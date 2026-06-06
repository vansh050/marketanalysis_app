/**
 * ============================================================================
 * SEMANTIC SHADOW TOKENS
 * ============================================================================
 *
 * Single source of truth for every elevation/shadow style used in the app.
 *
 * Each token is a React Native style object — iOS keys (shadowColor /
 * shadowOffset / shadowOpacity / shadowRadius) AND Android key (elevation)
 * are both set so the same token works on both platforms.
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below
 *   2. `shadowTokens` nested object from advisor config (partial, deep-merged)
 *
 * v1: backend overrides are not yet wired through ConfigContext.
 * buildShadows() accepts config for future symmetry.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens for the layer model.
 * ============================================================================
 */

const mergeStyle = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    return { ...base, ...override };
};

const mergeShadows = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
        const value = override[key];
        if (!value || typeof value !== 'object') continue;
        out[key] = mergeStyle(base[key] || {}, value);
    }
    return out;
};

export const DEFAULT_SHADOWS = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    elevated: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    modal: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    floating: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 12,
    },
};

/**
 * Build the resolved shadow tokens for a given advisor config.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved shadow tokens (per-role RN style objects)
 */
export const buildShadows = (config) => mergeShadows(DEFAULT_SHADOWS, config?.shadowTokens);

export default buildShadows;
