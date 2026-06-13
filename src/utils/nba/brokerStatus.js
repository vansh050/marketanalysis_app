/**
 * brokerStatus.js — the typed broker-status enum the NBA engine ranks on.
 *
 * P0 scaffold: only the ENUM is ported here (the six states), copied 1:1 from web
 * (prod-alphaquark-github @ de22d67e, src/utils/brokerStatus.js). The web file also
 * holds the async classifier (`classifyFundsResponse` / `validateBrokerSession`),
 * which is NOT ported — on mobile, P3 (NBA wiring) maps the app's EXISTING Phase-3
 * broker-status classification onto these string values when it builds NbaSignals.
 *
 * Keep the string VALUES identical to web — nbaRanking compares against them and the
 * ported unit tests pin them. See docs/WEB_PARITY_MIGRATION_2026-06.md §5.2.
 *
 *   OK             live broker, funds fresh
 *   NOT_CONNECTED  no broker / status !== "connected" (and not deliberate manual)
 *   TOKEN_EXPIRED  real auth failure → reconnect
 *   TRANSIENT      broker maintenance window → not an error
 *   PROBE_FAILED   network blip reaching ccxt → stay quiet, retry
 *   MANUAL         deliberate DummyBroker / "continue without broker" → do NOT nag
 */
export const BROKER_STATUS = {
  OK: "OK",
  NOT_CONNECTED: "NOT_CONNECTED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TRANSIENT: "TRANSIENT",
  PROBE_FAILED: "PROBE_FAILED",
  MANUAL: "MANUAL",
};
