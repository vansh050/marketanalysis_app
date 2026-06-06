/**
 * ============================================================================
 * SEMANTIC BORDER-RADIUS TOKENS
 * ============================================================================
 *
 * Single source of truth for every borderRadius value used in the app.
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below
 *   2. `radiiTokens` nested object from advisor config (partial overrides)
 *
 * v1: backend overrides are not yet wired through ConfigContext.
 * buildRadii() accepts config for future symmetry.
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

export const DEFAULT_RADII = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999,
};

/**
 * Build the resolved radii scale for a given advisor config.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved radii tokens
 */
export const buildRadii = (config) => merge(DEFAULT_RADII, config?.radiiTokens);

export default buildRadii;
