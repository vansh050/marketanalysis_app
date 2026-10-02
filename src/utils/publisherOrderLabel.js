export const publisherOrderLabel = status => {
  const value = String(status || '').toUpperCase();
  return ({NOT_OBSERVED: 'NOT SENT', NOT_SUBMITTED: 'READY TO SUBMIT',
    AWAITING_BROKER: 'VERIFYING WITH BROKER', WAITING_FOR_SELLS: 'WAITING FOR SELLS'})[value] || value;
};

// The broker has said its final word about a leg. Anything else is still in
// flight -- including a LIMIT resting unfilled, which Kite keeps alive until
// 15:30 because the Publisher basket sends DAY validity on every exchange.
// Offering Retry while a leg is in flight offers a double buy: the original
// order can still fill afterwards.
const TERMINAL_LEG_STATUSES = new Set([
  'COMPLETE', 'COMPLETED', 'EXECUTED', 'TRADED', 'FILLED',
  'REJECTED', 'CANCELLED', 'CANCELED', 'FAILED', 'FAILURE',
  'NOT_OBSERVED', 'NOT_SENT', 'NOT_SUBMITTED', 'HISTORY_UNAVAILABLE']);

export const publisherLegStatus = row =>
  String(row?.orderStatus ?? row?.status ?? '').trim().toUpperCase().replace(/\s+/g, '_');

// Unknown and empty are deliberately NOT terminal. "We cannot tell" must hold
// the customer still, never wave them through into a retry.
export const isPublisherLegTerminal = row =>
  TERMINAL_LEG_STATUSES.has(publisherLegStatus(row));
