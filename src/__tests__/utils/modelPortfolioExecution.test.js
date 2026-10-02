import {selectBrokerExecution} from '../../utils/modelPortfolioExecution';

const executions = [
  {user_email: 'testaccount@gmail.com', user_broker: 'ICICI Direct', status: 'pending'},
  {user_email: 'testaccount@gmail.com', user_broker: 'Fyers', status: 'partial'},
];

test('does not carry a pending execution across a broker switch', () => {
  expect(selectBrokerExecution(executions, 'testaccount@gmail.com', 'Groww')).toBeUndefined();
});

test('returns only the exact broker execution', () => {
  expect(selectBrokerExecution(executions, 'TESTACCOUNT@gmail.com', 'ICICI Direct'))
    .toMatchObject({user_broker: 'ICICI Direct', status: 'pending'});
});
