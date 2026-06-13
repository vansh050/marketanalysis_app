/**
 * recoveryActions.js — the RecoveryAction enum the NBA engine ranks on.
 *
 * P0 scaffold: ENUM only, copied 1:1 from web (prod-alphaquark-github @ de22d67e,
 * src/services/PendingPaymentManager.js lines 25–33). The full web
 * PendingPaymentManager (which DERIVES a RecoveryAction from payment/digio state)
 * is NOT ported here — on mobile, P4 (payments) maps the app's pending-payment
 * state onto these values when building NbaSignals.recovery.
 *
 * Keep VALUES identical to web — nbaRanking + the ported tests pin them.
 */
export const RecoveryAction = {
  NONE: "NONE",
  COMPLETE_SUBSCRIPTION: "COMPLETE_SUBSCRIPTION",
  COMPLETE_DIGIO: "COMPLETE_DIGIO",
  RETRY_DIGIO: "RETRY_DIGIO",
  WAIT: "WAIT",
  RETRY_PAYMENT: "RETRY_PAYMENT",
  PAYMENT_FAILED: "PAYMENT_FAILED",
};
