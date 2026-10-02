/**
 * B-38b on mobile (2026-09-21) — per-customer closure sizing for the Kite
 * Publisher path.
 *
 * A closure advice is a BROADCAST: one advice, many customers, each holding a
 * different filled quantity. The advised quantity is meaningless per customer.
 * API brokers are sized server-side in `/order-place` (B-38); the Zerodha
 * single-leg flow opens the Kite Publisher window directly and never reaches
 * that route, so the review modal must size the basket itself — the same way
 * the web's `ReviewTradeModel` has since 2026-07-02. Until this port, this
 * modal sent the advised quantity verbatim: a broker rejection for a CNC exit
 * larger than the holding, and a naked short for an F&O one.
 *
 * The server owns the computation (`POST api/process-trades/closure-clamp`:
 * net open = entry fills − prior closure fills per advice, with broker
 * holdings as positive evidence when our own books are silent — B-38c). It
 * returns rows ONLY for closure legs it can size. `netOpen = 0` → the leg is
 * removed; `netOpen < requested` → the quantity is clamped. Basket legs are
 * excluded (ccxt's basket.py sizes those per customer).
 *
 * Fail-closed rule: if the lookup cannot run and the cart contains an EXIT
 * leg, nothing is sent. Entry-only carts are unaffected by a lookup failure.
 */
import axios from 'axios';

export const isClosureLeg = stock =>
  String(stock?.purpose || '').toUpperCase() === 'EXIT' ||
  stock?.isClosure === true ||
  ['fullclose', 'partialclose', 'closed'].includes(
    String(stock?.closurestatus || '').toLowerCase(),
  );

export const applyClosureClamps = (stockDetails, clamps) => {
  const byId = new Map(
    (Array.isArray(clamps) ? clamps : [])
      .filter(c => c && c.tradeId != null)
      .map(c => [String(c.tradeId), c]),
  );
  const removed = [];
  const clamped = [];
  const next = (stockDetails || [])
    .map(stock => {
      const clamp = stock?.tradeId != null ? byId.get(String(stock.tradeId)) : null;
      if (!clamp) return stock;
      const requested = Number(stock.quantity) || 0;
      const netOpen = Number(clamp.netOpen) || 0;
      if (netOpen <= 0) {
        removed.push(stock.tradingSymbol || stock.symbol);
        return null;
      }
      if (requested > netOpen) {
        clamped.push(`${stock.tradingSymbol || stock.symbol} (${requested}→${netOpen})`);
        return {...stock, quantity: netOpen};
      }
      return stock;
    })
    .filter(Boolean);
  return {next, removed, clamped};
};

export const fetchClosureClamps = async ({
  baseUrl, userEmail, tradeIds, broker, headers, timeout = 8000,
}) => {
  const response = await axios.post(
    `${baseUrl}api/process-trades/closure-clamp`,
    // Naming the broker lets the server read holdings from the account this
    // cart executes on (B-38c), not an arbitrary connected one.
    {userEmail, tradeIds, user_broker: broker},
    {headers, timeout},
  );
  return Array.isArray(response?.data?.clamps) ? response.data.clamps : [];
};

export const REMOVED_EXIT_MESSAGE = symbols =>
  `Exit skipped for ${symbols.join(', ')} — no open quantity for this advice, and no matching holding in your broker account. If you do hold it, close it from your broker app.`;

export const CLAMPED_EXIT_MESSAGE = entries =>
  `Exit quantity adjusted to your actual position: ${entries.join(', ')}`;

export const CLAMP_UNAVAILABLE_MESSAGE =
  'Exit is blocked until your open quantity can be verified. No order was sent.';
