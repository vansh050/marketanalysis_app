/**
 * tradeVariant.js
 *
 * Single source of truth for the trade `variant` field — `"AMO" | "REGULAR"`.
 *
 * See `docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field` for the full
 * contract. This file enforces the rules at submit-time:
 *
 *   variant = (!IsMarketHours() && allowAfterHoursOrders === true)
 *               ? "AMO"
 *               : "REGULAR"
 *
 * `IsMarketHours()` already encodes the 09:15–15:30 IST gate; this helper
 * exists so every payload builder (bespoke / rebalance / MP / GTT) computes
 * variant identically — no per-call-site forks of the rule.
 *
 * The field is intentionally a string literal (not boolean) so future
 * variants — `"GTT"`, `"OCO"`, `"BO"`, `"CO"` — can be added without a
 * breaking schema change. It is the first piece of the future SDK trade
 * contract: when bespoke + basket execution migrate from legacy ccxt/Node
 * to the SDK lane the way Phase 3 broker-connect did, this field stays.
 *
 * Display-only as of 2026-05-01 — `RecommendationSuccessModal` renders an
 * amber AMO pill when `variant === "AMO"`. Place-order payload behaviour
 * is unchanged (every supported broker auto-converts after-hours orders to
 * AMO server-side; explicit `orderVariety: "AMO"` is a deferred followup).
 */

import IsMarketHours from './isMarketHours';

/**
 * Compute the trade variant for the current submit moment.
 *
 * @param {boolean | undefined} allowAfterHoursOrders
 *   The advisor's `appadvisors.allowAfterHoursOrders` /
 *   `featureFlags.allowAfterHoursOrders` toggle (resolved by ConfigContext).
 * @returns {"AMO" | "REGULAR"}
 */
export function computeTradeVariant(allowAfterHoursOrders) {
  if (!IsMarketHours() && allowAfterHoursOrders === true) {
    return 'AMO';
  }
  return 'REGULAR';
}

/**
 * Match a result row back to its outgoing trade record so we can recover
 * `variant` on the rebalance/MP lane.
 *
 * As of 2026-05-11 ccxt-india's /rebalance/process-trade echoes `variant`
 * on each result row (see `ccxt-india/rebalancing/rebalancing.py:1191-`).
 * The helper is now defensive — tier 1 (response.variant) is the primary
 * source. Tiers 2-3 cover (a) older ccxt-india deploys that pre-date the
 * echo fix, (b) cached responses, (c) the bespoke rebalance lane until
 * RebalanceModal threads outgoingTrades through.
 *
 * Three-tier resolution:
 *   1. result.variant — primary (server-echoed since 2026-05-11)
 *   2. matching outgoing trade's `variant` by symbol+tradeId+transactionType
 *   3. 'REGULAR' default
 *
 * Treating "REGULAR" as the default — a missing AMO badge on a live order
 * is a cosmetic miss; a wrong AMO badge on a live order suggests "this
 * didn't fire", which is the regression we're trying to prevent.
 *
 * @param {object} resultItem - One row from the order-place response.
 * @param {Array<object>} outgoingTrades - The trades just submitted.
 * @returns {"AMO" | "REGULAR"}
 */
export function resolveResultVariant(resultItem, outgoingTrades) {
  if (!resultItem) return 'REGULAR';
  const fromResponse = (resultItem.variant || '').toString().toUpperCase();
  if (fromResponse === 'AMO' || fromResponse === 'REGULAR') {
    return fromResponse;
  }
  if (!Array.isArray(outgoingTrades) || outgoingTrades.length === 0) {
    return 'REGULAR';
  }
  const targetSymbol = (resultItem.symbol || resultItem.tradingSymbol || '')
    .toString()
    .trim()
    .toLowerCase();
  const targetType = (resultItem.transactionType || resultItem.Type || '')
    .toString()
    .trim()
    .toLowerCase();
  const targetTradeId = (resultItem.tradeId || '').toString().trim();

  const match = outgoingTrades.find((t) => {
    if (!t) return false;
    const sym = (t.tradingSymbol || t.Symbol || t.symbol || '')
      .toString()
      .trim()
      .toLowerCase();
    const type = (t.transactionType || t.Type || '')
      .toString()
      .trim()
      .toLowerCase();
    const tid = (t.tradeId || '').toString().trim();
    if (sym !== targetSymbol) return false;
    if (targetType && type && type !== targetType) return false;
    if (targetTradeId && tid && tid !== targetTradeId) return false;
    return true;
  });

  const fromMatch = (match?.variant || '').toString().toUpperCase();
  if (fromMatch === 'AMO' || fromMatch === 'REGULAR') return fromMatch;
  return 'REGULAR';
}

export default computeTradeVariant;
