/**
 * ============================================================================
 * SEMANTIC SPACING TOKENS
 * ============================================================================
 *
 * Single source of truth for every spacing value used in the app.
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below
 *   2. `spacingTokens` nested object from advisor config (partial overrides)
 *
 * v1: backend overrides are not yet wired through ConfigContext (no
 * appadvisors.spacingTokens field exists). buildSpacing() accepts config for
 * future symmetry; when ConfigContext exposes spacingTokens, defaults will
 * deep-merge with the backend value automatically.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens for the layer model.
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

export const DEFAULT_SPACING = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

/**
 * Build the resolved spacing scale for a given advisor config.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved spacing tokens
 */
export const buildSpacing = (config) => merge(DEFAULT_SPACING, config?.spacingTokens);

export default buildSpacing;
