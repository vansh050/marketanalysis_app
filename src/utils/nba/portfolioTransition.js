/**
 * ───────────────────────────────────────────────────────────────────────────
 * PORTED FROM WEB — prod-alphaquark-github @ de22d67e
 *   source: src/utils/portfolioTransition.js
 * SEBI-sensitive engine (RA-attributed Transition diff). VERBATIM copy.
 * DO NOT edit the logic here independently of web.
 *
 * DRIFT TRIPWIRE (D2, docs/WEB_PARITY_MIGRATION_2026-06.md §4.2):
 *   __tests__/utils/portfolioTransition.test.js is the web suite ported 1:1.
 *   On a web engine change, re-sync from the pinned commit and re-run; mismatch fails CI.
 * Pure + deterministic — no React, no network, no clock → portable as-is.
 * NOTE: Phase 5 (deferred). Ported now for parity but NOT mounted on home until web mounts it.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * portfolioTransition.js — the Transition diff engine (NBA Phase 2, greenfield).
 *
 * Pure, deterministic. Given the customer's CURRENT holdings and a TARGET model
 * (the RA's model portfolio, as a weight vector), it computes:
 *   - an alignment % (how close current is to target — the convergence bar),
 *   - keep / trim / exit / add / top-up buckets (the trades that close the gap),
 *   - current + target allocation vectors (for the donuts / bars).
 *
 * SEBI boundary (decision 4A): this is the ADVICE side. The buckets are value
 * judgments (sell this, buy that) and are ONLY legitimate because the target is the
 * RA's model — so the CARD renders RA attribution ABOVE the diff. The engine itself
 * is just arithmetic over (holdings, targetWeights); it invents no target and makes
 * no recommendation of its own. Keep this file free of React + network + clock so it
 * stays unit-testable and backend-portable (mirrors portfolioHealth.js).
 *
 * Multi-model: the engine takes ONE target vector. When the user is subscribed to
 * several models the CALLER builds the allocation-weighted blend first and passes the
 * blended vector here (see CUSTOMER_JOURNEY_NBA_REDESIGN.md §"Multi-model targeting").
 * No target → { hasTarget: false } so the surface shows the "choose a model" matcher,
 * never a fabricated alignment number.
 */

export const TRANSITION_BUCKET = {
  KEEP: "keep",
  TRIM: "trim",
  EXIT: "exit",
  ADD: "add",
  TOPUP: "topup",
};

/** Per-holding current value. Prefer live LTP, fall back to avg cost, then stored value. */
function holdingValue(h) {
  const qty = Number(h?.quantity ?? h?.qty ?? 0) || 0;
  const px = Number(h?.ltp ?? h?.lastPrice ?? h?.avgPrice ?? h?.averagePrice ?? 0) || 0;
  const v = qty * px;
  if (v > 0) return v;
  // Some holdings carry a precomputed value with no usable price/qty.
  return Number(h?.value ?? h?.currentValue ?? 0) || 0;
}

// Strip the NSE series suffix so a model symbol ("YESBANK-EQ") matches the broker
// holding ("YESBANK") — both reduce to the underlying. Mirrors the broker-side
// scrip-master fallback (ccxt angelone_symbol_fallback): equity series codes only,
// so we never collapse two genuinely-different instruments. BSE symbols carry no
// suffix and pass through unchanged.
const SERIES_SUFFIX = /-(EQ|BE|BZ|SM|ST|GS|GB|IL|RR|N[0-9])$/;
function norm(sym) {
  return String(sym || "")
    .trim()
    .toUpperCase()
    .replace(SERIES_SUFFIX, "");
}

/**
 * Normalize a target model into { [symbol]: weightFraction } summing to ~1.
 * Accepts either explicit weights ([{symbol, weight}]) or a holdings-shaped model
 * ([{symbol, quantity, ltp/avgPrice}]) from which weights are derived by value.
 */
function normalizeTarget(target) {
  const list = Array.isArray(target) ? target : Array.isArray(target?.constituents) ? target.constituents : [];
  if (list.length === 0) return null;

  const hasExplicitWeight = list.some((t) => t && t.weight != null);
  const raw = {};
  let total = 0;

  for (const t of list) {
    const sym = norm(t?.symbol ?? t?.tradingSymbol ?? t?.advSymbol);
    if (!sym) continue;
    let w;
    if (hasExplicitWeight) {
      w = Number(t?.weight ?? 0) || 0;
    } else {
      w = holdingValue(t);
    }
    if (w <= 0) continue;
    raw[sym] = (raw[sym] || 0) + w;
    total += w;
  }
  if (total <= 0) return null;
  const out = {};
  for (const sym of Object.keys(raw)) out[sym] = raw[sym] / total;
  return out;
}

/**
 * @param {Array} holdings   current broker holdings ({symbol, quantity, ltp, avgPrice, ...})
 * @param {Array|Object} target   the RA model — [{symbol, weight}] or holdings-shaped
 * @param {Object} [opts]
 * @param {string[]} [opts.doNotSell]   symbols the user refuses to sell (never Trim/Exit)
 * @param {number} [opts.keepBandPct]   |Δweight| within this band counts as aligned (default 0.02)
 * @returns {{
 *   hasTarget: boolean, holdingsCount: number, alignmentPct: number,
 *   buckets: Object, currentAllocation: Array, targetAllocation: Array,
 *   tradeCount: number
 * }}
 */
export function computeTransition(holdings = [], target = null, opts = {}) {
  const keepBand = Number(opts.keepBandPct ?? 0.02);
  const doNotSell = new Set((opts.doNotSell || []).map(norm));

  const targetW = normalizeTarget(target);
  const list = Array.isArray(holdings) ? holdings : [];

  // Current allocation by value.
  const curVal = {};
  let totalCur = 0;
  for (const h of list) {
    const sym = norm(h?.symbol ?? h?.tradingSymbol ?? h?.advSymbol);
    if (!sym) continue;
    const v = holdingValue(h);
    if (v <= 0) continue;
    curVal[sym] = (curVal[sym] || 0) + v;
    totalCur += v;
  }
  const holdingsCount = Object.keys(curVal).length;

  if (!targetW) {
    return {
      hasTarget: false,
      holdingsCount,
      alignmentPct: 0,
      buckets: emptyBuckets(),
      currentAllocation: toAllocation(curVal, totalCur),
      targetAllocation: [],
      tradeCount: 0,
    };
  }

  const curW = {};
  for (const sym of Object.keys(curVal)) curW[sym] = totalCur > 0 ? curVal[sym] / totalCur : 0;

  const symbols = new Set([...Object.keys(curW), ...Object.keys(targetW)]);
  const buckets = emptyBuckets();
  let overlap = 0; // Σ min(cur, target) — portfolio-overlap alignment metric.

  for (const sym of symbols) {
    const cur = curW[sym] || 0;
    const tgt = targetW[sym] || 0;
    overlap += Math.min(cur, tgt);
    const delta = tgt - cur; // >0 means we need MORE of it
    const row = {
      symbol: sym,
      currentWeight: cur,
      targetWeight: tgt,
      deltaWeight: delta,
      doNotSell: doNotSell.has(sym),
    };

    if (tgt > 0 && cur === 0) {
      buckets[TRANSITION_BUCKET.ADD].push(row);
    } else if (tgt === 0 && cur > 0) {
      // Not in the model. Respect do-not-sell — never force an exit.
      if (row.doNotSell) buckets[TRANSITION_BUCKET.KEEP].push(row);
      else buckets[TRANSITION_BUCKET.EXIT].push(row);
    } else if (Math.abs(delta) <= keepBand) {
      buckets[TRANSITION_BUCKET.KEEP].push(row);
    } else if (delta < 0) {
      // Overweight vs model → trim, unless do-not-sell.
      if (row.doNotSell) buckets[TRANSITION_BUCKET.KEEP].push(row);
      else buckets[TRANSITION_BUCKET.TRIM].push(row);
    } else {
      // Underweight vs model → top up.
      buckets[TRANSITION_BUCKET.TOPUP].push(row);
    }
  }

  // Sort each bucket by the magnitude of the gap (biggest moves first).
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight));
  }

  const alignmentPct = Math.round(Math.max(0, Math.min(1, overlap)) * 100);
  const tradeCount =
    buckets.trim.length + buckets.exit.length + buckets.add.length + buckets.topup.length;

  return {
    hasTarget: true,
    holdingsCount,
    alignmentPct,
    buckets,
    currentAllocation: toAllocation(curW, 1, curVal),
    targetAllocation: toAllocation(targetW, 1),
    tradeCount,
  };
}

function emptyBuckets() {
  return {
    [TRANSITION_BUCKET.KEEP]: [],
    [TRANSITION_BUCKET.TRIM]: [],
    [TRANSITION_BUCKET.EXIT]: [],
    [TRANSITION_BUCKET.ADD]: [],
    [TRANSITION_BUCKET.TOPUP]: [],
  };
}

/** Shape a weight map into a sorted allocation array for the donut/bars. */
function toAllocation(weightMap, denom = 1, valueMap = null) {
  return Object.keys(weightMap)
    .map((symbol) => ({
      symbol,
      weight: denom ? weightMap[symbol] / denom : weightMap[symbol],
      value: valueMap ? valueMap[symbol] : undefined,
    }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Build a single blended target vector from several subscribed models, weighted by
 * the user's allocation across them. Each entry: { weights:{sym:frac}|[{symbol,weight}],
 * allocation:number }. Returns [{symbol, weight}] normalized — feed straight to
 * computeTransition. (Multi-model case from the design doc.)
 */
export function blendTargets(models = []) {
  const acc = {};
  let totalAlloc = 0;
  for (const m of models) {
    const alloc = Number(m?.allocation ?? 0) || 0;
    if (alloc <= 0) continue;
    const w = normalizeTarget(m?.weights ?? m?.constituents ?? m);
    if (!w) continue;
    totalAlloc += alloc;
    for (const sym of Object.keys(w)) acc[sym] = (acc[sym] || 0) + w[sym] * alloc;
  }
  if (totalAlloc <= 0) return [];
  return Object.keys(acc)
    .map((symbol) => ({ symbol, weight: acc[symbol] / totalAlloc }))
    .sort((a, b) => b.weight - a.weight);
}
