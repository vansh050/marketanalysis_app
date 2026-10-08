import {
  pendingVerificationBadgeLabel,
  pendingVerificationRecovery,
} from '../../utils/accountRecoveryUx';

// Shape of the real get-repair model row (moneyman testaccount / Dhan,
// 2026-10-08): reconciling, blocked on ownership, and WITHOUT a modelId.
const dhanOwnershipRow = {
  modelName: 'test plan',
  reconciliationPending: true,
  repairStatus: 'reconciling',
  accountRecovery: {
    blocked: true,
    state: 'ownership_conflict',
    reason: 'broker_attribution_ambiguous',
    staleDays: 6,
    nextAction: {code: 'review_holdings'},
  },
};

describe('pendingVerificationBadgeLabel', () => {
  it('keeps the broker wording when nothing more specific is known', () => {
    expect(pendingVerificationBadgeLabel(null)).toBe('Awaiting Broker Confirmation');
    expect(pendingVerificationBadgeLabel({blocked: false, state: 'ready'}))
      .toBe('Awaiting Broker Confirmation');
  });

  it('keeps the broker wording while broker orders are genuinely unresolved', () => {
    expect(pendingVerificationBadgeLabel({
      blocked: true, state: 'orders_unresolved', reason: 'execution_not_terminal',
    })).toBe('Awaiting Broker Confirmation');
  });

  it('names an ownership conflict instead of blaming the broker', () => {
    expect(pendingVerificationBadgeLabel({
      blocked: true, state: 'ownership_conflict', reason: 'broker_attribution_ambiguous',
    })).toBe('Portfolio holdings need review');
  });

  it('says support is needed once the blocker is stale', () => {
    expect(pendingVerificationBadgeLabel(dhanOwnershipRow.accountRecovery))
      .toBe('Verification needs support');
  });
});

describe('pendingVerificationRecovery', () => {
  it('finds the same-name row when get-repair omitted modelId', () => {
    expect(pendingVerificationRecovery({
      repairModels: [dhanOwnershipRow],
      modelId: '6abe21ded81a5f6f43ed0cde',
      modelName: 'test_plan',
      accountRecovery: {blocked: false, state: 'ready'},
    })).toBe(dhanOwnershipRow.accountRecovery);
  });

  it('never borrows another model row', () => {
    expect(pendingVerificationRecovery({
      repairModels: [dhanOwnershipRow],
      modelName: 'other plan',
    })).toBeNull();
    expect(pendingVerificationRecovery({
      repairModels: [{...dhanOwnershipRow, modelId: 'other-id'}],
      modelId: 'this-id',
      modelName: 'test plan',
    })).toBeNull();
  });

  it('prefers the id-matched row, then the account-level blocker', () => {
    const matched = {blocked: true, state: 'orders_unresolved'};
    expect(pendingVerificationRecovery({
      matchingFailedTrades: {accountRecovery: matched},
      repairModels: [dhanOwnershipRow],
      modelName: 'test plan',
    })).toBe(matched);
    const account = {blocked: true, state: 'ownership_conflict'};
    expect(pendingVerificationRecovery({repairModels: [], accountRecovery: account}))
      .toBe(account);
  });
});
