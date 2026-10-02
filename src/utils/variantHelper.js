import Config from './safeConfig';
import APP_VARIANTS from './Config';
import {getRuntimeTenantSubdomain} from './runtimeAdvisor';

/**
 * Canonical resolver for the `X-Advisor-Subdomain` request header.
 *
 * USE THIS for every request header. Do NOT pass `getAdvisorSubdomain()` —
 * that returns the BUILD VARIANT (`APP_VARIANT`), which is a different
 * namespace from the tenant key (`REACT_APP_HEADER_NAME`). They coincide on
 * most forks and differ on AlphaPro (`alphaquark` vs `prod`), so sending the
 * variant silently routes the request to a DIFFERENT DATABASE: the backend
 * resolver passes an undotted, unregistered value straight through to
 * connectDB(), and a Mongo database literally named `alphaquark` exists
 * (unregistered in `ccxt_common_db.advisor_config`). Reads there find nothing
 * and writes land in a ghost — the same silent data-split class as the
 * 2026-06-11 `marketanalysisacademy` incident. See CLAUDE.md
 * "BLOCKING — mobile tenant header".
 *
 * @param {object} [configData] TradeContext config, when the caller has it.
 */
export const getBuildTenantSubdomain = () =>
  Config?.REACT_APP_X_ADVISOR_SUBDOMAIN ||
  Config?.REACT_APP_HEADER_NAME ||
  getAdvisorSubdomain();

export const getTenantSubdomain = configData =>
  configData?.config?.REACT_APP_HEADER_NAME ||
  configData?.REACT_APP_HEADER_NAME ||
  configData?.subdomain ||
  getRuntimeTenantSubdomain() ||
  getBuildTenantSubdomain();

export const getAdvisorSubdomain = () => {
  const selectedVariant = Config?.APP_VARIANT || 'alphaquark';
  const variantConfig = APP_VARIANTS[selectedVariant] || APP_VARIANTS['alphaquark'] || {};

  // Return subdomain if exists, otherwise fall back to the variant name itself
  return variantConfig?.subdomain || selectedVariant;
};

export const getAdvisorRaCode = () => {
  const selectedVariant = Config?.APP_VARIANT || 'alphaquark';
  const variantConfig = APP_VARIANTS[selectedVariant] || APP_VARIANTS['alphaquark'] || {};
  return variantConfig?.advisorRaCode || null;
};

export const getGoogleWebClientId = () => {
  const selectedVariant = Config?.APP_VARIANT || 'alphaquark';
  const variantConfig = APP_VARIANTS[selectedVariant] || APP_VARIANTS['alphaquark'] || {};

  // Return googleWebClientId if exists, otherwise return a default/fallback
  return (
    variantConfig?.googleWebClientId ||
    '892331696104-e26pu9iotqrjk1o6jq4ifd4e95fasil1.apps.googleusercontent.com' // Default fallback
  );
};
