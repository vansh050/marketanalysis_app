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
 *   - An explicit `variant` prop or `DESIGN_VARIANT` remains fixed/build-owned.
 *     The AlphaB2B master build may otherwise select a statically bundled
 *     design from the authenticated runtime advisor config.
 *   - Runtime advisor changes re-resolve the bundle atomically; no component
 *     code is downloaded and unknown advisors fall back to the default.
 *   - The default variant is the contract floor. resolveDesign() throws at
 *     startup if `designs/default/` is missing from the registry.
 *
 * Place at app root, INSIDE GestureHandlerRootView and OUTSIDE all other app
 * providers. See App.js for placement.
 * ============================================================================
 */

import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import safeConfig from '../utils/safeConfig';
import resolveDesign from './resolveDesign';
import {
    getRuntimeAdvisorConfig,
    getRuntimeDesignVariant,
    hydrateRuntimeAdvisorConfig,
    subscribeRuntimeAdvisor,
} from '../utils/runtimeAdvisor';

export const DesignContext = createContext(null);

const pickSelection = (override) => {
    if (override) return { name: override, source: 'prop' };
    if (safeConfig?.DESIGN_VARIANT) {
        return { name: safeConfig.DESIGN_VARIANT, source: 'DESIGN_VARIANT' };
    }
    const runtimeVariant = getRuntimeDesignVariant();
    if (runtimeVariant) {
        return { name: runtimeVariant, source: 'runtime-advisor' };
    }
    if (safeConfig?.APP_VARIANT) {
        return { name: safeConfig.APP_VARIANT, source: 'APP_VARIANT' };
    }
    return { name: 'default', source: 'fallback' };
};

export function DesignProvider({ variant, children }) {
    const [runtimeConfig, setRuntimeConfig] = useState(
        getRuntimeAdvisorConfig(),
    );

    useEffect(() => {
        const unsubscribe = subscribeRuntimeAdvisor(setRuntimeConfig);
        hydrateRuntimeAdvisorConfig(AsyncStorage);
        return unsubscribe;
    }, []);

    const resolved = useMemo(
        () => resolveDesign(pickSelection(variant)),
        [variant, runtimeConfig],
    );

    return (
        <DesignContext.Provider value={resolved}>
            {children}
        </DesignContext.Provider>
    );
}

export default DesignProvider;
