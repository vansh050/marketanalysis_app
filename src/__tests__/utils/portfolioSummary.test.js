import {
  buildPriceInstruments,
  calculateCompleteHoldingsSummary,
  getBrokerHoldingRows,
} from '../../utils/portfolioSummary';

describe('portfolioSummary', () => {
  test('reads the broker holding response shape used by TradeContext', () => {
    const rows = [{symbol: 'SBIN', quantity: 2}];
    expect(getBrokerHoldingRows({status: 0, holding: rows})).toBe(rows);
    expect(getBrokerHoldingRows({data: {holding: rows}})).toBe(rows);
    expect(getBrokerHoldingRows(rows)).toBe(rows);
  });

  test('subscribes broker and model-portfolio symbols without duplicates', () => {
    expect(
      buildPriceInstruments(
        {holding: [{symbol: 'SBIN', exchange: 'NSE'}]},
        [
          {symbol: 'SBIN', exchange: 'NSE'},
          {symbol: 'TCS', exchange: 'NSE'},
        ],
      ),
    ).toEqual([
      {symbol: 'SBIN', exchange: 'NSE'},
      {symbol: 'TCS', exchange: 'NSE'},
    ]);
  });

  test('does not calculate a false loss while one quote is missing', () => {
    const rows = {
      holding: [
        {symbol: 'SBIN', quantity: 2, avgPrice: 100},
        {symbol: 'TCS', quantity: 1, avgPrice: 200},
      ],
    };
    const getLTP = symbol => (symbol === 'SBIN' ? 110 : 0);

    expect(calculateCompleteHoldingsSummary(rows, getLTP)).toBeNull();
  });

  test('uses broker LTP as fallback and calculates only a complete set', () => {
    const rows = {
      holding: [
        {symbol: 'SBIN', quantity: 2, avgPrice: 100, ltp: 108},
        {symbol: 'TCS', quantity: 1, avgPrice: 200, ltp: 205},
      ],
    };
    const getLTP = symbol => (symbol === 'SBIN' ? 110 : 0);

    expect(calculateCompleteHoldingsSummary(rows, getLTP)).toEqual({
      totalInvested: 400,
      totalCurrent: 425,
      totalReturns: 25,
      returnsPercentage: 6.25,
    });
  });
});
