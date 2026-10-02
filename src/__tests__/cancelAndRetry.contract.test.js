/**
 * Cancel & Retry (2026-10-01, Fyers): a refused cancel must stop and say why
 * inside the Order Status modal; the app must never write `toExecute` itself;
 * the header must count still-open orders separately.
 */
const fs = require('fs');
const path = require('path');
const React = require('react');
const {act, create} = require('react-test-renderer');

const textOf = tree =>
  tree.root
    .findAll(n => typeof n.props?.children === 'string' || Array.isArray(n.props?.children))
    .map(n => [].concat(n.props.children).filter(c => typeof c === 'string').join(''))
    .filter(Boolean);
const render = el => {
  let tree;
  act(() => {
    tree = create(el);
  });
  return tree;
};

const read = rel => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
const handler = card.slice(
  card.indexOf('const handleCancelAndRetry = async () => {'),
  card.indexOf('// Retry without cancelling'),
);

jest.mock('../theme/useTokens', () => () => ({colors: {brand: {primary: '#000'}}}));
const PendingOrdersModal =
  require('../components/ModelPortfolioComponents/PendingOrdersModal').default;

describe('Cancel & Retry handler', () => {
  test('never manufactures toExecute or recalculates directly', () => {
    expect(handler).not.toContain("executionStatus: 'toExecute'");
    expect(handler).not.toContain('handleAcceptClick()');
    expect(handler).toContain('await handlePendingRefresh();');
  });

  test('a failed cancel stops before any retry and is explained', () => {
    const stop = handler.indexOf('if (failures.length > 0)');
    expect(stop).toBeGreaterThan(-1);
    expect(handler.indexOf('return;', stop)).toBeLessThan(
      handler.indexOf('await handlePendingRefresh();'),
    );
    expect(handler).toContain('Nothing was retried.');
  });

  test('sends the tenant database, not the display tag first', () => {
    expect(handler).toMatch(
      /advisorDb:\s*\n\s*configData\?\.config\?\.REACT_APP_HEADER_NAME \|\|/,
    );
  });
});

describe('PendingOrdersModal', () => {
  const orders = [
    {orderId: '1', tradingSymbol: 'KARNAWATI', transactionType: 'SELL', orderStatus: 'COMPLETE'},
    {orderId: '2', tradingSymbol: 'CROPSTER', transactionType: 'SELL', orderStatus: 'PENDING'},
  ];

  test('header counts still-open orders separately', () => {
    const tree = render(
      <PendingOrdersModal isOpen orders={orders} broker="Fyers" onClose={() => {}} />,
    );
    expect(textOf(tree)).toContain('1 completed · 1 still open at Fyers · 0 need action');
  });

  test('shows the cancel error inside the modal with a Refresh action', () => {
    const tree = render(
      <PendingOrdersModal
        isOpen
        orders={orders}
        broker="Fyers"
        onClose={() => {}}
        cancelError="Could not cancel CROPSTER at Fyers. Nothing was retried."
        onRefresh={() => {}}
      />,
    );
    expect(
      tree.root.findAll(n => n.props?.testID === 'pending-orders-cancel-error').length,
    ).toBeGreaterThan(0);
    expect(textOf(tree)).toContain('Refresh');
  });
});

describe('Zerodha login inside quick-reconnect setup (2026-10-01)', () => {
  const modal = read('src/components/BrokerConnectionModal/ZerodhaConnectModal.js');
  const ui = read('src/UIComponents/BrokerConnectionUI/ZerodhaConnectUI.js');
  test('the gate fallback explains the one-time login and offers a way back', () => {
    expect(modal).toContain("quickReconnectPending={typeof onBackToQuickReconnect === 'function'}");
    expect(ui).toContain('testID="zerodha-quick-reconnect-step"');
    expect(ui).toContain('Step 2 of 2: log in to Zerodha once');
    expect(ui).toContain('Back to quick reconnect setup');
  });
});
