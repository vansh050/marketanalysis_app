import {fundPendingEntry, summarizeFundingPendingLegs} from '../../utils/fundPendingGap';

describe('FUNDING_PENDING legs (Phase 2, 2026-09-20)', () => {
  it('sums the recorded amount of funding-pending BUY legs only', () => {
    const rows = [
      {symbol: 'WABAG-EQ', orderType: 'BUY', qty: 6, isFundingPending: true, fundingRequired: 12865.8},
      {symbol: 'TATVA-EQ', orderType: 'BUY', qty: 14, isFundingPending: true, frozenPrice: 100},
      {symbol: 'REAL', orderType: 'BUY', qty: 2, classification: 'FROZEN_REPAIR_RESIDUAL'},
      {symbol: 'OLD', orderType: 'SELL', qty: 5, isFundingPending: true},
    ];
    const out = summarizeFundingPendingLegs(rows, () => 0);
    expect(out.count).toBe(2);
    expect(out.total).toBe(12865.8 + 1400);
  });

  it('builds a fund_pending instruction on top of the current base', () => {
    const entry = fundPendingEntry({
      preview: {status: 0, baseInvestmentAmount: 3718471},
      gapAmount: 12865.8,
      dateTime: '2026-09-20T10:00:00.000Z',
    });
    expect(entry.changeMode).toBe('fund_pending');
    expect(entry.changeAmount).toBe(12866);
    expect(entry.amount).toBe(3718471 + 12866);
  });

  it('refuses when the base cannot be read', () => {
    expect(() => fundPendingEntry({preview: {status: 1}, gapAmount: 100, dateTime: 'x'})).toThrow();
  });
});
