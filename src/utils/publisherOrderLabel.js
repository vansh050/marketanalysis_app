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

// A retry is refused while a leg is still live at Kite; say which one, or the
// customer reads "still checking" and keeps tapping (testaccount CROPSTER SELL
// open at Kite, 2026-10-22).
export function stillCheckingZerodhaAlert(orders = []) {
  // Only rows Kite reported as live; "awaiting broker" or an empty status may
  // never have reached Kite, and must not be called open there.
  const open = (orders || []).filter(row => {
    const status = publisherLegStatus(row);
    return row && status && status !== 'AWAITING_BROKER' && status !== 'UNKNOWN' &&
      !isPublisherLegTerminal(row);
  });
  const names = [...new Set(open.map(row =>
    `${row.tradingSymbol || row.symbol || ''} ${String(row.transactionType || '').toLowerCase()}`.trim(),
  ).filter(Boolean))];
  if (names.length === 0) {
    return [
      'Still checking Zerodha',
      'Nothing was retried. Refresh again after broker verification completes.',
    ];
  }
  const list = names.join(', ');
  return [
    names.length === 1 ? 'Order still open in Kite' : 'Orders still open in Kite',
    `Your ${list} ${names.length === 1 ? 'order is' : 'orders are'} still open in Kite. ` +
      `Cancel ${names.length === 1 ? 'it' : 'them'} in the Kite app (or wait for a fill), then tap Retry. Nothing was retried.`,
  ];
}
