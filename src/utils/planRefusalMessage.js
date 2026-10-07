/**
 * Customer copy for a frozen-plan refusal from `rebalance/process-trade`.
 *
 * ccxt answers `409 {recompute: true, code}` when the plan the app sent can no
 * longer be executed (`plan_freeze.guard_status`). Nothing was sent to the
 * broker. The server's own message is generic ("Your plan is no longer
 * current"), so the app names what happened and the one next step.
 */
export const planRefusalMessage = (code, broker, serverMessage) => {
  const brokerName = broker || 'your broker';
  switch (String(code || '').toUpperCase()) {
    case 'PLAN_ALREADY_CONSUMED':
      return {
        title: 'These orders were already sent',
        message:
          `This rebalance was already sent to ${brokerName} earlier, so nothing ` +
          'new was placed now. If some orders did not go through, tap ' +
          '"Repair Portfolio" on the portfolio card to see why and place only ' +
          'those orders.',
      };
    case 'PLAN_EXPIRED':
    case 'PLAN_STALE':
    case 'PLAN_NOT_ACCEPTABLE':
    case 'PLAN_NOT_FOUND':
    case 'PLAN_REQUIRED':
    case 'REPAIR_REQUIRES_FRESH_CALCULATE':
      return {
        title: 'Please review the orders again',
        message:
          'Your portfolio or prices changed since you reviewed these orders, ' +
          'so nothing was placed. Open the portfolio again to see the updated ' +
          'orders.',
      };
    default:
      return {
        title: 'Nothing was placed',
        message:
          serverMessage ||
          'This plan can no longer be placed. Open the portfolio again to see the latest orders.',
      };
  }
};
