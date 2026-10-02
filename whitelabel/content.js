/**
 * ============================================================================
 * whitelabel/content — PER-FORK TENANT CONTENT + FEATURE FLAGS (upstream default)
 * ============================================================================
 *
 * 🔴 PER-FORK FILE. NOT BYTE-IDENTICAL ACROSS REPOS. 🔴
 *
 * This is the UPSTREAM (Alphab2bapp) copy: every key that a fork may fill in
 * is exported here with a NEUTRAL default so the variant-agnostic seams in
 * `src/` (see `src/utils/whitelabelContent.js`) behave exactly as before the
 * seams existed. Forks overwrite this file with their own values — a fork
 * that fills a key changes the corresponding behaviour WITHOUT touching `src/`.
 *
 * Every export in a fork's copy MUST have a matching neutral export here —
 * a missing key silently reverts to the default behaviour.
 *
 * See `docs/WHITELABEL_RECIPE.md` for the fork/upstream contract.
 * ============================================================================
 */

// Platform display name — used as the last-resort fallback in user-facing
// strings (e.g. "Could not reach <name>"). Forks override this to their own
// brand ("Markup Club", "MoneyMan Investments", …).
export const PLATFORM_DISPLAY_NAME = 'Market Analysis Academy';

// Persistent regulatory strip rendered at the app root. Empty string = the
// banner slot renders nothing.
export const MONEYMAN_COMPLIANCE_NOTICE = '';

// Website Insights page — linked from the Knowledge Hub home section. Null
// = no link is rendered.
export const MONEYMAN_INSIGHTS_URL = null;

// More-screen "More Links" section. Empty array = no section rendered.
export const MONEYMAN_MORE_LINKS = [];

// Plan identity cards — the fixed catalog order AND the plan-specific
// summaries/colors. Empty array = upstream default behaviour (no fixed
// ordering, no plan summaries/colors).
export const MONEYMAN_PLAN_CARDS = [];

// Plan-card ORDERING for the Plans tab.
//   'fixed'              — keep the catalog order in MONEYMAN_PLAN_CARDS.
//   'subscription-first' — legacy behaviour: subscribed plans float to top
//                          (upstream default).
export const MONEYMAN_PLAN_ORDERING = 'subscription-first';

// Position-based card color cycle used when MONEYMAN_PLAN_ORDERING ===
// 'fixed'. Empty array = fall back to the legacy name-map / brand colors.
export const MONEYMAN_PLAN_COLORS = [];

// Inner card accents (Save tag, expanded-overview background, TrendingUp
// icon) follow the card's own theme color instead of the generic lime-green
// defaults.
export const MONEYMAN_CARD_ACCENT_FROM_CARD_COLOR = false;

// More-screen background logo hidden (for rectangular wordmarks that read
// as a white square).
export const MONEYMAN_HIDE_BACKGROUND_LOGO = false;

// Home feed restructure (tenant with no bespoke product that wants the
// Knowledge Hub only in the Home footer). False = upstream default feed.
export const MONEYMAN_HOME_FEED_RESTRUCTURE = false;

export const getMoneyManPlanCard = () => null;

export const getMoneyManPlanColor = () => null;

export const getMoneyManPlanSummary = (planName, fallback = '') => fallback;

// Home-footer content. Empty arrays / null = footer renders only the
// statutory shell (or nothing when the footer slot itself is not overridden
// by a fork's design variant).
export const MONEYMAN_FRAMEWORKS = [];
export const MONEYMAN_STATUTORY_DISCLOSURES = [];
export const MONEYMAN_DISCLAIMERS = [];
export const MONEYMAN_REGISTRATION_DETAILS = null;
