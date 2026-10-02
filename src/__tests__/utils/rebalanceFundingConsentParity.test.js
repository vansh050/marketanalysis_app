import fs from 'fs';
import path from 'path';

import {canExecuteRebalance} from '../../utils/rebalanceContract';

const readSource = relativePath =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('model portfolio funding-consent parity', () => {
  test('a funding decision is never executable', () => {
    expect(canExecuteRebalance({
      rebalanceContract: {
        schemaVersion: 1,
        plan: {legs: []},
        funding: {classification: 'NEEDS_TOP_UP'},
        customerAction: {code: 'MODIFY_INVESTMENT', blocking: true},
        fundingConsent: {required: true},
      },
    })).toBe(false);
  });

  test('the three-step review renders both choices and guards every broker path', () => {
    const source = readSource(
      '../../components/AdviceScreenComponents/RebalanceModal.js',
    );
    expect(source).not.toContain('rebalance/reduce-to-funded');
    expect(source).toContain('availableFundsOptions()');
    expect(source).toContain('insufficientFundsAttemptOptions()');
    expect(source).toContain('Review stocks and attempt buy');
    expect(source).not.toContain('Update total investment to ₹');
    expect(source).not.toContain('explicitly update your total investment');
    expect(source).toContain("I've added funds — Retry");
    expect(source).toContain('if (!isRepairMode && !ensureRebalanceExecutable())');
    expect(source).toContain("'Add funds instead'");
    expect(source).toContain('Closing this screen makes no change.');
  });

  test('calculation hands funding choices to step three and retry forces broker truth', () => {
    const parent = readSource(
      '../../components/AdviceScreenComponents/RebalanceAdvices.js',
    );
    expect(parent).toContain(
      'decision?.customerAction?.blocking && !decision?.fundingConsent?.required',
    );
    expect(parent).toContain(
      'recalculateRebalance={(options = {}) => handleAcceptRebalance({...options, forceRefresh: true, directReview: true})}',
    );
    expect(parent).toContain('{forceRefresh: true}');
  });

  test('legacy detail and Publisher paths use the same funding guard', () => {
    const modal = readSource(
      '../../components/ModelPortfolioComponents/MPReviewTradeModal.js',
    );
    const performance = readSource('../../screens/Drawer/MPPerformanceScreen.js');
    const zerodhaStart = modal.indexOf('const handleZerodhaRedirect = async () => {');
    const zerodhaGuard = modal.indexOf('if (!ensureRebalanceExecutable())', zerodhaStart);
    expect(zerodhaStart).toBeGreaterThan(-1);
    expect(zerodhaGuard).toBeGreaterThan(zerodhaStart);
    expect(zerodhaGuard - zerodhaStart).toBeLessThan(200);
    expect(modal).toContain("I've added funds — Retry");
    expect(modal).toContain('insufficientFundsAttemptOptions()');
    expect(modal).toContain('Review stocks and attempt buy');
    expect(performance).toContain("options?.forceRefresh ? '0'");
    expect(performance).toContain('{forceRefresh: true}');
  });

  test('the navigation review also offers both durable choices', () => {
    const controller = readSource('../../screens/Rebalance/RebalanceReviewScreen.js');
    const presentation = readSource('../../../designs/default/screens/RebalanceReviewScreen.js');
    expect(controller).not.toContain('rebalance/reduce-to-funded');
    expect(controller).toContain('availableFundsOptions()');
    expect(controller).toContain('insufficientFundsAttemptOptions()');
    expect(presentation).toContain('Review stocks and attempt buy');
    expect(presentation).toContain('Add funds instead');
    expect(presentation).toContain('Going back makes no change.');
    expect(controller).toContain('!decision?.fundingConsent?.required');
  });

  test('every funding continuation only recalculates', () => {
    const callSites = [
      '../../screens/Rebalance/RebalanceReviewScreen.js',
      '../../components/AdviceScreenComponents/RebalanceModal.js',
      '../../components/ModelPortfolioComponents/MPReviewTradeModal.js',
    ];
    callSites.forEach(relativePath => {
      const source = readSource(relativePath);
      expect(source).not.toContain('rebalance/reduce-to-funded');
      expect(source).toContain('availableFundsOptions()');
      expect(source).toContain('insufficientFundsAttemptOptions()');
      const presentation = relativePath.includes('RebalanceReviewScreen')
        ? readSource('../../../designs/default/screens/RebalanceReviewScreen.js')
        : source;
      expect(presentation).toContain('Continue with available funds');
      expect(presentation).toContain('Review stocks and attempt buy');
    });
  });
});
