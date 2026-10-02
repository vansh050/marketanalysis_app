/**
 * whitelabelContent.js — re-exports the per-tenant content + feature flags
 * from `whitelabel/content.js`. This file is upstream-managed and
 * byte-identical across forks; tenant-specific values live OUTSIDE `src/`
 * so that `src/` stays byte-identical between upstream and every fork.
 *
 * Forks override `whitelabel/content.js` (and any of `whitelabel/components/`,
 * `whitelabel/utils/`) without touching `src/`. See `docs/WHITELABEL_RECIPE.md`
 * for the full contract.
 */

export * from '../../whitelabel/content';