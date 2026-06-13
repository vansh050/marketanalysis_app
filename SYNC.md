# SYNC.md — Marketanalysis Whitelabel Overlay

This repo is a thin fork overlay on top of `Alphab2bapp` upstream. It contains:

- `whitelabel/appVariants.js` — the marketanalysis tenant block, plus the
  upstream's other variants (alphaquark, zamzamcapital, rgxresearch, arfs,
  magnus). `src/utils/Config.js` re-exports this; the file stays byte-identical
  to upstream.
- `designs/marketanalysis/` — variant skeleton (tokens/composites/screens/sdk/
  assets). Currently the only override is `tokens/assets.js` which swaps the
  logo asset token. Component / screen / SDK overrides are empty — they flow
  through to upstream's `designs/default/`.
- A 2-line patch on `designs/registry.js` registering the variant. **This is
  the one file that will conflict on every upstream merge** — resolve by
  keeping both upstream's default-only state and the fork's `import
  marketanalysisVariant from './marketanalysis';` + `marketanalysis:
  marketanalysisVariant,` map entry.
- Native shell — Android/iOS icons, `applicationId`, signing, splash,
  display-name "Market Analysis Academy".
- `.env` — `DESIGN_VARIANT=marketanalysis` + `APP_VARIANT=marketanalysis` +
  tenant Firebase credentials.

**Everything else is upstream.** See `docs/WHITELABEL_RECIPE.md` (upstream-
owned) for the full contract.

## Upstream

- Repo: `https://github.com/alpha112233/Alphab2bapp`
- Local clone: `/Users/pratik/PycharmProjects/Alphab2bapp`
- Tracked branch: `feature/sdk-plus-config_forkv2`
- Last merged commit: `76b943d` (chore(cashfree): force PRODUCTION via
  REACT_APP_CASHFREE_ENV override) — synced 2026-06-13.
- Cadence: at least monthly.

## Sync workflow

```bash
# from /Users/pratik/PycharmProjects/marketanalysis_app

# 1) Pull upstream's src/ + designs/default/ + the upstream-owned root configs.
rsync -a --delete /Users/pratik/PycharmProjects/Alphab2bapp/src/     src/
rsync -a --delete /Users/pratik/PycharmProjects/Alphab2bapp/designs/default/ designs/default/
cp /Users/pratik/PycharmProjects/Alphab2bapp/App.js   App.js
cp /Users/pratik/PycharmProjects/Alphab2bapp/index.js index.js

# 2) Manually reconcile root files that have per-fork holds (see below):
#    - package.json  (keep reanimated 4.1.0 + worklets, but adopt new deps)
#    - babel.config.js (keep react-native-worklets/plugin)
#    - metro.config.js (keep the SDK path ../alphaquark-mobile-sdk)
#    - app.json (keep "Market Analysis Academy" display name)

# 3) Verify designs/registry.js still has the 2-line marketanalysis patch.

# 4) Build + smoke-test.
```

If anything outside `whitelabel/`, `designs/marketanalysis/`, native shell,
`.env`, or `SYNC.md` ends up patched on this fork, that's drift — fix it
upstream first (the recipe is explicit about this).

## Per-fork holds

These intentionally diverge from upstream until a future migration:

| Surface | Upstream | Fork | Why |
|---|---|---|---|
| `react-native-reanimated` | `3.19.5` | `4.1.0` | Fork is on RN new arch + worklets 0.5.2. Migration to 3.19.5 hasn't been validated against the fork's animations yet. |
| `babel.config.js` plugin | `react-native-reanimated/plugin` | `react-native-worklets/plugin` | Paired with the reanimated 4 hold above. |
| `metro.config.js` SDK_PATH | `../../alphaquark-mobile-sdk/packages/rn` | `../alphaquark-mobile-sdk/packages/rn` | SDK lives one level up from this fork's repo; in upstream it's two levels up due to its repo nesting (`codes/github/`). |
| `app.json` name + displayName | `AlphaProByAlphaQuark` / `AlphaQuark` | `MarketAnalysis` / `Market Analysis Academy` | Fork brand. |
| `package.json` name | `AlphaQuark` | `MarketAnalysis` | Fork brand. |
| `android/app/build.gradle` `applicationId` | upstream tenant ID | `com.arpint.alphaquark` (kept as-is on this fork until rebrand) | Per-fork native shell. |

When upstream's value for any of these changes, document the new diff here and
decide whether to migrate.

## Per-fork gotchas

- **Firebase project**: the fork uses `marketanalysis-3a279` (sender ID
  `675041319268`). The previous decommissioned project was
  `marketanalysisacademy-4e595` (sender ID `794163196580`). All Firebase env
  vars in `.env` MUST point at the new project, otherwise GoogleSignin's ID
  token is signed for the wrong audience and Firebase rejects
  `signInWithCredential` with `auth/invalid-credential`. The
  `googleWebClientId` baked into `whitelabel/appVariants.js` MUST match the
  Web OAuth client of the new project.
- **`src/utils/firebaseConfig.js` has no fallbacks** post-sync — upstream
  removed them on purpose to prevent leaking another tenant's credentials.
  All `REACT_APP_FIREBASE_*` vars must be set in `.env`.
- **Android signing**: the fork keeps its own release keystore. Not committed.
- **Deep link scheme**: fork uses `REACT_APP_DEEP_LINK_SCHEME=Marketanalysisacademy`
  (case-sensitive). App.js falls back to `'rgxapp'` if unset — DON'T let the
  env var go missing.
- **SDK location**: `@alphaquark/mobile-sdk` is installed as a file: dep
  pointing at `../alphaquark-mobile-sdk/packages/rn`. Metro's
  `metro.config.js` `SDK_PATH` must match. If you ever move the SDK clone,
  bump both.

## What this fork does NOT contain (must stay empty)

- Any patch to `src/`. If `src/` ever gets edited here, that's a bug.
- Any patch to `docs/*`. Docs live upstream.
- Any patch to backend code. Tenant-specific backend config lives in
  `appadvisors.<subdomain>` documents in MongoDB.
- A duplicated `designs/default/` divergence. Default is upstream-owned and
  must stay byte-identical to upstream.
