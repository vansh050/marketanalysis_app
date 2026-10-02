/**
 * DRIFT TRIPWIRE — ported 1:1 from prod-alphaquark-github @ de22d67e
 *   (src/__tests__/utils/portfolioTransition.test.js). Only the import path changed.
 * If this fails after a web engine change, re-sync src/utils/nba/portfolioTransition.js
 * from the pinned commit. See docs/WEB_PARITY_MIGRATION_2026-06.md §4.2 (D2).
 */
import {
  computeTransition,
  blendTargets,
  TRANSITION_BUCKET,
} from "../../src/utils/nba/portfolioTransition";

// Two equal-value holdings → 50/50 current allocation.
const HOLDINGS = [
  { symbol: "RELIANCE", quantity: 10, ltp: 100 }, // 1000
  { symbol: "TCS", quantity: 10, ltp: 100 }, // 1000
];

describe("computeTransition — no target", () => {
  it("returns hasTarget=false (choose-a-model) when target is null/empty", () => {
    const r = computeTransition(HOLDINGS, null);
    expect(r.hasTarget).toBe(false);
    expect(r.alignmentPct).toBe(0);
    expect(r.holdingsCount).toBe(2);
    const empty = computeTransition(HOLDINGS, []);
    expect(empty.hasTarget).toBe(false);
  });
});

describe("computeTransition — alignment + buckets", () => {
  it("identical to target → 100% aligned, all KEEP, 0 trades", () => {
    const r = computeTransition(HOLDINGS, [
      { symbol: "RELIANCE", weight: 0.5 },
      { symbol: "TCS", weight: 0.5 },
    ]);
    expect(r.hasTarget).toBe(true);
    expect(r.alignmentPct).toBe(100);
    expect(r.tradeCount).toBe(0);
    expect(r.buckets[TRANSITION_BUCKET.KEEP]).toHaveLength(2);
  });

  it("symbol in target but not held → ADD", () => {
    const r = computeTransition(HOLDINGS, [
      { symbol: "RELIANCE", weight: 0.34 },
      { symbol: "TCS", weight: 0.33 },
      { symbol: "INFY", weight: 0.33 },
    ]);
    const adds = r.buckets[TRANSITION_BUCKET.ADD].map((x) => x.symbol);
    expect(adds).toContain("INFY");
    expect(r.alignmentPct).toBeLessThan(100);
  });

  it("symbol held but not in target → EXIT", () => {
    const r = computeTransition(HOLDINGS, [{ symbol: "RELIANCE", weight: 1 }]);
    const exits = r.buckets[TRANSITION_BUCKET.EXIT].map((x) => x.symbol);
    expect(exits).toContain("TCS");
    // RELIANCE underweight (0.5 → 1.0) → top up
    expect(r.buckets[TRANSITION_BUCKET.TOPUP].map((x) => x.symbol)).toContain("RELIANCE");
  });

  it("overweight → TRIM, underweight → TOPUP", () => {
    const r = computeTransition(HOLDINGS, [
      { symbol: "RELIANCE", weight: 0.2 }, // currently 0.5 → overweight → trim
      { symbol: "TCS", weight: 0.8 }, // currently 0.5 → underweight → topup
    ]);
    expect(r.buckets[TRANSITION_BUCKET.TRIM].map((x) => x.symbol)).toContain("RELIANCE");
    expect(r.buckets[TRANSITION_BUCKET.TOPUP].map((x) => x.symbol)).toContain("TCS");
  });

  it("respects do-not-sell — never Trim/Exit a protected symbol", () => {
    const r = computeTransition(HOLDINGS, [{ symbol: "RELIANCE", weight: 1 }], {
      doNotSell: ["TCS"],
    });
    expect(r.buckets[TRANSITION_BUCKET.EXIT]).toHaveLength(0);
    const keep = r.buckets[TRANSITION_BUCKET.KEEP].find((x) => x.symbol === "TCS");
    expect(keep).toBeTruthy();
    expect(keep.doNotSell).toBe(true);
  });

  it("alignment is the overlap metric Σmin(cur,tgt) (50% when disjoint halves)", () => {
    // Hold A 100%; target B 100% → zero overlap → 0% aligned.
    const r = computeTransition([{ symbol: "A", quantity: 1, ltp: 100 }], [
      { symbol: "B", weight: 1 },
    ]);
    expect(r.alignmentPct).toBe(0);
  });

  it("matches model symbols to broker holdings across the NSE series suffix", () => {
    // Broker holding is bare 'YESBANK'; model target is 'YESBANK-EQ' → must align, not exit/add.
    const r = computeTransition([{ symbol: "YESBANK", quantity: 10, ltp: 20 }], [
      { symbol: "YESBANK-EQ", weight: 1 },
    ]);
    expect(r.alignmentPct).toBe(100);
    expect(r.buckets[TRANSITION_BUCKET.EXIT]).toHaveLength(0);
    expect(r.buckets[TRANSITION_BUCKET.ADD]).toHaveLength(0);
  });

  it("derives target weights from a holdings-shaped model (no explicit weight)", () => {
    const r = computeTransition(HOLDINGS, [
      { symbol: "RELIANCE", quantity: 10, ltp: 100 },
      { symbol: "TCS", quantity: 10, ltp: 100 },
    ]);
    expect(r.alignmentPct).toBe(100);
  });
});

describe("blendTargets — allocation-weighted blend of several models", () => {
  it("combines two models by allocation into one normalized vector", () => {
    const blend = blendTargets([
      { allocation: 1, weights: [{ symbol: "A", weight: 1 }] },
      { allocation: 1, weights: [{ symbol: "B", weight: 1 }] },
    ]);
    const bySym = Object.fromEntries(blend.map((x) => [x.symbol, x.weight]));
    expect(bySym.A).toBeCloseTo(0.5);
    expect(bySym.B).toBeCloseTo(0.5);
  });

  it("weights by allocation (3:1 → 0.75/0.25)", () => {
    const blend = blendTargets([
      { allocation: 3, weights: [{ symbol: "A", weight: 1 }] },
      { allocation: 1, weights: [{ symbol: "B", weight: 1 }] },
    ]);
    const bySym = Object.fromEntries(blend.map((x) => [x.symbol, x.weight]));
    expect(bySym.A).toBeCloseTo(0.75);
    expect(bySym.B).toBeCloseTo(0.25);
  });
});
