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
 *      `components` over default's. Tokens layer-merge by namespace
 *      (variant's `tokens.X` replaces default's `tokens.X` if present).
 *   3. If a non-default variant is requested but NOT registered:
 *      - When source is 'DESIGN_VARIANT' or 'prop': warn in dev (this is a
 *        misconfiguration — the env var was set but no folder exists).
 *      - When source is 'APP_VARIANT': silent fallback (APP_VARIANT is a
 *        business-config selector, not a design selector — no design folder
 *        for it is the normal case).
 *      Either way, fall back to default.
 *
 * The resolver is called ONCE at <DesignProvider> mount and the result is
 * frozen for the life of the provider (see DesignProvider.js).
 * ============================================================================
 */

import { VARIANTS, DEFAULT_VARIANT_NAME } from '../../designs/registry';

const buildBundle = (name, defaultVariant, requestedVariant) => {
    if (!requestedVariant) {
        return {
            variant: DEFAULT_VARIANT_NAME,
            tokens: defaultVariant.tokens,
            components: { ...(defaultVariant.components || {}) },
        };
    }
    return {
        variant: name,
        tokens: { ...(defaultVariant.tokens || {}), ...(requestedVariant.tokens || {}) },
        components: {
            ...(defaultVariant.components || {}),
            ...(requestedVariant.components || {}),
        },
    };
};

/**
 * @param {{ name: string, source: 'prop' | 'DESIGN_VARIANT' | 'APP_VARIANT' | 'fallback' }} selection
 */
export const resolveDesign = (selection) => {
    const defaultVariant = VARIANTS[DEFAULT_VARIANT_NAME];
    if (!defaultVariant) {
        throw new Error(
            `[DesignProvider] designs/${DEFAULT_VARIANT_NAME} is required and is missing from designs/registry.js. The default variant is the contract floor.`
        );
    }

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
