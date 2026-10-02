/**
 * DRIFT TRIPWIRE — ported 1:1 from prod-alphaquark-github @ de22d67e
 *   (src/__tests__/utils/portfolioHealth.test.js). Only the import path changed.
 * If this suite fails after a web engine change, re-sync src/utils/nba/portfolioHealth.js
 * from the pinned commit. See docs/WEB_PARITY_MIGRATION_2026-06.md §4.2 (D2).
 */
import { computeHealthSubScores, HEALTH_SUBSCORE, DEFAULT_ENABLED } from "../../src/utils/nba/portfolioHealth";

// portfolioHealth is the TOOL engine — FACTUAL sub-scores only. These tests pin the
// math + the gap flags AND assert the output can never carry advice (decision 4A).

const h = (symbol, quantity, ltp) => ({ symbol, quantity, ltp });
const byKey = (res, k) => res.subScores.find((s) => s.key === k);

describe("empty / invalid", () => {
  it("returns zeros for no holdings", () => {
    const r = computeHealthSubScores([]);
    expect(r).toMatchObject({ holdingsCount: 0, totalValue: 0, gapCount: 0 });
  });
  it("ignores zero/invalid-value holdings", () => {
    const r = computeHealthSubScores([h("A", 0, 100), h("B", 10, 0), h("C", 5, 20)]);
    expect(r.holdingsCount).toBe(1); // only C has value
  });
  it("never throws on junk input", () => {
    expect(() => computeHealthSubScores(null)).not.toThrow();
    expect(() => computeHealthSubScores([null, {}, { quantity: "x", ltp: "y" }])).not.toThrow();
  });
});

describe("concentration", () => {
  it("computes the top holding's % and flags a gap over threshold", () => {
    // RELIANCE 38k of 100k total = 38%
    const r = computeHealthSubScores([
      h("RELIANCE", 38, 1000), h("A", 20, 1000), h("B", 20, 1000), h("C", 22, 1000),
    ]);
    const c = byKey(r, HEALTH_SUBSCORE.CONCENTRATION);
    expect(c.value).toBe(38);
    expect(c.detail).toContain("RELIANCE");
    expect(c.isGap).toBe(true); // > 30
  });
  it("no concentration gap for an even spread", () => {
    const r = computeHealthSubScores([h("A", 25, 100), h("B", 25, 100), h("C", 25, 100), h("D", 25, 100)]);
    expect(byKey(r, HEALTH_SUBSCORE.CONCENTRATION).isGap).toBe(false); // 25% < 30
  });
});

describe("top-3, spread, diversification", () => {
  it("top-3 weight + spread count", () => {
    const r = computeHealthSubScores([
      h("A", 40, 100), h("B", 30, 100), h("C", 20, 100), h("D", 5, 100), h("E", 5, 100),
    ]);
    expect(byKey(r, HEALTH_SUBSCORE.TOP3_CONCENTRATION).value).toBe(90); // 40+30+20
    expect(byKey(r, HEALTH_SUBSCORE.TOP3_CONCENTRATION).isGap).toBe(true); // > 60
    expect(byKey(r, HEALTH_SUBSCORE.SPREAD).value).toBe(5);
    expect(byKey(r, HEALTH_SUBSCORE.SPREAD).isGap).toBe(false); // 5 is not < 5
  });
  it("flags a thin portfolio (spread gap)", () => {
    const r = computeHealthSubScores([h("A", 50, 100), h("B", 50, 100)]);
    expect(byKey(r, HEALTH_SUBSCORE.SPREAD).isGap).toBe(true); // 2 < 5
  });
  it("effective-diversification (HHI) ~ even portfolio approaches N", () => {
    const r = computeHealthSubScores([h("A", 25, 100), h("B", 25, 100), h("C", 25, 100), h("D", 25, 100)]);
    expect(byKey(r, HEALTH_SUBSCORE.DIVERSIFICATION).value).toBe(4); // 1/Σ(0.25²)=4
    expect(byKey(r, HEALTH_SUBSCORE.DIVERSIFICATION).isGap).toBe(false);
  });
});

describe("optional sub-scores (only when data supplied)", () => {
  it("cash-drag only when availableCash given", () => {
    const holdings = [h("A", 80, 1000)]; // 80k invested
    expect(byKey(computeHealthSubScores(holdings), HEALTH_SUBSCORE.CASH_DRAG)).toBeUndefined();
    const r = computeHealthSubScores(holdings, { availableCash: 20000 }); // 20k / 100k = 20%
    expect(byKey(r, HEALTH_SUBSCORE.CASH_DRAG).value).toBe(20);
    expect(byKey(r, HEALTH_SUBSCORE.CASH_DRAG).isGap).toBe(true); // > 15
  });
  it("sector-tilt only when sectorOf supplied", () => {
    const holdings = [h("TCS", 60, 1000), h("INFY", 20, 1000), h("HDFC", 20, 1000)];
    expect(byKey(computeHealthSubScores(holdings), HEALTH_SUBSCORE.SECTOR_TILT)).toBeUndefined();
    const sectorOf = (s) => (s === "HDFC" ? "Banking" : "IT");
    const r = computeHealthSubScores(holdings, { sectorOf });
    const t = byKey(r, HEALTH_SUBSCORE.SECTOR_TILT);
    expect(t.value).toBe(80); // IT = TCS+INFY = 80%
    expect(t.detail).toContain("IT");
    expect(t.isGap).toBe(true); // > 40
  });
  it("respects advisor thresholds + enabled selection", () => {
    const holdings = [h("A", 40, 1000), h("B", 60, 1000)];
    const r = computeHealthSubScores(holdings, {
      enabled: [HEALTH_SUBSCORE.CONCENTRATION],
      thresholds: { concentrationPct: 70 },
    });
    expect(r.subScores).toHaveLength(1);
    expect(byKey(r, HEALTH_SUBSCORE.CONCENTRATION).isGap).toBe(false); // 60% < 70 override
  });
});

describe("DEFAULT_ENABLED (config default — no implied coverage)", () => {
  it("is exactly the four holdings-only sub-scores (cash_drag + sector_tilt excluded)", () => {
    expect(DEFAULT_ENABLED).toEqual([
      HEALTH_SUBSCORE.CONCENTRATION,
      HEALTH_SUBSCORE.TOP3_CONCENTRATION,
      HEALTH_SUBSCORE.SPREAD,
      HEALTH_SUBSCORE.DIVERSIFICATION,
    ]);
    expect(DEFAULT_ENABLED).not.toContain(HEALTH_SUBSCORE.CASH_DRAG);
    expect(DEFAULT_ENABLED).not.toContain(HEALTH_SUBSCORE.SECTOR_TILT);
  });
  it("with DEFAULT_ENABLED, cash_drag + sector_tilt never surface even if their data is supplied", () => {
    const holdings = [h("TCS", 60, 1000), h("INFY", 20, 1000), h("HDFC", 20, 1000)];
    const r = computeHealthSubScores(holdings, {
      enabled: DEFAULT_ENABLED,
      availableCash: 50000, // would normally trip cash_drag
      sectorOf: (s) => (s === "HDFC" ? "Banking" : "IT"), // would normally trip sector_tilt
    });
    expect(byKey(r, HEALTH_SUBSCORE.CASH_DRAG)).toBeUndefined();
    expect(byKey(r, HEALTH_SUBSCORE.SECTOR_TILT)).toBeUndefined();
    expect(r.subScores.map((s) => s.key).sort()).toEqual([...DEFAULT_ENABLED].sort());
  });
});

describe("gapCount + SEBI factual-only shape", () => {
  it("gapCount counts flagged sub-scores", () => {
    const r = computeHealthSubScores([h("RELIANCE", 60, 1000), h("B", 40, 1000)]);
    // concentration 60>30 gap, top3 n/a (count<3), spread 2<5 gap, diversification low gap
    expect(r.gapCount).toBeGreaterThanOrEqual(2);
  });
  it("sub-scores carry NO advice fields (cannot express buy/sell/recommendation)", () => {
    const r = computeHealthSubScores([h("A", 50, 100), h("B", 50, 100)]);
    r.subScores.forEach((s) => {
      expect(Object.keys(s).sort()).toEqual(["detail", "isGap", "key", "label", "value"]);
      ["action", "recommendation", "advice", "buy", "sell", "cta"].forEach((bad) =>
        expect(s).not.toHaveProperty(bad)
      );
    });
  });
});
