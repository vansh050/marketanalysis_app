/**
 * ============================================================================
 * SEMANTIC COLOR TOKENS
 * ============================================================================
 *
 * Single source of truth for every color used in the app.
 *
 * Resolution order (last wins):
 *   1. Static defaults defined below (preserve current visuals)
 *   2. Legacy branding fields from advisor config (themeColor, mainColor,
 *      gradient1, gradient2, basket1..., tabIconColor, etc.)
 *   3. `colorTokens` nested object from advisor config (partial overrides —
 *      advisors set any subset in support.alphaquark.in)
 *
 * See docs/COLOR_TOKENS.md for the full token catalog and docs/COLOR_SYSTEM.md
 * for how to change colors from the advisor config UI.
 * ============================================================================
 */

const identity = (v) => v;

const merge = (base, override) => {
    if (!override || typeof override !== 'object') return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
        const value = override[key];
        if (value === undefined || value === null || value === '') continue;
        if (
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            out[key] = merge(base[key], value);
        } else {
            out[key] = value;
        }
    }
    return out;
};

export const DEFAULT_TOKENS = {
    brand: {
        primary: '#0D021F',
        secondary: '#ffffff',
        accent: '#ff0000',
        gradientStart: '#F0F0F0',
        gradientEnd: '#773D9A',
        onBrand: '#ffffff',
        placeholder: '#B893F1',
    },
    text: {
        primary: '#111827',
        secondary: '#374151',
        muted: '#6B7280',
        disabled: '#9CA3AF',
        inverse: '#ffffff',
        link: '#0056B7',
        onBrand: '#ffffff',
    },
    surface: {
        base: '#ffffff',
        card: '#ffffff',
        elevated: '#ffffff',
        subtle: '#F8F9FC',
        muted: '#F0F0F0',
        strong: '#E5E7EB',
        inverse: '#111827',
    },
    border: {
        default: '#E5E7EB',
        subtle: '#F0F0F0',
        strong: '#CCCCCC',
        focus: '#0056B7',
    },
    status: {
        success: '#16A34A',
        successBg: '#DCFCE7',
        danger: '#DC2626',
        dangerBg: '#FEE2E2',
        warning: '#F59E0B',
        warningBg: '#FEF3C7',
        info: '#2563EB',
        infoBg: '#DBEAFE',
    },
    pnl: {
        profit: '#16A34A',
        profitBg: '#DCFCE7',
        loss: '#DC2626',
        lossBg: '#FEE2E2',
        neutral: '#6B7280',
    },
    nav: {
        tabBg: '#242424',
        tabBorder: 'transparent',
        tabIcon: '#ffffff',
        tabIconActive: '#8555EF',
    },
    basket: {
        start: '#6A29CA',
        end: '#4F0A9E',
        card: '#600CC0',
        symbolBg: '#6D0DD6',
    },
    chart: {
        series: [
            '#EAE7DC', '#F5F3F4', '#D4ECDD', '#FFDDC1', '#F8E9A1',
            '#B2C9AB', '#FFC8A2', '#F6BD60', '#CB997E', '#A5A58D',
            '#E4F1FE', '#D7E3FC', '#CCDBFD', '#ABC4FF', '#B6E2D3',
            '#FAD9C1', '#EDDCD2', '#FFF1E6', '#F0EFEB', '#DFE7FD',
        ],
    },
    emptyState: {
        backgroundColor: '#6B1400',
        darkerColor: '#3A0B00',
        mediumColor: '#4D2418',
        brighterColor: '#8B2500',
        mutedColor: '#5A3327',
        lightColor: '#F8E8E5',
        mediumLightShade: '#F5DDD8',
        lightWarmColor: '#E4F1FE',
    },
    overlay: {
        scrim: 'rgba(0,0,0,0.4)',
        modal: 'rgba(0,0,0,0.5)',
        light: 'rgba(0,0,0,0.1)',
    },
    shadow: {
        color: '#000000',
        subtle: 'rgba(0,0,0,0.05)',
        medium: 'rgba(0,0,0,0.15)',
    },
};

/**
 * Layer legacy branding fields from advisor config onto the default tokens.
 * Components using `themeColor`, `mainColor`, `gradient1/2`, etc. today continue
 * to work because those values flow into the corresponding semantic tokens.
 */
const applyLegacyBranding = (tokens, config) => {
    if (!config) return tokens;
    const pick = (v, fallback) => (v && v !== '' ? v : fallback);

    return {
        ...tokens,
        brand: {
            ...tokens.brand,
            primary: pick(config.mainColor, tokens.brand.primary),
            secondary: pick(config.secondaryColor, tokens.brand.secondary),
            accent: pick(config.themeColor, tokens.brand.accent),
            gradientStart: pick(config.gradient1, tokens.brand.gradientStart),
            gradientEnd: pick(config.gradient2, tokens.brand.gradientEnd),
            placeholder: pick(config.placeholderText, tokens.brand.placeholder),
        },
        nav: {
            ...tokens.nav,
            tabBg: pick(config.bottomTabbg, tokens.nav.tabBg),
            tabIcon: pick(config.tabIconColor, tokens.nav.tabIcon),
            tabIconActive: pick(config.selectedTabcolor, tokens.nav.tabIconActive),
        },
        basket: {
            ...tokens.basket,
            start: pick(config.basket1, tokens.basket.start),
            end: pick(config.basket2, tokens.basket.end),
            card: pick(config.basketcolor, tokens.basket.card),
            symbolBg: pick(config.basketsymbolbg, tokens.basket.symbolBg),
        },
        emptyState: {
            ...tokens.emptyState,
            ...(config.EmptyStateUi || {}),
        },
    };
};

/**
 * Build the resolved color palette for a given advisor config.
 * @param {object} config - the value returned by useConfig()
 * @returns {object} resolved semantic token tree
 */
export const buildColors = (config) => {
    const withBranding = applyLegacyBranding(DEFAULT_TOKENS, config);
    const withOverrides = merge(withBranding, config?.colorTokens);
    return withOverrides;
};

/**
 * Validate that a value looks like a valid color string. Used by tests and
 * by the support UI to warn on invalid entries.
 */
export const isValidColor = (value) => {
    if (typeof value !== 'string') return false;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return true;
    if (/^rgba?\(/.test(value)) return true;
    if (value === 'transparent') return true;
    return false;
};

export default buildColors;
export { identity };
