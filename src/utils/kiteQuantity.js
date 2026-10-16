/**
 * Quantity for a Kite (Zerodha Publisher) basket item.
 *
 * A recommendation can arrive with no quantity (the customer sizes it on the
 * review screen). Kite baskets used `parseInt(qty) || 1`, so a blank quantity
 * silently became a 1-share order that the record-back could never match
 * (server INVALID_EXECUTION_QUANTITY -> "Awaiting broker confirmation" forever;
 * Kyzen TCS, 2026-10-13). A blank or non-positive quantity is never placed:
 * callers block the Kite launch and ask the customer to enter one.
 */
export const kiteQuantity = stock => {
  const raw = stock?.quantity ?? stock?.Quantity ?? stock?.qty;
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Symbols in `trades` whose quantity is missing or not a positive whole number. */
export const tradesMissingQuantity = trades =>
  (trades || [])
    .filter(t => kiteQuantity(t) === null)
    .map(t => String(t?.tradingSymbol || t?.symbol || t?.Symbol || 'this stock').replace(/-EQ$/, ''));

export const missingQuantityMessage = symbols =>
  `Enter a quantity for ${symbols.join(', ')} before placing. No order was sent.`;
