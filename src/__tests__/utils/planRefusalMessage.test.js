import {planRefusalMessage} from '../../utils/planRefusalMessage';

describe('frozen-plan refusal copy', () => {
  test('a consumed plan says the orders were already sent and points to Repair', () => {
    const copy = planRefusalMessage('PLAN_ALREADY_CONSUMED', 'ICICI Direct', 'Your plan is no longer current.');
    expect(copy.title).toBe('These orders were already sent');
    expect(copy.message).toContain('ICICI Direct');
    expect(copy.message).toContain('Repair Portfolio');
  });

  test.each(['PLAN_EXPIRED', 'PLAN_STALE', 'PLAN_REQUIRED', 'REPAIR_REQUIRES_FRESH_CALCULATE'])(
    '%s asks the customer to review again and says nothing was placed',
    code => {
      const copy = planRefusalMessage(code, 'Zerodha');
      expect(copy.message).toContain('nothing was placed');
    },
  );

  test('an unknown code keeps the server message', () => {
    expect(planRefusalMessage('SOMETHING_NEW', 'Dhan', 'Server says no').message).toBe('Server says no');
  });
});
