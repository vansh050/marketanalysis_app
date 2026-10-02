/** One authorization and one WebView opening per immutable batch. */
export const createPublisherBatchDispatcher = () => {
  const dispatched = new Set();
  const pending = new Set();
  return {
    async run({attemptId, index, legs, authorize, open}) {
      const sides = new Set((legs || []).map(leg => String(leg.transactionType || '').toUpperCase()));
      if (!attemptId || !legs?.length || sides.size !== 1 || !['SELL', 'BUY'].includes([...sides][0])) {
        throw new Error('Refresh the portfolio to prepare a valid order batch.');
      }
      const activationId = `${attemptId}:${[...sides][0]}:${index}`;
      // Past the dispatch boundary we cannot prove the form did not reach the
      // broker, so this refusal is an UNKNOWN outcome and callers must not
      // report it as a failure — telling a customer "rejected" here invites
      // the retry that double-places. Before the boundary nothing was sent.
      if (dispatched.has(activationId)) {
        const error = new Error('This batch was already sent to your broker. Check your broker orders and refresh order status before trying again.');
        error.dispatchUncertain = true;
        throw error;
      }
      if (pending.has(activationId)) {
        throw new Error('This batch is already opening. Wait for the broker window.');
      }
      pending.add(activationId);
      try {
        await authorize(activationId);
        // An exception after this boundary cannot prove the form was not sent.
        dispatched.add(activationId);
        await open();
      } finally {
        pending.delete(activationId);
      }
    },
  };
};
