/**
 * NBA / Portfolio-Health engine bundle — pure, SEBI-sensitive logic ported from web.
 * P0 foundations (docs/WEB_PARITY_MIGRATION_2026-06.md §4.2, D2). Logic only — the
 * visual surfaces live in designs/default/ (NbaBanner, PortfolioHealthSheet, …) and
 * consume these engines via thin src containers.
 *
 * Pinned to prod-alphaquark-github @ de22d67e. Re-sync via the drift tripwire suites
 * in __tests__/utils/ when web changes any engine.
 */
export { rankActions, focalAction, isAllCaughtUp, NBA_KIND } from "./nbaRanking";
export {
  computeHealthSubScores,
  HEALTH_SUBSCORE,
  DEFAULT_ENABLED,
} from "./portfolioHealth";
export {
  computeTransition,
  blendTargets,
  TRANSITION_BUCKET,
} from "./portfolioTransition";
export { BROKER_STATUS } from "./brokerStatus";
export { RecoveryAction } from "./recoveryActions";
