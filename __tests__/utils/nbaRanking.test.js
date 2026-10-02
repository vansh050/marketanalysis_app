/**
 * DRIFT TRIPWIRE — ported 1:1 from prod-alphaquark-github @ de22d67e
 *   (src/__tests__/utils/nbaRanking.test.js). Only the import paths changed
 *   (brokerStatus + RecoveryAction now resolve to the local nba enum modules).
 * If this fails after a web engine change, re-sync src/utils/nba/nbaRanking.js
 * from the pinned commit. See docs/WEB_PARITY_MIGRATION_2026-06.md §4.2 (D2).
 */
import { rankActions, focalAction, isAllCaughtUp, NBA_KIND } from "../../src/utils/nba/nbaRanking";
import { BROKER_STATUS } from "../../src/utils/nba/brokerStatus";
import { RecoveryAction } from "../../src/utils/nba/recoveryActions";

// nbaRanking is the NBA brain. These tests pin (a) the reconciled priority order,
// (b) ActionCenter coverage parity (the regression criterion), and (c) the no-nag
// rules for MANUAL / transient broker states.

describe("idle / caught-up", () => {
  it("returns no actions when nothing needs doing (live broker, no recovery/rebalance/reco)", () => {
    const s = { brokerState: BROKER_STATUS.OK };
    expect(rankActions(s)).toEqual([]);
    expect(isAllCaughtUp(s)).toBe(true);
    expect(focalAction(s)).toBeNull();
  });

  it("empty signals → caught up (no throws)", () => {
    expect(rankActions()).toEqual([]);
    expect(rankActions({})).toEqual([]);
  });
});

describe("individual blockers fire", () => {
  it("finish_signing for a digio recovery", () => {
    expect(focalAction({ recovery: { action: RecoveryAction.COMPLETE_DIGIO } }).kind).toBe(NBA_KIND.FINISH_SIGNING);
    expect(focalAction({ recovery: { action: RecoveryAction.RETRY_DIGIO } }).kind).toBe(NBA_KIND.FINISH_SIGNING);
  });

  it("reconnect_broker for TOKEN_EXPIRED", () => {
    expect(focalAction({ brokerState: BROKER_STATUS.TOKEN_EXPIRED }).kind).toBe(NBA_KIND.RECONNECT_BROKER);
  });

  it("connect_broker for NOT_CONNECTED", () => {
    expect(focalAction({ brokerState: BROKER_STATUS.NOT_CONNECTED }).kind).toBe(NBA_KIND.CONNECT_BROKER);
  });

  it("payment_recovery for a non-digio recovery; meta.failed flips on PAYMENT_FAILED", () => {
    expect(focalAction({ recovery: { action: RecoveryAction.RETRY_PAYMENT } }).kind).toBe(NBA_KIND.PAYMENT_RECOVERY);
    const failed = focalAction({ recovery: { action: RecoveryAction.PAYMENT_FAILED } });
    expect(failed.kind).toBe(NBA_KIND.PAYMENT_RECOVERY);
    expect(failed.meta.failed).toBe(true);
  });

  it("review_repair_trades when repairTradesCount > 0", () => {
    expect(focalAction({ repairTradesCount: 2 }).kind).toBe(NBA_KIND.REVIEW_REPAIR_TRADES);
  });

  it("names an account blocker ahead of unusable Repair trades", () => {
    const action = focalAction({
      accountRecovery: {
        blocked: true,
        state: "ownership_conflict",
        message: "Unverified: GTLINFRA.",
        nextAction: {label: "Review portfolio holdings"},
      },
      repairTradesCount: 2,
    });
    expect(action.kind).toBe(NBA_KIND.ACCOUNT_RECOVERY);
    expect(action.title).toBe("Portfolio holdings need review");
    expect(action.detail).toContain("GTLINFRA");
  });

  it("accept_rebalance names the model and picks the OLDEST rebalanceDate", () => {
    const a = focalAction({
      pendingRebalances: [
        { modelName: "Momentum 50", rebalanceDate: "2026-05-30" },
        { modelName: "Bluechip", rebalanceDate: "2026-05-20" }, // older → should win
      ],
    });
    expect(a.kind).toBe(NBA_KIND.ACCEPT_REBALANCE);
    expect(a.title).toContain("Bluechip");
    expect(a.meta.count).toBe(2);
  });

  it("act_on_recommendation / tax_tip / explore_model nudges", () => {
    expect(focalAction({ newRecommendationsCount: 1 }).kind).toBe(NBA_KIND.ACT_ON_RECOMMENDATION);
    expect(focalAction({ taxTips: [{}] }).kind).toBe(NBA_KIND.TAX_TIP);
    expect(focalAction({ modelNudges: [{}] }).kind).toBe(NBA_KIND.EXPLORE_MODEL);
  });
});

describe("no-nag rules (the deliberate-disconnect / transient rules)", () => {
  it("MANUAL never produces connect/reconnect", () => {
    const actions = rankActions({ brokerState: BROKER_STATUS.MANUAL, newRecommendationsCount: 1 });
    const kinds = actions.map((a) => a.kind);
    expect(kinds).not.toContain(NBA_KIND.CONNECT_BROKER);
    expect(kinds).not.toContain(NBA_KIND.RECONNECT_BROKER);
    // a manual-mode user can still be told about a recommendation
    expect(kinds).toContain(NBA_KIND.ACT_ON_RECOMMENDATION);
  });

  it("TRANSIENT and PROBE_FAILED never nag to connect/reconnect", () => {
    [BROKER_STATUS.TRANSIENT, BROKER_STATUS.PROBE_FAILED].forEach((st) => {
      const kinds = rankActions({ brokerState: st }).map((a) => a.kind);
      expect(kinds).not.toContain(NBA_KIND.CONNECT_BROKER);
      expect(kinds).not.toContain(NBA_KIND.RECONNECT_BROKER);
    });
  });

  it("OK broker produces no broker action", () => {
    expect(rankActions({ brokerState: BROKER_STATUS.OK }).map((a) => a.kind))
      .not.toContain(NBA_KIND.CONNECT_BROKER);
  });
});

describe("priority order + digio/payment exclusivity", () => {
  it("digio_pending outranks a token-expired broker", () => {
    const a = rankActions({
      recovery: { action: RecoveryAction.COMPLETE_DIGIO },
      brokerState: BROKER_STATUS.TOKEN_EXPIRED,
    });
    expect(a[0].kind).toBe(NBA_KIND.FINISH_SIGNING);
    expect(a[1].kind).toBe(NBA_KIND.RECONNECT_BROKER);
  });

  it("a digio recovery does NOT also emit a payment_recovery card (mutually exclusive)", () => {
    const kinds = rankActions({ recovery: { action: RecoveryAction.COMPLETE_DIGIO } }).map((a) => a.kind);
    expect(kinds).toContain(NBA_KIND.FINISH_SIGNING);
    expect(kinds).not.toContain(NBA_KIND.PAYMENT_RECOVERY);
  });

  it("full stack ranks in the committed order", () => {
    const kinds = rankActions({
      recovery: { action: RecoveryAction.COMPLETE_DIGIO },
      brokerState: BROKER_STATUS.TOKEN_EXPIRED,
      repairTradesCount: 1,
      pendingRebalances: [{ modelName: "M", rebalanceDate: "2026-01-01" }],
      newRecommendationsCount: 1,
      taxTips: [{}],
      modelNudges: [{}],
    }).map((a) => a.kind);
    expect(kinds).toEqual([
      NBA_KIND.FINISH_SIGNING,
      NBA_KIND.RECONNECT_BROKER,
      NBA_KIND.REVIEW_REPAIR_TRADES,
      NBA_KIND.ACCEPT_REBALANCE,
      NBA_KIND.ACT_ON_RECOMMENDATION,
      NBA_KIND.TAX_TIP,
      NBA_KIND.EXPLORE_MODEL,
    ]);
  });
});

describe("ActionCenter coverage parity (regression criterion)", () => {
  // Every blocker class ActionCenter surfaces must be reproducible by the ranking.
  it("covers digio_pending, broker_expired, payment_recovery, repair, no_broker", () => {
    expect(focalAction({ recovery: { action: RecoveryAction.COMPLETE_DIGIO } }).kind).toBe(NBA_KIND.FINISH_SIGNING);
    expect(focalAction({ brokerState: BROKER_STATUS.TOKEN_EXPIRED }).kind).toBe(NBA_KIND.RECONNECT_BROKER);
    expect(focalAction({ recovery: { action: RecoveryAction.PAYMENT_FAILED } }).kind).toBe(NBA_KIND.PAYMENT_RECOVERY);
    expect(focalAction({ repairTradesCount: 1 }).kind).toBe(NBA_KIND.REVIEW_REPAIR_TRADES);
    expect(focalAction({ brokerState: BROKER_STATUS.NOT_CONNECTED }).kind).toBe(NBA_KIND.CONNECT_BROKER);
  });
});
