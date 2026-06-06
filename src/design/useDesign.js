/**
 * ============================================================================
 * useDesign / useComponent — DESIGN-SYSTEM HOOKS
 * ============================================================================
 *
 * `useDesign()` returns the full resolved design bundle:
 *   { variant, tokens, components }
 *
 * `useComponent(key)` returns the variant-aware implementation of a single
 * design-system component (primitive / composite / screen). Throws if the key
 * is not registered in the active variant or default.
 *
 * Usage:
 *
 *   import { useComponent } from '../design/useDesign';
 *
 *   function HomeScreenContainer() {
 *     const HomePresentation = useComponent('screens.Home');
 *     const viewModel = { ... };
 *     const actions = { ... };
 *     return <HomePresentation viewModel={viewModel} actions={actions} />;
 *   }
 *
 * Component keys are dot-namespaced by layer (e.g. `primitives.Button`,
 * `composites.IgnoreStockCard`, `screens.Home`). The exact key catalog is
 * documented in DESIGN_COMPONENT_AUDIT.md and registered in
 * `designs/default/index.js`.
 *
 * For the token bundle, prefer the existing `useTokens()` hook in
 * `src/theme/useTokens.js` — it integrates with ConfigContext for advisor
 * overrides. `useDesign().tokens` exposes the variant's STATIC token defaults
 * (build*() builders + DEFAULT_* objects); it does NOT layer ConfigContext on
 * top. Use `useTokens()` in components; use `useDesign().tokens` for variant-
 * level introspection / build-time decisions only.
 * ============================================================================
 */

import { useContext } from 'react';
import { DesignContext } from './DesignProvider';

export function useDesign() {
    const ctx = useContext(DesignContext);
    if (!ctx) {
        throw new Error(
            '[useDesign] called outside <DesignProvider>. Wrap your app with <DesignProvider> in App.js — see docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry.'
        );
    }
    return ctx;
}

export function useComponent(key) {
    const { components, variant } = useDesign();
    const C = components[key];
    if (!C) {
        throw new Error(
            `[useComponent] component "${key}" not found in active variant "${variant}" or default. Register it in designs/default/index.js (and override in the active variant if applicable). The default variant is the contract floor — every key MUST exist there.`
        );
    }
    return C;
}

export default useDesign;
