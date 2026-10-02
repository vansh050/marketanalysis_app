import {
  canExecuteRebalance,
  getCanonicalRebalanceTrades,
  getRebalanceContract,
} from '../src/utils/rebalanceContract';

const response = {
  buy: [{symbol: 'WRONG-EQ', quantity: 99}],
  sell: [],
  rebalanceContract: {
    schemaVersion: 1,
    plan: {
      hash: 'plan-1',
      legs: [{tradingSymbol: 'INFY-EQ', transactionType: 'BUY', exchange: 'NSE', quantity: 1}],
    },
    funding: {classification: 'READY'},
    customerAction: {code: 'EXECUTE', label: 'Continue', blocking: false},
  },
};

test('uses the backend frozen legs and sole action', () => {
  expect(getRebalanceContract(response).customerAction.code).toBe('EXECUTE');
  expect(getCanonicalRebalanceTrades(response).buy).toEqual([
    expect.objectContaining({symbol: 'INFY-EQ', quantity: 1}),
  ]);
  expect(canExecuteRebalance(response)).toBe(true);
});

test('blocks any non-EXECUTE backend action', () => {
  const blocked = JSON.parse(JSON.stringify(response));
  blocked.rebalanceContract.customerAction = {
    code: 'RETRY_VERIFICATION',
    label: 'Verify again',
    blocking: true,
  };
  expect(canExecuteRebalance(blocked)).toBe(false);
});
