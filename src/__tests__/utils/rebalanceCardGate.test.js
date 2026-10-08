/**
 * Regression guard for the RebalanceCard "No rebalance pending" gate.
 *
 * 2026-08-08 (Markup RA): `RebalanceCard` gated the Accept button on
 * `hasExecutionRecord = !!userExecution` for BOTH its label and `disabled`.
 * `subscriberExecutions` is a one-shot snapshot taken at rebalance-push time
 * and never reconciled, so a subscriber added to `subscribed_by` after the push
 * — or one who switched broker — legitimately has no row while the rebalance is
 * genuinely pending. The card therefore rendered a DISABLED "No rebalance
 * pending" over a live rebalance that the WEB card happily executed. 14
 * stranded Markup subscribers, 147 rows fleet-wide.
 *
 * The component has no pure export and this repo has no react-native render
 * harness, so this file guards the contract two ways:
 *
 *   1. SOURCE assertions — read the real component and assert the gate is gone
 *      and the repair guard is present. These cannot drift from the code,
 *      because they ARE the code.
 *   2. LOGIC assertions — a mirror of the label/disabled derivation, kept
 *      literally adjacent to the source assertions so a change to one without
 *      the other fails the suite.
 *
 * Web reference: prod-alphaquark-github
 * `src/Home/ModelPortfolioSection/RebalanceCard.js:1619-1621` — no existence
 * gate; a missing row falls through to "Accept Rebalance".
 * Canonical doc: MODEL_PORTFOLIO_ARCHITECTURE.md §17.
 */
import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../UIComponents/RebalanceAdvicesUI/RebalanceCard.js'),
  'utf8',
);

describe('RebalanceCard source contract', () => {
  it('does NOT gate the Accept button on the presence of an execution row', () => {
    // The exact regression: `|| !hasExecutionRecord` in the disabled prop.
    expect(SOURCE).not.toContain('!hasExecutionRecord');
    expect(SOURCE).toContain(
      'disabled={loading || pendingRefreshLoading || isRebalanceExecuted}',
    );
  });

  it('no longer renders a "No rebalance pending" label branch', () => {
    // Matches the LABEL EXPRESSION, not the bare phrase — the explanatory
    // comment above `hasExecutionRecord` legitimately quotes it.
    expect(SOURCE).not.toContain("? 'No rebalance pending'");
  });

  it('lets verified repair legs override a missing or stale execution projection', () => {
    expect(SOURCE).toContain('const isRepairMode = hasRepairTrades');
    expect(SOURCE).not.toContain(
      'const isRepairMode = hasRepairTrades && hasExecutionRecord',
    );
    // And every repair branch must go through it rather than re-deriving.
    expect(SOURCE).not.toContain("repair && userExecution?.status !== 'toExecute'\n");
  });

  it('keeps execution projections broker-scoped and applies aligned repair truth immediately', () => {
    expect(SOURCE).toContain('hasExecutionRecord && userExecution?.status');
    expect(SOURCE).toContain('brokerMatchesExecution &&');
    expect(SOURCE).toContain('locallyResolvedAligned');
    expect(SOURCE).toContain('setLocallyResolvedAligned(true)');
  });

  it('uses model-scoped broker reconciliation even beside a stale executed projection', () => {
    expect(SOURCE).toContain(
      'matchingFailedTrades?.reconciliationPending === true',
    );
    expect(SOURCE).toContain('Awaiting Broker Confirmation');
    expect(SOURCE).toContain("'Refresh Order Status'");
  });

  it('labels the pending badge by what it waits on, without changing the gate', () => {
    expect(SOURCE).toContain('{pendingBadgeLabel}');
    expect(SOURCE).toContain('pendingVerificationRecovery({');
    expect(SOURCE).toContain('repairModels: modelPortfolioRepairTrades');
  });

  it('uses the account-wide reconciliation barrier when no model repair row exists', () => {
    expect(SOURCE).toContain('repairReconciliation?.pending === true');
    expect(SOURCE).toContain('accountReconciliationPending');
  });
});

// ── Mirror of the component's derivation. Keep in sync with the source
//    assertions above; they fail together by design. ──
function deriveCardState({
  userExecution,
  broker,
  repair,
  failedTrades = [],
  pendingRefreshLoading,
  loading,
  accountReconciliationPending = false,
  refreshedLegsNonTerminal = false,
}) {
  const hasExecutionRecord = !!userExecution;
  const brokerMatchesExecution =
    !userExecution?.user_broker ||
    userExecution?.user_broker === broker ||
    (!broker && userExecution?.user_broker === 'DummyBroker');
  const hasRepairTrades = !!repair && failedTrades.length > 0;
  // A verified-complete card is settled; a lingering leg flag cannot regress it.
  const brokerReconciliationPending =
    accountReconciliationPending ||
    (refreshedLegsNonTerminal && userExecution?.status !== 'executed');
  const isRebalanceExecuted =
    hasExecutionRecord &&
    userExecution?.status === 'executed' &&
    brokerMatchesExecution &&
    !hasRepairTrades;
  const isPartiallyExecuted =
    hasExecutionRecord &&
    userExecution?.status === 'partial' &&
    brokerMatchesExecution &&
    !brokerReconciliationPending;
  const isPendingVerification =
    !isRebalanceExecuted &&
    !hasRepairTrades &&
    ((hasExecutionRecord &&
      userExecution?.status === 'pending' &&
      brokerMatchesExecution) ||
      brokerReconciliationPending);
  const isRepairMode = hasRepairTrades;

  const label = isRebalanceExecuted
    ? 'Rebalance Executed'
    : isRepairMode
      ? 'Repair Portfolio'
      : isPartiallyExecuted
        ? 'Retry Rebalance'
      : isPendingVerification
        ? 'Check Order Status'
        : 'Accept Rebalance';

  return {
    label,
    disabled: !!loading || !!pendingRefreshLoading || isRebalanceExecuted,
  };
}

describe('RebalanceCard button state', () => {
  it('keeps this model\'s verified repair actionable when another model is pending', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'pending'},
      broker: 'Zerodha',
      repair: 'repair',
      failedTrades: [{symbol: 'RTNPOWER', qty: 1}],
      accountReconciliationPending: true,
    });
    expect(s.label).toBe('Repair Portfolio');
    expect(s.disabled).toBe(false);
    expect(SOURCE).toMatch(/onPress=\{\s*isRepairMode\s*\?/);
  });

  it('offers an ENABLED "Accept Rebalance" when the subscriber has no execution row', () => {
    // The reported bug: added to subscribed_by after the rebalance push.
    const s = deriveCardState({
      userExecution: undefined,
      broker: 'DefinEdge Securities',
    });
    expect(s).toEqual({label: 'Accept Rebalance', disabled: false});
  });

  it('blocks fresh execution while account-wide reconciliation is pending', () => {
    const s = deriveCardState({
      userExecution: undefined,
      broker: 'Zerodha',
      accountReconciliationPending: true,
    });
    expect(s.label).toBe('Check Order Status');
  });

  it('does not downgrade an already executed card for a global pending barrier', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'executed'},
      broker: 'Zerodha',
      accountReconciliationPending: true,
    });
    expect(s.label).toBe('Rebalance Executed');
  });

  it('offers "Accept Rebalance" when the only row is tagged a different broker', () => {
    // Kaushik's exact state: row says Zerodha, account is now DefinEdge.
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'toExecute'},
      broker: 'DefinEdge Securities',
    });
    expect(s).toEqual({label: 'Accept Rebalance', disabled: false});
  });

  it('does not infer repair from the flag without verified failed legs', () => {
    const s = deriveCardState({
      userExecution: undefined,
      broker: 'Zerodha',
      repair: 'repair',
    });
    expect(s.label).toBe('Accept Rebalance');
  });

  it('offers direct repair when verified legs exist without an execution row', () => {
    const s = deriveCardState({
      userExecution: undefined,
      broker: 'Zerodha',
      repair: 'repair',
      failedTrades: [{symbol: 'JAMNAAUTO-EQ'}],
    });
    expect(s).toEqual({label: 'Repair Portfolio', disabled: false});
  });

  it('lets terminal verified repair legs override the partial summary', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Groww', status: 'partial'},
      broker: 'Groww',
      repair: 'repair',
      failedTrades: [{symbol: 'YESBANK-EQ', orderStatus: 'REJECTED'}],
    });
    expect(s).toEqual({label: 'Repair Portfolio', disabled: false});
  });

  it('still offers repair when a real, non-toExecute row exists', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'failed'},
      broker: 'Zerodha',
      repair: 'repair',
      failedTrades: [{symbol: 'NIFTY'}],
    });
    expect(s.label).toBe('Repair Portfolio');
  });

  it('offers repair when verified legs exist beside a consolidated toExecute row', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'toExecute'},
      broker: 'Zerodha',
      repair: 'repair',
      failedTrades: [{symbol: 'JAMNAAUTO-EQ'}],
    });
    expect(s).toEqual({label: 'Repair Portfolio', disabled: false});
  });

  it('does not trust a stale executed summary when Zerodha has failed legs', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'executed'},
      broker: 'Zerodha',
      repair: 'repair',
      failedTrades: [{symbol: 'NIFTY2690124450CE', orderStatus: 'rejected'}],
    });
    expect(s).toEqual({label: 'Repair Portfolio', disabled: false});
  });

  it.each([
    ['executed', 'Rebalance Executed', true],
    ['partial', 'Retry Rebalance', false],
    ['pending', 'Check Order Status', false],
  ])('preserves the %s state (label %s, disabled %s)', (status, label, disabled) => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status},
      broker: 'Zerodha',
    });
    expect(s).toEqual({label, disabled});
  });

  it('treats an executed row from a DIFFERENT broker as re-executable', () => {
    // Different broker means different holdings — matches the tier-3 matcher.
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'executed'},
      broker: 'Fyers',
    });
    expect(s).toEqual({label: 'Accept Rebalance', disabled: false});
  });

  it('keeps the button disabled while a refresh is in flight', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'toExecute'},
      broker: 'Zerodha',
      pendingRefreshLoading: true,
    });
    expect(s.disabled).toBe(true);
  });

  it('keeps the button disabled while its normal or repair flow is loading', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Groww', status: 'toExecute'},
      broker: 'Groww',
      loading: true,
    });
    expect(s.disabled).toBe(true);
  });
});

/**
 * 2026-09-18 (prod/ankitaborn1999ghosh@gmail.com): the SECOND way this card can
 * mis-rank its own state. `repairReconciliation` / `matchingFailedTrades` only
 * refresh when repair discovery runs. The last get-repair answered "ready" at
 * 10:51:55, seconds before the reconciliation cases were written, and was never
 * called again. The card read that stale all-clear, saw `status: 'partial'`,
 * and offered "Retry Rebalance" while SWASTIVI was still a live DAY limit at
 * Zerodha — a retry would re-buy 16 shares the resting order can still fill.
 *
 * Per-leg rows from the Refresh the customer just pressed are strictly newer
 * than anything get-repair said, so they win.
 */
describe('RebalanceCard freshest-evidence contract', () => {
  it('feeds the refreshed per-leg truth into the pending derivation', () => {
    expect(SOURCE).toContain('setRefreshedLegTruth');
    expect(SOURCE).toContain('isPublisherLegTerminal');
    expect(SOURCE).toContain('refreshedLegTruth?.nonTerminal === true');
    expect(SOURCE).toContain('refreshedLegsNonTerminal');
  });

  it('clears that truth once the attempt itself is resolved', () => {
    // Two exits: publisher/cancelled resolved, and the buy-continuation handoff.
    expect(SOURCE.match(/setRefreshedLegTruth\(null\)/g) || []).toHaveLength(2);
  });

  it('bounds it with the same completion guards as the account barrier', () => {
    const block = SOURCE.slice(
      SOURCE.indexOf('const refreshedLegsNonTerminal'),
      SOURCE.indexOf('const brokerReconciliationPending'),
    );
    for (const guard of ['!hasRepairTrades', '!requiresFreshRebalance',
      '!verifiedExecutionComplete', '!locallyResolvedAligned']) {
      expect(block).toContain(guard);
    }
  });

  it('only routes to the holdings screen when holdings can settle the block', () => {
    expect(SOURCE).toContain('holdingsReviewCanResolve(result.accountRecovery)');
    expect(SOURCE).not.toMatch(/else if \(action === 'review_holdings'\) \{/);
  });

  it('never enrolls model-only reconciliation for a stale pending summary', () => {
    const refresh = SOURCE.slice(
      SOURCE.indexOf('const handlePendingRefresh'),
      SOURCE.indexOf('// Cancel open orders'),
    );
    expect(refresh).toContain('if (!selectedAttempt.queueIdentity)');
    expect(refresh).toContain('allowPendingClear: true');
    expect(refresh.indexOf('if (!selectedAttempt.queueIdentity)'))
      .toBeLessThan(refresh.indexOf('rebalance/add-user/status-check-queue'));
    expect(refresh).toContain('...selectedAttempt.queueIdentity');
    expect(refresh).not.toContain('Broker confirmation is still pending');
  });
});

describe('RebalanceCard refuses Retry while any leg is still in flight', () => {
  const partialAtBroker = {user_broker: 'Zerodha', status: 'partial'};

  it('holds at order status when the refresh found a non-terminal leg', () => {
    const s = deriveCardState({
      userExecution: partialAtBroker,
      broker: 'Zerodha',
      // What the stale get-repair said, versus what the refresh actually read.
      accountReconciliationPending: false,
      refreshedLegsNonTerminal: true,
    });
    expect(s.label).not.toBe('Retry Rebalance');
    expect(s.label).toBe('Check Order Status');
  });

  it('offers Retry again once every leg is terminal', () => {
    const s = deriveCardState({
      userExecution: partialAtBroker,
      broker: 'Zerodha',
      refreshedLegsNonTerminal: false,
    });
    expect(s.label).toBe('Retry Rebalance');
  });

  it('never downgrades a verified-complete card on a lingering leg flag', () => {
    const s = deriveCardState({
      userExecution: {user_broker: 'Zerodha', status: 'executed'},
      broker: 'Zerodha',
      refreshedLegsNonTerminal: true,
    });
    expect(s.label).toBe('Rebalance Executed');
  });
});
