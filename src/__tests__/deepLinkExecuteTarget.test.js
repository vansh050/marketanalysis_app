/**
 * Execute deep links (WhatsApp / Telegram → card), 2026-10-10.
 * Unit tests for utils/deepLinkExecuteTarget.js + contract pins for the
 * HomeScreen consumer and the three card listeners.
 */
import fs from 'fs';
import path from 'path';

import eventEmitter from '../components/EventEmitter';
import {
  ANNOUNCE_DELAYS_MS,
  DEEP_LINK_EXECUTE_EVENT,
  claimDeepLinkExecuteTarget,
  clearDeepLinkExecuteTarget,
  getDeepLinkExecuteTarget,
  startDeepLinkExecuteTarget,
  targetMatchesAdviceRow,
  targetMatchesModel,
} from '../utils/deepLinkExecuteTarget';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('deepLinkExecuteTarget', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearDeepLinkExecuteTarget();
    eventEmitter.removeAllListeners(DEEP_LINK_EXECUTE_EVENT);
  });
  afterEach(() => {
    clearDeepLinkExecuteTarget();
    eventEmitter.removeAllListeners(DEEP_LINK_EXECUTE_EVENT);
    jest.useRealTimers();
  });

  test('ignores surfaces it does not route', () => {
    expect(startDeepLinkExecuteTarget({surface: 'broker_reauth'})).toBe(false);
    expect(getDeepLinkExecuteTarget()).toBeNull();
  });

  test('rebalance target matches the model name loosely, never an advice row', () => {
    startDeepLinkExecuteTarget({surface: 'rebalance_execute', model_name: 'Value_Momentum', unique_id: 'u1'});
    const target = getDeepLinkExecuteTarget();
    expect(target.adviceRecoId).toBeNull();
    expect(targetMatchesModel(target, 'value momentum')).toBe(true);
    expect(targetMatchesModel(target, 'Other')).toBe(false);
    expect(targetMatchesAdviceRow(target, {advice_reco_id: 'u1'}, 'trade_execute')).toBe(false);
  });

  test('trade target matches rows by advice_reco_id and surface', () => {
    startDeepLinkExecuteTarget({surface: 'trade_execute', model_name: 'Stock', unique_id: 'adv-9'});
    const target = getDeepLinkExecuteTarget();
    expect(targetMatchesAdviceRow(target, {advice_reco_id: 'adv-9'}, 'trade_execute')).toBe(true);
    expect(targetMatchesAdviceRow(target, {adviceRecoId: 'adv-9'}, 'trade_execute')).toBe(true);
    expect(targetMatchesAdviceRow(target, {advice_reco_id: 'adv-8'}, 'trade_execute')).toBe(false);
    expect(targetMatchesAdviceRow(target, {advice_reco_id: 'adv-9'}, 'basket_execute')).toBe(false);
    expect(targetMatchesModel(target, 'Stock')).toBe(false);
  });

  test('a target is claimed exactly once', () => {
    startDeepLinkExecuteTarget({surface: 'basket_execute', unique_id: 'b1'});
    const target = getDeepLinkExecuteTarget();
    expect(claimDeepLinkExecuteTarget(t => t.adviceRecoId === 'nope')).toBeNull();
    expect(claimDeepLinkExecuteTarget(t => t === target)).toBe(target);
    expect(claimDeepLinkExecuteTarget(() => true)).toBeNull();
  });

  test('re-announces until a ready card claims, then stops', () => {
    const seen = [];
    let ready = false;
    eventEmitter.on(DEEP_LINK_EXECUTE_EVENT, target => {
      seen.push(target);
      if (ready) claimDeepLinkExecuteTarget(t => t === target);
    });
    const onUnclaimed = jest.fn();
    startDeepLinkExecuteTarget({surface: 'trade_execute', unique_id: 'a'}, {onUnclaimed});
    jest.advanceTimersByTime(ANNOUNCE_DELAYS_MS[1]);
    expect(seen).toHaveLength(2);
    ready = true;
    jest.advanceTimersByTime(ANNOUNCE_DELAYS_MS[2] - ANNOUNCE_DELAYS_MS[1]);
    expect(seen).toHaveLength(3);
    jest.advanceTimersByTime(60000);
    expect(seen).toHaveLength(3);
    expect(onUnclaimed).not.toHaveBeenCalled();
    expect(getDeepLinkExecuteTarget()).toBeNull();
  });

  test('unclaimed target is cleared and reported, so it can never open later', () => {
    const onUnclaimed = jest.fn();
    startDeepLinkExecuteTarget({surface: 'trade_execute', unique_id: 'gone'}, {onUnclaimed});
    jest.advanceTimersByTime(ANNOUNCE_DELAYS_MS[ANNOUNCE_DELAYS_MS.length - 1] + 600);
    expect(onUnclaimed).toHaveBeenCalledTimes(1);
    expect(getDeepLinkExecuteTarget()).toBeNull();
  });

  test('a newer link replaces an older pending one', () => {
    const onFirst = jest.fn();
    startDeepLinkExecuteTarget({surface: 'trade_execute', unique_id: 'old'}, {onUnclaimed: onFirst});
    startDeepLinkExecuteTarget({surface: 'trade_execute', unique_id: 'new'});
    expect(getDeepLinkExecuteTarget().adviceRecoId).toBe('new');
    jest.advanceTimersByTime(60000);
    expect(onFirst).not.toHaveBeenCalled();
  });
});

describe('execute deep-link wiring contract', () => {
  const home = read('src/screens/Home/HomeScreen.js');
  const smartLink = read('src/utils/smartLink.js');
  const rebalanceCard = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
  const stockAdvices = read('src/components/AdviceScreenComponents/StockAdvices.js');
  const basketCard = read('src/UIComponents/StockAdvicesUI/BasketCard.js');

  test('links land on Home and hand off to the cards, not the notification list', () => {
    expect(home).not.toContain("navigation.navigate('PushNotificationScreen', {");
    expect(home).toContain('startDeepLinkExecuteTarget(resolved');
    expect(home).toContain('eventEmitter.on(PENDING_DEEPLINK_EVENT, consumePendingDeepLink)');
    // signed-out tap: token stashed, resolved after sign-in
    expect(home).toContain('await resolveFunctionalDeepLink(parsed.token)');
    expect(smartLink).toContain('eventEmitter.emit(PENDING_DEEPLINK_EVENT)');
    expect(smartLink).toContain('deepLinkResolveErrorMessage');
  });

  test('every card claims through the shared once-only claim and reuses its own button handler', () => {
    expect(rebalanceCard).toContain('eventEmitter.on(DEEP_LINK_EXECUTE_EVENT, handleDeepLinkTarget)');
    expect(rebalanceCard).toContain('if (isDatafetchinRepair || loading || actionOpeningRef.current) return;');
    expect(rebalanceCard).toContain('runAcceptRebalanceButton();');
    expect(stockAdvices).toContain("if (type !== 'home' && type !== 'All') return undefined;");
    expect(stockAdvices).toContain("await handleSingleSelectStock(rows[0].Symbol, rows[0].tradeId, 'add');");
    expect(basketCard).toContain('handleTradeNowBasket();');
    for (const source of [rebalanceCard, stockAdvices, basketCard]) {
      expect(source).toContain('claimDeepLinkExecuteTarget(t => t === target)');
    }
  });
});

describe('hidden-email Apple users confirm their email instead of a dead end', () => {
  const {needsEmailVerificationForLink} = require('../utils/deepLinkExecuteTarget');

  test('no email in the token → verify', () => {
    expect(needsEmailVerificationForLink('no_identity', null)).toBe(true);
  });

  test('relay or empty email mismatch → verify; a real other email → never', () => {
    expect(needsEmailVerificationForLink('identity_mismatch', 'abc@privaterelay.appleid.com')).toBe(true);
    expect(needsEmailVerificationForLink('identity_mismatch', '')).toBe(true);
    expect(needsEmailVerificationForLink('identity_mismatch', 'someone@gmail.com')).toBe(false);
  });

  test('other failures never prompt', () => {
    for (const e of ['token_expired', 'already_used', 'token_not_found', 'network_error']) {
      expect(needsEmailVerificationForLink(e, null)).toBe(false);
    }
  });

  test('Home keeps the link, opens the OTP screen, retries once', () => {
    const home = read('src/screens/Home/HomeScreen.js');
    expect(home).toContain("navigation.navigate('EmailScreenAppleLogin', {");
    expect(home).toContain('!parsed.emailVerifyAttempted &&');
    expect(home).toContain('JSON.stringify({token: parsed.token, resolved: null, emailVerifyAttempted: true})');
    expect(home).toContain('if (verifiedEmail) eventEmitter.emit(PENDING_DEEPLINK_EVENT);');
  });
});
