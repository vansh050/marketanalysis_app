/**
 * ============================================================================
 * designs/registry — VARIANT REGISTRY
 * ============================================================================
 *
 * Static map of every design variant available at build time. Metro bundles
 * what's imported here; variants not listed are not in the bundle.
 *
 * To add a custom variant:
 *   1. Create `designs/<variant>/index.js` exporting `{ name, tokens,
 *      components }` (same shape as `designs/default/index.js`).
 *   2. Add an import + entry in this file.
 *   3. Set `DESIGN_VARIANT=<variant>` in `.env`.
 *
 * The active variant is resolved at `<DesignProvider>` mount time by
 * `src/design/resolveDesign.js`. Resolution order:
 *   1. DesignProvider's `variant` prop (mostly for tests)
 *   2. `DESIGN_VARIANT` env var
 *   3. `APP_VARIANT` env var (warning suppressed if no matching folder —
 *      APP_VARIANT is a business-config selector, not a design selector)
 *   4. `default`
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry and § Variant selection.
 * ============================================================================
 */

import defaultVariant from './default';

export const DEFAULT_VARIANT_NAME = 'default';

export const VARIANTS = {
    [DEFAULT_VARIANT_NAME]: defaultVariant,
    // Add custom variants here:
    // acme: require('./acme').default,
    // zamzamcapital: require('./zamzamcapital').default,
};

export default VARIANTS;
