/**
 * deepLinkExecuteTarget — hands a resolved WhatsApp / Telegram execute link to
 * the card that can act on it (mobile deep-link Phase 2, 2026-10-10).
 *
 * Flow: `smartLink.js` resolves `/l/<tenant>?t=<token>` → HomeScreen calls
 * `startDeepLinkExecuteTarget(resolved)` → this module re-announces the target
 * on `DEEP_LINK_EXECUTE_EVENT` a few times while Home's cards mount and load →
 * the first matching card that is READY calls `claimDeepLinkExecuteTarget()`
 * and runs exactly what its own Accept / Trade button runs (so every broker,
 * funds, sell-auth and review gate still applies, and the customer still
 * confirms in the normal review). Nothing here places an order.
 *
 * Surfaces (from Node `POST /api/deep-link/resolve`):
 *   rebalance / rebalance_execute → RebalanceCard matching `model_name`
 *   trade_execute                 → StockAdvices rows with `advice_reco_id === unique_id`
 *   basket_execute                → BasketCard whose legs carry that `advice_reco_id`
 *
 * If no card claims the target before the last announcement, `onUnclaimed`
 * runs (HomeScreen shows "no longer pending") and the target is cleared, so a
 * stale link can never auto-open a card later.
 *
 * Doc: docs/APP_ARCHITECTURE.md § "Execute deep links (WhatsApp/Telegram → card)".
 */
import eventEmitter from '../components/EventEmitter';

export const DEEP_LINK_EXECUTE_EVENT = 'deepLinkExecuteTarget';

// Cards mount immediately, but their data (trades, repair legs, basket entry
// authorization) arrives over the next few seconds. Re-announce until then.
export const ANNOUNCE_DELAYS_MS = [800, 2000, 4000, 7000, 11000, 16000];

const REBALANCE_SURFACES = new Set(['rebalance', 'rebalance_execute']);
const SUPPORTED_SURFACES = new Set([
  ...REBALANCE_SURFACES,
  'trade_execute',
  'basket_execute',
]);

let pending = null;
let timers = [];

const normalizeName = value =>
  String(value ?? '').replace(/_/g, ' ').trim().toLowerCase();

const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

export const isRebalanceSurface = surface => REBALANCE_SURFACES.has(surface);

export function isSupportedExecuteSurface(surface) {
  return SUPPORTED_SURFACES.has(String(surface || ''));
}

/** Pure: does this target point at the given model? */
export function targetMatchesModel(target, modelName) {
  if (!target || !isRebalanceSurface(target.surface)) return false;
  const want = normalizeName(target.modelName);
  return Boolean(want) && want === normalizeName(modelName);
}

/** Pure: does this target point at a row/leg carrying this advice id? */
export function targetMatchesAdviceRow(target, row, surface) {
  if (!target || target.surface !== surface || !row) return false;
  const id = String(target.adviceRecoId || '');
  return Boolean(id) && String(row.advice_reco_id || row.adviceRecoId || '') === id;
}

export function getDeepLinkExecuteTarget() {
  return pending;
}

/**
 * Claim the pending target if `predicate(target)` is true. Returns the target
 * (and clears it) exactly once; every later caller gets null.
 */
export function claimDeepLinkExecuteTarget(predicate) {
  const target = pending;
  if (!target) return null;
  if (typeof predicate === 'function' && !predicate(target)) return null;
  pending = null;
  clearTimers();
  return target;
}

export function clearDeepLinkExecuteTarget() {
  pending = null;
  clearTimers();
}

/**
 * Start announcing a resolved deep link. Returns false (and does nothing) for
 * surfaces this module does not route, e.g. `broker_reauth`.
 */
export function startDeepLinkExecuteTarget(resolved, {onUnclaimed} = {}) {
  const surface = String(resolved?.surface || '');
  if (!isSupportedExecuteSurface(surface)) return false;
  clearDeepLinkExecuteTarget();
  const target = {
    surface,
    modelName: resolved?.model_name || null,
    // trade/basket: unique_id IS the advice_reco_id (ccxt advice/send/reco.py).
    adviceRecoId: isRebalanceSurface(surface) ? null : resolved?.unique_id || null,
    uniqueId: resolved?.unique_id || null,
    startedAt: Date.now(),
  };
  pending = target;
  ANNOUNCE_DELAYS_MS.forEach((delay, index) => {
    timers.push(
      setTimeout(() => {
        if (pending !== target) return;
        eventEmitter.emit(DEEP_LINK_EXECUTE_EVENT, target);
        if (index === ANNOUNCE_DELAYS_MS.length - 1 && pending === target) {
          // Give the final announcement's listeners a tick to claim.
          setTimeout(() => {
            if (pending !== target) return;
            clearDeepLinkExecuteTarget();
            onUnclaimed?.(target);
          }, 500);
        }
      }, delay),
    );
  });
  return true;
}

/**
 * Should a failed resolve send the customer through email verification?
 * The server matches the Firebase ID-token EMAIL against the customer the link
 * was sent to. Apple "Hide My Email" users have no email (`no_identity`) or a
 * private-relay email (`identity_mismatch`) in their token, while their account
 * is keyed by the address they typed. Confirming that address with the
 * existing one-time code (EmailScreenAppleLogin → /api/auth/apple/verify-email-otp)
 * writes it onto their Firebase user, after which the link matches. Never for a
 * mismatch with a REAL email — that is a genuinely different account.
 */
export function needsEmailVerificationForLink(error, firebaseEmail) {
  if (error === 'no_identity') return true;
  if (error !== 'identity_mismatch') return false;
  const email = String(firebaseEmail || '').trim();
  return !email || /@privaterelay\.appleid\.com$/i.test(email);
}
