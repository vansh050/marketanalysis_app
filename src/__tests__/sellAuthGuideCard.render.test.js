const React = require('react');
const {act, create} = require('react-test-renderer');

jest.mock('axios', () => ({get: jest.fn(() => Promise.reject(new Error('offline')))}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 'tok'}));
jest.mock('../utils/variantHelper', () => ({getTenantSubdomain: () => 'prod'}));

const SellAuthGuideCard = require('../components/SellAuth/SellAuthGuideCard').default;

const texts = tree =>
  tree.root
    .findAll(n => n.type === 'Text' || typeof n.props?.children === 'string')
    .map(n => [].concat(n.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
    .join('\n');

test('renders the fallback guide with the sells to approve', async () => {
  let tree;
  await act(async () => {
    tree = create(
      <SellAuthGuideCard
        broker="Upstox"
        variant="portal"
        sellOrders={[{tradingSymbol: 'YESBANK-EQ', transactionType: 'SELL', quantity: 2}]}
      />,
    );
  });
  const t = texts(tree);
  expect(t).toContain("Approve today's sell with your CDSL TPIN");
  expect(t).toContain('YESBANK-EQ');
  expect(t).toContain('tap Submit');
  expect(t).not.toContain('DDPI Inactive');
});
