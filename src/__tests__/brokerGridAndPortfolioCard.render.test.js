const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = TestRenderer;
const fs = require('fs');
const path = require('path');

jest.mock('react-native-linear-gradient', () => {
  const R = require('react');
  const {View} = require('react-native');
  return ({children, ...rest}) => R.createElement(View, rest, children);
});

jest.mock('../theme/useTokens', () => () => ({
  colors: {brand: {gradientStart: '#123456', gradientEnd: '#654321'}},
}));

const {brokerGridLayout} = require('../../designs/default/composites/brokerGridLayout');
const PortfolioCard = require('../screens/PortfolioScreen/PortFolioCard').default;
const formatCurrency = require('../utils/formatCurrency').default;

const allText = node =>
  (node.children || [])
    .map(child => (typeof child === 'string' ? child : allText(child)))
    .join('');

describe('broker selection grid', () => {
  test('uses 3 columns on narrow phones and 4 on wider ones, never overflowing the row', () => {
    for (const width of [320, 360, 379, 380, 393, 412, 480]) {
      const {columns, tileWidth} = brokerGridLayout(width);
      expect(columns).toBe(width < 380 ? 3 : 4);
      const used = columns * tileWidth + (columns - 1) * 10 + 40;
      expect(used).toBeLessThanOrEqual(width);
      // The logo box is 36dp tall and the name 2 lines: a tile must be wide
      // enough to read the name without the old square-tile overflow.
      expect(tileWidth).toBeGreaterThanOrEqual(70);
    }
  });

  test('tiles size to their content instead of a fixed square', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'designs/default/composites/BrokerSelectionModal.js'),
      'utf8',
    );
    const card = src.slice(src.indexOf('brokerCard: {'), src.indexOf('brokerCardPressed: {'));
    expect(card).not.toContain('aspectRatio');
    expect(card).toContain("overflow: 'hidden'");
    expect(src).toContain('maxFontSizeMultiplier={1.2}');
  });
});

describe('portfolio summary card', () => {
  const render = props => {
    let r;
    act(() => {
      r = TestRenderer.create(
        React.createElement(PortfolioCard, {formatCurrency, broker: 'Zerodha', ...props}),
      );
    });
    return allText(r.toJSON());
  };

  test('leads with current value and shows invested, P&L and cash', () => {
    const text = render({
      allHoldingsData: {totalinvvalue: 100000, totalprofitandloss: 2500.5, totalpnlpercentage: 2.5},
      profitAndLoss: 2500.5,
      pnlPercentage: 2.5,
      availableCash: 1234.5,
    });
    expect(text).toContain('Broker Holdings value');
    expect(text).toContain('Zerodha broker account');
    expect(text).toContain('₹1,02,500.5');
    expect(text).toContain('▲ 2.50%');
    expect(text).toContain('₹ 1,00,000');
    expect(text).toContain('+₹2,500.5');
    expect(text).toContain('₹ 1,234.5');
  });

  test('with no broker holdings shows a dash, the source and cash — never bare zeros', () => {
    const text = render({allHoldingsData: {}, profitAndLoss: 0, pnlPercentage: 0, availableCash: undefined, broker: ''});
    expect(text).toContain('—');
    expect(text).toContain('No broker account is connected');
    expect(text).toContain('Unavailable');
    expect(text).not.toContain('Invested');
  });
});
