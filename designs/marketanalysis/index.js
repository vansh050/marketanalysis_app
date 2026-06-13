/**
 * ============================================================================
 * designs/marketanalysis — VARIANT ROOT
 * ============================================================================
 *
 * Marketanalysis whitelabel variant. Empty `components` and `sdk` overrides
 * — every primitive / composite / screen / SDK slot flows through to
 * upstream `designs/default/`. Override one key at a time:
 *
 *   1. Add `designs/marketanalysis/screens/<Name>.js` (or composites/, sdk/).
 *   2. Register the key in `components` / `sdk` below.
 *
 * The variant becomes active when `DESIGN_VARIANT=marketanalysis` is set in
 * `.env`. It's selected by `src/design/resolveDesign.js` and resolved out of
 * `designs/registry.js` (where the variant is registered).
 *
 * See `docs/DESIGN_SYSTEM_ARCHITECTURE.md` § Registry and
 * `docs/WHITELABEL_RECIPE.md` § "Adding a new whitelabel".
 * ============================================================================
 */

import * as tokens from './tokens';

const variant = {
    name: 'marketanalysis',
    tokens,
    // No component overrides yet — fall through to default.
    components: {},
    // No SDK slot overrides yet — fall through to default's SDK bundle.
    sdk: {},
};

export default variant;
