/**
 * An Order Status screen can show an attempt from an earlier day, for example
 * when the server is still reconciling it. If every order failed and that day
 * is over, say so plainly instead of presenting it like a live placement
 * (moneyman testaccount / Fyers, 7 Oct 2026: a 2 Oct all-rejected attempt
 * read as if orders had just been sent).
 */
const istDay = value => {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time + 330 * 60 * 1000).toISOString().slice(0, 10);
};

export const isPastAttemptWithNothingBought = ({
  attemptedAt,
  completedCount,
  openCount,
  orderCount,
  retryableCount,
  now = Date.now(),
}) => {
  if (!attemptedAt || !orderCount) return false;
  if (completedCount > 0 || openCount > 0 || retryableCount !== orderCount) return false;
  const attemptDay = istDay(attemptedAt);
  return Boolean(attemptDay) && attemptDay < istDay(now);
};
