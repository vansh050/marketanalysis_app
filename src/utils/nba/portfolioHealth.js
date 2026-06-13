/**
 * ───────────────────────────────────────────────────────────────────────────
 * PORTED FROM WEB — prod-alphaquark-github @ de22d67e
 *   source: src/utils/portfolioHealth.js
 * SEBI-sensitive engine (factual-only Portfolio Health tool). This is a VERBATIM
 * copy. DO NOT edit the logic here independently of web.
 *
 * DRIFT TRIPWIRE (D2, docs/WEB_PARITY_MIGRATION_2026-06.md §4.2):
 *   __tests__/utils/portfolioHealth.test.js is the web suite ported 1:1. If web
 *   changes this engine, re-sync from the pinned commit above and re-run the suite;
 *   a behavioural mismatch must fail CI rather than silently diverge.
 * Pure + deterministic — no React, no network, no platform APIs → portable as-is.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * portfolioHealth.js — the Portfolio Health engine (NBA Phase 1b, the TOOL).
 *
 * Pure + deterministic. Computes FACTUAL sub-scores about the holdings a customer
 * already owns — concentration, spread, diversification, optional cash-drag /
 * sector-tilt. This is a tool/analysis, NOT advice (CUSTOMER_JOURNEY_NBA_REDESIGN.md
 * §SEBI + eng-review decision 4A):
 *   - Every sub-score is an objectively computable FACT ("38% in RELIANCE",
 *     "14 holdings"). There is NO field for a recommendation / buy-sell / "exit this".
 *     Value judgments like "dead weight" / "weak stock" are ADVICE and live ONLY on
 *     the RA-attributed Transition screen — this engine cannot express them.
 *   - The headline is a GAP COUNT ("N things worth a look"), never a single
 *     buy/hold/sell-able score.
 *   - `isGap` is a factual threshold cross (advisor-configurable), not a directive.
 *
 * Per decision 3A this will run as a backend service for auditability; this pure
 * module is the computation it calls (and is unit-tested here). Sub-score selection
 * + thresholds are advisor-config (the per-advisor opt-in module).
 *
 * Holding shape (from AllHoldings.js): { symbol, quantity, ltp, value?, exchange? }.
 */

export const HEALTH_SUBSCORE = {
  CONCENTRATION: "concentration",
  TOP3_CONCENTRATION: "top3_concentration",
  SPREAD: "spread",
  DIVERSIFICATION: "diversification",
  CASH_DRAG: "cash_drag",
  SECTOR_TILT: "sector_tilt",
};

// Default factual thresholds for the "gap" flag. Advisor config overrides these.
const DEFAULT_THRESHOLDS = {
  concentrationPct: 30, // single holding above this % of the portfolio
  top3Pct: 60, // top-3 holdings above this combined %
  minHoldings: 5, // fewer holdings than this
  minEffectiveHoldings: 4, // HHI-effective count below this
  cashDragPct: 15, // idle cash above this % of (cash + invested)
  sectorTiltPct: 40, // single sector above this %
};

// Sub-scores enabled by DEFAULT (when advisor_config.portfolio_health.enabled is unset).
// Only the four computable from holdings alone. cash_drag + sector_tilt are OMITTED by
// default — we don't reliably feed `availableCash` (not surfaced consistently; stale in
// the v2 cron) or `sectorOf` (no symbol→sector map exists). Both branches still work when
// an advisor opts them in AND the data is supplied. Keep in sync with the backend engine
// (aq_backend_github/utilities/portfolioHealth.js) + AppConfigContext.portfolioHealth.
export const DEFAULT_ENABLED = [
  "concentration",
  "top3_concentration",
  "spread",
  "diversification",
];

const round = (n, d = 0) => {
  const p = 10 ** d;
  return Math.round((Number(n) || 0) * p) / p;
};

function holdingValue(h) {
  if (h == null) return 0;
  if (typeof h.value === "number" && !Number.isNaN(h.value) && h.value > 0) return h.value;
  const qty = Number(h.quantity) || 0;
  // Live LTP first; fall back to cost basis (avgPrice) when the holdings endpoint
  // omits LTP — otherwise every value-weighted sub-score collapses to 0.
  const px = Number(h.ltp) || Number(h.avgPrice) || Number(h.averagePrice) || 0;
  return qty * px;
}

/**
 * @param {Array} holdings  [{symbol, quantity, ltp, value?, exchange?}]
 * @param {{ availableCash?: number, sectorOf?: (symbol:string)=>string|null,
 *           thresholds?: object, enabled?: string[] }} [opts]
 * @returns {{ holdingsCount:number, totalValue:number, gapCount:number,
 *             subScores: Array<{key:string,label:string,value:number,detail:string,isGap:boolean}> }}
 */
export function computeHealthSubScores(holdings, opts = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds || {}) };
  const list = (Array.isArray(holdings) ? holdings : [])
    .map((h) => ({ ...h, _v: holdingValue(h) }))
    .filter((h) => h._v > 0);

  const totalValue = list.reduce((s, h) => s + h._v, 0);
  const count = list.length;
  const subScores = [];
  const want = (k) => !opts.enabled || opts.enabled.includes(k);

  if (totalValue > 0 && count > 0) {
    const sorted = [...list].sort((a, b) => b._v - a._v);

    if (want(HEALTH_SUBSCORE.CONCENTRATION)) {
      const top = sorted[0];
      const pct = round((top._v / totalValue) * 100);
      subScores.push({
        key: HEALTH_SUBSCORE.CONCENTRATION,
        label: "Concentration",
        value: pct,
        detail: `${pct}% in a single stock (${top.symbol || "—"})`,
        isGap: pct > thresholds.concentrationPct,
      });
    }

    if (want(HEALTH_SUBSCORE.TOP3_CONCENTRATION) && count >= 3) {
      const top3 = sorted.slice(0, 3).reduce((s, h) => s + h._v, 0);
      const pct = round((top3 / totalValue) * 100);
      subScores.push({
        key: HEALTH_SUBSCORE.TOP3_CONCENTRATION,
        label: "Top-3 weight",
        value: pct,
        detail: `${pct}% in your top 3 holdings`,
        isGap: pct > thresholds.top3Pct,
      });
    }

    if (want(HEALTH_SUBSCORE.SPREAD)) {
      subScores.push({
        key: HEALTH_SUBSCORE.SPREAD,
        label: "Spread",
        value: count,
        detail: `${count} holding${count !== 1 ? "s" : ""}`,
        isGap: count < thresholds.minHoldings,
      });
    }

    if (want(HEALTH_SUBSCORE.DIVERSIFICATION)) {
      // Herfindahl effective number of holdings = 1 / Σ(weight²).
      const hhi = list.reduce((s, h) => {
        const w = h._v / totalValue;
        return s + w * w;
      }, 0);
      const eff = hhi > 0 ? round(1 / hhi, 1) : 0;
      subScores.push({
        key: HEALTH_SUBSCORE.DIVERSIFICATION,
        label: "Effective diversification",
        value: eff,
        detail: `~${eff} effective holdings (of ${count})`,
        isGap: eff < thresholds.minEffectiveHoldings,
      });
    }

    if (want(HEALTH_SUBSCORE.SECTOR_TILT) && typeof opts.sectorOf === "function") {
      const bySector = {};
      list.forEach((h) => {
        const sec = opts.sectorOf(h.symbol) || "Unknown";
        bySector[sec] = (bySector[sec] || 0) + h._v;
      });
      const [topSector, topSecVal] = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0] || [];
      if (topSector) {
        const pct = round((topSecVal / totalValue) * 100);
        subScores.push({
          key: HEALTH_SUBSCORE.SECTOR_TILT,
          label: "Sector tilt",
          value: pct,
          detail: `${pct}% in ${topSector}`,
          isGap: pct > thresholds.sectorTiltPct,
        });
      }
    }
  }

  if (want(HEALTH_SUBSCORE.CASH_DRAG) && typeof opts.availableCash === "number" && opts.availableCash >= 0) {
    const denom = totalValue + opts.availableCash;
    if (denom > 0) {
      const pct = round((opts.availableCash / denom) * 100);
      subScores.push({
        key: HEALTH_SUBSCORE.CASH_DRAG,
        label: "Cash drag",
        value: pct,
        detail: `${pct}% sitting in idle cash`,
        isGap: pct > thresholds.cashDragPct,
      });
    }
  }

  return {
    holdingsCount: count,
    totalValue: round(totalValue),
    gapCount: subScores.filter((s) => s.isGap).length,
    subScores,
  };
}
