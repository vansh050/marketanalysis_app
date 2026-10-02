/**
 * ============================================================================
 * resolveDesign — REGISTRY RESOLUTION
 * ============================================================================
 *
 * Given a requested variant name + how that name was chosen, returns the
 * resolved design bundle that <DesignProvider> stores in context.
 *
 * Resolution rules (per docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry):
 *   1. The default variant (designs/default/) is the contract floor — every
 *      key MUST exist there. Throw at startup if it's missing from the
 *      registry; the app cannot run without it.
 *   2. If a non-default variant is requested AND registered, shallow-merge its
 *      `components`, `sdk` slots and `navigation` manifest keys over default's. Tokens layer-merge by
 *      namespace (variant's `tokens.X` replaces default's `tokens.X` if
 *      present).
 *   3. A variant may override only component/SDK keys declared by default.
 *      Unknown keys fail fast instead of creating tenant-only contracts.
 *   4. If a non-default variant is requested but NOT registered:
 *      - When source is 'DESIGN_VARIANT' or 'prop': warn in dev (this is a
 *        misconfiguration — the env var was set but no folder exists).
 *      - When source is 'APP_VARIANT': silent fallback (APP_VARIANT is a
 *        business-config selector, not a design selector — no design folder
 *        for it is the normal case).
 *      Either way, fall back to default.
 *
 * The resolver is pure. Standalone builds normally call it once; the AlphaB2B
 * master provider calls it again when the authenticated runtime advisor
 * changes to another statically registered design.
 * ============================================================================
 */

import { VARIANTS, DEFAULT_VARIANT_NAME } from '../../designs/registry';
import { MANIFEST_KEYS } from '../navigation/screenCatalog';

const buildBundle = (name, defaultVariant, requestedVariant) => {
    if (!requestedVariant) {
        return {
            variant: DEFAULT_VARIANT_NAME,
            tokens: defaultVariant.tokens,
            components: { ...(defaultVariant.components || {}) },
            sdk: { ...(defaultVariant.sdk || {}) },
            navigation: { ...(defaultVariant.navigation || {}) },
        };
    }
    return {
        variant: name,
        tokens: { ...(defaultVariant.tokens || {}), ...(requestedVariant.tokens || {}) },
        components: {
            ...(defaultVariant.components || {}),
            ...(requestedVariant.components || {}),
        },
        sdk: {
            ...(defaultVariant.sdk || {}),
            ...(requestedVariant.sdk || {}),
        },
        // Per top-level key: a variant's `tabs` array replaces default's whole
        // (never merged), anything it omits falls back to default.
        navigation: {
            ...(defaultVariant.navigation || {}),
            ...(requestedVariant.navigation || {}),
        },
    };
};

const assertKnownKeys = (variantName, layerName, defaults, overrides) => {
    if (!overrides) {
        return;
    }
    const unknown = Object.keys(overrides).filter(key => !(key in (defaults || {})));
    if (unknown.length > 0) {
        throw new Error(
            `[DesignProvider] variant "${variantName}" defines unknown ${layerName} key(s): ${unknown.join(', ')}. Add every contract key to designs/default first so other variants have a fallback.`
        );
    }
};

/**
 * Enforce the default-as-contract-floor rule before merging a custom variant.
 * Variants may override any subset, but may not invent private component or
 * SDK slot names that other variants cannot resolve.
 */
export const validateVariantContract = (variantName, defaultVariant, requestedVariant) => {
    if (!requestedVariant || variantName === DEFAULT_VARIANT_NAME) {
        return;
    }
    assertKnownKeys(
        variantName,
        'component',
        defaultVariant.components,
        requestedVariant.components,
    );
    assertKnownKeys(variantName, 'SDK slot', defaultVariant.sdk, requestedVariant.sdk);
    if (requestedVariant.navigation) {
        const allowed = Object.fromEntries(MANIFEST_KEYS.map(key => [key, true]));
        assertKnownKeys(variantName, 'navigation', allowed, requestedVariant.navigation);
    }
};

export const validateRegistryContract = variants => {
    const defaultVariant = variants?.[DEFAULT_VARIANT_NAME];
    if (!defaultVariant) {
        throw new Error(
            `[DesignProvider] designs/${DEFAULT_VARIANT_NAME} is required and is missing from designs/registry.js. The default variant is the contract floor.`
        );
    }
    for (const [variantName, variant] of Object.entries(variants)) {
        validateVariantContract(variantName, defaultVariant, variant);
    }
    return defaultVariant;
};

/**
 * @param {{ name: string, source: 'prop' | 'DESIGN_VARIANT' | 'runtime-advisor' | 'APP_VARIANT' | 'fallback' }} selection
 */
export const resolveDesign = (selection) => {
    const defaultVariant = validateRegistryContract(VARIANTS);

    const { name, source } = selection || { name: DEFAULT_VARIANT_NAME, source: 'fallback' };

    if (!name || name === DEFAULT_VARIANT_NAME) {
        return buildBundle(DEFAULT_VARIANT_NAME, defaultVariant, null);
    }

    const requestedVariant = VARIANTS[name];

    if (!requestedVariant) {
        // Not registered. Warn only when the variant was an explicit design
        // selector — APP_VARIANT not having a design folder is normal.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            if (source === 'DESIGN_VARIANT' || source === 'prop') {
                console.warn(
                    `[DesignProvider] variant "${name}" not found in designs/registry.js — falling back to "${DEFAULT_VARIANT_NAME}". To register, add an entry to designs/registry.js.`
                );
            }
        }
        return buildBundle(DEFAULT_VARIANT_NAME, defaultVariant, null);
    }

    return buildBundle(name, defaultVariant, requestedVariant);
};

export default resolveDesign;
