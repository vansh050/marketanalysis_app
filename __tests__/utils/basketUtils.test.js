import {
  isRetiredEntryLeg,
  hasClosureContext,
  collapseRetiredEntries,
  netBasketTrades,
} from '../../src/utils/basketUtils';

describe('isRetiredEntryLeg', () => {
  test('true for a retired manual-entry leg with no fill fields', () => {
    expect(isRetiredEntryLeg({
      manual_entry_completed_externally: true,
      trade_place_status: 'COMPLETE',
    })).toBe(true);
  });

  test('false for a retired leg that holds its own explicit fill', () => {
    expect(isRetiredEntryLeg({
      manual_entry_completed_externally: true,
      tradedQty: 1,
      trade_place_status: 'COMPLETE',
    })).toBe(false);
  });

  test('false for legs without the retirement flag', () => {
    expect(isRetiredEntryLeg({trade_place_status: 'COMPLETE', Quantity: 1})).toBe(false);
    expect(isRetiredEntryLeg({manual_entry: true, tradedQty: 3})).toBe(false);
  });
});

describe('hasClosureContext', () => {
  test('true for closurestatus and EXIT purpose', () => {
    expect(hasClosureContext({closurestatus: 'fullClose'})).toBe(true);
    expect(hasClosureContext({closurestatus: 'pending'})).toBe(true);
    expect(hasClosureContext({purpose: 'EXIT'})).toBe(true);
    expect(hasClosureContext({purpose: 'exit'})).toBe(true);
  });

  test('false when only the feed projection flag/toTradeQty are present', () => {
    expect(hasClosureContext({isClosure: true, toTradeQty: -3})).toBe(false);
    expect(hasClosureContext({closurestatus: ''})).toBe(false);
    expect(hasClosureContext({})).toBe(false);
  });
});

describe('collapseRetiredEntries', () => {
  test('drops retired no-fill advice legs, keeps manual_entry legs', () => {
    const retired = {Symbol: 'FUT', manual_entry_completed_externally: true, trade_place_status: 'COMPLETE'};
    const manual = {Symbol: 'FUT', manual_entry: true, tradedQty: 3, trade_place_status: 'COMPLETE'};
    expect(collapseRetiredEntries([retired, manual])).toEqual([manual]);
  });
});

describe('netBasketTrades (mobile port)', () => {
  test('renders a recorded entry-only basket as entries only — no projection closure rows', () => {
    // SSD-BAJFINANCE shape (2026-08-21): 2-symbol pair, 1 lot advised each,
    // both recorded externally as 3-lot fills. Feed carries toTradeQty=-3 +
    // closure:true per symbol from the POSITION_OPEN projection but NO
    // closure instruction — the card must show the 2 entries, not 4 rows.
    const trades = [
      {Symbol: 'BAJFINANCE26AUGFUT', Type: 'BUY', Quantity: 1, trade_place_status: 'COMPLETE', manual_entry_completed_externally: true, toTradeQty: -3, isClosure: true},
      {Symbol: 'BAJFINANCE26AUGFUT', Type: 'BUY', Quantity: 3, tradedQty: 3, trade_place_status: 'COMPLETE', manual_entry: true, toTradeQty: -3, isClosure: true},
      {Symbol: 'BAJFINANCE25AUG261760PE', Type: 'BUY', Quantity: 1, trade_place_status: 'COMPLETE', manual_entry_completed_externally: true, toTradeQty: -3, isClosure: true},
      {Symbol: 'BAJFINANCE25AUG261760PE', Type: 'BUY', Quantity: 3, tradedQty: 3, trade_place_status: 'COMPLETE', manual_entry: true, toTradeQty: -3, isClosure: true},
    ];

    const result = netBasketTrades(trades);

    expect(result).toHaveLength(2);
    expect(result.filter((t) => t.Type === 'SELL')).toHaveLength(0);
    expect(result.some((t) => t.manual_entry_completed_externally === true)).toBe(false);
    result.forEach((t) => {
      expect(t.manual_entry).toBe(true);
      expect(t.Quantity).toBe(3);
    });
  });

  test('still consolidates closure rows when a leg carries real closure context', () => {
    const trades = [
      {Symbol: 'RELIANCE', Type: 'BUY', Quantity: 10, trade_place_status: 'executed', toTradeQty: -5, closurestatus: 'pending'},
    ];
    const result = netBasketTrades(trades);
    const sell = result.find((t) => t.Type === 'SELL');
    expect(sell).toBeTruthy();
    expect(sell.Quantity).toBe(5);
  });

  test('keeps a retired leg that holds its own explicit fill visible', () => {
    const trades = [
      {Symbol: 'FUT', Type: 'BUY', Quantity: 1, tradedQty: 1, trade_place_status: 'COMPLETE', manual_entry_completed_externally: true, toTradeQty: -4, isClosure: true},
      {Symbol: 'FUT', Type: 'BUY', Quantity: 3, tradedQty: 3, trade_place_status: 'COMPLETE', manual_entry: true, toTradeQty: -4, isClosure: true},
    ];
    const result = netBasketTrades(trades);
    expect(result.some((t) => t.manual_entry_completed_externally === true)).toBe(true);
    expect(result.filter((t) => t.Type === 'SELL')).toHaveLength(0);
  });
});
