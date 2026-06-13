/**
 * ───────────────────────────────────────────────────────────────────────────
 * PORTED FROM WEB — prod-alphaquark-github @ de22d67e
 *   source: src/utils/nbaRanking.js
 * VERBATIM logic. The ONLY change vs web is the two import paths (BROKER_STATUS +
 * RecoveryAction now resolve to local enum modules in this folder instead of web's
 * ./brokerStatus and ../services/PendingPaymentManager). Behaviour is identical and
 * pinned by the ported test suite.
 *
 * DRIFT TRIPWIRE (D2, docs/WEB_PARITY_MIGRATION_2026-06.md §4.2):
 *   __tests__/utils/nbaRanking.test.js is the web suite ported 1:1. On a web engine
 *   change, re-sync from the pinned commit and re-run; mismatch fails CI.
 * Pure + deterministic — no React, no network, no clock.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * nbaRanking.js — the Next-Best-Action brain.
 *
 * Pure, deterministic ranking of "what should this customer do next?" The NBA home
 * shows actions[0] as the focal card; the rest queue beneath it (count chip).
 *
 * PARITY (regression criterion, CUSTOMER_JOURNEY_NBA_REDESIGN.md §Phase 0): this
 * must reproduce every blocker the existing ActionCenter already surfaces, so
 * replacing the home is not a regression. ActionCenter's classes:
 *   digio_pending · broker_expired (TOKEN_EXPIRED) · payment_recovery · repair · no_broker
 * On top, the NBA adds the forward nudges the doc commits to:
 *   accept-rebalance · act-on-recommendation · tax-tip · explore-model
 *
 * Reconciled priority order (the contract; weighting is a tuning detail):
 *   1 finish_signing        digio_pending (post-payment must close)
 *   2 reconnect_broker      broker TOKEN_EXPIRED
 *   3 connect_broker        broker NOT_CONNECTED  (deliberate MANUAL never nags)
 *   4 payment_recovery      non-digio recovery (retry / check)
 *   5 review_repair_trades  failed rebalance legs need review
 *   6 accept_rebalance      pending model rebalance(s), oldest rebalanceDate first
 *   7 act_on_recommendation new RA recommendation(s)
 *   8 tax_tip               timing/tax nudge
 *   9 explore_model         discovery nudge
 *
 * NOTE on order vs ActionCenter: ActionCenter ranks payment_recovery ABOVE no_broker;
 * here connect_broker (#3) sits above payment_recovery (#4) — a connected broker is a
 * prerequisite to act on anything. This is the one deliberate reorder; coverage parity
 * (all five classes can fire) is preserved and asserted in tests.
 *
 * KYC: the doc's "KYC incomplete" top-rank is deferred until KYC state is normalized
 * (TODOS.md). The interim KYC blocker is exactly digio_pending (#1) — we do NOT invent
 * a separate coarse-KYC rank here. `signals.kycComplete` is accepted for forward-compat
 * but only suppresses a (future) KYC nudge; it never fabricates a blocker today.
 */
import { BROKER_STATUS } from "./brokerStatus";
import { RecoveryAction } from "./recoveryActions";

export const NBA_KIND = {
  FINISH_SIGNING: "finish_signing",
  RECONNECT_BROKER: "reconnect_broker",
  CONNECT_BROKER: "connect_broker",
  PAYMENT_RECOVERY: "payment_recovery",
  REVIEW_REPAIR_TRADES: "review_repair_trades",
  ACCEPT_REBALANCE: "accept_rebalance",
  ACT_ON_RECOMMENDATION: "act_on_recommendation",
  TAX_TIP: "tax_tip",
  EXPLORE_MODEL: "explore_model",
};

const isDigioRecovery = (a) =>
  a === RecoveryAction.COMPLETE_DIGIO || a === RecoveryAction.RETRY_DIGIO;

// A non-digio recovery action that warrants a payment card (mirrors ActionCenter §3).
const isPaymentRecovery = (a) =>
  Boolean(a) &&
  a !== RecoveryAction.NONE &&
  a !== RecoveryAction.WAIT &&
  !isDigioRecovery(a);

/**
 * @typedef {Object} NbaSignals
 * @property {string} [brokerState]        a BROKER_STATUS value (from deriveBrokerStatus)
 * @property {{action: string}|null} [recovery]  pending-payment recovery result
 * @property {number} [repairTradesCount]  failed rebalance legs needing review
 * @property {Array<{modelName?: string, rebalanceDate?: string|number}>} [pendingRebalances]
 * @property {number} [newRecommendationsCount]
 * @property {Array} [taxTips]
 * @property {Array} [modelNudges]         discovery suggestions
 * @property {boolean} [kycComplete]       interim coarse signal (forward-compat; see header)
 */

/**
 * Compute the ordered next-best-actions. Highest priority first. Empty array means
 * "nothing needs action" → the home shows the idle / all-caught-up state.
 *
 * Pure: same input → same output. No React, no network, no clock.
 * @param {NbaSignals} signals
 * @returns {Array<{key:string, kind:string, priority:number, title:string, detail?:string, ctaLabel?:string, meta?:object}>}
 */
export function rankActions(signals = {}) {
  const {
    brokerState = null,
    recovery = null,
    repairTradesCount = 0,
    pendingRebalances = [],
    newRecommendationsCount = 0,
    taxTips = [],
    modelNudges = [],
  } = signals;

  const recoveryAction = recovery?.action || null;
  const actions = [];
  let priority = 0;
  const push = (a) => actions.push({ ...a, priority: priority++ });

  // 1 — finish signing (post-payment digio). The interim KYC blocker too.
  if (isDigioRecovery(recoveryAction)) {
    push({
      key: NBA_KIND.FINISH_SIGNING,
      kind: NBA_KIND.FINISH_SIGNING,
      title: "Finish signing to activate",
      detail: "Your payment is complete — sign the document to activate your subscription.",
      ctaLabel: "Resume signing",
    });
  }

  // 2 — reconnect broker (real auth failure). MANUAL/TRANSIENT/PROBE_FAILED never nag.
  if (brokerState === BROKER_STATUS.TOKEN_EXPIRED) {
    push({
      key: NBA_KIND.RECONNECT_BROKER,
      kind: NBA_KIND.RECONNECT_BROKER,
      title: "Reconnect your broker",
      detail: "Your broker session expired. Reconnect to keep trading.",
      ctaLabel: "Reconnect",
    });
  }

  // 3 — connect broker (never connected). Deliberate MANUAL mode is NOT nagged.
  if (brokerState === BROKER_STATUS.NOT_CONNECTED) {
    push({
      key: NBA_KIND.CONNECT_BROKER,
      kind: NBA_KIND.CONNECT_BROKER,
      title: "Connect your broker",
      detail: "Link your broker to import holdings and place trades in one tap.",
      ctaLabel: "Connect broker",
    });
  }

  // 4 — payment recovery (non-digio).
  if (isPaymentRecovery(recoveryAction)) {
    const failed = recoveryAction === RecoveryAction.PAYMENT_FAILED;
    push({
      key: NBA_KIND.PAYMENT_RECOVERY,
      kind: NBA_KIND.PAYMENT_RECOVERY,
      title: failed ? "Payment failed" : "Payment needs attention",
      detail: failed
        ? "Your last payment didn't go through. Retry to activate your subscription."
        : "Your payment is being processed. Check status or retry if needed.",
      ctaLabel: failed ? "Retry payment" : "Check payment",
      meta: { failed },
    });
  }

  // 5 — repair trades.
  if (repairTradesCount > 0) {
    push({
      key: NBA_KIND.REVIEW_REPAIR_TRADES,
      kind: NBA_KIND.REVIEW_REPAIR_TRADES,
      title: "Some trades need review",
      detail: `${repairTradesCount} rebalance trade${repairTradesCount !== 1 ? "s" : ""} couldn't complete automatically.`,
      ctaLabel: "Review trades",
      meta: { count: repairTradesCount },
    });
  }

  // 6 — pending model rebalance(s), oldest rebalanceDate first. Names WHICH model.
  if (Array.isArray(pendingRebalances) && pendingRebalances.length > 0) {
    const sorted = [...pendingRebalances].sort(
      (a, b) => toTime(a?.rebalanceDate) - toTime(b?.rebalanceDate)
    );
    const oldest = sorted[0];
    push({
      key: NBA_KIND.ACCEPT_REBALANCE,
      kind: NBA_KIND.ACCEPT_REBALANCE,
      title: oldest?.modelName ? `Rebalance ${oldest.modelName}` : "Accept your rebalance",
      detail: "Your manager updated this model. Review the trades for your holdings.",
      ctaLabel: "Review rebalance",
      meta: { count: pendingRebalances.length, modelName: oldest?.modelName || null },
    });
  }

  // 7 — new recommendation(s).
  if (newRecommendationsCount > 0) {
    push({
      key: NBA_KIND.ACT_ON_RECOMMENDATION,
      kind: NBA_KIND.ACT_ON_RECOMMENDATION,
      title: newRecommendationsCount === 1 ? "1 new recommendation" : `${newRecommendationsCount} new recommendations`,
      detail: "From your manager — review and act.",
      ctaLabel: "View",
      meta: { count: newRecommendationsCount },
    });
  }

  // 8 — tax / timing tip.
  if (Array.isArray(taxTips) && taxTips.length > 0) {
    push({
      key: NBA_KIND.TAX_TIP,
      kind: NBA_KIND.TAX_TIP,
      title: "A tax-timing tip",
      detail: "There's a timing move worth a look.",
      ctaLabel: "See",
      meta: { count: taxTips.length },
    });
  }

  // 9 — discovery nudge.
  if (Array.isArray(modelNudges) && modelNudges.length > 0) {
    push({
      key: NBA_KIND.EXPLORE_MODEL,
      kind: NBA_KIND.EXPLORE_MODEL,
      title: "Worth a look",
      detail: "A model that matches your profile.",
      ctaLabel: "View",
      meta: { count: modelNudges.length },
    });
  }

  return actions;
}

/** The single focal action (or null when caught up). */
export function focalAction(signals) {
  return rankActions(signals)[0] || null;
}

/** True when nothing needs action → home shows the idle / all-caught-up state. */
export function isAllCaughtUp(signals) {
  return rankActions(signals).length === 0;
}

function toTime(d) {
  if (d == null) return Number.POSITIVE_INFINITY; // undated → sort last among rebalances
  const t = typeof d === "number" ? d : Date.parse(d);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}
