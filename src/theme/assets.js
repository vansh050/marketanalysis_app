/**
 * ============================================================================
 * SEMANTIC ASSET TOKENS — variant-overridable static images
 * ============================================================================
 *
 * Single source of truth for static images that variants need to swap. Each
 * key resolves to a React Native asset reference (the integer the bundler
 * returns from `require(...)` — already loaded into the asset registry).
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below (the AlphaQuark logos shipped in this repo)
 *   2. Variant override — a custom variant ships its own
 *      `designs/<variant>/tokens/assets.js` re-exporting a different
 *      `DEFAULT_ASSETS` const that points at the variant's own image files.
 *
 * Backend overrides intentionally NOT plumbed. RN's static `require(...)`
 * resolves at bundle time and cannot be swapped at runtime by a config field.
 * Per-tenant override of an asset requires either (a) a build-time
 * `DESIGN_VARIANT` switch (the current path), or (b) a runtime `<Image
 * source={{ uri }}>` with the URL coming from `configData` (a different
 * mechanism, out of scope here). `buildAssets(config)` accepts a config arg
 * for symmetry with the other token builders; it currently ignores it.
 *
 * Phase 2 (whitelabel sync, 2026-05-09) ships only `logoPng` + `logoFadedPng`
 * as the first asset slots. Future asset slots (splash, app-icon-preview,
 * empty-state illustrations, partner logos) get added the same way: a key on
 * `DEFAULT_ASSETS`, a default `require(...)` here, and consumers read it via
 * `useTokens().assets.<key>`.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens and § Variant assets.
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
    // The full-color AlphaQuark logo (default-variant brand mark).
    logoPng: require('../assets/logo.png'),
    // The faded watermark logo used as a card-background ornament in
    // RebalanceCard, BasketCard, and the auth screens.
    logoFadedPng: require('../assets/fadedlogo.png'),
};

/**
 * Build the resolved asset bundle for a given advisor config.
 * `config` is currently ignored (see file header). Kept for symmetry with
 * `buildSpacing`, `buildColors`, etc.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved asset references
 */
export const buildAssets = (config) => merge(DEFAULT_ASSETS, config?.assetTokens);

export default buildAssets;
