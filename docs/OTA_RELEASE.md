## 2026-10-02 — Android 3.9.178 MoneyMan broker tenant-session fix

APK-only QA release. AlphaB2B could mint its SDK session while still on the
build tenant (`prod`), then restore/select MoneyMan without changing the
signed-in email. The SDK provider's same-user shortcut retained that `prod`
JWT, so all SDK broker writes (Zerodha, AliceBlue, and the other SDK brokers)
went to the wrong tenant while verification correctly read `moneyman` and
showed `BROKER_PERSISTENCE_NOT_VERIFIED`.

- Fix source: `07517242`; release version bump follows this entry.
- The SDK client and provider now remint/remount on runtime tenant changes;
  `(tenant, userRef)` is the effective session identity.
- No backend, ccxt, payment-header, or broker-specific code changed.
- No OTA release was created, promoted, disabled, or retargeted.
- Signed APK:
  `artifacts/AlphaB2B-3.9.178-moneyman-broker-tenant-session-fix-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.178`, code `178`
- APK SHA-256: `b33b810fd23429e2218b289a095c53f117c0e73026a3cfebba59f978b999bbfa`
- Size: `62,112,924` bytes; certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`
- Validation: targeted broker/runtime-advisor Jest suites 22/22; import audit
  0 dangling; release APK build successful; ARM64 ELF alignment verified at
  16 KB (`2**14`).

## 2026-10-01 — Android 3.9.171 OTA target guard

APK-only QA release. **3.9.163–3.9.170 binaries are overwritten by Production
v93's 4-day-old code**: Revopush returns an open-ended (`>=3.9.129`) release
with `target_binary_range` set to the caller's own version, so the old exact
check passed. 3.9.171 accepts an OTA only if its description contains
`[aq-target android 3.9.171]`; the npm `ota:*` scripts now stamp it. See
`prod-alphaquark-github/docs/MOBILE_OTA_RELEASES.md` (top).

- Includes 3.9.169 (shared sell-auth guide, DDPI question) and `45095249`
  (tenant/design isolation, another session).
- No OTA release was created, promoted, disabled, or retargeted (owner
  decision: leave v88/v90/v91/v93 as is).
- Source: `04d5e81f`; SDK lib from `185f92a`.
- Signed APK: `artifacts/AlphaB2B-3.9.171-ota-target-guard-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.171`, code `171`
- APK SHA-256: `14189d9abb0f755b27ba5cf3ec3a35ff33925bee8143869e7f48a3aeb10f4368`
- Size: `62,108,741` bytes; certificate SHA-1 `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`
- Validation: OTA policy tests 9/9; bundle contains the marker check, the
  guide endpoint and the DDPI prompt.
- **Install note:** uninstall the old AlphaPro first (or clear app data), so
  a previously applied v93 bundle cannot linger.

## 2026-10-01 — Android 3.9.169 shared sell-authorization guide + DDPI question

APK-only QA release on top of 3.9.168.
- **Plan items 2+3:** every sell-authorization sheet renders one guide card
  from the server (`/api/sell-auth/guides/:broker`):
  - the rule, "Approve these on CDSL" with the exact sells, and the CDSL
    steps or the broker steps plus "Open <broker>";
  - a DDPI tip;
  - no more "DDPI Inactive" heading.
- **Plan item 4:** a one-time, non-blocking "Do you have DDPI?" prompt after
  connecting a broker (Zerodha and DummyBroker skipped). The answer is saved
  as a display hint only.
- **Server:** the ICICI "Invalid Checksum" error now says the Secret key does
  not match the API key.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `c3b0cb3e`. Backend `c118913` + `870a2d1` deployed.
- Signed APK: `artifacts/AlphaB2B-3.9.169-sell-auth-guide-ddpi-question-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.169`, code `169`
- APK SHA-256: `128507ec59774161cd84cbf4f7ff99f5da8eaf70c6da6966cf9292e3816804fe`
- Size: `62,087,023` bytes; certificate SHA-1 `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`
- Validation: new tests pass; bundle contains the guide endpoint, the
  declaration endpoint and "Approve these on CDSL", and no "DDPI Inactive".

## 2026-10-01 — Android 3.9.168 Cancel & Retry, ICICI return, Angel One, Zerodha step

APK-only QA release on top of 3.9.167.
- Cancel & Retry: a refused cancel stops with the reason inside the modal; a
  successful cancel re-reads broker status (Repair). The header counts open
  orders separately. Server side: ccxt `3b093e0f` (cancel routing) and
  `a7852af4` (duplicate rows).
- ICICI: `apisession` accepted on any non-ICICI origin (SDK `d3954e9`).
- Angel One: key saved before login (SDK `185f92a`); fixes
  `broker_persist_failed`.
- Zerodha quick reconnect: "Step 2 of 2" note on the one-time Kite login.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `c721603d` + SDK lib rebuilt from `185f92a`.
- Signed APK: `artifacts/AlphaB2B-3.9.168-cancel-icici-angel-zerodha-fixes-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.168`, code `168`
- APK SHA-256: `65d5dc1f8c0fa272a6b2db75a294289aaaae889110395956e49d0f75001cbe2d`
- Size: `62,081,610` bytes; certificate SHA-1 `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`
- Validation: app Jest 1420/1421 (pre-existing `brokerTradeFlow` only); SDK
  RN 179/179, Flutter 207/207; bundle contains the new strings.

## 2026-10-01 — Android 3.9.167 Fyers "Retry Order" loop fix

Android `3.9.167` is an APK-only QA release on top of 3.9.166.

- **Fyers "Retry Order" looped back to the TPIN sheet.** Root cause was
  server-side: the customer `PUT /api/update-edis-status` saved the
  authorization but did not clear the 5-minute sell-auth cache, so the SDK
  pre-check read the old `false`. Backend `067141e` (deployed 05:46 UTC) fixes
  this for every app version, 3.9.166 included.
- **SDK `9e0d4e5`** (lib rebuilt before this build): the pre-check sends
  `fresh=1`; an **unreadable** status is retried once and then the order is
  placed (no block). A readable "not authorized" still opens the TPIN flow,
  and a broker refusal reopens it through the existing classified recovery.
- **Test focus:** Fyers rebalance with SELLs → Proceed with Authorization →
  CDSL (tap Submit, TPIN, OTP) → tick "I've authorized" → Retry Order → Place
  Order. Expect orders placed, or a broker refusal that reopens TPIN, but no
  immediate loop.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `release/deploy_5.1` version-bump commit below; SDK `9e0d4e5`.
- Signed APK: `artifacts/AlphaB2B-3.9.167-fyers-retry-loop-fix-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.167`, code `167`
- APK SHA-256:
  `5c4196c0ae9476e31e7bff0d8dddcfd7d6ac3104229e031c3c95aeef1ca38223`
- Size: `62,082,460` bytes
- Signing: certificate SHA-1 `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`.
- Validation: app Jest 1414/1415 (pre-existing `brokerTradeFlow` only); SDK RN
  177/177, Flutter 206/206; bundle contains the new SDK pre-check
  (`sell_auth_unverified`, retry log line).

## 2026-10-01 — Android 3.9.166 order feedback, sell-auth retry, Fyers fixes

Android `3.9.166` is an APK-only QA release on top of 3.9.165.

- **Fyers "Place Order did nothing":** RN SDK `5eac009` — requests with a
  query no longer use React Native's partial URL API (the pre-placement
  sell-auth check threw on device before any network call since 2026-09-22);
  Kite Publisher completion parsing fixed the same way. App `9c6d0cd0`: the
  order screen and all sell-auth modals host their own `<Toast />` so failures
  are visible; an SDK `sell_auth_declined` for Fyers opens the TPIN flow.
- **"Authorized — recalculate":** progress, success/failure messaging, retry,
  review-screen note; sheet layout no longer clips.
- **Saved quick reconnect:** biometric unlock is the primary button.
- **Test focus:** Fyers rebalance with SELLs (expect either orders placed or
  the TPIN screen — never nothing); OtherBroker sell-auth sheet on a ~360dp
  phone (layout, progress, success message); Fyers Manage Connections →
  Reconnect with quick reconnect saved.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `9c6d0cd0` (`release/deploy_5.1`) + this version bump; SDK lib
  rebuilt from `5eac009` before the build.
- Signed APK: `artifacts/AlphaB2B-3.9.166-order-feedback-fyers-fixes-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.166`, code `166`
- APK SHA-256:
  `5146226820ea8f01d44441d69137099f0137d5e135eccee28b5167ac3454fbb6`
- Size: `62,082,506` bytes
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all `arm64-v8a` libraries
  16 KB-aligned (0 unaligned); zipalign verified.
- Validation: app Jest 1414/1415 (pre-existing `brokerTradeFlow` only); SDK RN
  175/175; design audit clean; bundle contains the new sell-auth progress,
  review note, Fyers TPIN routing and quick-reconnect strings. Not exercised
  on a device by the build.
- **Revopush audit (read-only, 2026-10-01):** unchanged — enabled open-ended
  Production v88/v90/v91/v93 and Staging v35–v37 (`>=3.9.129`); none targets
  `3.9.166`; all OTA paths in this binary reject non-exact targets.

## 2026-10-01 — Android 3.9.165 on SDK 94a3895

Android `3.9.165` is an APK-only QA release on top of 3.9.164, rebuilt
against alphaquark-mobile-sdk `94a3895` (recommendation `unknown` /
`status_raw` types; the Flutter-only additions do not affect this RN app).
No AlphaPro UI change expected; same test focus as 3.9.164.

- No OTA release was created, promoted, disabled, or retargeted.
- Source: `10c2087f` (`release/deploy_5.1`) + this version bump; SDK lib
  rebuilt from `94a3895`.
- Signed APK: `artifacts/AlphaB2B-3.9.165-sdk-parity-status-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.165`, code `165`
- APK SHA-256:
  `c1b0eec242a643db3f58de384bf90bb62eb3eb9c12b7651940025d9b19b6e2c2`
- Size: `62,077,188` bytes
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; 24/24 `arm64-v8a` libraries
  16 KB-aligned; zipalign verified.
- Validation: SDK RN 170/170, Flutter 204/204, web smoke; Alphab2bapp slot
  render tests 11/11; bundle contains the slot guard, navigation resolver and
  exact-target OTA strings.
- **Revopush audit (read-only, 2026-10-01):** unchanged — enabled open-ended
  Production v88/v90/v91/v93 and Staging v35–v37 (`>=3.9.129`); none targets
  `3.9.165`; all OTA paths in this binary reject non-exact targets.

## 2026-10-01 — Android 3.9.164 SDK slots + recommendations client

Android `3.9.164` is an APK-only QA release on top of 3.9.163 (configurable
navigation and the exact-target stale-bundle fix are included unchanged).

- Built against alphaquark-mobile-sdk `7dc0fda`: SDK component slots are
  consumed as presentation-only overrides; the SDK gained
  `getRecommendations()` / `useRecommendations()`. AlphaPro's registry
  (`designs/default/sdk/index.js`, `f18c6d0f`) keeps the SDK built-ins, so
  broker login, the broker WebView header and the Kite header must look
  exactly as in 3.9.163. **Test focus:** connect a credential broker (e.g.
  Groww/Kotak) and an OAuth broker; open Zerodha Kite Publisher; confirm the
  screens and headers are unchanged. Plus the 3.9.162 navigation checks.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `f18c6d0f` (`release/deploy_5.1`) + this version bump; SDK lib
  rebuilt from `7dc0fda` before the build.
- Signed APK: `artifacts/AlphaB2B-3.9.164-sdk-slots-recommendations-release.apk`
- Package/version: `com.arpint.alphaquark`, `3.9.164`, code `164`
- APK SHA-256:
  `f4f6d25c9ef2853588b329740dd2ff19d0ef80b1fb9817947000961c2d869fc5`
- Size: `62,077,181` bytes
- Signing/alignment: v2 signature, certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  16 KB-aligned (0 unaligned); zipalign verified.
- Validation: Alphab2bapp Jest 1406/1407 (only the pre-existing
  `brokerTradeFlow` Kotak failure) incl. 11 SDK slot render tests; SDK RN
  170/170, Flutter 200/200; design/import audits pass; bundle contains the
  SDK slot guard, navigation resolver and exact-target OTA strings.
- **Revopush audit (read-only, 2026-10-01):** unchanged — enabled open-ended
  Production v88/v90/v91/v93 and Staging v35–v37 (`>=3.9.129`); none targets
  `3.9.164`; every OTA path in this binary rejects non-exact targets.

## 2026-10-01 — Android 3.9.163 exact-target stale-bundle update

Android `3.9.163` is an APK-only QA release on top of 3.9.162 (configurable
navigation is included unchanged).

- `handleStaleExecutionBundle` (`src/utils/executionBundleSafety.js`), which
  runs when the server answers `EXECUTION_BUNDLE_STALE`, now installs only an
  OTA whose target is exactly the running binary version, via
  `installExactTargetOta`. The bare CodePush sync it used before would have
  accepted Production v93 (`>=3.9.129`). This closes the gap recorded under
  3.9.162. The toast says "Safety update downloaded" only when an update was
  installed; otherwise "App update required". Both say no order was sent.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `c106a676` (`release/deploy_5.1`) + this version bump.
- Signed APK:
  `artifacts/AlphaB2B-3.9.163-exact-target-stale-bundle-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.163`, version
  code `163`
- APK SHA-256:
  `c855bb2a1b55a9f68a5f0512211b01e42fdba001378e89b443df40b0cec87a71`
- Size: `62,079,049` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  have 16 KB (`2**14`) LOAD alignment (0 unaligned) and APK zipalign
  verification passed.
- Validation: OTA policy + execution-safety suites 10/10 (incl. the new rule
  that no source file calls `codePush.sync(`); full Jest 1395/1396 (the one
  failure, `brokerTradeFlow` Kotak payload, also fails on clean HEAD); Android
  release Gradle build; embedded bundle contains "App update required", the
  stale-bundle check warning and the navigation resolver strings. The stale
  path was not exercised live (it needs the server minimum raised above
  `2026091102`, which was not done).
- **Revopush audit (read-only, 2026-10-01):** unchanged from 3.9.162.
  Production still has enabled open-ended v88, v90, v91, v93 (`>=3.9.129`)
  plus older bounded ranges ending at `<=3.9.123`; Staging has v35–v37
  (`>=3.9.129`). None targets exactly `3.9.163`, and every OTA path in this
  binary (launch/resume check in `index.js` and the stale-bundle path) now
  rejects non-exact targets; `MainApplication.kt` clears retained CodePush
  files on the 162→163 `versionCode` transition. Disabling the open-ended
  Production releases remains a separate production OTA action (not done).

## 2026-10-01 — Android 3.9.162 configurable navigation

Android `3.9.162` is an APK-only QA release on top of 3.9.161.

- Tabs, first tab, More menu, phone-first pre-login order and tab-bar height
  now come from the design variant's data-only navigation manifest
  (`designs/default/navigation.js`, see `docs/CONFIGURABLE_NAVIGATION_DESIGN.md`).
  The default manifest reproduces 3.9.161's navigation exactly: tabs Home,
  Orders, Portfolio, Plans, More; the same More rows and routes. **Test focus:**
  tap every tab and every More row (incl. Delete Account and Log Out), and the
  add-to-cart sheet position above the tab bar.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `67da316f` (`release/deploy_5.1`) + this version bump.
- Signed APK:
  `artifacts/AlphaB2B-3.9.162-configurable-navigation-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.162`, version
  code `162`
- APK SHA-256:
  `8edaae1912b8cf1c79762d8df56f3b053839b948570e136fcceb2d69feb60e33`
- Size: `62,080,337` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  have 16 KB (`2**14`) LOAD alignment and APK zipalign verification passed.
- Validation: navigation suites 37/37; full Jest 1391/1392 (the one failure,
  `brokerTradeFlow` Kotak payload, also fails on clean HEAD); design / style /
  import audits pass; Android release Gradle build; embedded bundle contains
  the resolver strings (`nav_manifest_warning`, `required_tab_added`,
  `preLoginRoute`). Not exercised on a device by the build.
- **Revopush audit (read-only, 2026-10-01):** Production still has ENABLED
  open-ended releases v88, v90, v91 and **v93** (`>=3.9.129`); v92/v94/v95
  disabled; v96 `3.9.144`, v97 `3.9.145` exact. Staging has enabled v35–v37
  (`>=3.9.129`). None targets exactly `3.9.162`, so the exact-target client
  guard (`src/utils/otaPolicy.js` `installExactTargetOta`, used by `index.js`)
  rejects all of them, and `MainApplication.kt` clears retained CodePush files
  on the 161→162 `versionCode` transition. Result: the embedded bundle stays
  authoritative.
- ⚠️ **Gap present in this binary (fixed in source after 3.9.162 — ships in the
  next binary; see CHANGELOG "stale-bundle safety update is exact-target only"):**
  `src/utils/executionBundleSafety.js` `handleStaleExecutionBundle` calls an
  unguarded `codePush.sync()` when the server answers `EXECUTION_BUNDLE_STALE`.
  That path would accept the open-ended Production v93. It cannot fire for
  this build today (`prod.minimum_mobile_execution_bundle` = `2026091102` =
  this bundle's `EXECUTION_BUNDLE_VERSION`), but raising that minimum would make
  3.9.162 download v93. Fix: route it through `installExactTargetOta`, and/or
  disable the open-ended Production releases (a production OTA action,
  needs sign-off).

## 2026-09-30 — Android 3.9.161 Kotak/Groww quick reconnect offered first

Android `3.9.161` is an APK-only QA release on top of 3.9.160.

- Kotak and Groww now render the quick-reconnect switch before the credential
  fields (`placeBeforeFields: true`), as Upstox and the shared quick-reconnect
  screen do. Previously it sat after the 6-digit TOTP field, so customers typed
  a one-time code before seeing the option. With the switch on, the TOTP field
  is replaced by the setup-key field.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `1d06cc08` (`release/deploy_5.1`)
- Signed APK:
  `artifacts/AlphaB2B-3.9.161-kotak-groww-quick-reconnect-first-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.161`, version
  code `161`
- APK SHA-256:
  `627f145eb44517369c5005d46ad71ec46bba919396aa0e839ddbb7fc67043711`
- Size: `62,075,240` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  have 16 KB (`0x4000`) LOAD alignment and APK zipalign verification passed.
- Validation: device-TOTP contract (pins live flag + switch-first for Kotak and
  Groww) and dispatch routing suites, 23/23; Android release Gradle build;
  package/version, signature, zip and ELF alignment checks; bundle contains the
  3.9.159 key check, the wrong-PIN title and the Kotak switch label. No live
  broker login was exercised by the build.

## 2026-09-30 — Android 3.9.160 AliceBlue/Kotak/Groww quick-reconnect flag

Android `3.9.160` is an APK-only QA release on top of 3.9.159.

- AliceBlue opened its login page directly with no quick-reconnect choice.
  `AliceBlueConnect`, `KotakModal` and `GrowwConnectModal` read
  `deviceTotpEnabled` only from TradeContext's cached `configData`, while the
  dispatcher routes on the live `useConfig()` flag. They now also read
  `useConfig()` (as `upstoxModal` already did). Additive only.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `3640164b` (`release/deploy_5.1`)
- Signed APK: `artifacts/AlphaB2B-3.9.160-quick-reconnect-flag-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.160`, version
  code `160`
- APK SHA-256:
  `f287fc83bf3da402c667dd8a4817d3ec35d6ad88eefb943236ccae98951f2836`
- Size: `62,075,223` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  have 16 KB (`0x4000`) LOAD alignment and APK zipalign verification passed.
- Validation: device-TOTP contract (now pins the live flag read for AliceBlue,
  Kotak and Groww) + dispatch routing suites pass; ESLint error counts
  unchanged from origin on the three files; Android release Gradle build;
  package/version, signature, zip and ELF alignment checks. No live broker
  login was exercised by the build.

## 2026-09-30 — Android 3.9.159 TOTP key check and wrong-PIN titles

Android `3.9.159` is an APK-only QA release.

- The TOTP setup-key field on the shared quick-reconnect screen (Angel One,
  Motilal, Zerodha, Fyers) shows a live "Key check": the 6-digit code the pasted
  key produces now, refreshed every second, to compare with the authenticator
  before verifying. Removing the typed current-code check (3.9.155) had let a
  wrong Zerodha key use up login-lock attempts ("1 attempt remains").
  Informational only; nothing is blocked.
- A broker PIN rejection is titled "<Broker> PIN not accepted" (quick-reconnect
  screen and Upstox). Nothing is blocked, retried or cleared.
- Server-side, same day (works on older builds too): ccxt `1b71fbba` sends the
  FYERS quick-reconnect PIN to `verify_pin_v2` (FYERS quick reconnect had never
  succeeded); ccxt `5883acba` surfaces Upstox's own TOTP-login error; aq_backend
  `1e73821` explains that repeated wrong FYERS PINs can lock the login.
- No OTA release was created, promoted, disabled, or retargeted.
- Source: `ca00fd26` (`release/deploy_5.1`)
- Signed APK:
  `artifacts/AlphaB2B-3.9.159-totp-key-check-fyers-pin-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.159`, version
  code `159`
- APK SHA-256:
  `e2376686f1ba74198c68ee907cebefbf667eb63e06ea4a3bcf5dd02cf6b1f1f0`
- Size: `62,075,214` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  have 16 KB (`0x4000`) LOAD alignment and APK zipalign verification passed.
- Validation: 5 focused Jest suites, 50/50 tests (key check, device-TOTP
  contract, enrollment/wrong-PIN helper, dispatch routing, vault); ESLint 0
  errors on changed files; Android release Gradle build; package/version,
  signature, zip and ELF alignment checks; the embedded bundle contains the
  "Key check" and "PIN not accepted" strings. No live broker login or order was
  exercised by the build.

## 2026-09-30 — Android 3.9.158 mixed-case TOTP input

Android `3.9.158` is an APK-only QA release. Broker TOTP setup-key fields now
preserve the user's pasted uppercase/lowercase text instead of rewriting the
controlled input while typing. Base32 canonicalisation remains internal to
validation, TOTP generation, and protected storage, where case is
mathematically irrelevant. Upstox copy now distinguishes the TOTP setup secret
encoded in the broker's QR/manual setup key from the separate developer API
Secret.

- No OTA release was created, promoted, disabled, or retargeted. The read-only
  Production history audit found no package targeting `3.9.158`; the latest
  listed deployment remained v97 targeting `3.9.145`.
- Signed APK:
  `artifacts/AlphaB2B-3.9.158-totp-case-preserving-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.158`, version
  code `158`
- APK SHA-256:
  `f8690a6d00f437660d3ff7ed90b3a9b6366aa4258da57c4501e3d539a3171217`
- Size: `62,072,206` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK ZIP verification passed.
- Validation: 3 focused Jest suites, 44/44 tests; Android release Gradle build;
  package/version, signature, ZIP, and 16 KB ELF alignment checks. The built
  Hermes bundle includes the revised Upstox QR/manual-key guidance. No live
  broker login or order was exercised by the build.

## 2026-09-30 — Android 3.9.157 stale-OTA immunity and Dhan EDIS handoff

Android `3.9.157` is an APK-only corrective release. Production OTA v93 was
still enabled with target `>=3.9.129`; after installing 3.9.156 it could replace
the correct embedded bundle with older JavaScript and resurrect the removed
“Update total investment to ₹0” flow. The new binary clears retained CodePush
packages once per native-version transition, performs only manual update
checks, and downloads only packages whose target exactly equals the running
binary version. OTA publish scripts now require exact targets.

Dhan TPIN/EDIS completion now polls live broker status, propagates it to every
parent flow, and checks only the selected SELL holdings and approved quantities.
It no longer reopens order review with the stale pre-authorization snapshot or
blocks because an unrelated account holding has `edis:false`.

- No OTA release was created, promoted, disabled, or retargeted.
- Signed APK:
  `artifacts/AlphaB2B-3.9.157-ota-baseline-dhan-edis-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.157`, version
  code `157`
- APK SHA-256:
  `7f53e054c93de22b37aabc08c69ddc843d96eb7e19c87f5742546c6c4bb43e29`
- Size: `62,072,067` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK ZIP verification passed.
- Validation: 5 focused Jest suites, 25/25 tests; changed entry/utility lint
  with 0 errors; Babel parse of all changed JS; Android release Gradle build;
  package/version, signature, ZIP, and 16 KB ELF alignment checks. The embedded
  bundle contains the exact-target OTA rejection, Dhan verification action and
  available-funds review action, and excludes both forbidden zero-target
  strings. No live broker order was exercised by the build.

## 2026-09-30 — Android 3.9.156 recovery health and deterministic broker unblock

Android `3.9.156` now distinguishes credentials stored on the account
(**Broker Linked**) from a recent, broker-scoped live probe (**Broker Live**).
If account recovery is blocking a rebalance, the home pill shows **Broker
Linked · Check**, and rebalance/refresh surfaces show the backend's actual
authentication, ownership, pending-order, pricing, or reconciliation blocker
instead of a generic retry message.

- Signed APK: `artifacts/AlphaB2B-3.9.156-recovery-health-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.156`, version
  code `156`
- APK SHA-256:
  `1714d33eb715cd86d43faa33660981bfd6722f529b307c36a91bfea33c7a4833`
- Size: `62,069,354` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK zip-alignment verification passed.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 4 focused Jest suites, 63/63 tests; design and import audits;
  Android release Gradle build; APK package/version, ABI, signature, ZIP, and
  16 KB ELF alignment checks. No live broker order was exercised by the build.

## 2026-09-30 — Android 3.9.156 broker reconnect and Kotak session integrity

Android `3.9.156` hardens the phone-protected TOTP flows across brokers. It
normalizes pasted Base32/`otpauth://` secrets, keeps biometric/passcode prompts
user-initiated, restores reliable secret-field Show/Hide behavior, uses the
official Zerodha enrollment path, adds Upstox normal-login recovery, and gives
actionable Fyers PIN/TOTP errors. Kotak no longer performs the SDK dual-write
that could replace a valid NEO session with incomplete pre-login credentials;
its rebalance payload now uses the current NEO session fields. Groww's manual
sell-authorization help now opens the direct TPIN authorization page and makes
clear that authorization itself does not sell a holding.

- Signed APK: `artifacts/AlphaB2B-3.9.156-broker-reconnect-kotak-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.156`, version
  code `156`
- APK SHA-256:
  `2ef07059b5e2314a4d9f0ef7dc30d0450c197cc02219d956cb6192f4c48864b2`
- Size: `62,071,031` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK zip-alignment verification passed.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 5 focused Jest suites, 107/107 tests; Android release Gradle
  build; APK package/version, ABI, signature, and 16 KB alignment checks. No
  live broker order was exercised by the build.

## 2026-09-30 — Android 3.9.154 Upstox fresh-TOTP enrollment

Android `3.9.154` fixes Upstox phone enrollment validating an already-expired
six-digit code after OAuth. The seed/current-code pair is now checked before
OAuth; after the canonical connection is saved, the app waits for the next
TOTP window, verifies a newly generated code and PIN through Upstox's TOTP-token
route, and only then writes the device-bound biometric/passcode keychain
record. The error copy now distinguishes a successful normal connection from
an unsuccessful phone enrollment.

- Signed APK: `artifacts/AlphaB2B-3.9.154-upstox-fresh-totp-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.154`, version
  code `154`
- APK SHA-256:
  `32fb43b73787fa4964116c3f779365021d7835b823a9565b31abf047247c84d2`
- Size: `62,067,420` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK zip-alignment verification passed.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 9 relevant Jest suites, 72/72 tests; Android release Gradle
  build; APK package/version, signature, and 16 KB alignment checks. No live
  token revocation, broker login, or order was exercised by the build.

## 2026-09-30 — Android 3.9.153 broker-specific TOTP creation guide

Android `3.9.153` fixes the missing instruction surface exposed by selecting
**Enable quick reconnect on this phone**. The choice now stays above the
enrollment fields and expands contextual, numbered instructions explaining
where the broker's fixed Base32 secret comes from, how it differs from the
changing six-digit TOTP, and which portal page to open. Angel One, Motilal
Oswal, Zerodha and FYERS each have broker-specific steps.

- Signed APK: `artifacts/AlphaB2B-3.9.153-totp-setup-guide-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.153`, version
  code `153`
- APK SHA-256:
  `8174e013f5f9e2389672b74fac82bf39e88b614ec54166afa61ef884087fe2ea`
- Size: `62,066,380` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK zip-alignment verification passed.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 9 relevant Jest suites, 71/71 tests; ESLint on the
  changed source/test files, 0 errors; Android release Gradle build; APK
  package/version, signature, and 16 KB alignment checks. No live broker login
  or order was exercised by the build.

## 2026-09-30 — Android 3.9.152 complete broker TOTP enrollment

Android `3.9.152` restores the complete device-TOTP enrollment surface for
Angel One, Motilal Oswal, Zerodha, and Fyers. The phone flow now retains each
broker's stable application credentials, shows the broker setup and static-IP
instructions, completes the canonical first login, then verifies and saves the
TOTP factors for biometric quick reconnect. Angel One now requests only the
SmartAPI API Key and Client Code (not an API Secret), uses
`https://ccxtprod.alphaquark.in/angelone/callback`, and no longer repeats a
second conflicting prerequisite block.

- Signed APK: `artifacts/AlphaB2B-3.9.152-complete-broker-totp-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.152`, version
  code `152`
- APK SHA-256:
  `25d7c4b57a540fb33b95a373fc48833d0a72227a4c4f1f91130a1dd504169de4`
- Size: `62,061,790` bytes
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  reported `ALIGNED (2**14)` and APK zip-alignment verification passed.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 9 relevant Jest suites, 69/69 tests; Android release Gradle build;
  APK package/version, signature, and 16 KB alignment checks. No live broker
  login or order was exercised by the build.

## 2026-09-29 — Android 3.9.149 holdings re-fetch fix (Accept rebalance speed)

Android `3.9.149` = 3.9.148 plus `13126e8`: `TradeContext` re-fetches broker
holdings only when the broker session changes (`holdingsRefreshKey`), instead
of on every `getUser` refresh. The home-card **Accept rebalance** check no
longer fans out into repeated live broker calls (~12 Fyers calls in 10 s were
seen in tidi nginx logs for one tap). Post-order holdings refresh is kept via
the `refreshEvent` / `OrderPlacedReferesh` listener. Server-side context the
same day (no app change needed): Mongo primary moved to tidi, Node→ccxt routed
via tidi's local nginx — see prod-alphaquark-github
`docs/server_issues/2026-09-29-mongo-primary-move-to-tidi.md`.

- Signed APK: `artifacts/AlphaB2B-3.9.149-holdings-perf-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.149`, version
  code `149`
- APK SHA-256:
  `8dfe1ecd17a6fde6a25ad9d01fc78e66f33711ddf7f64bc1beafdd4f28294ae3`
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4` (SHA-256 `66f8016e…8f96970`,
  matches `app-links.alphaquark.in` assetlinks); all 24 `arm64-v8a` libraries
  `ALIGNED (2**14)`; bundle contains `holdingsRefreshKey`. SDK `lib` rebuilt
  from `alphaquark-mobile-sdk` `4cbfb17` before bundling.
- No OTA (Revopush) release was created or re-targeted. The change is JS-only,
  so it is OTA-eligible for binaries `>=3.9.129` if published later.
- Validation: full Jest run, 1,298/1,298 tests (1,290 + 8 new
  `holdingsRefreshKey` cases). No live broker order was exercised by the build.

## 2026-09-29 — Android 3.9.151 Angel One per-customer fallback

Android `3.9.151` = 3.9.150 plus `fed0722`: for device-TOTP tenants, Angel One's
full login (first connect / "Continue with normal Angel One login") opens the
per-customer SDK modal instead of the platform-shared-SmartAPI
`AngleoneBookingModal`. Routing for every broker is asserted by
`src/__tests__/brokerDispatchRouting.test.js`; see `docs/BROKER_CONNECTION.md`
§ "Broker connect routing matrix". `AngleoneBookingModal` is still compiled in
(dead imports in `CustomToolbar.js` / unused `BrokerModalRenderer.js`) but is not
reachable from the dispatcher.

- Signed APK: `artifacts/AlphaB2B-3.9.151-angelone-per-customer-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.151`, version
  code `151`
- APK SHA-256:
  `7655161628ec6f2b292fd636a1df8efc907f8e64cc5c95ef1b5e0622f62974d7`
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  `ALIGNED (2**14)`; no `otplib`; includes the 3.9.149 holdings fix and the
  3.9.150 TOTP-window enrollment.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 150/150 Jest suites, 1,309/1,309 tests. No live Angel One login
  was exercised by the build.

## 2026-09-29 — Android 3.9.150 Fyers quick-reconnect waits for a fresh TOTP

Android `3.9.150` = 3.9.149 (holdings re-fetch fix, `aa492f1`) plus `660b75e`:
the background Fyers quick-reconnect enrollment waits for the next 30 s TOTP
window before its server-side login, retries once on a TOTP-step / 5xx /
network failure (`src/utils/deviceTotpEnrollment.js`), and confirms
"quick reconnect enabled". Pairs with ccxt-india `d9997fcd` (assisted-login step
logging + `FYERS_ASSISTED_<STEP>_FAILED`), deployed to tidi 2026-09-29 via
`./pull_restart.sh` (`ccxt_prod` active).

This change was first built as a second "3.9.149" while another session had
already cut 3.9.149 (holdings); that duplicate APK was deleted unshipped and
the build renumbered to 150 so each version maps to one binary.

- Signed APK: `artifacts/AlphaB2B-3.9.150-fyers-quick-reconnect-totp-window-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.150`, version
  code `150`
- APK SHA-256:
  `7177ae5ddc5a76fb0306dff9f150f091780f85a38a96b1babe366d82195e562c`
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  `ALIGNED (2**14)`; no `otplib` module; `holdingsRefreshKey` present.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 149/149 Jest suites, 1,305/1,305 tests. No live Fyers login was
  exercised by the build.

## 2026-09-29 — Android 3.9.148 Fyers quick-reconnect enrollment ordering

Android `3.9.148` = 3.9.147 plus `a747862`: the staged Fyers quick-reconnect
enrollment runs after the connect confirmation instead of before it, and its
failure alert is no longer hidden by "Connected Successfully". Pairs with the
backend fix aq_backend `b72b4cf` (Fyers device-TOTP route reads the tenant's
`brokerConnectRedirectUrl`), deployed to tidi 2026-09-29 ~16:57 IST via
`./deploy.sh -y` (all four services active, running commit `b72b4cf`).

- Signed APK: `artifacts/AlphaB2B-3.9.148-fyers-quick-reconnect-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.148`, version
  code `148`
- APK SHA-256:
  `6b716919780ec7e6e190c2e8dffc94cbdf32cb749bb64e4f2f643540894c2d83`
- Signing/alignment: certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; all 24 `arm64-v8a` libraries
  `ALIGNED (2**14)`; release source map contains no `otplib` module.
- No OTA (Revopush) release was created or re-targeted.
- Validation: 147/147 Jest suites, 1,290/1,290 tests. No live Fyers login was
  exercised by the build.

## 2026-09-29 — Android 3.9.147 device-TOTP crash fix + Fyers connect stability

Android `3.9.147` fixes the fatal `ReferenceError: Property 'TextDecoder'
doesn't exist` raised when a customer submits the device-TOTP / Fyers
quick-reconnect form (`isValidDeviceTotpSeed` → `otplib` v13 module load on
Hermes). TOTP is now generated/checked by `src/utils/totp.js` (RFC 6238 on
`crypto-js`); `otplib` is no longer in the release bundle (verified from the
release source map). Reconnect fields are uncontrolled so typing cannot lag or
lose keyboard **Next**, the gate hands its user id to Fyers OAuth so the account
document is fetched once, the staged hand-off shows one progress surface, and a
killed OAuth WebView renderer is unmounted with a retry prompt. Details:
`docs/CHANGELOG.md` and `docs/BROKER_CONNECTION.md` § "Device TOTP runtime and
Fyers staged hand-off".

- Signed APK: `artifacts/AlphaB2B-3.9.147-fyers-totp-crash-fix-release.apk`
- Build output: `android/app/build/outputs/apk/release/app-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.147`, version
  code `147`
- APK SHA-256:
  `2d9ba715f58ec11fae7fa0a673560dc76f5790416ca83c79dd87302784e95b2e`
- Signing/alignment: `apksigner verify` passed with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; `check_elf_alignment.sh`: all 24
  `arm64-v8a` libraries `ALIGNED (2**14)`.
- No OTA (Revopush) release was created or re-targeted for this build.
- Validation: 147/147 Jest suites and 1,290/1,290 tests passed (including
  unmocked RFC 6238 vectors); design-boundary and style-literal audits at zero;
  no new ESLint errors in changed files. No live Fyers credential, login or
  order was exercised.
- Known, not fixed here: pre-existing `Maximum update depth exceeded`
  (VirtualizedList update loop) seen on 3.9.142 and earlier. The 3.9.147
  release source map is kept so a crash from this build can be symbolicated.

## 2026-09-29 — Android 3.9.145 consolidated Fyers onboarding

Android `3.9.145` replaces the two-form first-connect quick-reconnect journey
with one scrollable form containing the activated Fyers App ID and Secret ID,
TOTP Base32 secret/current code, Client ID and PIN. A valid submission starts
the existing Fyers OAuth request directly. Normal Fyers login remains unchanged
for customers who skip phone protection and for flag-off tenants.

Invalid TOTP input now dismisses the keyboard and renders a persistent inline
error while preserving every value. It no longer opens the global animated
alert above the full-screen broker overlay and active Android keyboard—the
stacked state shown immediately before the reported process crash. The setup
guide and static-IP card are memoized during text entry, and keyboard **Next**
moves focus to the following input.

- Signed APK: `artifacts/AlphaB2B-3.9.145-fyers-onboarding-release.apk`
- Build output: `android/app/build/outputs/apk/release/app-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.145`, version
  code `145`
- APK SHA-256:
  `e06b0a0bb9af351eb098cc20f0b21a722949cfe2e0402945e254d24ea1a14892`
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; 16 KiB zip alignment verified.
- Source: Alphab2bapp `0962b85`.
- `AlphaPro-Android` Production **v97** is enabled, optional, at 100% rollout,
  and targets only `3.9.145`, preventing the older broad OTA from replacing
  this binary while leaving every other app version untouched.
- Validation: 144/144 Jest suites and 1,259/1,259 tests passed; design and
  style audits are at zero; dangling-import and 735-file design-literal checks
  passed; the signed Gradle release build and archive verification passed. No
  live Fyers credential, login or order was exercised.

## 2026-09-29 — Android 3.9.144 rebalance-review APK and exact OTA

Android `3.9.144` gives the order list the available height in the rebalance
review, moves funding explanations into the scrollable footer, collapses the
low-funds detail by default, and removes the redundant **Funding used for this
calculation** strip. Order calculation, consent, broker authorization and
submission behavior are unchanged.

Fyers phone-TOTP onboarding remains controlled by the advisor's exact boolean
`deviceTotpEnabled` flag. The live `prod` flag was already `true`; the old form
could still appear because the open-ended Production v93 OTA was compatible
with later binaries, or because a transient account lookup silently selected
normal login. Enabled Fyers tenants now retain the combined onboarding screen
when that lookup fails. Flag-off tenants still receive only normal Fyers login.

- Signed APK: `artifacts/AlphaB2B-3.9.144-rebalance-fyers-release.apk`
- Build output: `android/app/build/outputs/apk/release/app-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.144`, version
  code `144`
- APK SHA-256:
  `e6e2a890911a9a248808bba43b56b14f3f83e184de748fb1a59dd7dfe8d3ad69`
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; 16 KiB zip alignment verified.
- Source: Alphab2bapp `15bce71` (rebalance implementation `657a240`).
- `AlphaPro-Android` Production **v96** is enabled, optional, at 100% rollout,
  and targets only `3.9.144`. This prevents Production v93 from replacing this
  binary with the older Fyers JavaScript while leaving every other binary
  version untouched.
- Validation: 144/144 Jest suites and 1,257/1,257 tests passed; design and
  style audits are at zero; dynamic-import, dangling-import and 735-file
  design-literal compile checks passed; the signed Gradle release build and
  archive verification passed. No live broker login or order was exercised.

## 2026-09-29 — Android 3.9.143 combined onboarding APK

Android `3.9.143` restores the complete first-connect Fyers setup and keeps the
device-protected phone quick-reconnect enrolment as an optional choice in that
same flow. The APK also contains the shared phone-protected reconnect flows for
Kotak, Groww, Upstox, Dhan Direct API, Angel One, Motilal Oswal, Zerodha,
DefinEdge and Arihant; AliceBlue retains its related protected assisted-login
flow. Brokers without a compatible adapter retain their normal login. The
prior Production v93 target (`>=3.9.129`) could replace a newer APK's embedded
JavaScript with its older bundle, which is why the static-IP/App ID/App Secret
guide and phone option appeared inconsistently.

- Signed APK: `artifacts/AlphaB2B-3.9.143-broker-device-totp-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.143`, version
  code `143`
- APK SHA-256:
  `aa6e6e392ca83f65b378a14fb2de066da8ea5d4259aed6766872d54e097475d2`
- Signing/alignment: APK Signature Scheme v2 verified with certificate SHA-1
  `c778cd34b6c93a7d4440efa6594ad6d247b5a5b4`; 16 KiB zip alignment verified.
- Source: Alphab2bapp `a6bc7ce`; rebuilt mobile SDK `116b092`.
- `AlphaPro-Android` Production **v95** was uploaded with exact target
  `3.9.143`, then disabled immediately when delivery was narrowed to APK-only.
  It is not downloadable. Its package hash is
  `295e01eca407fedf3224abffb9def0efb5767d1119d87dc3bbb7357bb063b6cc`
  and bundle hash
  `9bc26360dd4db9a1c3875e7b077acec26fd62a68c88244201619c5dbc4740da3`.
- Validation: 145 focused broker/rebalance tests passed; the SDK build and
  signed Gradle release build succeeded; the embedded bundle contains the
  combined Fyers setup and optional quick-reconnect copy. No live broker login,
  sell authorization, or order was exercised.

## 2026-09-28 — Fyers/Zerodha first-connect device-TOTP test APK

Android `3.9.140` fixes the first-connect gate that hid the phone-protected
TOTP enrolment choice for Fyers and Zerodha. It preserves the normal-login
bypass and remains controlled by the existing advisor `deviceTotpEnabled`
flag; the live `prod` config was read back as `true` before packaging. Dhan's
partner flow remains on the organisation-whitelisted server egress and does
not ask the customer for an individual static IP.

- Signed APK: `artifacts/AlphaB2B-3.9.140-fyers-zerodha-device-totp-release.apk`
- Package/version: `com.arpint.alphaquark`, version name `3.9.140`, version
  code `140`
- SHA-256: `c7325b2316748dc4314dee8ebe293d46545e6f6833e0f71483c80db4729d34ac`
- Validation: Gradle release build succeeded; APK Signature Scheme v2 verified;
  every arm64 ELF reported `2**14` alignment.
- This is a direct-install test APK only. No Play Store/App Store rollout or
  CodePush promotion was performed.

## 2026-09-27 device-protected broker TOTP reconnect

AlphaPro now keeps encrypted API keys/secrets server-side and protects only the
customer-controlled reconnect factors on the phone. Upstox and Dhan use their
documented PIN+TOTP token APIs; DefinEdge and Arihant reuse their existing
server credential/challenge routes with a TOTP generated after device unlock.
Normal broker login remains available. The host flows are selected only when
the existing advisor `deviceTotpEnabled` flag is exactly `true` (already true
for `prod`); other advisors remain on their previous flow. Because the vault is
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, a replacement phone has no record and offers
enrolment again after a successful normal broker login.

The final release source is `ddce059` on
`release/device-totp-prod-baseline-20260927`: the prior Android v91 / iOS v60
Production source `2e19f5c7e3` with only implementation commit `d55ab6e`
cherry-picked, using SDK `d2f7ad6`. The supporting production services were
deployed first: aq_backend `d551e2c` and ccxt-india `be51c3c3`. Both platform
bundles were Metro-built, Hermes-compiled and signed. The documented `--force`
override covered only the unchanged onboarding/DDPI assets. No real broker
credential, login or order was exercised during deployment.

- `AlphaPro-Android` Staging **v37** promoted unchanged to Production **v93**,
  target `>=3.9.129`, package hash
  `ad7c302349c930c2ef49e5c0abf35594f7dcde3536e30b98879a2178b6548470`.
- `AlphaPro-iOS` Staging **v31** promoted unchanged to Production **v62**,
  target `>=2.4`, package hash
  `b4897b8dc6d607d7543c59c91dbc564264f33633306f7b3874eb8b502d0a760a`.
- Both final releases are enabled, optional and at 100% rollout. The initially
  promoted v92/v61 artifacts were disabled immediately after the ancestry
  audit found they also contained later, separately staged changes; v93/v62
  supersede them with the scoped baseline-only build.
- Corrected-baseline validation passed 14 focused mobile tests plus both clean
  Android/iOS Metro-Hermes signed bundles; the supporting backend passed 8
  tests and the adapter passed 2 tests.

## 2026-09-25 available-funds continuation — staged, awaiting Production approval

All three review flows preserve the saved investment target and remaining
funding authorization. Continue refreshes only Calculate, keeps target/budget/gap
visible, and requires separate acceptance. It never calls reduce-to-funded.
See [behavior and implementation review](AVAILABLE_FUNDS_CONTINUATION.md).

| App | Staging | Target | Source | Package hash |
|---|---|---|---|---|
| AlphaPro-Android | v35 | `>=3.9.129` | `61cd7b4` | `d21456d0a2479e86728106c35831f40d797c00b3011c79cfca572e6a82adb8a7` |
| AlphaPro-iOS | v29 | `>=2.4` | `61cd7b4` | `07ff347ea046af4c703acdc9e359975e27f2c1025e3d5e993b41939b0e95a504` |

SDK source `53ed4e5` was rebuilt before packaging. All five Metro/Hermes builds
and signing completed. The unchanged oversized onboarding/DDPI assets used the
existing documented size override; no native files or assets changed.
The targeted suites passed: AlphaB2B 16, Markup 16, MoneyMan 14 (46 total).
No physical-device broker execution was performed and no orders were placed.

These optional packages are in **Staging only**. Automatic approval review
rejected the AlphaB2B 100% Production promotion as requiring an explicit user
rollout decision. No Production promotion was made. After approval, promote
these exact staging labels (not an unverified newer staging head), retain their
existing version floors, and record the resulting Production labels/hashes.

# OTA release log

## 2026-09-24 — pair distinct exit recommendation IDs

The fallback advice display now pairs a manager full-close delivery with its
entry through `sourceAdviceRecoId` (or server-projected
`positionAdviceRecoId`) plus symbol, while preserving same-ID compatibility.
Focused advice-display tests passed (12 tests). This JavaScript-only update was
Hermes-compiled and signed from source `2e19f5c7e3`; no native files or broker
orders were involved.

- `AlphaPro-Android` Production **v91**, target `>=3.9.129`, package hash
  `8d056e303fe55ee42446f9ee00c3a91aab7f491d91f91de722a010953b268f36`.
- `AlphaPro-iOS` Production **v60**, target `>=2.4`, package hash
  `b382dad5e51463f9f2e2239ee4391cbbd0413df7fcca5cd3e6828ffe0463aaac`.
- Both releases are enabled, optional, and at 100% rollout. They activate on
  the next cold restart. The asset-size override covered only unchanged
  DDPI/onboarding assets.

## 2026-09-24 — targets converged to open-ended floors

Every lane now runs **one** production release targeting `>=<oldest supported
binary>`, so a new store build inherits the train automatically instead of
needing its own baseline release. The previous per-native pins
(`3.9.130`, `2.5`, `23`, and the raised floors `>=1.0.83` / `>=1.0.22`) each
silently excluded part of the installed base — either the older binaries still
in the field, or the newer one the moment it shipped.

- `AlphaPro-Android` Production **v90**, target `>=3.9.129` — covers every supported
  binary from the floor upward, including the current native `3.9.130`.
- `AlphaPro-iOS` Production **v59**, target `>=2.4` — covers every supported
  binary from the floor upward, including the current native `2.5`.

`package.json`'s `ota:*` scripts carry the same floors, staging and production,
so running them cannot re-pin a lane to the newest binary. **Raise a floor only
when the old binary is genuinely retired, never to match the version you happen
to have just built.**

Content is unchanged from the preceding releases — this is a targeting change
carrying the same bundle (the Kite BUY-basket refit coverage fix).

# Revopush OTA releases

## 2026-09-23 new native baselines own the OTA head

The mandatory store baseline is now Android \`3.9.130\`; the next iOS binary is
marketing version \`2.5\` (build floor \`4\`). OTA scripts explicitly target those
versions so a future release cannot silently inherit the previous native
baseline. Fresh signed Production packages were generated from clean source
\`2b6acce\` with SDK \`6554c15\`; they include the mounted-modal crash rollback,
tenant-aware plan loading, Repair quantity support, and live-buying-power
sizing for every Kite BUY basket.

- \`AlphaPro-Android\` Production **v89**, target \`3.9.130\`, package hash
  \`edfa49e6a50896a47b3cdcef154210c8537c681cb0919fa0abd33abc9b167305\`.
- \`AlphaPro-iOS\` Production **v58**, target \`2.5\`, package hash
  \`ef9efd34c0eea9e66d112ddce000b8495ed414f43cad12170c1739db82b9db16\`.
- Both packages are enabled, mandatory, and at 100% rollout. They activate on
  the next clean restart and do not retarget an older iOS package onto 2.5.
- Android and iOS Metro bundles completed, were Hermes-compiled, and were
  signed. The documented \`--force\` override applied only to unchanged
  oversized onboarding assets. The Android CLI raised a local temporary-zip
  cleanup error after upload; deployment history independently confirmed v89.

## 2026-09-23 restore mounted native modal roots after Android crash reports

The two AlphaB2B 3.9.129 devices that activated v85—Android 12 and Android
16—reported the process closing across Home, Broker, More, Manage Connections,
broker edit, re-auth and reconnect paths. V85's conditional Fabric native-modal
teardown was the only shared runtime change; v86 retained it while adding the
unrelated tenant-aware plan-loading repair.

The hotfix keeps `ProfileModal`, broker disconnect/manage modals and the
holdings-migration modal mounted and closes them through their existing
visibility props. The v86 tenant-loading repair remains included.

- `AlphaPro-Android` Production **v87**, target `3.9.129`, package hash
  `dc34a957d11a80b2e6cc8c0436d54f84427d719857965bd63390d68941e157f0`.
- Source `7e72414` (SDK `6554c15`); enabled, mandatory, and at 100% rollout.
- Six focused modal/profile/tenant-loading tests passed, as did Android
  production Metro bundling. The published package was Hermes-compiled and
  signed. No authenticated physical-device flow or broker order was exercised.

## 2026-09-23 restore subscribed plan and rebalance loading

Model-portfolio requests could omit `X-Advisor-Subdomain` when runtime config
was present in a non-nested shape. The backend correctly returned HTTP 400,
leaving Home without the subscribed plan or pending rebalance action. The
subscribed-strategy, plan-catalog and repair paths now use the canonical tenant
resolver and refetch after runtime config hydration.

- `AlphaPro-Android` Production **v86**, target `3.9.129`, package hash
  `d4a5ce006d42df346fe4c689e7f910c3068c666ac850aa32222da24e8f9ff6b6`.
- `AlphaPro-iOS` Production **v56**, target `2.4`, package hash
  `120161242040e3a36ba77398c7835e55004b222296b7847cce2e7c8a94303344`.
- Source `e35a005` (SDK `6554c15`); both packages are enabled, mandatory, and at
  100% rollout, activating on the next cold restart.
- Eighty-seven focused model-portfolio/rebalance checks passed, as did Android
  and both Production Metro/Hermes bundles. No broker order was submitted.

## 2026-09-23 release hidden native modal windows after close

`ProfileModal` now stays mounted only through its close animation and
`onModalHide` refresh, then unmounts. The broker disconnect, connection manager,
and holdings-migration native modals are likewise mounted only while visible.
This prevents an invisible Android modal window from retaining input ownership,
which made **Manage Connections**, Profile, and other navigation targets need a
second tap.

- `AlphaPro-Android` Production **v85**, target `3.9.129`, package hash
  `5e2fe839cacf33656c3b809a7a3fefa4709c79b138106c9b39afdace687c61c9`.
- `AlphaPro-iOS` Production **v55**, target `2.4`, package hash
  `a3001d23d0c1d63663d290bb631f828a634b573b60dc8190167eb54f84e49723`.
- Source `6921c66` (SDK `6554c15`); both packages are enabled, mandatory, and at
  100% rollout, activating on the next cold restart.

The six focused modal lifecycle tests and Babel parsing of all changed runtime
files passed. The wider suite retains its pre-existing harness/source-contract
failures; no device was connected for a physical tap test.

## 2026-09-22 refused placements say why; SDK lib rebuilt on every release

The SDK (`5641423`) keeps ccxt's own sentence for a placement refused before
dispatch (`MARKET_CLOSED`, expired session, drifted plan) and marks it
`notSent`/retryable; `RebalanceModal` shows it (never the TPIN modal) and
`ModelPortfolioService` no longer calls it a reconciliation. Metro bundles
`@alphaquark/mobile-sdk` from its gitignored `packages/rn/lib/`, which nothing
had rebuilt since 2026-09-03 — every OTA in between shipped a 3 Sep SDK. The
`ota:*` scripts now run `ota:sdk:build` first; this train also carries the
14–21 Sep RN SDK changes for the first time, hence mandatory.

- `AlphaPro-Android` Production **v80**, target `>=3.9.108 <=3.9.123`, mandatory, 100%.
- `AlphaPro-iOS` Production **v51**, target `2.4`, mandatory, 100%.
- Source `5158f03` (SDK `5641423`); `--force` only for the unchanged large assets.
  Cross-repo record: `prod-alphaquark-github docs/MOBILE_OTA_RELEASES.md`.

## 2026-09-18 recover from a 403 customer-identity mismatch

A customer opened the app after a rebalance and sat on *"Portfolio
recommendations could not be refreshed"* with a **Retry** that could never work.
The server had returned `403 MF_CUSTOMER_IDENTITY_MISMATCH` — the Firebase token
proved a different customer than the URL asked for — and `authTokenInterceptor`
replayed only **401**, so Retry re-issued a byte-identical request and got the
identical 403, forever.

The interceptor now replays that 403 **once** with a force-refreshed token,
fixing the recoverable case of a cached token predating an identity change. If
the mismatch survives, the two identities genuinely differ, so it announces once
per app run and Home renders *"Signed in as a different account"* with a route
to account settings instead of a dead Retry. The 401 replay is unchanged, and
nothing rewrites the stored account email — the typed email is identity on
purpose, because an Apple relay alias matches no backend record.

- `AlphaPro-Android` Staging **v30** promoted to Production **v69**, target
  `>=3.9.108 <=3.9.123`, hash
  `fad85c9403a1b2d384c6c97db9fc9ee49c0ae92f756fb545ac3a8ee214a95693`.
- `AlphaPro-iOS` Staging **v24** promoted to Production **v40**, target `2.4`,
  hash `d78a6151946da447e9060c5a7d02d49e15aca323be571800c355dbdee37cb07e`.
- Both signed, mandatory, 100% rollout, activating on the next cold restart. The
  documented `--force` advisory override was again required for the pre-existing
  onboarding videos and `ddpi.png`, and `-t` was passed explicitly on both the
  promote and the publish (the Android staging publish again defaulted to
  `3.9.123` alone). Source `013e33a`; JS-only, no native change.

Full record:
`prod-alphaquark-github/docs/server_issues/2026-09-18-customer-identity-403.md`.

## 2026-09-17 visible SDK broker-connect success

Source commit `7558458`.

The Phase 3 SDK broker sheet used to close silently after the canonical
persistence check succeeded. It now emits the same `refreshEvent` as the
legacy broker modals and shows a bottom success toast before dismissing. The
toast is deliberately skipped when the migration sheet is about to provide
the success surface. Verification failures still return before dismissal.

- AlphaPro-Android Staging **v27** was promoted unchanged to Production
  **v67** for `>=3.9.108 <=3.9.123`; package hash
  `3b92b5a6c83f41c6ce0f6e5c3b9f65ed590fb7f4991db24e451526fa2ca0fe2b`.
- AlphaPro-iOS Staging **v22** was promoted unchanged to Production **v38**
  for `2.4`; package hash
  `f3e37013363b0a5ecf2bc9c6844a8d3a506cb01c2ce53d5cb79c36943db10e0e`.
- Both signed packages are enabled, mandatory, and at 100% rollout. They
  activate on the next cold restart. Fourteen focused checks and production
  Android bundle generation passed; no broker order was submitted.

## 2026-09-17 rebalance funding banner (model buying power, not account cash)

Source commit `b0c36ff`.

The rebalance funding banner quoted **whole-account broker cash** as the figure
the basket had been "limited to". Web moved to the model-admitted chain on
2026-08-13 because that cash may belong to another portfolio; the apps never
received it. On testaccount / `agust test portfolio` the app read *"limited to
verified buying power of ₹367.30"* beside ₹33.08 of placed buys, when the figure
that actually gated the basket was ₹35.91.

`src/components/AdviceScreenComponents/RebalanceModal.js` and
`src/screens/Rebalance/RebalanceReviewScreen.js` now use the same chain as web
(`marginProjection.estBuyingPowerToday ?? estBuyingPowerAfterSettlement ??
calculationCashAvailable ?? verifiedModelCash`), with `liveAvailableCash`
deliberately NOT a fallback — absent all four, `LowFundsRebalanceWarning` drops
the amount clause instead of printing a wrong one. The "Funding used for this
calculation" note still shows `liveBrokerCashTotal`; that is correct, since it
is explicitly labelled *Broker cash*. Display only — nothing about what is
calculated, ordered or recorded changed.

AlphaPro-Android Production **v63** (promoted Staging v23) targets
`>=3.9.108 <=3.9.123`; AlphaPro-iOS Production **v34** (promoted Staging v18)
targets `2.4`.

Both signed releases are enabled, mandatory, and at 100% rollout. Mandatory is
safe during market hours because `index.js` pins `mandatoryInstallMode:
ON_NEXT_RESTART`. The documented `--force` advisory override was required for
the existing oversized onboarding assets. No native files or dependencies
changed. The working tree was clean and the source commit pushed to origin
before release. Unit run was **identical** with and without the change
(938 passed / 98 pre-existing failures), the expected result for a display-only prop change; the pre-existing
failures are unchanged. No device test was performed. Post-release
`deployment ls` confirmed label, target, mandatory flag and description.

Cross-repo record: `prod-alphaquark-github` `docs/MOBILE_OTA_RELEASES.md` and
`docs/server_issues/2026-09-17-rebalance-cost-reserve-dropped-buy-legs.md`.

## 2026-09-17 uncertain batch reporting and the order-status wait

Source commit `87f7a8c`. Two narrowly scoped Publisher corrections:

- A batch refused after the dispatch boundary may already be with the broker.
  `publisherBatchDispatch` marks that refusal `dispatchUncertain`, and the
  model-portfolio review reports those legs as **pending** instead of stamping
  every one "rejected" — a claim the app cannot support, and the one most
  likely to trigger the retry that double-places. Ordinary preparation
  failures, and the pre-dispatch "already opening" refusal, are unchanged.
- Returning from the broker window left record-back and the order-book check
  running while `RebalanceModal` re-rendered a placeable review. That window
  now states the orders were submitted and are being confirmed, with the
  button spinning and not pressable; it clears when the result screen opens,
  and closing the modal still ends the wait.

AlphaPro-Android Production **v62** (promoted Staging v22) targets
`>=3.9.108 <=3.9.123`; AlphaPro-iOS Production **v33** (promoted Staging v17)
targets `2.4`. Both are signed, enabled, mandatory and at 100% rollout.
Mandatory is safe during market hours because `index.js` pins
`mandatoryInstallMode: ON_NEXT_RESTART`. Existing oversized onboarding assets
required the documented `--force` advisory override. No native files or
dependencies changed. Unit run 876 passed, identical to a stashed baseline
(the pre-existing source-text assertion failures are unchanged). No device
test was performed.

## 2026-09-17 verified Repair fast path

Source commit `d4e1071` opens an already verified portfolio Repair directly
from the card instead of repeating broker refresh, funds classification, and
`get-repair` discovery. Place Order retains the live broker/price preflight.

- AlphaPro-Android Staging **v20** was promoted unchanged to Production
  **v60** for `>=3.9.108 <=3.9.123`.
- AlphaPro-iOS Staging **v16** was promoted unchanged to Production **v31**
  for native version `2.4`.
- Both signed releases are enabled, mandatory, and at 100% rollout.
  Metro/Hermes packaging and 19 focused contract checks passed. No broker
  order was submitted during validation.

## 2026-09-16 Orders loading and tap responsiveness

AlphaPro-Android Staging **v18** was promoted unchanged to Production **v56**
for `>=3.9.108 <=3.9.120`, mandatory, enabled, 100% rollout. Metro/Hermes
packaging and 14 targeted checks passed. No broker orders were placed.

The Orders screen no longer turns on Android's native pull-to-refresh layer
while an ordinary tab-focus fetch is in progress. Its full-history request is
bounded to 12 seconds, concurrent focus/event requests are coalesced per
account, and a failed empty-state fetch offers Retry instead of an indefinite
spinner. Orders also no longer creates a second, unused market-data socket
subscription and 30-second polling loop; the shared toolbar remains the live
index owner. This addresses an observed 1.5 MB order-history response and
the reported unresponsive Orders content. It does not prove every app-wide
tap delay has the same cause; on-device verification is still required.

## 2026-09-16 Repair card tap and dormant modal correction

AlphaPro-Android Staging **v17** was promoted unchanged to Production **v55**
for `>=3.9.108 <=3.9.120`, mandatory, enabled, 100% rollout. Metro/Hermes
packaging and the 41 focused checks passed. The broader Jest suite still has
unrelated pre-existing native/e2e harness failures; no authenticated physical
device was available to reproduce the all-screen touch freeze.

The unsolicited yellow "Some orders need attention" paragraph is removed.
`get-repair` may mark the account pending because a different model is still
being reconciled; an exact verified repair on this card now takes precedence,
so its displayed Repair action invokes repair discovery rather than status
refresh. Dormant card information/detail native modals are unmounted while
closed to avoid retaining an invisible Android touch window. The same source
correction is ported to Markup and MoneyMan; only Alpha showed the reported
screen. No broker order is submitted by this change. Device reproduction of
the reported all-screen touch freeze remains a release QA requirement.

## 2026-09-16 exact Zerodha sell-to-buy continuation

Android Production **v53** targets `>=3.9.108 <=3.9.120`. CDSL authorization
now shares the app-root Kite browser and its authenticated cookies; a completed
SELL phase resumes only the frozen, untouched BUY claims. Home status refresh
uses the actionable Publisher attempt instead of a newer sell-only recording
row, and live review prices remain valid funding evidence if the secondary
quote lookup omits an alias. The signed package is mandatory, enabled and at
100% rollout; package hash
`4c72ef6341e810dadb5c86335abe6a87092b7b9ffe781483f060a45ee6f5c384`.

## 2026-09-16 CDSL TPIN focus isolation

Android Production **v52** targets `>=3.9.108 <=3.9.120` and freezes the active
Publisher WebView session so CDSL TPIN keyboard focus is preserved. It is
mandatory, enabled and at 100% rollout; package hash
`5dc9f9a6b6a17a70b5312e296dd8053673a9f064cd50e0da5fd02c7ce9baedaa`.

## 2026-09-15 Publisher keyboard containment

The Zerodha order Publisher now leaves the React Native native dialog before
rendering the broker WebView and uses the focus-safe full-screen overlay shared
by every order entry point. This is JavaScript-only and OTA-compatible. Signed
updates continue to activate on the next clean restart; they must not force a
reload during broker login or order placement.

- Android Production **v50** was disabled because its overlay inherited the
  portfolio screen's child bounds.
- Corrected Android Production **v51** targets `>=3.9.108 <=3.9.120`.
- v51 is mandatory, enabled and at 100% rollout; package hash
  `67afb17ef2ce8e76c3de350cf55a28168703cb5d4548a078a1cc29fc106bed68`.

## 2026-09-15 Android Play-install splash recovery

Mandatory OTA activation again waits for a clean cold start. Immediate
activation could restart a newly installed Play binary while Firebase identity
and advisor configuration were still being restored, leaving the customer on
the splash screen. Updates are still checked on launch/resume and downloaded
promptly, but they never interrupt that startup. The existing 12-second Splash
watchdog remains the final routing escape.

- Android Production v47 was disabled after the reported Play-install reload.
- Android Production v48 targets `>=3.9.118 <=3.9.119` and is deliberately
  non-mandatory for its first activation: affected immediate-mode binaries
  download it without another forced reload, then activate it on the next clean
  reopen. Once active, the bundle enforces deferred activation for later
  mandatory releases as well.
- Android Production v49 carries the identical signed package to the Play
  baseline range `>=3.9.108 <=3.9.117`. This closes the targeting gap that left
  a fresh Play install displaying the old `NOT_OBSERVED`/internal-ID modal even
  though newer test binaries already received v48.

## 2026-09-15 startup recovery and clean OTA activation

JavaScript-only recovery from source commit `bb91c25`. Startup identity errors
are now caught, the user/advisor request times out after eight seconds, and a
12-second watchdog routes from Splash using the locally restored auth state.
Navigation is single-shot. Future mandatory OTAs download in the background
and activate on the next cold start instead of reloading during initialization.

- AlphaPro-Android Staging **v15** was promoted unchanged to Production
  **v39** for `3.9.119`; package hash
  `8e29ca2caf1d2cf7496d0a54c6291cc7c5f0e30343bfe7298b2ed232eddac1b7`.
- AlphaPro-iOS Staging **v13** was promoted unchanged to Production **v19**
  for `2.4`; package hash
  `222edc7077e74177f34583598a117252515d59af468b5674a06db8ff1199415b`.
- Both signed releases are enabled, mandatory, and at 100% rollout. Android
  Metro/Hermes compilation and 18 focused tests passed.

## 2026-09-15 Zerodha Place Order price-preflight repair

JavaScript-only P0 fix from source commit `8111752`. The fresh-price safety
check now queries both the application's source/scripmaster symbol
(`IDEA-EQ`) and the Kite symbol (`IDEA`), then maps the verified live price
back to the Kite basket. This restores the Place Order handoff without
weakening the fail-closed price rule. A genuine price refusal is now shown in
the active native modal instead of a toast hidden behind it.

- AlphaPro-Android Staging **v14** was promoted unchanged to Production
  **v38** for native version `3.9.119`; package hash
  `c96b82d00dd24ffd1a2b0fff9f30850e8b38aec9a62b01e46f0ac9f44b35f920`.
- AlphaPro-iOS Staging **v12** was promoted unchanged to Production **v18**
  for native version `2.4`; package hash
  `7fefdab26384b41570bcfd9493fc4a7e707f2ace80f9dddeebadf01d4e09007c`.
- Both signed releases are enabled, mandatory, and at 100% rollout. The live
  quote service returned all four incident symbols with the corrected request;
  31 focused checks passed. No customer order was submitted during validation.

## 2026-09-14 basket execution authority and dedup

JavaScript-only P0 safety update from source commit `f388c46`. Basket entry and
exit requests now retain basket identity and customer-selected multiplier,
route direct execution through the authenticated backend authority, bind
Publisher opening to a server-prepared durable intent, authenticate result
recording, and reject unsupported basket GTT before broker navigation.

- AlphaPro-Android Staging **v13** was promoted unchanged to Production
  **v37** for native version `3.9.119`; package hash
  `830cfeee7f9b0d37f06c7d01914d7a5c8915ecb0f494ff40df723f63582f181d`.
- AlphaPro-iOS Staging **v11** was promoted unchanged to Production **v17**
  for native version `=2.4`; package hash
  `4b6213c942261b1595b69d1f3b1471d1d8e0cc5b513dafc6f378868bce284331`.
- Both signed releases are enabled, mandatory, and at 100% rollout. Metro and
  Hermes packaging succeeded; only the existing oversized onboarding-media
  advisory required `--force`. No native files or dependencies changed.

## 2026-09-14 standalone execution authority and dedup

JavaScript-only safety update from source commit `9f3319f`. Standalone
non-model, non-basket orders now go through the authenticated Node
orchestrator, which queries the stored recommendation before placement and is
the authoritative execution writer. The client no longer pre-writes execution
state or reports synthetic manual success; Publisher uses prepared/activated
intent phases, and manual completion requires real broker evidence.

- AlphaPro-Android Staging **v12** was promoted unchanged to Production
  **v36** for native version `3.9.119`; package hash
  `da4fbc9d2724bd8bdb95cd18db8802b019b4ba41ed64c14642be0e0b53892484`.
- AlphaPro-iOS Staging **v10** was promoted unchanged to Production **v16**
  for native version `=2.4`; package hash
  `56942dcbee0ec77b3d8df12c52819dbec03397cc5c6269dd2979e814233f8b2b`.
- Both signed releases are enabled, mandatory, and at 100% rollout. Metro and
  Hermes packaging succeeded; the existing oversized onboarding media used
  the documented `--force` advisory override. No native files or dependencies
  changed.

## 2026-09-11 international profile phone correction

The shared ProfileModal validates phone numbers using the selected calling code
and `libphonenumber-js/max`, replacing the fixed 9–11 digit restriction. Qatar
and Singapore eight-digit numbers can be saved. API payloads contain normalized
national digits and a separate calling code, both strings. Profile reloads
restore `country_code`; national numbers starting with 91 and significant
leading zeroes are preserved. Formatted input is accepted, and malformed or
country-mismatched input is rejected before the update request.

This adds only JavaScript and numbering metadata, with no native dependency or
binary changes. Regression coverage includes the profile component's load/save
request and pure phone validation/round trips. Source is canonical here and
ported to Markup and MoneyMan using their documented content-sync workflows.

## 2026-09-08 Per-batch Publisher authorization

AlphaPro Android Production **v27** targets **3.9.119**; iOS Production **v8**
targets **2.4**. Both were promoted from signed Staging v4, source `d1baa7ec`.
Initial allocation, rebalance and Repair now send exact phase legs/activation
IDs and require matching dispatch grants, closing this parity gap with Markup.
The completed-card correction remains included.

Eight focused suites / 35 checks passed, including actual authorization and
batch-submission callbacks, refused BUY continuation, mismatched grants,
duplicate taps and uncertain window-open failures. Metro/Hermes built both
platforms; downloaded package signatures verified as RS256 and signed content
hashes matched Staging and Production. Both releases are enabled, optional,
100%; download at launch, install on the next restart. No native changes,
customer orders or real-device broker submission tests were performed.
Existing oversized assets used the documented advisory override. Builds used
isolated temporary directories. Native versions outside the targets are not
claimed covered by these packages.

## 2026-09-07 Publisher recovery release

JavaScript-only acknowledgement and foreground refresh parity with Markup.
Published from source commit `4020ea0` through signed Staging v2:

- AlphaPro-Android Production v25 targets Android 3.9.119.
- AlphaPro-iOS Production v6 targets iOS 2.4.
- Both are enabled, optional, 100% rollouts; activation is on the next restart
  after download, without forcing a mid-trade restart.
- Five Jest suites / 40 tests passed. Metro and Hermes builds completed for
  both platforms; RS256 signatures verified and content hashes matched the
  Production packages. No on-device broker-flow test was performed.
- Existing oversized onboarding assets were retained with the CLI asset-size
  advisory override. Native versions, dependencies, environment and branding
  remain unchanged. This OTA does not backfill execution or place retry orders.

## 2026-09-05 synchronized review APK

AlphaB2B Android 3.9.112 (versionCode 112) contains the shared
portfolio-scoped Retry/Repair state machine, SELL-first publisher guard, compact
portfolio layout, and holdings-editor Android fixes. This is an APK build record;
no OTA publication is implied.


## 2026-09-04 Compact portfolio summary

Android Production `v20` targets 3.9.108 and iOS Production `v2` targets 2.4,
both at mandatory 100% rollout. The realised-gains section now shows only
portfolio-level totals and lot counts instead of an expandable sold-trade
ledger. A `View current holdings` action switches directly to All Holdings →
Holdings. Fresh rebalance retries continue to show the allocation comparison
before order review; frozen-leg Repair continues to skip the holdings-edit
step.

## 2026-09-04 Performance-screen request flood guard

Android Production `v19` targets 3.9.108 and iOS Production `v1` targets 2.4,
both at mandatory 100% rollout. Model-portfolio tab scenes now retain stable
component identities across unrelated context and quote refreshes. Performance
history and benchmark requests are additionally deduplicated in flight and
cached for five minutes, so a navigation remount cannot repeatedly hit CCXT.

## 2026-09-04 Zerodha model-portfolio SELL-first invariant

Android Production targets 3.9.108 at mandatory 100% rollout. Both supported
model-portfolio Publisher entry points now fail closed unless a mixed Zerodha
rebalance is split into homogeneous SELL-first, then BUY batches. Existing
DDPI/CDSL authorization remains a prerequisite for the equity SELL phase.

This protects current OTA-capable binaries. Obsolete pre-OTA binaries cannot
receive this package and must update from the store.

## 2026-09-04 authenticated recommendation fetch

Android Production targets 3.9.108 at mandatory 100% rollout. The customer
recommendation request now waits for verified Firebase identity instead of
letting a cold-start 401 render as an empty feed.

## 2026-09-04 recommendation LTP recovery

Android Production targets 3.9.108 at mandatory 100% rollout. Recommendation
cards now authenticate and join gateway symbol rooms directly, with four-second
initial and 30-second recurring REST recovery for missing or stale LTPs.

## 2026-09-03 broker-reconnect reconciliation parity

Android Production `v17`, target `3.9.108`, is signed, mandatory, and rolled
out to 100%. After any successful broker connection or re-authentication, and
after switching to an already-connected primary broker, the app now queues the
server-owned account reconciliation orchestrator. The enqueue is non-blocking
for the connection UI; `/rebalance/calculate` independently enforces the same
account-wide barrier, so an unresolved broker order or attribution case cannot
be bypassed by immediately starting Calculate.

This OTA adds no client-side holdings or execution writer. The app sends only
`userEmail`, canonical `userBroker`, and the trigger name to
`/rebalance/reconcile-account`; canonical status projection, Publisher-intent
recovery, and holdings attribution remain server-owned.

## 2026-09-03 mandatory model-portfolio parity release

Production target: 3.9.108. This signed, mandatory, 100% rollout carries
direct frozen-leg Repair, allocation-review classification, durable Zerodha
sell-to-buy continuation, non-terminal sell-batch status protection, canonical
holdings confirmation, post-order funds invalidation, and derivative lot
expansion. No native files or dependencies changed.


This app uses Revopush for signed React Native JavaScript and asset updates.
The first OTA-capable store binaries are the releases containing this setup;
older installed binaries cannot receive OTA updates.

## 2026-09-12 execution-boundary safeguards

JavaScript-only update from source commit `7ceda3a`, combined with the latest
profile bundle at the remote tip. Publisher WebViews now have quiet phase
telemetry and one safe pre-Kite retry; stale plans and temporarily unavailable
broker verification refresh with bounded delays. Every mobile Publisher intent
carries execution bundle `2026091102`.

- AlphaPro-Android Production **v35** targets `3.9.119`; package hash
  `f155667e9b19c841a900596a1d854940fc00331c7c25c48fbef19a72912d6c65`.
- AlphaPro-iOS Production **v15** targets `2.4`; package hash
  `7aab885bf24121e36beae388b68ce61492b6fe17e6c0151740580672131123b9`.
- Both signed releases are enabled, mandatory and at 100% rollout.

## Native bundle selection

`MainApplication` delegates the JavaScript bundle path to CodePush only in
release builds. Release artifacts package `index.android.bundle` as the
offline fallback and may replace it with a verified signed OTA package. Debug
APKs return no fixed bundle path so React Native connects to Metro; debug
variants intentionally do not package the release fallback bundle. The debug
source set permits Metro's local HTTP endpoint, while the release network
security resource remains HTTPS-only.

`index.js` also leaves `App` unwrapped when `__DEV__` is true. This prevents a
debug Metro session from downloading an OTA and restarting into its production
bundle. Release builds retain the signed CodePush policy below.

## One-time setup

1. Back up `../../../keys/alphapro/ota/alphapro-ota-private.pem` in the company secret store.
   Never commit or share the private key. Losing it means new signed updates
   cannot be installed by existing binaries.
2. Install dependencies with `npm ci`.
3. Authenticate the CLI with `npm run ota:login`.
4. On macOS, run `cd ios && pod install` before building the iOS store binary.

The Android and iOS Production deployment keys are embedded in their native
configurations. Android can override its key at build time with the
`CODEPUSH_DEPLOYMENT_KEY` environment variable or Gradle property.

## Safe release flow

Publish to Staging first:

```sh
npm run ota:android:staging -- --description "Description"
npm run ota:ios:staging -- --description "Description"
```

Staging updates require a tester build configured with the app's separate
Staging deployment key; a store binary configured with the Production key will
not see them. After testing, promote the same signed update to Production,
initially with a limited rollout if desired:

```sh
npm run ota:android:promote -- --rollout 10% --description "Production rollout"
npm run ota:ios:promote -- --rollout 10% --description "Production rollout"
```

Omit `--rollout 10%` for a 100% rollout. The app checks on launch/resume, but
both optional and mandatory updates activate only on the next clean restart.
This prevents an OTA from interrupting startup or an active order-placement
session. A mandatory release remains prioritised and cannot be skipped by the
client, but it does not force an in-process reload.

For an urgent signed update when no Staging-key tester build is available,
publish directly to Production with a limited rollout:

```sh
npm run ota:android:production -- --rollout 10% --description "Urgent fix"
npm run ota:ios:production -- --rollout 10% --description "Urgent fix"
```

Use OTA only for JavaScript and bundled assets. Native dependency, permission,
entitlement, plist, manifest, or SDK changes require a new store release. The
CLI targets the exact native app version from Gradle or Xcode by default, which
prevents an incompatible update from reaching another binary version.

## 2026-09-09 account-wide reconciliation guard

JavaScript-only update from source commit `ca86788`. Dashboard rebalance cards
now honor an account-wide reconciliation barrier even when the server has not
returned model-specific rows. Fresh cards no longer offer Accept Rebalance
while ownership evidence is still being checked; already verified or completed
cards are not downgraded.

- AlphaPro-Android Staging **v8** promoted unchanged to Production **v30** for
  native version `3.9.119`.
- AlphaPro-iOS Staging **v7** promoted unchanged to Production **v11** for
  native version `2.4`.
- Both releases are signed, enabled, optional, and at 100% rollout. They
  activate on the next cold restart.
- Four focused Jest suites / 59 tests passed. Metro/Hermes packaging and
  signing succeeded. No on-device broker-flow test was performed.

## 2026-09-11 corporate-action settlement notice

JavaScript-only update from source commit `0d5f4cc`. Recent bonus/split
adjustments now show an amber explanation on model cards and an info control
beside affected broker holdings while the broker quantity is still settling.

- AlphaPro-Android Staging **v9** promoted unchanged to Production **v31** for
  native version `3.9.119`; package hash `360e1961b871240e22d1098bf25a8c81aeaf66b4ff4f03fe1886c742d3446544`.
- AlphaPro-iOS Staging **v8** promoted unchanged to Production **v12** for
  native version `2.4`; package hash `93a329bb30245284971a39b3faa39d3a3c11452bfc62df2f7baf7a48b42d1417`.
- Both releases are signed, enabled, optional, and at 100% rollout. Focused
  Jest tests passed and Android/iOS Metro/Hermes packaging succeeded.
- Existing unchanged oversized onboarding assets required the documented
  asset-size override. No native files or dependencies changed.

### Verified Production rollout (2026-09-11)

Source commit: `220b62e`. Signed packages were staged, verified, and promoted.

| RevoPush app | Production label | Native versions | Package hash |
|---|---|---|---|
| AlphaPro-Android | v33 | `3.9.119` | `e5f7d2f4e36e3350872797af0ba9e89c1902d277eafd3097efc4d64a72f1fad2` |
| AlphaPro-iOS | v13 | `=2.4` | `ba623ffa5cafba6af9b6c6a490fba42e0935520709adb88704e24fdab8a30cd1` |

All releases are enabled, optional, and at 100% rollout. The update downloads
at launch and installs on the next restart. Production downloads were checked
against the signed package hash, RSA signature, Hermes bytecode, and new phone
validation; the old 9–11 digit error is absent. The native update-check endpoint
offers the expected package for every native version listed above.

Validation: 42 phone/profile/payment tests plus four existing execution-safety
tests passed in this repository; the Publisher completion authority check also
passed. No physical-device profile-save or OTP-delivery test was performed.

The CLI positional release parser treats `2.4` as a number; `=2.4` preserves
the existing semver range as a string. A native `app_version=2.4` acquisition
request was verified to receive v13.

## 2026-09-16 AlphaB2B 3.9.122 diagnostic binary

Source commit `f28824f` embeds the existing Repair/Orders OTA fixes and adds
single-flight loading for the account-wide trade feed plus a non-blocking
account refresh on the portfolio's **Refresh Order Status** action. The latter
still uses the broker-status endpoint as authority and never submits an order.

- Signed test APK: `artifacts/AlphaB2B-3.9.122-responsive-test.apk` in the
  production web workspace (SHA-256
  `7b780452c4fc9915a44a213b54e40b733d17c20924e2790c192d6f5d3e9aa33f`).
- Three focused Jest suites / 55 tests and the signed Android release build
  passed. No physical-device confirmation yet; the reported Orders row crash
  has not been diagnosed. Do **not** call this a validated crash fix.
- This is **not** published to Play or RevoPush. The Play Store 3.9.120
  binary remains older on a fresh reinstall until its OTA activates.
- Keep the AlphaB2B full-screen broker-auth WebView design distinct from
  Markup and MoneyMan. Port only verified shared changes after testing each
  app's own binary, signature and broker flow; do not assume an AlphaB2B OTA
  updates either other app.
