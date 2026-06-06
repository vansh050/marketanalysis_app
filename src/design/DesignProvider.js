/**
 * ============================================================================
 * DesignProvider — DESIGN-SYSTEM REGISTRY CONTEXT
 * ============================================================================
 *
 * Wraps the app and exposes the resolved design bundle (variant identity +
 * tokens + components map) via React context. Consumers use `useDesign()` to
 * read the whole bundle or `useComponent(key)` to resolve a specific
 * component to its variant-aware implementation.
 *
 * Design rules (docs/DESIGN_SYSTEM_ARCHITECTURE.md):
 *   - Variant is fixed at mount time. The `variant` prop, if provided, takes
 *     precedence over env vars (mostly useful for tests / Storybook). Without
 *     a prop, the resolver reads `DESIGN_VARIANT` first, then `APP_VARIANT`,
 *     then falls back to "default".
 *   - The resolved registry is frozen at mount via useRef so memoization is
 *     correct even if a parent re-renders with a different `variant` prop
 *     (which is ignored — runtime variant switching is not supported in v1).
 *   - The default variant is the contract floor. resolveDesign() throws at
 *     startup if `designs/default/` is missing from the registry.
 *
 * Place at app root, INSIDE GestureHandlerRootView and OUTSIDE all other app
 * providers. See App.js for placement.
 * ============================================================================
 */

import React, { createContext, useRef } from 'react';
import safeConfig from '../utils/safeConfig';
import resolveDesign from './resolveDesign';

export const DesignContext = createContext(null);

const pickSelection = (override) => {
    if (override) return { name: override, source: 'prop' };
    if (safeConfig?.DESIGN_VARIANT) {
        return { name: safeConfig.DESIGN_VARIANT, source: 'DESIGN_VARIANT' };
    }
    if (safeConfig?.APP_VARIANT) {
        return { name: safeConfig.APP_VARIANT, source: 'APP_VARIANT' };
    }
    return { name: 'default', source: 'fallback' };
};

export function DesignProvider({ variant, children }) {
    const resolvedRef = useRef(null);
    if (resolvedRef.current === null) {
        const selection = pickSelection(variant);
        resolvedRef.current = resolveDesign(selection);
    }

    return (
        <DesignContext.Provider value={resolvedRef.current}>
            {children}
        </DesignContext.Provider>
    );
}

export default DesignProvider;
