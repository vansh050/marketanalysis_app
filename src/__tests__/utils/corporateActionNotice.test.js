import {
  corporateActionMessage,
  getRecentCorporateActionNotices,
} from '../../utils/corporateActionNotice';

describe('corporate-action customer notices', () => {
  test('aggregates a recent bonus and explains temporary P&L', () => {
    const notices = getRecentCorporateActionNotices([
      {symbol: 'PGIL-EQ', quantity: '16', corp_action_orig_qty: 8, corp_action_action_id: 'CA_PGIL_BONUS_20260911'},
      {symbol: 'PGIL', quantity: 6, corp_action_orig_qty: 3, corp_action_action_id: 'CA_PGIL_BONUS_20260911'},
    ], {now: new Date('2026-09-11T10:00:00+05:30')});
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({symbol: 'PGIL', adjustedQuantity: 22, addedQuantity: 11});
    expect(corporateActionMessage(notices[0], 11)).toContain('not a market loss');
  });

  test('drops notices after the settlement ceiling', () => {
    expect(getRecentCorporateActionNotices([
      {symbol: 'OLD', quantity: 20, corp_action_orig_qty: 10, corp_action_action_id: 'CA_OLD_SPLIT_20260801'},
    ], {now: new Date('2026-09-11T10:00:00+05:30')})).toEqual([]);
  });
});
