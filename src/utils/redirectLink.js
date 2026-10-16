/**
 * redirectLink — WhatsApp advice buttons on the fleet-wide UTILITY templates
 * (2026-10-10).
 *
 * Those templates' URL button has the static base
 * `https://app.alphaquark.in/api/redirect/{{1}}` (Meta re-categorises a new
 * template with an app-link base as MARKETING, so we keep the approved one).
 * `{{1}}` is either:
 *   - `<tenant>~<token>` — a per-customer execute link (ccxt
 *     `wa_advice_button_value`), or
 *   - the advisor's web domain, e.g. `prod.alphaquark.in` — the generic
 *     "View update" button.
 * This app claims ONLY its own tenant's forms (AndroidManifest intent filter +
 * iOS `applinks:app.alphaquark.in`; the server AASA lists the same paths via
 * aq_backend `WellKnownRouter.redirectPathsFor`). Not installed → the Node
 * `/api/redirect/:advisor` route serves the same web pages as before.
 *
 * Pure (no native imports) so it is unit-testable; smartLink.js acts on it.
 */
const REDIRECT_HOST = 'app.alphaquark.in';
const TOKEN_RE = /^[A-Za-z0-9_-]{16,400}$/;

/**
 * @returns {null | {kind: 'execute', tenant, token} | {kind: 'view', slug}}
 */
export function parseRedirectLink(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url
    .split('#')[0]
    .split('?')[0]
    .match(/^https:\/\/([^/]+)\/api\/redirect\/([^/]+)\/?$/i);
  if (!m || m[1].toLowerCase() !== REDIRECT_HOST) return null;
  let slug;
  try {
    slug = decodeURIComponent(m[2]);
  } catch (_) {
    return null;
  }
  const sep = slug.indexOf('~');
  if (sep > 0) {
    const tenant = slug.slice(0, sep).toLowerCase();
    const token = slug.slice(sep + 1);
    if (!/^[a-z0-9-]+$/.test(tenant) || !TOKEN_RE.test(token)) return null;
    return {kind: 'execute', tenant, token};
  }
  return /^[a-z0-9.-]+$/i.test(slug) ? {kind: 'view', slug: slug.toLowerCase()} : null;
}
