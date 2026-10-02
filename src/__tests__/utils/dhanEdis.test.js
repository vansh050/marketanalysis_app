import {
  getDhanSellTrades,
  isDhanSellAuthorizationReady,
} from '../../utils/dhanEdis';

describe('Dhan EDIS selection', () => {
  const status = {
    data: [
      {symbol: 'NHPC', exchange: 'NSE', isin: 'INE848E01016', aprvdQty: '17', edis: true},
      {symbol: 'UNRELATED', exchange: 'NSE', isin: 'INE000000002', aprvdQty: '0', edis: false},
    ],
  };

  test('checks only selected sell holdings, not every holding in the account', () => {
    expect(
      isDhanSellAuthorizationReady(status, [
        {Symbol: 'NHPC-EQ', Exchange: 'NSE', Type: 'SELL', Quantity: 17},
        {Symbol: 'PATELENG', Exchange: 'NSE', Type: 'BUY', Quantity: 1},
      ]),
    ).toBe(true);
  });

  test('requires enough approved quantity for each selected sell', () => {
    expect(
      isDhanSellAuthorizationReady(status, [
        {symbol: 'NHPC', exchange: 'NSE', transactionType: 'SELL', quantity: 18},
      ]),
    ).toBe(false);
  });

  test('aggregates duplicate sell legs before comparing approved quantity', () => {
    expect(
      isDhanSellAuthorizationReady(status, [
        {symbol: 'NHPC', exchange: 'NSE', transactionType: 'SELL', quantity: 9},
        {symbol: 'NHPC-EQ', exchange: 'NSE', transactionType: 'SELL', quantity: 9},
      ]),
    ).toBe(false);
  });

  test('fails closed when a selected sell is absent or status has no data', () => {
    expect(
      isDhanSellAuthorizationReady(status, [
        {symbol: 'MISSING', exchange: 'NSE', transactionType: 'SELL', quantity: 1},
      ]),
    ).toBe(false);
    expect(isDhanSellAuthorizationReady({data: []}, [{Type: 'SELL', Symbol: 'NHPC'}])).toBe(false);
  });

  test('collects sell trades from array and single-trade shapes', () => {
    expect(
      getDhanSellTrades(
        [{Type: 'BUY', Symbol: 'A'}, {Type: 'SELL', Symbol: 'B'}],
        {type: 'SELL', symbol: 'C'},
      ).map(trade => trade.Symbol || trade.symbol),
    ).toEqual(['B', 'C']);
  });
});
