/**
 * Config.js — re-exports the per-tenant APP_VARIANTS map from
 * `whitelabel/appVariants.js`. This file is upstream-managed and
 * byte-identical across forks; tenant-specific values live OUTSIDE `src/`
 * so that `src/` stays byte-identical between upstream and every fork.
 *
 * Forks override `whitelabel/appVariants.js` (and any of
 * `whitelabel/components/`, `whitelabel/utils/`) without touching `src/`.
 * See `docs/WHITELABEL_RECIPE.md` for the full contract.
 */

import APP_VARIANTS from '../../whitelabel/appVariants';

export default APP_VARIANTS;
