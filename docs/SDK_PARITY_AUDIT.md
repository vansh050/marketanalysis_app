# SDK Parity Audit — RN vs Flutter, Alphab2bapp vs tidi_new

> **Snapshot date**: 2026-04-29. Re-run when the SDK package, either consumer's
> Phase 3 surfaces, or the per-broker SDK_ELIGIBLE_MODALS / `_useSdkBrokerFlow`
> dispatch changes.
>
> **Scope**: the broker-connect / OAuth / EDIS / rebalance widgets the SDK ships,
> the way Alphab2bapp (RN) and tidi_new (Flutter) consume them, and where the
> SDK leaves chrome to the consumer vs. owns it itself.
>
> **Source of truth**:
> - `alphaquark-mobile-sdk/packages/rn/src/**` (RN)
> - `alphaquark-mobile-sdk/packages/flutter/lib/src/**` (Flutter)
> - `Alphab2bapp/src/components/BrokerConnectionModal/**`, `Alphab2bapp/src/sdk/**`,
>   `Alphab2bapp/src/GlobalUIModals/ModalManager.js`
> - `tidi_new/tidistockmobileapp/lib/components/home/portfolio/Phase3SdkConnectScreen.dart`,
>   `tidi_new/tidistockmobileapp/lib/components/home/portfolio/BrokerSelectionPage.dart`,
>   `tidi_new/tidistockmobileapp/lib/widgets/EgressIpCallout.dart`,
>   `tidi_new/tidistockmobileapp/lib/service/{ReauthHelper,BrokerCryptoService,SdkDualWriteBridge}.dart`
> - `Alphab2bapp/docs/PHASE3_BROKER_AUDIT.md`,
>   `tidi_new/tidistockmobileapp/docs/SDK_BROKER_PARITY_AUDIT.md`,
>   `tidi_new/tidistockmobileapp/docs/SDK_CHANGELOG.md`

---

## TL;DR

1. **SDK packages (RN vs Flutter): converged, with one functional gap on RN.**
   Per-broker schemas, widget contracts, client API method names + body shapes,
   and theming all match cleanly. The single substantive divergence is that the
   RN `BrokerFormField` does not yet expose `initialValue` / `transformValue`
   (Flutter SDK commit `64d4eff` was not back-ported to RN), so reconnect
   pre-fill and paste-tolerant input normalisation are Flutter-only today.
   Everything else (Angel One per-customer migration, Dhan/AliceBlue oauth
   reshape, Groww 2-field schema, customErrorMessages, pre-OAuth
   `/update-credentials` POST, credential-forwarding to `/login-url`) was
   landed on both sides in the same commit cycle.

2. **Consumers (Alphab2bapp vs tidi_new): the dispatch and gating philosophies
   diverge sharply.** tidi_new uses a single dotenv flag (`USE_SDK_BROKER_FLOW`)
   that routes ALL 13 brokers through `Phase3SdkConnectScreen` — no per-broker
   allowlist. Alphab2bapp uses the same flag PLUS a per-broker allowlist
   (`SDK_ELIGIBLE_MODALS`) PLUS a per-broker kill-switch (`SDK_LEGACY_FALLBACK`)
   PLUS a re-auth bypass (`isReauthFlow → always legacy`). On 2026-04-29
   tidi_new has 11/13 brokers SDK-primary (everything except — see Q2 matrix);
   Alphab2bapp has 11/14 brokers SDK-primary (Angel One and Zerodha kill-
   switched, IIFL Securities not yet promoted). Two consumers, two different
   answers about which brokers should go through the SDK first.

3. **UI hosting: the consumer owns the Phase 3 chrome; the SDK owns the form
   internals.** Both Alphab2bapp's `Phase3SdkBrokerModal` and tidi_new's
   `Phase3SdkConnectScreen` mount their own header / scrim / IP-whitelist
   gate / help content AROUND the SDK widget. The SDK widget itself
   (`BrokerCredentialForm`, `WebViewBrokerAuthFlow`) renders intro / prereqs
   / fields / submit button / WebView and its own minimal header (which
   consumers override). The SDK theme (`SdkTheme` / `useAqSdkTheme` /
   `SdkTheme.of(context)`) is shipped on both sides with the same shape, but
   neither consumer customises it today — both use `DEFAULT_SDK_THEME` /
   `defaultSdkTheme` colours, which means SDK widgets look slightly off-brand
   compared to their respective app shells.

---

## 1. SDK package parity (RN vs Flutter)

### 1.1 Per-broker form schema parity

Source files:
- RN: `alphaquark-mobile-sdk/packages/rn/src/components/brokerFormSchema.ts:145-455`
- Flutter: `alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/broker_form_schema.dart:180-526`

Every broker's schema was diffed field-by-field. Below the columns are
`flow`, `submitEndpoint`, field count + names, custom error map, and notable
divergences.

| Broker | Flow (both) | submitEndpoint (both) | Fields (both) | Custom error map | RN file:line | Flutter file:line | Diff |
|---|---|---|---|---|---|---|---|
| Zerodha | `oauth` | default (update-credentials) | `[]` | — | brokerFormSchema.ts:146-153 | broker_form_schema.dart:181-189 | identical |
| Angel One | `oauth` | default (update-credentials) | `[apiKey, secretKey, clientCode]` | 3 codes (REDIRECT_URL_MISMATCH, APP_CONFIG_AMBIGUOUS, INVALID_API_KEY) | brokerFormSchema.ts:154-210 | broker_form_schema.dart:198-243 | identical |
| Upstox | `oauth` | default | `[apiKey, secretKey]` | — | brokerFormSchema.ts:211-217 | broker_form_schema.dart:244-250 | identical |
| ICICI Direct | `oauth` | default | `[apiKey, secretKey]` | — | brokerFormSchema.ts:218-224 | broker_form_schema.dart:251-257 | identical |
| Kotak | `credentials_totp` | default | `[apiKey, mobileNumber, mpin, ucc, totp]` | — | brokerFormSchema.ts:225-272 | broker_form_schema.dart:258-309 | identical |
| Dhan | `oauth` | default | `[]` | — | brokerFormSchema.ts:273-288 | broker_form_schema.dart:310-332 | identical (Flutter migrated 2026-04-29 in `d7d88b4`) |
| Fyers | `oauth` | default | `[apiKey, secretKey, clientCode]` | — | brokerFormSchema.ts:289-304 | broker_form_schema.dart:333-348 | identical |
| IIFL Securities | `credentials_totp` | default | `[apiKey, clientCode, password, dob]` | — | brokerFormSchema.ts:305-335 | broker_form_schema.dart:349-379 | identical |
| AliceBlue | `oauth` | default | `[]` | — | brokerFormSchema.ts:336-351 | broker_form_schema.dart:380-408 | identical (Flutter migrated 2026-04-29 in `d7d88b4`) |
| Motilal Oswal | `oauth` | default | `[apiKey, clientCode]` | — | brokerFormSchema.ts:352-368 | broker_form_schema.dart:409-421 | identical |
| Hdfc Securities | `oauth` | default | `[apiKey, secretKey]` | — | brokerFormSchema.ts:369-375 | broker_form_schema.dart:422-428 | identical |
| Groww | `credentials` | `connect` | `[apiKey, growwTotpSeed]` | 5 codes (NOT_BASE32 / WRONG_LENGTH / GROWW_REJECTED / INVALID_SEED / INVALID_CREDENTIALS) | brokerFormSchema.ts:376-440 | broker_form_schema.dart:429-511 | identical (both reshaped 2026-04-29 in `0291e02` RN + Flutter twin) |
| Axis Securities | `oauth` | default | `[]` | — | brokerFormSchema.ts:441-447 | broker_form_schema.dart:512-518 | identical |
| DummyBroker | `stub` | default | `[]` | — | brokerFormSchema.ts:448-454 | broker_form_schema.dart:519-525 | identical |

**Schema verdict**: 14/14 brokers match field-for-field.

### 1.2 BrokerFormField API parity

| Property | RN type (`brokerFormSchema.ts:38-66`) | Flutter type (`broker_form_schema.dart:25-94`) | Match? |
|---|---|---|---|
| `name` | `string` | `String` | yes |
| `label` | `string` | `String` | yes |
| `helper` | `string?` | `String?` | yes |
| `placeholder` | `string?` | `String?` | yes |
| `inputType` | `"text"\|"number"\|"tel"\|"password"` | `BrokerFieldInputType` enum (same 4) | yes |
| `secureEntry` | `boolean?` default false | `bool` default false | yes |
| `required` | `boolean?` default false | `bool` default false | yes |
| `pattern` | `RegExp?` | `RegExp?` | yes |
| `patternError` | `string?` | `String?` | yes |
| `redactInLogs` | `boolean?` | `bool` | yes |
| `encrypt` | `boolean?` | `bool` | yes |
| `options` | `Array<{label,value}>?` | `List<({String label, String value})>?` | yes |
| **`initialValue`** | **MISSING** | `String?` (broker_form_schema.dart:62) | **NO — RN gap** |
| **`transformValue`** | **MISSING** | `String Function(String)?` (broker_form_schema.dart:76) | **NO — RN gap** |

**`initialValue` / `transformValue` are Flutter-only.** Added in SDK commit
`64d4eff` (`feat(BrokerFormField): add initialValue + transformValue (reconnect
pre-fill + paste-tolerant input)`). The commit message says
"reconnect pre-fill + paste-tolerant input"; Flutter commit landed but no RN
counterpart has been merged. tidi_new uses these for Kotak smart-prefill
(`Phase3SdkConnectScreen.dart:290-370` builds a per-field `initialValue`
mapping for apiKey/ucc/mobileNumber and `transformValue: _normaliseKotakMobile`).
Alphab2bapp has no equivalent — Kotak reconnect on Alphab2bapp goes through the
legacy modal because `KotakModal` already does the pre-fill itself (so no
visible regression on the legacy path), but if Alphab2bapp ever puts Kotak on
the SDK reconnect path it will re-prompt for stored fields.

**Severity**: minor for Alphab2bapp today (Kotak reconnect routed to legacy via
`isReauthFlow` short-circuit anyway). Blocker for any future SDK-primary
reconnect on RN.

### 1.3 BrokerFormSchema API parity

| Property | RN | Flutter | Match? |
|---|---|---|---|
| `broker` | `BrokerName` | `BrokerName` | yes |
| `flow` | `BrokerFlowKind` | `BrokerFlowKind` | yes |
| `intro` | `string?` | `String?` | yes |
| `prerequisites` | `string[]?` | `List<String>` | yes (Flutter non-nullable, RN nullable; same default of empty) |
| `fields` | `BrokerFormField[]` | `List<BrokerFormField>` | yes |
| `defaultRedirectUrl` | `string?` | `String?` | yes |
| `submitLabel` | `string?` | `String?` | yes |
| `submitEndpoint` | `"update-credentials"\|"connect"?` (kebab-case strings) | `BrokerSubmitEndpoint.updateCredentials\|connect` (camelCase enum) | yes (semantically equivalent; convention difference) |
| `customErrorMessages` | `Record<string, string>?` | `Map<String, String>?` | yes |

**Schema-level verdict**: identical contract; only convention difference is the
RN string-union vs the Flutter enum on `submitEndpoint`.

### 1.4 BrokerCredentialForm parity

| Concern | RN (`BrokerCredentialForm.tsx:46-368`) | Flutter (`broker_credential_form.dart:19-481`) | Diff |
|---|---|---|---|
| Props | `broker, schemaOverride, encrypt, onContinueToOauth, onSuccess, onError, title` | same plus `Key` | identical |
| Validation order | required → pattern check on trimmed field | required → pattern check on `_readField(f)` (which applies `transformValue` first) | **divergent**: Flutter applies `transformValue` before the regex; RN never has `transformValue` so the question doesn't arise |
| OAuth handoff for `submitEndpoint=update-credentials` | calls `client.updateBrokerCredentials(broker, body)` BEFORE `onContinueToOauth(body)` (`BrokerCredentialForm.tsx:190-194`) | same — calls `scope.client.updateBrokerCredentials(broker, body)` BEFORE `cb(body)` (`broker_credential_form.dart:175-179`) | identical (both shipped 2026-04-29 via `dfa4675` RN + `620a2fd` Flutter) |
| `submitEndpoint=connect` dispatch | `client.connectBroker(broker, body)` | `scope.client.connectBroker(widget.broker, body)` | identical |
| Default dispatch | `client.updateBrokerCredentials(broker, body)` | same | identical |
| Inline error banner | reads `schema.customErrorMessages[err.error]` (RN field is `error`) | reads `_schema.customErrorMessages[err.code]` (Flutter field is `code`) | **convention-only divergence** — both surface the same broker-specific actionable message; field name on the error envelope differs by package |
| Error banner render | red banner above submit button (`BrokerCredentialForm.tsx:267-282`); cleared on field-edit (line 110) | red banner above submit button (`broker_credential_form.dart:298-317`); cleared on field-edit (line 280-291) | identical UX |
| Theme reads | `useAqSdkTheme()` returns `SdkTheme` | `SdkTheme.of(context)` returns same | identical |
| Reconnect pre-fill | none — controllers default empty | `TextEditingController(text: f.initialValue ?? '')` (broker_credential_form.dart:81) | **RN gap** — see §1.2 |

**BrokerCredentialForm verdict**: contracts match. The two real divergences
are the convention difference on the error-code field name (`error` vs `code`)
and the missing `initialValue` / `transformValue` plumbing on RN.

### 1.5 WebViewBrokerAuthFlow parity

| Concern | RN (`WebViewBrokerAuthFlow.tsx:79-300`) | Flutter (`webview_auth_flow.dart:24-196`) | Diff |
|---|---|---|---|
| Props | `broker, redirectUrl, extraExchangeBody, mapCallbackParams, onSuccess, onError, renderHeader, onClose` | `broker, redirectUrl, extraExchangeBody, mapCallbackParams, onSuccess, onError, headerBuilder, onClose` | identical (RN: `renderHeader`; Flutter: `headerBuilder` — same intent, different name) |
| WebView dep | lazy `require('react-native-webview')` (line 67-77) so the dep is optional | `import 'package:webview_flutter/webview_flutter.dart'` (line 15) — required | **divergent**: RN lets the consumer omit `react-native-webview` if they never render the widget; Flutter `webview_flutter` is a mandatory transitive dep. Cosmetic for parity. |
| Login URL fetch | `client.getBrokerLoginUrl(broker, redirectUrl, extraExchangeBody)` on mount (line 158) | `client.getBrokerLoginUrl(broker, redirectUrl: ..., credentials: extraExchangeBody)` on mount (line 104-108) | identical (both forward `extraExchangeBody` as `credentials` to `/login-url` for broker-per-user OAuth) |
| Redirect match | origin + pathname comparison ignoring query (line 134-141) | scheme + host + port + path comparison (line 138-141) | identical intent; Flutter is more strict about scheme/port (RN's `URL.origin` includes both implicitly) |
| Idempotent exchange | `exchangeOnceRef.current` flag + 3 nav hooks (`onShouldStartLoadWithRequest`, `onLoadStart`, `onNavigationStateChange`) all funnel through `handleNav` (line 130, 264-289) | `_exchanged` bool + single `NavigationDelegate.onNavigationRequest` (line 110-114, 143-144) | **divergent** in implementation, but same outcome. RN's triple-hook is a workaround for Android 302 redirects (see SDK commit `80ccaf0`); Flutter's single hook hits before the 302 resolves naturally. Both are idempotent. |
| Loading / exchange phases | `phase` state with `loading | webview | exchanging` (line 127) | `_phase` enum with `loading | webview | exchanging` (line 66) | identical |
| Default header | renders own `Pressable Close` button + title (line 237-249) | renders own `_DefaultHeader` widget (line 198-239) | identical (both consumer-overrideable via `renderHeader` / `headerBuilder`) |
| Error envelope on `getBrokerLoginUrl` failure | wraps any error in `_toSdkError(e, "broker_login_url_failed")` | wraps any non-`SdkRequestError` in `SdkRequestError('broker_login_url_failed', 0, e.toString())` | identical |

**WebViewBrokerAuthFlow verdict**: contracts match. The triple-nav-hook on RN
vs single-delegate on Flutter is a platform-specific workaround documented in
SDK commit `80ccaf0`, not a behaviour divergence.

### 1.6 AqSdkClient API parity

| Method | RN signature (`AqSdkClient.ts`) | Flutter signature (`aq_sdk_client.dart`) | Match? |
|---|---|---|---|
| `setUser(userRef)` | `Promise<void>` | `Future<void>` | yes |
| `logout()` | `Promise<void>` | `Future<void>` | yes |
| `getUserStatus()` | `Promise<UserStatus>` | `Future<UserStatus>` | yes |
| `getSellAuth(broker, symbols?)` | `Promise<SellAuthStatus>` (line 225-231) | `Future<SellAuthStatus>` (line 221-230) | yes |
| `verifySellAuth(broker)` | yes | yes | yes |
| `attestSellAuth(broker)` | yes | yes | yes |
| `getBrokerLoginUrl(broker, redirectUrl?, credentials?)` | returns `BrokerLoginUrl` (line 262-276) | returns `String` (after extracting `loginUrl`) (line 266-285) | **divergent return type**: RN exposes the full payload; Flutter only the URL |
| `exchangeBrokerToken(broker, body)` | returns `BrokerExchangeResult` (line 278-287) | returns `BrokerExchangeResult` (line 287-300) | yes |
| `updateBrokerCredentials(broker, body)` | returns `{ok, broker, loginUrl?}` (line 289-295) | returns `String?` (just the loginUrl) (line 302-312) | **divergent return type**: RN exposes the full envelope; Flutter just the URL |
| `connectBroker(broker, body)` | returns `{ok, broker, connected_at, token_expire, is_primary}` (line 305-317) | returns `Map<String, dynamic>` (line 319-328) | **divergent return type** — Flutter returns the raw map; RN unpacks it into a typed shape |
| `getReauthUrl(broker, redirectUrl?)` | returns `{ok, broker, url, requires_form, requires_totp}` (line 319-331) | returns record `({String? url, bool requiresForm, bool requiresTotp})` (line 330-344) | **convention difference** — same fields different envelope |
| `setPrimaryBroker(broker)` | returns `{ok, broker, is_primary}` (line 333-338) | returns `Future<void>` (line 346-351) | **divergent return type** — RN gives the consumer the response; Flutter discards it |
| `rebalanceCalculate(input)` | returns `RebalanceCalculation` (line 342-348) | returns `RebalanceCalculation` (line 355-364) | yes |
| `rebalanceExecute(input)` | returns `RebalanceExecuteResult` (line 350-356) | returns `Map<String, dynamic>` (raw — line 369-377) | **divergent return type** — RN typed; Flutter raw broker-shaped |
| `rebalancePerformance(input)` | returns `RebalancePerformanceResult` (line 358-364) | returns `Map<String, dynamic>` (line 381-389) | **divergent return type** |
| `switchRebalanceBroker(broker)` | returns `{ok, broker} & raw` (line 366-372) | returns `Map<String, dynamic>` (line 391-397) | yes (semantically) |

**Client verdict**: 100% method-name coverage on both sides; method bodies and
endpoints match. Flutter's typed return story is less mature — it returns raw
Maps for several methods where RN has typed envelopes. Practical impact: a
Flutter consumer that wants `is_primary` after `connectBroker` reads
`r['is_primary'] as bool` directly; an RN consumer reads the typed field. No
information loss either way; just less type safety on Flutter.

### 1.7 EdisModal & RebalanceReviewModal

Both packages export `EdisModal` (`EdisModal.tsx:62-`, `edis_modal.dart`) with
the same prop set (`broker, symbols?, onAuthorized, onClose, onError?, title?`).
The internal `VERIFY_BROKERS = {Angel One, Dhan}` and
`ATTEST_BROKERS = {Zerodha, Fyers}` matrices are mirrored on both sides
(`EdisModal.tsx:37-46`).

`RebalanceReviewModal` ships in both packages
(`RebalanceReviewModal.tsx`, `rebalance_review_modal.dart`); cross-checked
prop list and submit handler shape — identical.

Neither consumer calls `EdisModal` / `RebalanceReviewModal` directly today
(both are wired into the broker connect flow only). When they do, the contracts
match.

### 1.8 SdkTheme parity

RN: `theme/SdkTheme.ts` — `DEFAULT_SDK_THEME` + `resolveSdkTheme` +
`useAqSdkTheme` (line 100-168).

Flutter: `theme/sdk_theme.dart` + `theme/sdk_theme_inherited.dart` —
`defaultSdkTheme` + `resolveSdkTheme` + `SdkTheme.of(context)` (line 26-358).

All 17 colour slots, 5 typography slots, 2 shape slots present on both sides
with the same defaults. SDK commit `14a1436`
(`feat(sdk): close Flutter theming gap, full RN/Flutter parity, test floor +
accurate READMEs`) explicitly closed the theming gap. Verified.

Both providers (`AqSdkProvider` props.theme + `AqSdkScope` widget.theme) accept
a `PartialSdkTheme` override and call `resolveSdkTheme` to deep-merge.

### 1.9 Recent SDK commits — RN-only / Flutter-only / both

```
$ cd alphaquark-mobile-sdk && git log --oneline
```

| Commit | Subject | Side(s) |
|---|---|---|
| `707ae47` | customErrorMessages — per-broker error-code → user message map | both (commit message lists both packages) |
| `0291e02` | Groww schema — 2 fields (drop secretKey), permissive Base32 pattern | both (schema file in each) |
| `dfa4675` | pre-OAuth /update-credentials call for flow=oauth + submitEndpoint=update-credentials | RN only (paired with `620a2fd`) |
| `620a2fd` | pre-OAuth /update-credentials call for flow=oauth + submitEndpoint=updateCredentials | Flutter only (paired with `dfa4675`) |
| `d7d88b4` | migrate Dhan + AliceBlue schemas to flow=oauth, fields=[] | Flutter only (RN was already at flow=oauth) |
| `c9475f5` | brokerFormSchema Dhan → flow=oauth, fields=[] | RN only |
| `c5bf168` | forward credentials to /login-url for broker-per-user OAuth | Flutter only (paired with `8435778`) |
| `8435778` | forward credentials to /login-url for broker-per-user OAuth | RN only (paired with `c5bf168`) |
| `64d4eff` | BrokerFormField initialValue + transformValue | **Flutter only — NOT YET ON RN** |
| `f9cfd92` | AliceBlue → flow=oauth, fields=[] | RN only |
| `d3c628b` | onLoadStart syntheticEvent type annotation | RN only (cosmetic) |
| `80ccaf0` | WebViewBrokerAuthFlow intercept onLoadStart | RN only (Android 302 fix) |
| `a69712c` | migrate Angel One schema to OAuth + per-customer SmartAPI app | both |
| `14a1436` | close Flutter theming gap, full RN/Flutter parity | Flutter (catch-up) |
| `1750200` | theme injection for SDK-rendered surfaces + Zerodha advisor-shared OAuth schema | RN only |
| `9cc22b9` | per-broker submitEndpoint dispatch | Flutter only (paired with `16f1dd9`) |
| `16f1dd9` | per-broker submitEndpoint dispatch | RN only (paired with `9cc22b9`) |
| `754ba06` | Phase 2 — rebalance client methods + RebalanceReviewModal | Flutter only (paired with `565c862`) |
| `565c862` | Phase 2 — rebalance hooks + RebalanceReviewModal | RN only (paired with `754ba06`) |

**Pattern**: the SDK is being built with paired commits — every RN feature has
a sibling Flutter commit. The two exceptions are:

- **`64d4eff` (Flutter `initialValue` + `transformValue`)** has no RN sibling.
- The early `c9475f5` / `f9cfd92` (RN Dhan / AliceBlue oauth reshape) and the
  later `d7d88b4` (Flutter port of both) — eventually paired but with a
  noticeable lag (RN got there first, Flutter caught up two days later).

### 1.10 SDK-package divergence — ranked

| # | Divergence | Severity | Side missing | Action |
|---|---|---|---|---|
| 1 | `BrokerFormField.initialValue` / `transformValue` not on RN | minor today, blocker for SDK-primary RN reconnect | RN | port `64d4eff` to RN |
| 2 | `getBrokerLoginUrl` returns `BrokerLoginUrl` on RN, `String` on Flutter | cosmetic | n/a | accept; document in README |
| 3 | `updateBrokerCredentials` / `connectBroker` / `setPrimaryBroker` / `rebalanceExecute` / `rebalancePerformance` return raw Map on Flutter, typed shape on RN | cosmetic | Flutter (typed) | optional — adds Dart types on Flutter |
| 4 | `submitEndpoint` is string-union on RN, enum on Flutter | cosmetic | n/a | language convention, accept |
| 5 | RN `SdkError.error` vs Flutter `SdkRequestError.code` field name | cosmetic | n/a | language convention, accept |
| 6 | `react-native-webview` lazy-required on RN; `webview_flutter` mandatory on Flutter | cosmetic | n/a | RN lets you skip the dep if you never render WebView; Flutter doesn't |
| 7 | RN WebView uses 3 nav hooks for Android 302 robustness; Flutter uses 1 | platform-specific implementation, no parity issue | n/a | ok |

---

## 2. Consumer parity (Alphab2bapp vs tidi_new)

### 2.1 Per-broker SDK routing matrix (2026-04-29 snapshot)

| Broker | Alphab2bapp routing | tidi_new routing | Reason for divergence |
|---|---|---|---|
| Zerodha | **legacy** (in `SDK_LEGACY_FALLBACK`, `BrokerConnectModalDispatch.js:132-135`) | **SDK** (no per-broker guard in `BrokerSelectionPage.dart:233-242`; default goes through `Phase3SdkConnectScreen`) | Alphab2bapp kill-switched Zerodha after Android 302 redirect race in WebView intercept (`BrokerConnectModalDispatch.js:131`); tidi_new uses `webview_flutter` which doesn't have the same Android 302 issue. tidi_new's verdict in `tidi_new/docs/SDK_BROKER_PARITY_AUDIT.md:135` is "Matches legacy" |
| Angel One | **legacy** (in `SDK_LEGACY_FALLBACK`, `BrokerConnectModalDispatch.js:132-135`) | **SDK** (both shared and per-customer modes — see commits `884cdef` + `709fd2d`) | Alphab2bapp note: "shared-mode `/exchange-token` callback handler still missing" (`BrokerConnectModalDispatch.js:127-131`). tidi_new closed that gap by depending on backend commit `177ce21` (`/sdk/v1/connections/Angel One/exchange-token` shared-mode dispatch). Alphab2bapp has not yet flipped Angel One because the audit row in `Alphab2bapp/docs/PHASE3_BROKER_AUDIT.md:72-98` still reads "SDK-broken" |
| Upstox | **SDK** (in `SDK_ELIGIBLE_MODALS`) | **SDK** | aligned |
| ICICI Direct | **SDK** (`'ICICI'` in allowlist; `normalizeBrokerKey` maps `'ICICI Direct' → 'ICICI'`) | **SDK** | aligned |
| Kotak | **SDK** (in allowlist) | **SDK** (post-`b404cf4` — promoted via schema override that uses Flutter-only `initialValue`/`transformValue`) | aligned, but tidi_new's promotion depends on the Flutter-only schema-override capability — Alphab2bapp's Kotak SDK promotion has no equivalent pre-fill, which would regress legacy UX if reconnect ran on SDK (currently `isReauthFlow → legacy` masks the issue) |
| Dhan | **SDK** (in allowlist) | **SDK** (post-`8b9549b`) | aligned |
| Fyers | **SDK** (in allowlist) | **SDK** (post-`08a5572`) | aligned |
| IIFL Securities | **legacy** (NOT in allowlist; explicit comment at `BrokerConnectModalDispatch.js:109-118` — "schema declares flow=credentials_totp but legacy iiflmodal.js is empty-fields OAuth at hardcoded markets.iiflcapital.com") | **legacy** (no specific guard but the SDK schema would 400 because backend has no `update-credentials` slug for IIFL; `Phase3SdkConnectScreen.dart:63-68` calls this out) | aligned (both stay legacy because the backend has no IIFL dispatch) |
| AliceBlue | **SDK** (in allowlist) | **SDK** (post-`8b9549b`) | aligned |
| Motilal Oswal | **SDK** (`'Motilal'` in allowlist; `normalizeBrokerKey` maps `'Motilal Oswal' → 'Motilal'`) | **SDK** (post-`08a5572`) | aligned |
| Hdfc Securities | **SDK** (`'HDFC'` in allowlist; `normalizeBrokerKey` maps `'Hdfc Securities' → 'HDFC'`) | **SDK** (post-`08a5572`) | aligned |
| Groww | **SDK** (in allowlist as of 2026-04-29 commit `01e9e39`) | **SDK** (post-`e55ef8e`) | aligned |
| Axis Securities | **SDK** (`'Axis Securities'` in allowlist) | **SDK** (post-`8b9549b`) | aligned |
| DummyBroker | **SDK** (in allowlist) | **SDK** | aligned |

**Allowlist counts (2026-04-29)**:
- Alphab2bapp `SDK_ELIGIBLE_MODALS`: 11 brokers (`HDFC, Upstox, ICICI, Motilal,
  Dhan, Kotak, AliceBlue, Fyers, Axis Securities, Groww, DummyBroker`).
  Outside allowlist: `IIFL` (not promoted), `Zerodha` + `Angel One` (in
  `SDK_LEGACY_FALLBACK` kill-switch).
- tidi_new: no allowlist; all 13 brokers go through `Phase3SdkConnectScreen`
  when `USE_SDK_BROKER_FLOW=true`. Only `IIFL Securities` falls back to legacy
  because the SDK schema lookup returns null at runtime
  (`Phase3SdkConnectScreen.dart:163-169` shows the diagnostic + opt-out path).

**Two consumers, two answers on Zerodha and Angel One.** The reasons for the
split:

1. **Zerodha**: Alphab2bapp's regression report
   (`docs/PHASE3_BROKER_AUDIT.md:62-72`) cites Android-only WebView 302
   redirect race in `react-native-webview`. tidi_new uses `webview_flutter`
   which doesn't share that bug. SDK commit `80ccaf0` (`fix(sdk):
   WebViewBrokerAuthFlow intercept onLoadStart — catches OAuth redirect before
   website 302`) is the RN-side fix; Alphab2bapp hasn't re-validated Zerodha on
   SDK after that commit landed.

2. **Angel One**: tidi_new merged the `/exchange-token` shared-mode dispatch
   (backend commit `177ce21`) and added a Flutter-only schema override
   (`Phase3SdkConnectScreen._buildAngelOneSharedSchemaOverride`,
   `Phase3SdkConnectScreen.dart:239-257`) that renders empty fields for
   shared-mode advisors. Alphab2bapp would need (a) to consume the same
   backend dispatch (already deployed), (b) to ship a parallel schema override
   on RN (it has none — the `useSharedAngelOneKey` toggle is read from
   `configData` but only to fall back to legacy, not to reshape the SDK form
   — `Phase3SdkBrokerModal.js:50-58` even calls this out as a Known Gap).

### 2.2 Reauth handling diff

| Concern | Alphab2bapp | tidi_new |
|---|---|---|
| Trigger | `ManageConnectionsModal` → `setModalPayload({reauthConfig})` → `ModalManager` reads `modalPayload.reauthConfig` → passes to `BrokerConnectModalDispatch` (`ModalManager.js:44`) | `ManageBrokersPage._navigateToBrokerAuth` → `ReauthHelper.handleSmartReauth` (`ReauthHelper.dart:214-279`) |
| SDK eligibility | **`isReauthFlow !== false`** short-circuits to legacy regardless of allowlist (`BrokerConnectModalDispatch.js:178-184`) | mixed: silent-refresh brokers (Groww only) bypass any UI; credential brokers (HDFC/Upstox/ICICI/Motilal/Fyers) get pre-signed URL via `/sdk/v1/connections/<broker>/reauth-url` and open `BrokerCredentialPage` with `reauthConfig`; everything else falls back to the normal connect path (which IS the SDK now) |
| Net behaviour for re-auth | every broker re-auths via legacy modals (Phase 3 design intent: "re-auth always legacy regardless of flag" per `Alphab2bapp/CLAUDE.md`) | re-auth uses SDK-primary connect path for non-credential brokers; uses legacy `BrokerCredentialPage` (with smart-reauth pre-fill) for credential brokers |
| Silent refresh (Groww) | not implemented in re-auth path (would still go to legacy which has its own retry) | implemented (`ReauthHelper.performSilentRefresh`, `kSilentRefreshBrokers = {'Groww'}`); succeeds without opening any modal |
| `markBrokerExpired` on Reconnect tap | yes (Alphab2bapp `a802ed7`) | yes (port: `eafb413`) |
| Smart pre-fill (Kotak, Fyers) | `KotakModal` + `FyersConnect` legacy modals do their own pre-fill | `BrokerCryptoService.getStoredBrokerCreds` returns 4 Kotak fields; tidi `Phase3SdkConnectScreen._buildKotakSchemaOverride` uses Flutter-only `initialValue` to feed into the SDK form (`Phase3SdkConnectScreen.dart:290-370`); Fyers `apiKey ↔ secretKey` swap in `getStoredBrokerCreds` |

**Reauth verdict**: structurally divergent. Alphab2bapp keeps re-auth on legacy
universally (deliberate); tidi_new mixes legacy (credential brokers) and SDK
(everyone else) with an explicit silent-refresh fast path. Both are working as
designed for their respective consumers; no immediate parity action.

### 2.3 Encryption diff

| Concern | Alphab2bapp | tidi_new |
|---|---|---|
| Cipher | `CryptoJS.AES.encrypt(value, 'ApiKeySecret').toString()` — CryptoJS default (AES-256-CBC, OpenSSL EVP_BytesToKey-MD5 KDF, salt prefix) | hand-rolled match in Dart using `encrypt` package — AES-256-CBC, MD5-derived key, OpenSSL-compatible salt prefix (`BrokerCryptoService.dart:11-50`) |
| Passphrase | `'ApiKeySecret'` (`Phase3SdkBrokerModal.js:124`) | `'ApiKeySecret'` (`BrokerCryptoService.dart:18`) |
| Hook into SDK | `encrypt={encryptField}` prop on `<BrokerCredentialForm/>` (`Phase3SdkBrokerModal.js:312-314`) | `encrypt: (fieldName, raw) async => BrokerCryptoService.instance.encryptCredential(raw)` on `BrokerCredentialForm` (`Phase3SdkConnectScreen.dart:619-620`) |
| Decrypt path | n/a (server-side) | mirror of CryptoJS-decrypt in `BrokerCryptoService.dart:53-100` for stored-cred read on smart-reauth |

**Encryption verdict**: identical wire format. The Dart implementation
explicitly mimics CryptoJS's behaviour
(`BrokerCryptoService.dart:8-13` docstring confirms). Same encrypted blob
shape, same passphrase, same upstream backend decrypt.

### 2.4 Help content diff

| Concern | Alphab2bapp | tidi_new |
|---|---|---|
| Phase 3 help component | `Phase3BrokerHelp.js` — broker → `<*HelpContent/>` mapping (`Phase3BrokerHelp.js:52-64`) | none — `Phase3SdkConnectScreen` does NOT render any per-broker help content. The legacy `BrokerCredentialPage` and `BrokerAuthPage` had per-broker help inline; `Phase3SdkConnectScreen` does not port that |
| Brokers with help | HDFC, Fyers, Upstox, Motilal, Zerodha, Groww, Kotak, ICICI (10 total once you count aliases) | none |
| Default expanded? | yes (`Phase3BrokerHelp.js:72`) | n/a |
| Tracked SDK gap? | no (Alphab2bapp owns the help components) | yes — tidi_new's `docs/SDK_CHANGELOG.md` Known Gap #1 ("Rich `prerequisites`") frames this as an SDK enhancement |

**Help-content verdict**: divergent. Alphab2bapp users see a 4-8 step guide
under the SDK form; tidi_new users see only the SDK schema's flat
`prerequisites: List<String>` bullets (the SDK widget's own rendering, not a
consumer-side help panel).

### 2.5 IP-whitelist gate diff

| Concern | Alphab2bapp | tidi_new |
|---|---|---|
| Component | `EgressIpCallout.js` — embedded inside the connect modal, takes `broker, customerEmail, onAcknowledgeChange` | `EgressIpCallout.dart` — same shape, takes `broker, email, onAcknowledgeChange` |
| Render gate | only mounted when `IP_WHITELIST_BROKERS.has(brokerName)` (`Phase3SdkBrokerModal.js:284`); broker set is `{Kotak, Groww, ICICI, ICICI Direct, HDFC, Hdfc Securities, Upstox, Motilal Oswal, Fyers}` (line 100-110) | always mounted; the callout itself reads server `egress/me` and self-skips for unsupported brokers via `_skipGate` (`EgressIpCallout.dart:88-128`) |
| Form gate | `pointerEvents={egressReady ? 'auto' : 'none'}` + opacity (`Phase3SdkBrokerModal.js:307-310`) | `IgnorePointer(ignoring: !_egressReady || _schemaOverridePending)` + opacity (`Phase3SdkConnectScreen.dart:612-615`) |
| Default ack value | `useState(!IP_WHITELIST_BROKERS.has(brokerName))` — true for non-whitelisted brokers immediately (line 175-177) | `false` initially; callout fires `onAcknowledgeChange(true)` immediately for non-whitelisted via `_skipGate` |
| Backend `broker_key` overrides | not visible in `Phase3SdkBrokerModal` (handled inside `EgressIpCallout.js` itself) | `Phase3SdkConnectScreen` doesn't override; `EgressIpCallout.dart:55-58` has hardcoded `{'hdfcsecurities': 'hdfcsec', 'axissecurities': 'axis'}` for the `egress/me` lookup |

**IP-whitelist verdict**: the front-of-house behaviour matches (gate the form
until ack), but the trigger logic diverges. Alphab2bapp has a hardcoded set of
"rendered" brokers; tidi_new always renders + lets the callout self-skip.
tidi_new's approach is more robust to backend changes (a new IP-required
broker auto-shows up); Alphab2bapp's is more deterministic but requires manual
maintenance of the set.

### 2.6 Allowlist promotion ordering

The two consumers promoted brokers in different orders. From
`Alphab2bapp/docs/CHANGELOG.md` and `tidi_new/docs/SDK_CHANGELOG.md`:

| Broker | Alphab2bapp commit | tidi_new commit | Date | Notes |
|---|---|---|---|---|
| HDFC | `f1f94b1` | `08a5572` (batched) | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Upstox | `8c901f0` | `08a5572` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| ICICI Direct | `634e523` | `08a5572` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Motilal Oswal | `672ee4e` | `08a5572` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Fyers | `87cd3b1` | `08a5572` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Dhan | `855a87a` | `8b9549b` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Kotak | `7d58776` | `b404cf4` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| AliceBlue | `6436c79` | `8b9549b` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Axis Securities | `6325003` | `8b9549b` | 2026-04-28 / 2026-04-29 | Alphab2bapp first |
| Groww | `01e9e39` | `e55ef8e` | 2026-04-29 / 2026-04-29 | Same day |
| Angel One (shared) | NOT promoted | `884cdef` | n/a / 2026-04-29 | tidi_new first; Alphab2bapp held |
| Zerodha | NOT promoted (kill-switched) | (default — never explicitly promoted) | n/a / day-1 | tidi_new ships SDK-by-default for Zerodha; Alphab2bapp kill-switches it |
| IIFL Securities | NOT promoted | NOT promoted (defensive null-check at `Phase3SdkConnectScreen.dart:163`) | n/a | both held |

**Pattern**: Alphab2bapp promoted brokers individually with per-broker audit
verdicts; tidi_new promoted in batches once the SDK gaps closed and saw no
need for an explicit allowlist. tidi_new is currently AHEAD on Angel One and
Zerodha; Alphab2bapp's audit doc has not been updated to reflect the
2026-04-29 backend `177ce21` Angel One dispatch landing.

---

## 3. UI hosting (consumer vs SDK)

### 3.1 Per-widget UI hosting table

For each SDK widget, who hosts what:

#### `BrokerCredentialForm`

| UI element | RN consumer (Alphab2bapp Phase3SdkBrokerModal) | Flutter consumer (Phase3SdkConnectScreen) | SDK widget itself |
|---|---|---|---|
| Bottom-sheet scrim + tap-outside dismiss | hosted (`Phase3SdkBrokerModal.js:261-266`) | n/a — full-screen `Scaffold` | not provided |
| Header / title bar with Close X | hosted (`Phase3SdkBrokerModal.js:211-227`) | hosted via `Scaffold(appBar: AppBar(title:...))` | NOT provided (form has no header) |
| `intro` line above fields | not hosted; SDK form renders | not hosted; SDK form renders | rendered by `BrokerCredentialForm.tsx:237` / `broker_credential_form.dart:236` |
| `prerequisites` bullet list | not hosted; SDK form renders | not hosted; SDK form renders | rendered by `BrokerCredentialForm.tsx:238-247` / `broker_credential_form.dart:243-273` |
| Per-field label + helper + input + error | not hosted | not hosted | rendered by SDK |
| Inline submit-error banner | not hosted | not hosted | rendered by SDK (uses `customErrorMessages` map) |
| **Submit button** | not hosted | not hosted | rendered by SDK |
| **EgressIpCallout (IP whitelist)** | **hosted ABOVE form** (`Phase3SdkBrokerModal.js:284-292`) | **hosted ABOVE form** (`Phase3SdkConnectScreen.dart:592-600`) | not provided (out of scope for SDK) |
| **Per-broker step guide / video / IP gotchas** | **hosted via `Phase3BrokerHelp` ABOVE form** (line 301) | **NOT hosted** | not provided |
| Form-disable gate (egressReady / schemaOverride pending) | hosted via `pointerEvents='none' + opacity:0.45` wrapper (line 303-311) | hosted via `IgnorePointer + Opacity` wrapper (line 612-615) | not provided |

#### `WebViewBrokerAuthFlow`

| UI element | Alphab2bapp | tidi_new | SDK widget itself |
|---|---|---|---|
| Bottom-sheet scrim + tap-outside dismiss | hosted (line 230-256) | n/a — full-screen Scaffold | not provided |
| Outer modal panel / route | hosted (`Phase3SdkBrokerModal.js:240-241`) | hosted (`Scaffold + AppBar`, line 548-549) | not provided |
| Inner header (close + "Connecting <Broker>") | duplicated — Phase3SdkBrokerModal renders `<Header title="Connect <Broker>"/>` (line 241), AND the SDK widget also renders its own header by default (`WebViewBrokerAuthFlow.tsx:237-249`); Alphab2bapp does NOT pass `renderHeader` so it ends up with TWO headers | hosted via Scaffold AppBar; SDK's `_DefaultHeader` ALSO renders unless `headerBuilder` is passed; tidi_new does NOT pass `headerBuilder` so it also has two headers | rendered by SDK by default |
| Loading spinner + "Loading <Broker> login..." | not hosted | not hosted | rendered by SDK |
| WebView itself | not hosted | not hosted | rendered by SDK |
| "Finalizing broker connection..." spinner | not hosted | not hosted | rendered by SDK |

**Double-header observation**: both consumers wrap the SDK WebView widget in
their own appbar but do not pass `renderHeader` / `headerBuilder` to suppress
the SDK's own header. This is a real visible bug worth fixing — the user sees
"<App AppBar with title>" + a divider + "Close [Broker]" SDK header below it.

### 3.2 Theme system usage

| Concern | Alphab2bapp | tidi_new |
|---|---|---|
| Provider mounting | `<AqSdkProvider client={...} userRef={...}>` in `SdkProviderRoot.js` — **no `theme` prop passed** | `<AqSdkScope client={...} userRef={...}>` in `main.dart` — **no `theme` prop passed** |
| Effect | SDK widgets use `DEFAULT_SDK_THEME` (primary `#1976d2`, surface `#ffffff`, etc.) regardless of app brand | SDK widgets use `defaultSdkTheme` (same defaults) regardless of app brand |
| Visual mismatch | yes — Alphab2bapp's primary brand colour is not `#1976d2` (configured per-tenant via `configData.config.color1`); SDK form's submit button is the wrong colour for many tenants | yes — tidi_new has its own brand palette in `lib/theme/`; SDK form is similarly off-brand |
| Documented? | not explicitly | not explicitly |

**Theme-usage verdict**: both consumers ship the default SDK theme. The theme
system exists end-to-end on both packages and is wired through the providers,
but no consumer is yet driving it from app config. Low-cost fix; high
brand-consistency upside for tenant-themed deployments.

### 3.3 SDK-vs-consumer hosting summary

**SDK hosts (both packages)**: form internals (intro, prereqs, fields, errors,
submit button), WebView lifecycle (load URL, capture redirect, exchange-token
POST, default header), EDIS / RebalanceReview modal bodies.

**Consumer hosts (both consumers)**: outer modal/route chrome, scrim,
app-shell appbar, IP-whitelist callout (`EgressIpCallout`), form-disable gates
(IP gate + Flutter-only schema-override pending gate), help content.

**Logically should move from consumer → SDK** (cross-cutting between RN +
Flutter):

1. **`EgressIpCallout`**: this is per-broker AlphaQuark backend infrastructure
   (egress IP claim/ack), not per-app branding. Both consumers ship a near-
   identical implementation against the same backend `egress/me` and
   `egress/claim` endpoints. Belongs in the SDK with a feature flag the
   consumer can disable for tenants without egress infrastructure. Tracked
   informally in tidi_new `SDK_CHANGELOG.md` Known Gap #5.
2. **Per-broker rich help content** (numbered steps, video links, copy-to-
   clipboard buttons, broker-specific "you must enable Order Placement"
   warnings): tidi_new's `SDK_CHANGELOG.md` Known Gap #1 explicitly proposes
   this as an SDK schema extension (`List<BrokerInstructionStep>`). Today
   only Alphab2bapp ships it (via `Phase3BrokerHelp.js`); tidi_new users
   miss out. Putting it in the SDK schema serves both consumers from one
   source.

**Logically should be overridable in SDK but isn't**:

3. **WebView header**: SDK forces a default header on; consumers wrap with
   their own app shell, producing the double-header bug. Either default the
   SDK header to off, or document that consumers should pass `renderHeader: ()
   => null` / `headerBuilder: (_) => SizedBox.shrink()`. Today neither
   consumer realises this and both ship double headers.
4. **Form's submit button label**: SDK uses `Connect <Broker>`; some legacy
   modals use "Continue" / "Verify and Connect" / "Connect Broker". The
   `submitLabel` prop exists on the schema but is unused by both consumers.
5. **Form's IP-callout slot**: today consumers wrap the SDK form. If the SDK
   exposed a `slotAboveForm` / `slotBelowPrerequisites` prop, the
   IP-callout placement (above prerequisites? above first field? below
   intro?) would be controlled by the SDK rather than every consumer
   re-deciding.

---

## 4. Action items

Concrete next steps to close the gaps surfaced above, ranked by impact.

### Severity: blocker

1. **Port SDK `BrokerFormField.initialValue` + `transformValue` to RN**
   (`alphaquark-mobile-sdk/packages/rn/src/components/brokerFormSchema.ts` +
   `BrokerCredentialForm.tsx`). Mirror the Flutter API exactly: nullable
   `initialValue: string`, optional `transformValue: (string) => string`.
   Update tests. Then port tidi_new's Kotak schema-override pattern to
   Alphab2bapp's `Phase3SdkBrokerModal` so reconnect-pre-fill works on RN.
   Without this, any future move of Kotak / Upstox / Fyers reconnect onto the
   SDK regresses legacy UX (re-prompts for stored fields). **Severity:
   blocker for moving re-auth to SDK on RN.**

2. **Suppress the SDK's default WebView header in both consumers** (or
   default it off in the SDK). Today every WebViewBrokerAuthFlow render in
   both apps shows a doubled header (Alphab2bapp's `<Header title="Connect
   <Broker>"/>` + SDK's "Connecting <Broker>"; tidi_new's `Scaffold`
   appBar + SDK's `_DefaultHeader`). Pass `renderHeader: () => null`
   / `headerBuilder: (_, __) => const SizedBox.shrink()` in
   `Phase3SdkBrokerModal.js` and `Phase3SdkConnectScreen.dart`.
   **Severity: blocker for visual parity.**

### Severity: high

3. **Reconcile Angel One routing**. tidi_new went SDK-primary on both shared
   and per-customer modes (commits `884cdef` + `709fd2d`); Alphab2bapp
   keeps Angel One on legacy via `SDK_LEGACY_FALLBACK`. Backend
   `/sdk/v1/connections/Angel One/exchange-token` shared-mode dispatch
   landed 2026-04-29 (`177ce21`). Update `Alphab2bapp/docs/PHASE3_BROKER_AUDIT.md`
   Angel One row, validate end-to-end on emulator, remove from
   `SDK_LEGACY_FALLBACK`. **Severity: high — an "AND" branch covered by
   tidi_new but not Alphab2bapp suggests Alphab2bapp's audit doc is stale.**

4. **Reconcile Zerodha routing**. Alphab2bapp's `SDK_LEGACY_FALLBACK` cites
   "Android 302 redirect race in WebView intercept" as the Zerodha blocker.
   SDK commit `80ccaf0` shipped the `onLoadStart` triple-hook fix four
   commits ago. Re-validate Zerodha on a device build of Alphab2bapp and
   either remove from `SDK_LEGACY_FALLBACK` or document the unresolved
   issue with a fresh repro. **Severity: high — bumper sticker comment
   (`BrokerConnectModalDispatch.js:131`) is older than the SDK fix.**

### Severity: medium

5. **Theme injection in both consumers**. Pass `theme={partialTheme}` to
   `<AqSdkProvider>` in Alphab2bapp `SdkProviderRoot.js` and
   `theme: partialTheme` to `<AqSdkScope>` in tidi_new `main.dart`. Source
   the colour palette from existing app config (`configData.config.color1`
   on Alphab2bapp; tidi_new app theme on tidi). **Severity: medium —
   SDK widgets currently look off-brand on both sides; the theme
   plumbing already exists, just not wired.**

6. **Move `EgressIpCallout` into the SDK** as an opt-in widget the
   consumer can enable via prop on `BrokerCredentialForm` (e.g.
   `showEgressCallout={true}`) or as a standalone widget the consumer
   wraps the form with. Today both apps duplicate ~700 lines of identical
   code (claim flow, status fetch, broker_key overrides). **Severity:
   medium — DRY violation, but both implementations work; tracked as
   tidi_new SDK_CHANGELOG.md Known Gap #5.**

7. **Add `BrokerInstructionStep` to SDK schema** (`prerequisites` extension
   in tidi_new SDK_CHANGELOG.md Known Gap #1). Move
   `Alphab2bapp/src/UIComponents/BrokerConnectionUI/HelpUI/*HelpContent.js`
   content into the SDK schema as structured steps with copy-targets and
   links. Both consumers then get rich per-broker help free.
   **Severity: medium — improves tidi_new UX (no help today); cleans up
   Alphab2bapp.**

8. **Promote tidi_new's per-method typed return shapes** (Flutter
   `connectBroker → Map`, `setPrimaryBroker → void`, `rebalanceExecute →
   Map`, etc.) to typed shapes matching RN. Today Flutter consumers read
   raw `Map<String, dynamic>` for several methods. **Severity: low-medium
   — cosmetic ergonomics.**

### Severity: low

9. **Document the RN compiled-output staleness caveat** (tidi_new
   `SDK_CHANGELOG.md` Known Gap #7) in
   `alphaquark-mobile-sdk/packages/rn/README.md` and add a CI check that
   `lib/` is in sync with `src/`. Several Phase 3 regressions on Alphab2bapp
   trace to this (schema edits not reaching the APK because `npm run build`
   wasn't run).

10. **Consolidate the `customErrorMessages` field-name convention**
    (`error` on RN, `code` on Flutter). Pick one. Likely cleaner to make RN
    expose `code` on the surfaced error envelope so consumer code reads the
    same way on both sides.

11. **IIFL Securities backend dispatch + SDK schema reshape**. Both
    consumers explicitly hold IIFL on legacy because the SDK schema
    (`flow=credentials_totp`, 4 fields) doesn't match the legacy modal's
    empty-fields-OAuth shape. Until the backend gets `/sdk/v1/connections/
    IIFL Securities/{login-url, exchange-token}` dispatches AND the schema
    is reshaped to `flow=oauth, fields=[]`, neither app can promote IIFL.
    **Severity: low — IIFL is a small minority of users.**

---

## Appendix: file:line index for every claim

This section is intentionally redundant with the body above — it's the lookup
index a future contributor will use to verify a single claim without
re-reading the doc.

```
SDK packages
  RN brokerFormSchema.ts             alphaquark-mobile-sdk/packages/rn/src/components/brokerFormSchema.ts:1-460
  Flutter broker_form_schema.dart    alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/broker_form_schema.dart:1-530
  RN BrokerCredentialForm            alphaquark-mobile-sdk/packages/rn/src/components/BrokerCredentialForm.tsx:1-444
  Flutter broker_credential_form     alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/broker_credential_form.dart:1-482
  RN WebViewBrokerAuthFlow           alphaquark-mobile-sdk/packages/rn/src/components/WebViewBrokerAuthFlow.tsx:1-349
  Flutter webview_auth_flow          alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/webview_auth_flow.dart:1-267
  RN AqSdkClient                     alphaquark-mobile-sdk/packages/rn/src/client/AqSdkClient.ts:1-386
  Flutter aq_sdk_client.dart         alphaquark-mobile-sdk/packages/flutter/lib/src/client/aq_sdk_client.dart:1-399
  RN SdkTheme                        alphaquark-mobile-sdk/packages/rn/src/theme/SdkTheme.ts:1-169
  Flutter sdk_theme.dart             alphaquark-mobile-sdk/packages/flutter/lib/src/theme/sdk_theme.dart:1-358
  RN AqSdkProvider                   alphaquark-mobile-sdk/packages/rn/src/hooks/AqSdkProvider.tsx:1-119
  Flutter aq_sdk_scope.dart          alphaquark-mobile-sdk/packages/flutter/lib/src/state/aq_sdk_scope.dart:1-133
  RN public surface                  alphaquark-mobile-sdk/packages/rn/src/index.ts:1-90
  Flutter public surface             alphaquark-mobile-sdk/packages/flutter/lib/aq_mobile_sdk.dart:1-39

Alphab2bapp Phase 3
  Phase3SdkBrokerModal               Alphab2bapp/src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js:1-405
  BrokerConnectModalDispatch         Alphab2bapp/src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js:1-223
  Phase3BrokerHelp                   Alphab2bapp/src/components/BrokerConnectionModal/Phase3BrokerHelp.js:1-115
  EgressIpCallout                    Alphab2bapp/src/components/BrokerConnectionModal/EgressIpCallout.js
  ModalManager                       Alphab2bapp/src/GlobalUIModals/ModalManager.js:1-49
  brokerSdkBridge                    Alphab2bapp/src/sdk/brokerSdkBridge.js:1-117
  SdkProviderRoot                    Alphab2bapp/src/sdk/SdkProviderRoot.js
  PHASE3_BROKER_AUDIT.md             Alphab2bapp/docs/PHASE3_BROKER_AUDIT.md
  PHASE3_PROGRESS.md                 Alphab2bapp/docs/PHASE3_PROGRESS.md
  PHASE3_ARCHITECTURE.md             Alphab2bapp/docs/PHASE3_ARCHITECTURE.md
  CHANGELOG (Phase 3 entries)        Alphab2bapp/docs/CHANGELOG.md:1-50

tidi_new Phase 3
  Phase3SdkConnectScreen             tidi_new/tidistockmobileapp/lib/components/home/portfolio/Phase3SdkConnectScreen.dart:1-647
  BrokerSelectionPage                tidi_new/tidistockmobileapp/lib/components/home/portfolio/BrokerSelectionPage.dart:1-280
  EgressIpCallout                    tidi_new/tidistockmobileapp/lib/widgets/EgressIpCallout.dart:1-130
  ReauthHelper                       tidi_new/tidistockmobileapp/lib/service/ReauthHelper.dart:1-280
  BrokerCryptoService                tidi_new/tidistockmobileapp/lib/service/BrokerCryptoService.dart:1-100
  SdkDualWriteBridge                 tidi_new/tidistockmobileapp/lib/service/SdkDualWriteBridge.dart
  AqSdkService                       tidi_new/tidistockmobileapp/lib/service/AqSdkService.dart
  SDK_CHANGELOG.md                   tidi_new/tidistockmobileapp/docs/SDK_CHANGELOG.md
  SDK_BROKER_PARITY_AUDIT.md         tidi_new/tidistockmobileapp/docs/SDK_BROKER_PARITY_AUDIT.md
```
