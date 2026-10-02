# Smart Links — campaign deep links + UTM attribution (app side)

App-side counterpart of the backend smart-link router
(`aq_backend_github/docs/SMART_LINKS.md`). Handles incoming campaign deep
links, captures UTM attribution (including deferred / post-install on Android),
and routes to the requested in-app destination.

This code lives **upstream (Alphab2bapp)** and is generic — every white-label
fork inherits it via the content port (SYNC.md). A fork differentiates only by
its own smart-link tenant slug (= `REACT_APP_HEADER_NAME`) baked into the
campaign URL, plus its native package id / App Store id. No per-fork code.

## The link (handed to campaigns)

```
https://app-links.alphaquark.in/l/<tenant>?utm_source=whatsapp&utm_medium=campaign&utm_campaign=<name>&dl=<destination>
```

`<tenant>` = this build's `REACT_APP_HEADER_NAME` (e.g. `alphanomy`). `dl` maps
to a screen via `SMART_LINK_DL_ROUTES`.

## Files

| File | Role |
|------|------|
| `src/utils/smartLink.js` | parse / capture / route. Exports `parseSmartLink`, `captureCampaign`, `getStoredCampaign`, `captureInstallReferrer`, `routeSmartLinkDestination`, `handleSmartLink`, `SMART_LINK_DL_ROUTES`. |
| `App.js` | `handleDeepLink` calls `handleSmartLink(url)` first (returns true ⇒ stops the Zerodha handler); `captureInstallReferrer()` runs once on mount. Smart links arrive via the same `Linking` `url` event / `getInitialURL` used for OAuth — Universal Links (iOS) and App Links (Android) both surface there. |
| `android/app/src/main/AndroidManifest.xml` | the verified `app-links.alphaquark.in` App Links intent-filter gained `<data android:pathPrefix="/l" />` alongside `/broker-callback`. |
| `ios/AlphaQuark/AlphaQuark.entitlements` | added `com.apple.developer.associated-domains` = `applinks:app-links.alphaquark.in` for Universal Links. **Requires the Associated Domains capability enabled on the App ID in the Apple Developer portal.** |
| `package.json` | added `react-native-play-install-referrer` (Android deferred deep link). |

## Flow

- **App installed, link tapped** → OS opens the app (verified App Link /
  Universal Link) → `handleDeepLink` → `handleSmartLink` → `captureCampaign`
  (store UTM locally + `POST /l/attribution`) → `routeSmartLinkDestination(dl)`.
- **App NOT installed (Android)** → backend sends Play Store with `&referrer=<UTM>`
  → on first launch `captureInstallReferrer()` reads the Play Install Referrer,
  recovers the UTM, and reports it. **Deferred deep link.**
- **App NOT installed (iOS)** → App Store. iOS has no install-referrer API, so
  post-install attribution is best-effort (campaign token only); the click is
  still logged server-side at redirect time.

## Adding a campaign destination

Add a row to `SMART_LINK_DL_ROUTES` in `src/utils/smartLink.js` mapping the
`dl` value to a screen registered in `src/components/Navigation.js`. Current
map: `subscriptions → SubscriptionScreen`, `mysubscriptions → MySubscriptionsScreen`.
An unknown `dl` simply lands the user on the default home flow.

## Native module note

`captureInstallReferrer()` `require()`s `react-native-play-install-referrer`
inside a try/catch, so the JS is safe to ship before the native lib is linked —
it no-ops until a build includes it. After bumping `package.json`, run
`npm install` and rebuild Android (autolinking) for deferred attribution to work.

## Reading attribution later (e.g. tag onto signup)

`getStoredCampaign()` returns the last captured `{utm_*, tenant, source,
platform, capturedAt}` from AsyncStorage (`campaign_attribution`).

## Backend mirror

`aq_backend_github/docs/SMART_LINKS.md` — the `/l/:tenant` router, `/l/attribution`,
`smartlink_clicks` collection, AASA `/l/*` path, GA4 env vars, and per-tenant
`appadvisors` prerequisites.
