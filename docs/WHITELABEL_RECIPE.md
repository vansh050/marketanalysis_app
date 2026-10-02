# Whitelabel Recipe — How to ship a new tenant variant

> **Audience**: anyone bootstrapping a new whitelabeled fork of this app
> (Alphanomy, Zamzam, RGX, ARFS, future tenants), and anyone editing this
> repo who needs to know what stays here vs what lives downstream.
>
> **Companion docs**:
> - `DESIGN_SYSTEM_ARCHITECTURE.md` — the upstream design-system contract
>   (token bundle, registry, container/presentation split, SDK boundary).
> - `DESIGN_COMPONENT_AUDIT.md` — per-surface verdict matrix in this repo.
> - `DESIGN_MIGRATION_PROGRESS.md` — chronological work log.
> - `CLAUDE.md` (root) — top-level invariants, blocking doc rules.

---

## The model in one paragraph

This repo (`Alphab2bapp`) is **upstream-default**: it ships the AlphaQuark
brand as `default` and the design-system infrastructure that lets any future
variant override pieces of it. **It never contains another tenant's variant
folder.** Each whitelabel — Alphanomy, Zamzam, RGX, ARFS, etc. — lives in
its own **fork repo** that merges upstream regularly and adds, on top:

1. A `designs/<variant>/` folder containing the variant's tokens / composites
   / screens / assets.
2. A native shell delta — Android/iOS app icon, `applicationId`, signing
   config, build number, splash, `Info.plist` display name. Things that
   can't be variant-switched at runtime.
3. A `.env` with `DESIGN_VARIANT=<variant>` and `APP_VARIANT=<variant>`.
4. A small one-line patch on `designs/registry.js` adding the variant to
   the static `VARIANTS` map.
5. A `SYNC.md` documenting the upstream merge cadence and any per-fork
   gotchas.

Everything else — services, hooks, contexts, navigators, the SDK
integration, broker code, ccxt-india plumbing — is upstream-only. The fork
repo is a **thin overlay**, not a maintained parallel codebase.

---

## Why this shape (and not something else)

Three alternatives we considered and rejected:

| Alternative | Why we didn't pick it |
|---|---|
| **All variants in upstream** (`designs/alphanomy/`, `designs/zamzam/`, etc. all live here, registered in the registry). Each tenant's app build picks one via `DESIGN_VARIANT`. | Cleaner registry; no merge conflicts. But every tenant-specific UI quirk and asset balloons the upstream bundle for everyone, and one tenant's design accident regresses the others' shipped binaries. The native shell (icons, applicationId) can't be runtime-switched anyway, so each tenant still needs a fork — making upstream-of-everything the worst of both worlds. |
| **`registry.local.js` extension point** (upstream registry tries `require('./registry.local.js')` and merges any variants it returns). Overlay repos commit a `registry.local.js` that's gitignored upstream. | Zero merge conflicts. But adds an indirection layer that hides which variants a build actually contains; static analyzers (Metro) need the conditional-require pattern explicitly tested per RN version; an empty / stale `registry.local.js` is a silent footgun. |
| **Variants as npm packages** (`@alphaquark/variant-alphanomy`) consumed by the upstream registry via dynamic discovery. | Right answer for a v3 of this. Out of scope: requires the upstream registry to become discovery-driven, and each variant package needs to model the contract version it targets. Phase A–G of the design system aren't yet stable enough to lock that contract. |

What we picked: **per-variant fork repo + conventional 2-line merge conflict
on `designs/registry.js` on every upstream pull**. Predictable, no
infrastructure, the conflict is mechanical (resolve by re-applying the
variant's `import` + map entry). The trade-off is real but small.

---

## What stays in upstream vs the fork

### Upstream (this repo)

- `designs/default/` — the default variant in full (tokens, primitives,
  composites, screens, sdk overrides). This is what an unbranded build
  ships.
- `designs/registry.js` — only imports `default`. **Forks edit this** to
  add their variant; merge conflicts on this file are expected and
  harmless.
- `src/design/*` — `DesignProvider`, `useDesign()`, `useComponent()`,
  `resolveDesign.js`. The infrastructure that makes variants work.
- `src/theme/*` — `colors.js`, `spacing.js`, `typography.js`, `radii.js`,
  `shadows.js`, `assets.js`, `useTokens.js`. Upstream owns the token
  *implementation* (with their `build*(config)` builders) and the AlphaQuark
  defaults.
- All `src/`-side feature code: contexts, services, hooks, screens'
  containers, navigators, SDK integration. Upstream is the source of truth.
- The SDK package boundary (`../../alphaquark-mobile-sdk/`). Forks don't touch
  the SDK package.
- All architecture docs (`docs/*.md`).
- Native shell of the AlphaQuark / default-variant build (Android `app/`,
  iOS Xcode project, signing for the default identity).

### Fork (variant overlay)

- `designs/<variant>/` — tokens, composites, screens, sdk overrides
  specific to this tenant. May be sparse (override one screen) or
  comprehensive (override many).
- `designs/<variant>/assets/` — variant-specific images (logos, splash,
  illustrations). Referenced by `designs/<variant>/tokens/assets.js`.
- `designs/<variant>/tokens/assets.js` — re-exports `DEFAULT_ASSETS`
  pointing at the variant's own image files. Pattern documented in
  `DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets`.
- `whitelabel/content.js` — **content + feature-flag seam.** Tenant-specific
  copy (regulatory notices, links, plan cards/summaries/colors, disclaimers)
  and behavioural flags (`MONEYMAN_PLAN_ORDERING`, `MONEYMAN_PLAN_COLORS`,
  `MONEYMAN_CARD_ACCENT_FROM_CARD_COLOR`, `MONEYMAN_HIDE_BACKGROUND_LOGO`,
  `MONEYMAN_HOME_FEED_RESTRUCTURE`, …). Read by `src/` ONLY through the
  upstream-managed re-exporter `src/utils/whitelabelContent.js`
  (`export * from '../../whitelabel/content'`). Upstream ships a neutral
  version (empty arrays / false flags) so `src/` behaves as before; every key
  a fork fills must exist upstream with a neutral default.
- A 2-line patch on upstream's `designs/registry.js`: an `import` and a
  map entry for the new variant. The patch is the variant's responsibility
  to maintain through upstream merges.
- Native shell — see § "Native shell delta" below.
- `.env` — `DESIGN_VARIANT=<variant>`, `APP_VARIANT=<variant>`,
  `applicationId`, any tenant-specific REACT_APP_* values (broker keys
  that differ per tenant, white-label text, deep-link scheme).
- `SYNC.md` — see § "SYNC.md template" below.

### UI slots that variants can fill (no `src/` patch needed)

Two app-root/Home slots are resolved from the active design variant, so a
fork can add persistent UI without editing `src/`:

- `composites.RootBanner` — rendered at App root above the navigation tree
  (e.g. a persistent regulatory strip). `App.js` calls
  `useComponent('composites.RootBanner')`. Default registers a no-op.
- `composites.HomeFooter` — rendered at the bottom of the Home feed list.
  The design-system `screens.HomeScreen` resolves it via
  `useComponent('composites.HomeFooter')`. Default registers a no-op.

Forks override these keys in their variant's `components` map (e.g.
`designs/moneyman_app/composites/RootBanner.js` + `HomeFooter.js`).

### What forks must NOT have

- A copy of any `src/` file. If a fork edits `src/`, that's either a
  bug to upstream, a generic improvement to upstream, or a sign that the
  feature needs a variant override mechanism in upstream first. Forks that
  carry `src/` patches drift unpredictably and break on every upstream
  merge.
- An overwrite of any shared file under `src/assets/*`. That breaks the
  default variant's appearance and was the leak Phase 2 (logo
  asset-token slot, 2026-05-09) closed.
- A copy of `docs/*`. Docs live upstream. Fork-specific notes go in
  `SYNC.md` only.
- A duplicated `designs/default/` folder. The fork inherits `default` from
  upstream automatically — that's the registry-fallback contract.
- Direct edits to the SDK package (`../../alphaquark-mobile-sdk/`). Forks
  consume the published SDK like any other dep.
- A divergent branch of any backend code. Backend lives in
  `aq_backend_github` and `ccxt-india`; backend overrides happen via
  `appadvisors` documents (per-tenant config rows in MongoDB), not via
  fork repos.

---

## The native shell delta

Things baked into the build at compile time — not switchable at runtime by
`DESIGN_VARIANT`. Each fork owns these:

| Surface | Files | What changes per fork |
|---|---|---|
| Android app icon | `android/app/src/main/res/mipmap-*/ic_launcher*.png`, `mipmap-*-v26/ic_launcher*.xml`, `values/colors-icon.xml` | Variant brand icon |
| iOS app icon | `ios/<scheme>/Images.xcassets/AppIcon.appiconset/*` | Variant brand icon |
| `applicationId` (Android) / `bundleIdentifier` (iOS) | `android/app/build.gradle`, iOS `.xcodeproj` / `Info.plist` | Distinct app on store, distinct push topic, distinct deep-link scheme |
| Signing config | `android/app/build.gradle`, iOS provisioning | Per-fork release signing key |
| Display name | `android/app/src/main/res/values/strings.xml`, `Info.plist` `CFBundleDisplayName` | Brand name as it appears on the home screen |
| Build number | `android/app/build.gradle` `versionCode`, iOS `CFBundleVersion` | Independent versioning per store presence |
| Splash screen | RN splash module config, native splash images | Variant brand splash |
| URL schemes (deep link) | `Info.plist` `CFBundleURLTypes`, `AndroidManifest.xml` `<intent-filter>` | Per-tenant `myapp-<variant>://` scheme |
| Notification sound / icon | per-platform notification config | Tenant-specific |

The reason these stay native: React Native can't reload an app icon on
runtime variant switch. The build artifact (APK / AAB / IPA) IS the variant's
brand identity at the OS level. So the fork is the build pipeline.

---

## Adding a new whitelabel — step by step

**Prerequisites**: upstream is at a tagged state (e.g. `release/deploy_5.1`; stable anchor `release/untouched_5.0`); you have push access to a new GitHub repo for the fork; you have the tenant's brand assets (icons in all densities, logo PNGs, splash PNG, theme colors, optional tenant-specific broker API keys).

1. **Fork & strip.**
   ```bash
   git clone https://github.com/Alphab2bapp .
   git remote rename origin upstream
   git remote add origin <new-fork-url>
   git checkout -b main
   git push -u origin main
   ```
   The fork starts as a byte-identical clone — initial drift is zero.

2. **Add the variant skeleton.**
   ```bash
   mkdir -p designs/<variant>/{tokens,composites,screens,sdk,assets}
   ```

3. **Copy the variant's brand assets** under `designs/<variant>/assets/`
   (logo.png, fadedlogo.png, plus any tenant-specific imagery).

4. **Create `designs/<variant>/tokens/assets.js`** re-exporting `DEFAULT_ASSETS`
   with the variant's logo paths. Pattern:
   ```js
   const merge = (base, override) => { /* same shape as src/theme/assets.js */ };
   export const DEFAULT_ASSETS = {
     logoPng: require('../assets/logo.png'),
     logoFadedPng: require('../assets/fadedlogo.png'),
   };
   export const buildAssets = (config) => merge(DEFAULT_ASSETS, config?.assetTokens);
   ```

5. **Create `designs/<variant>/index.js`** exporting the variant shape:
   ```js
   import * as tokens from './tokens';
   // import variant-specific screen/composite overrides as you build them
   const variant = { name: '<variant>', tokens, components: { /* dot-namespaced overrides */ } };
   export default variant;
   ```
   Start with no `components` overrides. Default flows-through automatically.
   Override one screen at a time, register it in `components`, verify, repeat.

6. **Patch `designs/registry.js`** — add the import and map entry:
   ```js
   import <variant>Variant from './<variant>';
   export const VARIANTS = {
     [DEFAULT_VARIANT_NAME]: defaultVariant,
     <variant>: <variant>Variant,
   };
   ```
   This is the file that conflicts on every upstream merge. Resolution is
   always to keep both upstream's default-only state and your variant's lines.

7. **Bring native shell.** Replace icons under
   `android/app/src/main/res/mipmap-*/` and `ios/.../AppIcon.appiconset/`.
   Update `android/app/build.gradle` `applicationId` + `versionCode`.
   Update iOS `Info.plist` display name + bundle id. Generate new signing
   config; do NOT commit signing secrets — use CI secrets store.

8. **Set `.env`** at fork root:
   ```
   DESIGN_VARIANT=<variant>
   APP_VARIANT=<variant>
   REACT_APP_HEADER_NAME=<tenant_subdomain>
   # ...other tenant-specific vars
   ```

9. **Write `SYNC.md`** — see template below.

10. **Initial sync test.** Run a build, sanity-check that:
    - The default flow still works (try `DESIGN_VARIANT=default` build — it should look like upstream Alphab2bapp).
    - `DESIGN_VARIANT=<variant>` build shows the variant brand in the app icon, splash, and the migrated logo consumers (Login / Signup / ResetPassword / ChangeAdvisor / BasketCard).
    - All other screens look identical to upstream — they should, because the variant has no overrides yet.

11. **Iterate.** Override one screen at a time. Each override:
    - Add a file under `designs/<variant>/screens/<Screen>.js`.
    - Register in `designs/<variant>/index.js` `components`.
    - Verify the upstream's container-side viewModel exposes everything the
      override needs. If it doesn't — STOP. The container needs to be updated
      upstream first; don't fork the container in your variant repo.

---

## Upstream sync workflow

Every fork merges upstream at least monthly (more often during active
development). Workflow:

```bash
git fetch upstream
git checkout main
git merge upstream/release/deploy_5.1  # active upstream build branch since 2026-09-29 (was feature/sdk-plus-config_forkv2)
```

Expected conflicts:

- **`designs/registry.js`** — almost always conflicts. Keep your variant's
  `import` + map entry, accept upstream's other changes. Mechanical.
- **Native shell files** — should never conflict because upstream and fork
  edit different files (upstream might bump iOS deployment target in
  `Project.pbxproj`; fork might change icons but not deployment target).
  When they do conflict, that's a flag — investigate.
- **Anything else** — you have a bug. The fork has accidentally drifted
  outside its sanctioned overlay surface. Find what was edited in `src/`
  on the fork, decide whether it belongs upstream (most likely) or whether
  it's a tenant-specific concern that needs a new variant override
  mechanism in upstream first. **Don't resolve the conflict by keeping the
  fork's `src/` edit.** That perpetuates drift.

After resolving:

```bash
git push origin main
# Run a build, smoke-test the variant
```

If a conflict feels surprising, ask — the rules above are the contract.

---

## SYNC.md template

Each fork's `SYNC.md` lives at the root of the fork repo. Suggested shape:

```markdown
# SYNC.md — <Variant Name> Whitelabel Overlay

This repo is a thin overlay on top of `Alphab2bapp` upstream. It contains:

- `designs/<variant>/` — variant-specific tokens, composites, screens, assets.
- Native shell — Android/iOS icons, `applicationId`, signing, splash.
- `.env` — `DESIGN_VARIANT=<variant>` + tenant-specific REACT_APP_* values.
- A 2-line patch on `designs/registry.js`.

**Everything else is upstream.** See `docs/WHITELABEL_RECIPE.md` upstream
for the contract.

## Upstream

- Repo: `https://github.com/.../Alphab2bapp`
- Tracked branch: `<branch>`
- Last merged commit: `<sha>`  ← update this after each merge
- Cadence: at least monthly

## Sync workflow

```bash
git fetch upstream
git merge upstream/<branch>
# Resolve `designs/registry.js` conflict (mechanical — keep both)
# If anything else conflicts, that's drift — investigate
git push origin main
```

## Per-fork gotchas

(Document anything tenant-specific the next maintainer needs to know.
Examples: tenant-specific broker keys, signing key location, store listing
URLs, support contact, brand color codes, font licensing.)

## What this fork does NOT contain

- Any patch to `src/`. If `src/` ever gets edited here, that's a bug.
- Any patch to backend code. Tenant-specific backend config lives in
  `appadvisors.<subdomain>` documents in MongoDB.
- A copy of `designs/default/`. The fallback chain in upstream's
  registry handles default-flow-through automatically.
```

---

## Decision log

Notable choices, kept short, oldest-first:

- **2026-05-09 — Phase 2: logo asset-token slot.** Added the
  `tokens.assets` family. Closed the leak where Alphanomy was overwriting
  shared `src/assets/*` files. See
  `DESIGN_MIGRATION_PROGRESS.md § 2026-05-09 Phase 2`.
- **2026-05-09 — Phase 3: variant overlay model formalized in this doc.**
  Conventional 2-line merge conflict on `designs/registry.js` chosen over
  `registry.local.js` extension point and over npm-package variants.
  Reasons in § "Why this shape" above.

When future decisions need to be revisited, document them here in the
same shape so context isn't lost.
