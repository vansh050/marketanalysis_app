// Wording for a post-sell BUY basket the server refit held back entirely.
//
// The sells are complete; the buys were NOT sent. Every line here must stay
// true in that state: never "aligned", never "submitted". moneyman/gvarung
// 2026-10-15: six buys held, the app said "Your Portfolio is Already Aligned".

const plural = count => (count === 1 ? 'buy order' : 'buy orders');

export function heldBuysTitle(held) {
  const count = Number(held?.count) || 0;
  if (held?.reason === 'unverified') return 'Buying power is still being verified';
  return count > 0
    ? `${count} ${plural(count)} not placed yet`
    : 'Buy orders not placed yet';
}

export function heldBuysBody(held) {
  const count = Number(held?.count) || 0;
  const what = count > 0 ? `the ${count} remaining ${plural(count)}` : 'the remaining buy orders';
  const lead =
    held?.reason === 'unverified'
      ? `Your sells are complete, but we could not confirm your available funds, so ${what} were not sent to your broker.`
      : `Your sells are complete, but ${what} were not sent to your broker, so this rebalance is not finished yet.`;
  const detail = String(held?.message || '').trim();
  return detail
    ? `${lead} ${detail}`
    : `${lead} Try again in a moment, or use Repair Portfolio to place what your funds allow.`;
}
