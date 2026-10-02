import {
  calculateCompletePositionsSummary,
  calculatePositionPnl,
} from '../../utils/positionPnl';

describe('position P&L', () => {
  test('calculates the live DefinEdge position shown in the report', () => {
    const position = {
      buyAmount: '618.45',
      buyAvgPrice: '618.45',
      buyQuantity: '1',
      netQuantity: '1',
      sellAmount: '0.00',
      sellAvgPrice: '0.00',
      sellQuantity: '0',
      symbol: 'ANANTRAJ-EQ',
    };

    const result = calculatePositionPnl(position, 616.25);
    expect(result).toMatchObject({
      capitalBasis: 618.45,
      isClosed: false,
    });
    expect(result.pnl).toBeCloseTo(-2.2, 8);
    expect(result.pnlPercentage).toBeCloseTo(-0.3557, 4);
  });

  test('aggregates open long and short positions', () => {
    const positions = [
      {
        symbol: 'LONG-EQ',
        buyQuantity: 10,
        sellQuantity: 0,
        netQuantity: 10,
        buyAvgPrice: 100,
        buyAmount: 1000,
        sellAmount: 0,
      },
      {
        symbol: 'SHORT-EQ',
        buyQuantity: 0,
        sellQuantity: 5,
        netQuantity: -5,
        sellAvgPrice: 200,
        buyAmount: 0,
        sellAmount: 1000,
      },
    ];
    const prices = {'LONG-EQ': 110, 'SHORT-EQ': 190};

    expect(
      calculateCompletePositionsSummary(
        positions,
        symbol => prices[symbol],
      ),
    ).toMatchObject({
      totalInvested: 2000,
      totalCurrent: 2150,
      totalReturns: 150,
      returnsPercentage: 7.5,
      positionCount: 2,
    });
  });

  test('includes realised and unrealised P&L for a partial close', () => {
    const position = {
      buyQuantity: 10,
      sellQuantity: 4,
      netQuantity: 6,
      buyAvgPrice: 100,
      sellAvgPrice: 120,
      buyAmount: 1000,
      sellAmount: 480,
    };

    const result = calculatePositionPnl(position, 110);
    expect(result).toMatchObject({
      pnl: 140,
      capitalBasis: 1000,
      isClosed: false,
    });
    expect(result.pnlPercentage).toBeCloseTo(14, 8);
  });

  test('calculates a closed position without requiring a live quote', () => {
    const position = {
      buyQuantity: 2,
      sellQuantity: 2,
      netQuantity: 0,
      buyAvgPrice: 100,
      sellAvgPrice: 110,
      buyAmount: 200,
      sellAmount: 220,
    };

    expect(calculatePositionPnl(position)).toMatchObject({
      pnl: 20,
      capitalBasis: 200,
      pnlPercentage: 10,
      isClosed: true,
    });
  });

  test('supports common alias fields used by broker adapters', () => {
    expect(
      calculatePositionPnl(
        {
          qty: 3,
          averagePrice: 50,
          lastPrice: 55,
          realizedPnl: 0,
          unrealizedPnl: 15,
        },
      ),
    ).toMatchObject({
      pnl: 15,
      capitalBasis: 150,
      pnlPercentage: 10,
    });
  });

  test('does not report a false zero while an open quote is missing', () => {
    const positions = [
      {
        symbol: 'WAITING-EQ',
        buyQuantity: 1,
        sellQuantity: 0,
        netQuantity: 1,
        buyAvgPrice: 100,
        buyAmount: 100,
        sellAmount: 0,
      },
    ];

    expect(calculateCompletePositionsSummary(positions, () => null)).toBeNull();
  });
});
