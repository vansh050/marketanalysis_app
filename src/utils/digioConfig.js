/**
 * Resolve the backend-owned Digio enablement flag.
 *
 * AppAdvisor.digioConfig.digioEnabled is authoritative. Missing, stale, or
 * malformed values do not enable Digio; tenant policy must be explicit in the
 * backend. Payment-create routes independently enforce pre-payment signing.
 * See docs/MODEL_PORTFOLIO.md.
 */
export const isDigioEnabledFromBackend = digioEnabled =>
  digioEnabled === true;

export default isDigioEnabledFromBackend;
