/**
 * ============================================================================
 * SEMANTIC TYPOGRAPHY TOKENS
 * ============================================================================
 *
 * Single source of truth for every text style used in the app.
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below (Poppins family — shipped in
 *      android/app/src/main/assets/fonts/)
 *   2. `typographyTokens` nested object from advisor config (partial,
 *      deep-merged)
 *
 * Font note: this repo ships Poppins (full weight set) and Satoshi (Variable +
 * static). Defaults below pick Poppins for consistency. A custom variant may
 * override `fontFamily` per role (e.g. headings in Satoshi-Bold) by exporting
 * a `typographyTokens` object from `designs/<variant>/tokens/typography.js`.
 *
 * v1: backend overrides are not yet wired through ConfigContext (no
 * appadvisors.typographyTokens field exists). buildTypography() accepts config
 * for future symmetry; when ConfigContext exposes typographyTokens, defaults
 * deep-merge with the backend value automatically.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens for the layer model.
 * ============================================================================
 */

const mergeStyle = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    return { ...base, ...override };
};

const mergeTypography = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
        const value = override[key];
        if (!value || typeof value !== 'object') continue;
        out[key] = mergeStyle(base[key] || {}, value);
    }
    return out;
};

export const DEFAULT_TYPOGRAPHY = {
    heading: {
        fontFamily: 'Poppins-Bold',
        fontSize: 22,
        lineHeight: 28,
        fontWeight: '700',
    },
    title: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 24,
        fontWeight: '600',
    },
    subtitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
    },
    body: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    },
    bodyEmphasis: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    caption: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400',
    },
    muted: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '400',
    },
    button: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
    },
};

/**
 * Build the resolved typography scale for a given advisor config.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved typography tokens (per-role text style objects)
 */
export const buildTypography = (config) =>
    mergeTypography(DEFAULT_TYPOGRAPHY, config?.typographyTokens);

export default buildTypography;
