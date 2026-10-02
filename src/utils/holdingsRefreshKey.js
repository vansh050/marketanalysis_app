/**
 * Identity of the broker session that holdings belong to.
 *
 * TradeContext used to re-fetch broker holdings (`/<broker>/holdings` +
 * `/<broker>/all-holdings`) whenever the `userDetails` object changed. Every
 * getUser refresh creates a new object even when nothing changed, so a single
 * "Accept rebalance" tap (whose broker check refreshes the user) fanned out
 * into repeated live broker calls — ~12 Fyers calls in 10 s on 2026-09-29.
 *
 * Holdings only change meaning when the user, broker, connection status or
 * session credentials change, so that is what the effect keys on. Explicit
 * refresh paths (order placed, `refreshEvent`) still re-fetch holdings.
 */
export function holdingsRefreshKey(userDetails) {
  if (!userDetails) return null;
  return [
    userDetails.email,
    userDetails.user_broker,
    userDetails.connect_broker_status,
    userDetails.clientCode,
    userDetails.jwtToken,
  ]
    .map(value => (value === undefined || value === null ? '' : String(value)))
    .join('|');
}

export default holdingsRefreshKey;
