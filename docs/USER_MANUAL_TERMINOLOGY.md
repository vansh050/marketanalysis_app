# AlphaQuark User Manual — Terminology Rules

> **Audience:** anyone (Claude included) editing user-facing copy in `docs/USER_MANUAL.html`, marketing pages, in-app strings, or external docs that quote this manual.
>
> **Last updated:** 2026-05-15

---

## Why this file exists

The user manual was originally written in **SEBI Registered Investment Advisor (RIA)** framing — "advisor", "advice", "advisory agreement", etc. On 2026-05-15 this was reset to the correct framing: AlphaQuark serves clients of **Portfolio Managers / money managers**, not RIA clients.

Future edits to user-facing copy MUST keep the same vocabulary. Drift on this is what caused the rewrite to be needed in the first place.

---

## Mandatory replacements

When writing or editing user-facing copy, use the right column. These are **non-negotiable** for any text that ends up in front of a client.

| ❌ Don't use            | ✅ Use instead                                          |
|------------------------|--------------------------------------------------------|
| advisor / Advisor       | manager / Manager                                      |
| advisors / Advisors     | managers / Managers                                    |
| advisory                | management (or context-appropriate equivalent)         |
| advice                  | recommendation                                         |
| Advice                  | Recommendation                                         |
| advices                 | recommendations                                        |
| Advices                 | Recommendations                                        |
| advisory clients        | clients consuming their money manager's service        |
| Advisory Agreement      | Management Agreement                                   |
| advisory services       | management services                                    |
| advisory reports        | management reports                                     |
| Advisory_Agreement.pdf  | Management_Agreement.pdf                               |
| egress IP               | static IP assigned                                     |
| support@alphaquark.in   | admin@alphaquark.in                                    |

## Scope

**Applies to:**
- `docs/USER_MANUAL.html` (the canonical user manual)
- Any future user-facing copy: in-app strings, marketing landing pages, email templates, onboarding flows, push notification copy, store listings (iOS App Store / Google Play)
- Any external/shared doc that quotes or excerpts the user manual
- Cross-repo user-facing copy in the sibling Flutter app `tidi_new/tidistockmobileapp/` IF it shares wording with this manual (verify with user first — Flutter app may have its own brand positioning)

**Does NOT apply to:**
- Internal architecture docs (`BROKER_CONNECTION.md`, `MODEL_PORTFOLIO_ARCHITECTURE.md`, `APP_ARCHITECTURE.md`, `PHASE3_*.md`, `SDK_*.md`, etc.) — those describe technical systems. Database fields named `advisor`, route names like `/advisor/...`, and SEBI regulatory references can keep "advisor" verbatim.
- Code comments, variable names, JSDoc, type definitions — leave the technical vocabulary alone.
- SEBI legal/regulatory references where the term is a SEBI-registered category (e.g., "Investment Advisor" as the legal SEBI category). When citing SEBI directly, use SEBI's own term.

## Edit protocol

1. Before adding new user-facing text, scan the manual for the existing phrasing of the concept you're documenting.
2. When in doubt, default to the right column above.
3. If a new term appears in user-facing copy that doesn't fit the table, add a row here in the same commit.
4. The canonical reference for terminology is the post-2026-05-15 state of `docs/USER_MANUAL.html`. If this file and the manual diverge, the manual wins — and update this file in the same commit.

## Why "manager" not "advisor"

- **RIA (Registered Investment Advisor)**: SEBI category for fiduciaries who give advice but don't execute. Client retains discretion.
- **PMS (Portfolio Manager)**: SEBI category where the manager actively manages money on the client's behalf. Discretion may be delegated.

AlphaQuark's product surface (subscribe to strategies, auto-execute rebalances, etc.) sits closer to the PMS workflow than the RIA workflow. The original "advisor" framing was technically wrong for the product even though shared code used "advisor" as a data-model field name. User-facing copy now reflects PMS framing; internal code/data models still use `advisor` because they describe the database schema and changing field names would break every consumer.
