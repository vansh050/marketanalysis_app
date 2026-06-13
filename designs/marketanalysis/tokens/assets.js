/**
 * ============================================================================
 * designs/marketanalysis/tokens/assets — variant asset overrides
 * ============================================================================
 *
 * Overrides `DEFAULT_ASSETS.logoPng` (and any other asset slot) so consumers
 * that read via `useTokens().assets.logoPng` automatically pick up the
 * marketanalysis brand mark when DESIGN_VARIANT=marketanalysis is active.
 *
 * The brand binaries live under `designs/marketanalysis/assets/` — NEVER
 * inside `src/assets/`. Overwriting `src/assets/*` would mutate upstream's
 * default-variant appearance and re-introduce the Phase-2 cross-tenant leak.
 *
 * See upstream `src/theme/assets.js` for the contract this variant overrides
 * and `docs/WHITELABEL_RECIPE.md` § "Variant assets".
 * ============================================================================
 */

const merge = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
        const value = override[key];
        if (value === undefined || value === null) continue;
        out[key] = value;
    }
    return out;
};

export const DEFAULT_ASSETS = {
    logoPng: require('../assets/logo.png'),
    // No marketanalysis-specific faded watermark yet — falls through to
    // upstream default. Add `logoFadedPng: require('../assets/fadedlogo.png')`
    // here when a branded faded mark is provided.
};

export const buildAssets = (config) => merge(DEFAULT_ASSETS, config?.assetTokens);

export default buildAssets;
