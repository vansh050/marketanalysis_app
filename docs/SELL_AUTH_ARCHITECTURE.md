# Sell-Authorization Architecture (DDPI / TPIN / EDIS)

> **Canonical reference for sell-authorization across all brokers, all repos.**
> Maintained as the single source of truth. tidi_new + alphaquark-mobile-sdk
> mirror this doc by reference (`docs/SELL_AUTH_REFERENCE.md` in those repos).
>
> **🔴 BLOCKING RULE — see § "Documentation update contract" at the bottom.**
> Every code change touching sell-auth (any field, any flag, any broker, any
> persist path, any read path, any UI gate, any SDK widget) MUST update this
> doc IN THE SAME COMMIT.

---

## 1. Conceptual model

### 2026-09-28 portal-broker execution invariant

Sell authorization is broker-class specific:

1. **Live check + in-app authorization:** Zerodha, Angel One and Dhan verify
   current authorization and open the broker/CDSL flow when it is missing.
2. **Broker-evidence-first in-app authorization:** Fyers submits the SELL
   first. Its stored flag and profile `ddpi_enabled` value are advisory because
   the profile has returned false for a broker account whose UI showed active
   DDPI. Only backend `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED` evidence opens
   the Fyers TPIN/holdings WebView.
3. **External broker authorization:** Upstox, ICICI Direct, Kotak, HDFC
   Securities, IIFL Securities, Motilal Oswal, Groww, Axis Securities and
   AliceBlue are never stopped solely by a stale/false local flag. SELLs are
   dispatched first. If every expected SELL has zero fill and there is no
   stronger failure classification, ccxt emits `SELL_AUTH_REQUIRED`; the app
   immediately shows broker-specific portal steps and a DDPI recommendation.

Dependent BUY legs are withheld and returned as `NOT_ATTEMPTED` with
`DEPENDENT_LEG_NOT_ATTEMPTED`. After manual confirmation, apps persist today's
authorization and reopen a fresh protected review/calculation. They do not
blindly replay the consumed frozen plan.

### 2026-09-30 Dhan quantity evidence and SELL-phase rule

Dhan `DH-906 Validate Qty from CDSL` is an explicit sell-authorization
rejection and maps to `SELL_AUTH_REVOKED`. A CDSL callback or customer checkbox
is not authorization evidence. The app must re-read `/dhan/edis-status` and
require `edis=true` plus approved quantity greater than or equal to the
aggregate requested quantity for every SELL, both after CDSL returns and before
dispatch.

The shared broker orchestrator remains SELL-first: it submits the complete SELL
phase before any BUY. If zero SELLs succeed, all dependent BUYs are returned as
`DEPENDENT_LEG_NOT_ATTEMPTED`; if at least one SELL succeeds, the approved BUY
phase may proceed. This rule was not changed by the ICICI Repair correction.

### 2026-09-22 RN SDK pre-dispatch verification invariant

For `executeAdvice` with equity-delivery SELL legs, the RN SDK reads the
authenticated SDK sell-auth endpoint before placement. The server response,
not an empty SDK-local user object, is authoritative. When the host owns the
review modal (`skipReview: true`), an unavailable or unauthorized verdict is a
typed error to the host; the SDK must not open another modal behind it. This
prevents the Groww Step 3 stall where no placement request reached the backend.

When a customer SELLS shares from their demat account, SEBI requires explicit
authorization that the broker is acting on their behalf. India brokers
implement this through three different mechanisms — every flow in our system
ultimately resolves to ONE of these:

| Mechanism | Lifetime | User experience | Notes |
|---|---|---|---|
| **DDPI** (Demat Debit and Pledge Instruction) | **Permanent** until user revokes at depository | One-time form filed at the depository (CDSL/NSDL) — usually via the broker's account-opening flow or a separate POA module | Modern SEBI replacement for POA. If a user has DDPI, they can sell ANY day without per-day authorization. |
| **TPIN / EDIS** (Electronic Delivery Instruction Slip) | **Per-day per-session** — expires at end of trading day | User receives an OTP on the registered mobile, enters it via broker's CDSL/NSDL flow each morning before selling | Manual, per-trading-day. If user authorizes today, they can sell today. Tomorrow they must re-authorize. |
| **POA** (Power of Attorney) | **Permanent** — legacy, mostly deprecated | Physical paper document, scanned + uploaded at account opening | SEBI's pre-DDPI standard. Still honored by older accounts; new accounts use DDPI instead. |

> **Why the day-scope matters.** TPIN/EDIS is the default for users who haven't
> set up DDPI. The TPIN session is bound to the broker's daily settlement cycle
> — once the day rolls over (3:30 PM IST close, then overnight settlement), the
> session is invalidated and the user MUST re-authorize before placing the next
> day's sell orders. **Persisting `is_authorized_for_sell: true` across days
> for a TPIN/EDIS user is actively harmful** — they think they can sell, but
> the broker rejects mid-trade with a POA / EDIS-required error code.

---

## 2. The two flags + the timestamp

These three fields live on BOTH the top-level user document AND every entry
in `connected_brokers[]` (Mongoose schemas in `Models/userModel.js`):

| Field | Type | Set by | Reset by | Lifetime |
|---|---|---|---|---|
| `ddpi_enabled` | Boolean | Broker live check (Zerodha `save-ddpi-status`, Angel One `verify-dis`, Dhan `get-edis-status`) — sets TRUE when broker reports DDPI active. Manual confirmation does NOT set this. | Broker live check returns false (rare — typically only if user revoked DDPI at depository). | **Permanent until broker says otherwise** — survives reconnect AND day rollover. |
| `is_authorized_for_sell` | Boolean | TWO paths: (a) frontend `update-edis-status` after manual TPIN flow; (b) ccxt-side auto-detection after a successful sell order goes through (the order itself proves the auth). | (a) Day rollover via `shouldPreserveSellAuth` check at next reconnect; (b) ccxt-side auto-revoke when a sell rejection is classified as `SELL_AUTH_REVOKED` (see `trading_logic/sell_auth_revoke.py` + `Routes/UpdateEdisStatus.js`). | **Day-scoped — TRUE-only-today.** Reset at next IST calendar-day boundary. |
| `sell_auth_set_at` | Date | Stamped to `new Date()` whenever `is_authorized_for_sell` flips to TRUE (any path). Set to `null` when flipped to FALSE. | Same as `is_authorized_for_sell`. | Companion timestamp — anchors the day-scope. |

### 2a. Why we need BOTH `ddpi_enabled` AND `is_authorized_for_sell`

A boolean alone can't distinguish "permanently authorized via DDPI" from
"authorized just for today via TPIN". The two flags keep them separate so:

- DDPI users (`ddpi_enabled: true`) NEVER see the manual EDIS prompt.
- TPIN users (`is_authorized_for_sell: true` AND `sell_auth_set_at == today`)
  don't see the prompt today, but DO see it tomorrow.
- New users / revoked users (both false) see the prompt every time until they
  authorize once.

### 2b. Why we need `sell_auth_set_at` (introduced 2026-05-02)

Before this field existed, every broker connect handler hard-reset
`is_authorized_for_sell: false`, which forced the user to re-confirm manually
on every reconnect even within the same day. The first attempted fix
preserved the boolean indefinitely — wrong, because TPIN expires daily.

`sell_auth_set_at` is the anchor that lets the connect path distinguish
"set today" (preserve) from "stale from yesterday" (reset to false).

---

## 3. The day-check helper

**File:** `aq_backend_github/utils/sellAuthDayCheck.js`

```js
const { shouldPreserveSellAuth, isSetToday, _ymdIST } = require('./utils/sellAuthDayCheck');

// Returns true iff `flag` is TRUE AND `setAt` is the same calendar date as
// today in IST (Asia/Kolkata, UTC+5:30, no DST).
shouldPreserveSellAuth(storedIsAuthorized, storedSetAt) // → boolean
```

**Used by:**

- `Routes/userRoutes.js` — every broker's `connect-broker` handler (14 sites)
- `services/MultiBrokerService.js addBrokerConnection` — the
  `connected_brokers[broker]` sub-doc sync
- (extensible) any future code path that reads `is_authorized_for_sell`
  alongside `sell_auth_set_at` and needs to honor day-scope

> **Date math is IST, not UTC.** Indian markets reset on the IST calendar.
> The helper does `new Date().getTime() + 5.5 * 3600 * 1000` then formats as
> YYYY-MM-DD. Don't switch to UTC — a sell auth at 11pm IST would silently
> expire 30 minutes later if compared on UTC dates.

---

## 4. Per-broker matrix

| Broker | Sell-auth mechanism | Live server-side check | Stored flag relied on? | EDIS flow file | Notes |
|---|---|---|---|---|---|
| **Zerodha** | TPIN session (per-day) OR DDPI (permanent) | ✅ `/zerodha/save-ddpi-status` — refreshes both `ddpi_status` and `is_authorized_for_sell` from Kite session | Yes (overwritten by live check on rebalance entry) | tidi: `DdpiAuthPage.dart` `_zerodhaFlow`<br>Alphab2bapp: `DdpiModal.js` (Zerodha branch via `ZerodhaTpinModal`) | Web Kite Connect TPIN flow renders inside our WebView. |
| **Angel One** | DDPI OR TPIN (CDSL form) | ✅ `/angelone/verify-dis` (server-side: `app_angelone.py:verify_dis`) — returns `{edis: bool, data: {DPId, ReqId, TransDtls}}`. `edis: true` ⇒ already authorized today / DDPI active. | Yes (preferred); live check is fallback when both flags are false (added 2026-05-02). | tidi: `DdpiAuthPage.dart` `_angelOneFlow`<br>Alphab2bapp: `DdpiModal.js` (auto-fetch `verify-edis` on open; auto-skip when `edis: true` — added 2026-05-02) | clientCode required for `verify-dis`. SmartAPI JWT payload's `username` claim carries it — JWT-fallback added 2026-05-02 in `DdpiAuthPage._angelOneFlow` for users whose `connected_brokers[Angel One].clientCode` is empty (older shared-mode connections didn't persist it; backend persist now extracts from JWT — `Routes/sdk/v1/connections.js` Angel One shared-mode branch). |
| **Dhan** | TPIN (CDSL via Dhan portal) | ✅ `/dhan/edis-status` — returns per-holding eDIS state and approved quantity. Authorized iff every selected equity-delivery SELL has a matching `edis=true` row with enough aggregate approved quantity; unrelated holdings are ignored. | Hint only; callback/checkbox and a stale true flag never override live quantity evidence. | tidi: `DdpiAuthPage.dart` `_dhanFlow` (`generate-tpin` → `enter-tpin` → HTML form WebView)<br>Alphab2bapp: `DdpiModal.js` (Dhan branch) | AlphaB2B polls after CDSL completion and lifts fresh state into the parent; Tidi verifies after callback and final dispatch. `DH-906 Validate Qty from CDSL` reopens recovery as `SELL_AUTH_REVOKED`. |
| **Fyers** | Standing DDPI or TPIN (Fyers/CDSL flow) | Advisory `GET /api/v3/profile data.ddpi_enabled`; false/unknown is not a gate | No pre-block; recovery/audit only | Alphab2bapp: `DdpiModal.js` `FyersTpinModal` (`submit-holdings` → app-root HTML WebView) | SELL first. Open authorization only for explicit `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED`. Empty results, timeouts, low funds, app-permission errors and generic rejected SELLs retain their real result. |
| **Upstox** | DDPI / broker-portal authorization | ❌ No live check | Recorded after manual confirmation; not a pre-block signal | tidi: `_buildManualAuthContent` (manual instructions screen) | SELL first; all-zero-fill refusal opens portal recovery. DDPI is the recommended standing fix. |
| **HDFC Securities** | DDPI / POA | ❌ | Recovery/audit signal only | Manual content | Same optimistic portal pattern as Upstox. |
| **Motilal Oswal** | DDPI / POA | ❌ | Recovery/audit signal only | Manual content | Same. |
| **AliceBlue** | DDPI / TPIN at broker portal | ❌ (no reliable account-wide pre-trade verdict) | Recovery/audit signal only | Manual content | SELL first; authorize at AliceBlue portal after an all-zero-fill refusal. |
| **IIFL Securities** | DDPI / POA | ❌ | Recovery/audit signal only | Manual content | Same. |
| **Axis Securities** | DDPI / POA | ❌ | Recovery/audit signal only | Manual content | Same. |
| **Kotak** | DDPI / TPIN | ❌ | Yes | Manual content | Same. |
| **Groww** | DDPI / TPIN | ❌ | Yes | Manual content | Same. |
| **ICICI Direct** | DDPI / POA | ❌ | Yes | Manual content | Same. |
| **DummyBroker** | N/A (simulation) | N/A | N/A | N/A | Always allowed; no auth concept. |

**Live-check brokers** (3): Zerodha, Angel One, Dhan. Stored flag is a hint;
live check is authoritative. Stored flag's day-scope still matters for the
brief window between connect and the next live probe.

**Broker-evidence-first brokers** include Fyers and the nine portal brokers
(Upstox, HDFC, Motilal, AliceBlue, IIFL, Axis, Kotak, Groww, ICICI). Their
stored flag is an audit/same-day convenience signal, not authority to
pre-block execution. Fyers differs only in recovery: it can open the CDSL form
inside the app after an explicit classification.

---

## 5. Lifecycle: what happens when

### 5a. First-ever sell on a new connection

```
1. User opens RebalanceModal (Alphab2bapp) / RebalanceReviewPage (tidi).
2. Pre-trade gate reads connected_brokers[broker].is_authorized_for_sell.
3. Live-check brokers: pre-gate calls verify-dis / save-ddpi-status / get-edis-status.
   - If live returns "authorized" → DB flag flipped to true via update-edis-status,
     gate passes silently.
   - If live returns "not authorized" → manual EDIS UI opens.
4. Fyers and portal brokers: submit SELL; do not block on a false/stale flag.
   - explicit `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED` → recovery UI.
   - any other failure → preserve and display the real broker result.
5. When explicitly required, user completes manual TPIN/EDIS flow in WebView
   (CDSL/NSDL form).
6. On WebView success callback, frontend calls PUT /api/update-edis-status:
     { uid, is_authorized_for_sell: true, user_broker }
7. Backend (UpdateEdisStatus.js):
     - Sets root user.is_authorized_for_sell = true
     - Sets root user.sell_auth_set_at = new Date()
     - Mirrors to connected_brokers[primary_broker].is_authorized_for_sell = true
     - Mirrors connected_brokers[primary_broker].sell_auth_set_at = new Date()
8. RebalanceModal reopens; gate now passes; trade flow proceeds.
```

### 5b. Same-day reconnect (after disconnect/reconnect within the trading day)

```
1. User reconnects broker via Phase3SdkConnectScreen / BrokerSelectionModal.
2. Backend connect handler (e.g. userRoutes.js Upstox branch line 920):
     - Reads currentUser (existing user doc).
     - Computes preservedSellAuth = shouldPreserveSellAuth(
         currentUser.is_authorized_for_sell,    // true
         currentUser.sell_auth_set_at           // today's date
       ) → returns TRUE (set today).
     - findOneAndUpdate $set:
         is_authorized_for_sell: true (preserved)
         sell_auth_set_at: today (preserved)
3. syncBrokerToMultiBrokerArray → MultiBrokerService.addBrokerConnection:
     - Reads existing connected_brokers[broker] entry.
     - shouldPreserveSellAuth on that entry → TRUE.
     - Writes is_authorized_for_sell: true (preserved) on the slot.
4. User attempts sell → gate sees true → no manual prompt → trade proceeds.
```

### 5c. Next-day reconnect (after midnight IST rollover)

```
1. User reconnects at 9 AM IST (markets just opened on day N+1).
2. Backend connect handler:
     - currentUser.sell_auth_set_at = day N (yesterday IST).
     - shouldPreserveSellAuth → FALSE (set_at != today).
     - $set: is_authorized_for_sell: false, sell_auth_set_at: null.
3. MultiBrokerService.addBrokerConnection:
     - existingEntry.sell_auth_set_at = day N.
     - shouldPreserveSellAuth → FALSE.
     - Writes is_authorized_for_sell: false on the slot.
4. User attempts sell → gate sees false → manual EDIS UI opens →
   user enters today's TPIN → flag flips back to true (set_at = day N+1).
   Same as 5a.
```

### 5d. ccxt-side auto-revoke (sell rejected because broker says not authorized)

```
1. User attempts sell on a no-live-check broker.
2. Fyers and portal brokers proceed regardless of a stale local flag.
3. ccxt forwards order to broker.
4. Broker rejects with EDIS / POA error.
5. ccxt classifies an actionable rejection as `SELL_AUTH_REVOKED`. For the
   nine portal brokers, if every expected SELL instead returns only a generic
   zero-fill failure and no stronger classification exists, the basket guard
   stamps `SELL_AUTH_REQUIRED`.
6. ccxt POSTs to internal endpoint:
     PUT /api/update-edis-status (X-Internal-Source header)
     { email, broker, is_authorized_for_sell: false,
       sell_auth_revoked_at: NOW, revoke_reason: "..." }
7. UpdateEdisStatus.js internal path:
     - $set connected_brokers[broker].is_authorized_for_sell = false
     - $set connected_brokers[broker].sell_auth_set_at = null
     - If primary_broker matches, mirrors root flags too.
     - Stamps sell_auth_revoked_at + sell_auth_revoke_reason.
8. Frontend re-fetches user details → sees flag false → on next sell,
   manual EDIS UI opens.
```

---

## 6. Backend persistence schema

### 6a. Top-level user fields (`Models/userModel.js`)

```js
ddpi_enabled: { type: Boolean, default: false },          // permanent
is_authorized_for_sell: { type: Boolean, default: false }, // day-scoped
sell_auth_set_at: { type: Date },                         // companion to above
sell_auth_revoked_at: { type: Date },                     // ccxt-side revoke audit
sell_auth_revoke_reason: { type: String },                // ccxt-side revoke audit
```

### 6b. Per-broker entry (`connectedBrokerSchema`)

Same five fields, mirrored to the `connected_brokers[]` sub-document. Mobile
apps read these per-broker — the top-level fields are legacy mirrors maintained
for older code paths.

### 6c. Required code paths

The following code paths MUST handle sell-auth correctly:

1. **Connect handlers** (userRoutes.js — 14 broker branches): preserve via
   `shouldPreserveSellAuth(currentUser?.is_authorized_for_sell, currentUser?.sell_auth_set_at)`.
   The Zerodha branch also queues credential-free model-portfolio account
   reconciliation after the validated token and preserved sell-auth state are
   durably written (2026-09-16). This asynchronous hook does not read, reset or
   change DDPI/TPIN/EDIS fields and cannot roll back broker connection success.
2. **MultiBrokerService.addBrokerConnection**: same check on `existingEntry`.
3. **UpdateEdisStatus.js** (both PUT paths): set `sell_auth_set_at = new Date()`
   when `is_authorized_for_sell` flips to TRUE; `null` on FALSE.
4. **SDK connect path** (`Routes/sdk/v1/connections.js`): `_selfCallLegacy`s
   to `/api/user/connect-broker` which inherits the userRoutes.js fix.

If a NEW connect path is added (for a new broker, or a new SDK route, or a
new auto-import flow), it MUST follow #1's pattern.

---

## 7. Mobile app responsibilities

### 7a. Read path (sell-auth gate before showing EDIS UI)

| App | File | Pattern |
|---|---|---|
| **tidi_new** | `RebalanceReviewPage.dart`, `ExecutionStatusPage.dart` | Zerodha, Angel One and Dhan live-check; Dhan requires exact broker-confirmed quantities after callback and before dispatch. Fyers uses today's flag then its WebView; portal brokers submit SELLs first. Explicit sell-auth classification or the guarded all-SELL-zero-fill fallback opens `DdpiAuthPage(postFailure: true)`. Only broker-confirmed Dhan completion persists the flag and opens a fresh protected review. |
| **Alphab2bapp** | `src/components/AdviceScreenComponents/RebalanceModal.js` | Per-broker if-blocks read `userDetails.is_authorized_for_sell` (top-level). Opens broker-specific TPIN modal. **2026-05-03: derivatives (NFO/BFO/MCX exchanges, MIS/NRML product types) excluded from EDIS/DDPI checks** — only equity delivery (CNC) sells trigger the gate. DdpiModal auto-fetches `verify-edis` and short-circuits when `edis: true`. Zerodha WebView CDSL flow fixed: confirmation overlay no longer shows prematurely (waits for callback_url or user close). |
| **SDK** | `@alphaquark/mobile-sdk` `SellAuthGate.tsx` `requireSellAuth()` | **2026-05-03: derivatives excluded** — filters to equity delivery (CNC) sells before checking DDPI flags. NFO/BFO/MCX exchanges and MIS/NRML product types pass through without sell-auth gate. |
| **Alphab2bapp** (initial allocation) | `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:218-310` | DDPI-priority gate added 2026-05-03. Pre-blocks ONLY for Zerodha (`!is_authorized_for_sell && !ddpi_status in ['physical','ddpi']`) + Angel One (`!ddpi_enabled && !is_authorized_for_sell`) + 8 portal-side brokers (`!is_authorized_for_sell`). **Dhan + Fyers NOT pre-blocked** — optimistic placement per § 7d below. |

### 7d. DDPI-priority semantics (canonical, 2026-05-03)

**The principle**: when DDPI is active at the broker, the user can sell freely without per-day authorization. Pre-blocking when DDPI may be active is wrong UX (false negative).

**Per-broker classification:**

| Class | Brokers | Pre-block strategy |
|---|---|---|
| **DDPI-aware (cheap server-cached flag)** | Zerodha (`ddpi_status` populated by `/zerodha/save-ddpi-status`), Angel One (`ddpi_enabled` populated by `/angelone/verify-dis`) | Pre-block ONLY when `!ddpi_flag && !is_authorized_for_sell`. DDPI active ⇒ proceed. |
| **Live-check available, expensive** | Dhan (`/dhan/edis-status`, per-holding) | Where pre-fetched (RebalanceModal does), use live check. Where not pre-fetched (UserStrategySubscribeModal), prefer optimistic placement over stored-flag fallback — stale flag would falsely block users who cleared EDIS at the portal between sessions. |
| **In-app, no reliable live check** | Fyers | If today's flag is not valid, open the Fyers TPIN/holdings WebView before placement. |
| **External portal, no reliable live check** | Upstox, HDFC, Motilal, AliceBlue, IIFL, Axis, Kotak, Groww, ICICI Direct | Do not pre-block on the stored flag. Submit SELLs first; only an explicit sell-auth classification or guarded all-SELL-zero-fill generic failure opens manual recovery. |

**Current orchestrated direction**: SDK/app ownership implements the canonical pattern:

1. Check DDPI-aware flags (cheap, accurate). DDPI active ⇒ proceed.
2. For DDPI-non-aware brokers, attempt the trade optimistically.
3. If broker rejects with EDIS error (classified by ccxt), open the SDK `<SellAuthGate>` widget for in-app re-auth (Zerodha auth-sell, Angel One verify-dis, Dhan TPIN, Fyers TPIN) OR show "authorize at broker portal" instructions for portal-side brokers.
4. After successful re-auth, reopen a fresh protected calculation/review. The
   old frozen plan is consumed and must not be directly replayed. The next
   review retains SELL-first dispatch and does not resend prior fills.

AlphaB2B and Tidi retain different presentation components, but the broker
classes, trigger conditions and retry safety rule are shared.

### 7e. "I've authorized" retry and failure visibility (2026-10-01)

- **`OtherBrokerModel` "Authorized — recalculate"** (`src/components/DdpiModal.js`):
  saves `is_authorized_for_sell` (`PUT /api/update-edis-status`), refreshes
  user details, then `POST /rebalance/calculate`. The sheet now **stays open**
  with "Saving your authorization…" → "Recalculating your orders…" and closes
  only after the recalculation succeeds; then the review reopens with the
  tagged plan (`_sellAuthorizationRetry`) showing "Updated after your sell
  authorization. No orders have been placed yet…", plus a toast. A failed save
  does **not** block (block only on positive evidence) but is reported; a
  failed recalculation stays on the sheet with "Try again". Double taps are
  ignored. Previously the sheet closed first, the customer sat on the home
  screen during the request, and both failures were silent.
- **Layout:** the shared checkbox `label` wraps (`flexShrink: 1`); the sheet's
  actions stack full-width (they clipped on ~360dp phones since 2026-09-30).
- **Toasts over native modals:** `RebalanceModal` and every sell-auth modal in
  `DdpiModal.js` (OtherBroker, Angel One, Dhan, Fyers TPIN) mount their own
  `<Toast />`; the App.js host renders underneath an open native Modal, so
  their error toasts were invisible.
- **Fyers SDK refusal:** when the SDK's pre-placement sell-auth check returns
  a positive "not authorized" (`OrchestrationError` `sell_auth_declined`),
  `handleFyersRedirect` opens the Fyers TPIN flow ("No orders were placed")
  instead of a dead-end error.
- **SDK root cause of the 2026-10-01 "Place Order did nothing" (Fyers):** the
  RN SDK's `request()` used `url.searchParams.set`, which React Native's
  built-in URL does not implement; `getSellAuth` (which sends the SELL
  symbols) threw on device before any network call since the 2026-09-22
  pre-check, so every SDK-path rebalance with equity SELLs failed silently.
  Fixed in alphaquark-mobile-sdk (`buildRequestUrl`); see
  `alphaquark-mobile-sdk/docs/SELL_AUTH_REFERENCE.md`.
- **Fyers "Retry Order" loop (3.9.167):** after the customer ticked "I've
  authorized" and tapped Retry Order, the saved authorization was answered from
  the server's 5-minute sell-auth cache (still `false`), so the SDK refused and
  the TPIN sheet reopened. Fixed server-side (`aq_backend_github` `067141e`:
  the customer `PUT /api/update-edis-status` clears the cache and mirrors onto
  the broker it names) and in the SDK (`9e0d4e5`: the pre-check reads
  `fresh=1`). The SDK also stopped blocking on an **unreadable** status: it
  retries once and places; a broker refusal brings back the TPIN flow via the
  existing post-placement `hasExplicitSellAuthRejection` path.
- Pinned by `src/__tests__/sellAuthRetryFeedback.contract.test.js`.

### 7f. One instruction source + one sheet layout (2026-10-01)

Every sell-authorization sheet in `src/components/DdpiModal.js` renders
`src/components/SellAuth/SellAuthGuideCard.js`:
- **In-app brokers** — Zerodha `DdpiModal`, Angel One, Dhan, Fyers TPIN
  modals: `variant="inApp"` shows the rule, the sells to approve and the
  CDSL steps.
- **Portal brokers** — `OtherBrokerModel` (main and how-to views):
  `variant="portal"` shows the rule, the sells, the broker steps and
  "Open <broker>".

The copy comes from the server (`useSellAuthGuide` →
`GET /api/sell-auth/guides/:broker`, aq_backend_github
`utilities/sellAuthGuides.js`), with a generic built-in fallback. Copy
changes go on the server.

"DDPI Inactive: Proceed with TPIN Mandate" is gone: we cannot read DDPI for
these brokers. The title is now "Approve today's sell with your CDSL TPIN".

Render sites pass `sellOrders={sellOrdersForAuth(...)}`
(`src/utils/sellAuthOrders.js`): broker-rejected equity SELLs first, else
the planned SELLs. Display only, never a gate.

The local `brokerInstructions` object now only supplies the YouTube
walkthrough ids.

Pinned by `src/__tests__/sellAuthGuide.contract.test.js` and
`sellAuthGuideCard.render.test.js`.

### 7g. DDPI question after connecting (plan item 4, 2026-10-01)

`src/components/SellAuth/DdpiDeclarationPrompt.js` is mounted at the app root,
next to `BrokerAlertModal`.

When it asks:
- once per connected broker (an AsyncStorage key per email + broker),
  2.5 s after the account shows a connected `user_broker` whose
  `connected_brokers[]` entry has no `ddpi_self_declared`;
- never for Zerodha (DDPI is read from Kite) or DummyBroker.

What it does:
- Asks "Yes / No / Not sure", with a DDPI link from the server guide.
- Saves via `PUT /api/sell-auth/ddpi-declaration`.
- Never blocks, and never writes `ddpi_enabled` / `is_authorized_for_sell`.
- The answer is a display hint only; nothing reads it as authorization yet.

Pinned by `src/__tests__/ddpiDeclarationPrompt.test.js`.

### 7b. Write path (after WebView completes)

Both apps call `PUT /api/update-edis-status { uid, is_authorized_for_sell: true, user_broker }`
on TPIN/EDIS WebView completion. Backend stamps `sell_auth_set_at` automatically.

### 7c. Day-scope on the read side (NOT YET IMPLEMENTED)

Currently the day-scope is enforced ONLY on the connect path (backend). If a
user stays connected across midnight IST, the backend doesn't proactively
flip the flag — it only resets on the next reconnect.

**Defensive option for future:** mobile apps could also check
`sell_auth_set_at` before trusting `is_authorized_for_sell == true`. If
`set_at != today IST`, treat as false even though the flag says true.

This isn't currently wired because:
- Most users disconnect/reconnect within a 24-hour cycle.
- The ccxt-side auto-revoke catches users who try to sell with a stale flag.
- A backend cron at IST midnight could flip the flag deterministically across
  ALL connected_brokers entries for ALL users — preferred over per-app logic.

If we add the backend cron OR the per-app check, document it here.

---

## 8. SDK boundary (current and future)

### 8a. What the SDK owns today (`alphaquark-mobile-sdk`)

- **Post-trade-failure classification**: `state/edis_detection.dart` (Flutter)
  + `state/edisDetection.ts` (RN) classify whether a sell rejection is
  EDIS-related. Used by `EdisModal` widget to decide whether to surface the
  re-auth UI after a failed trade. Reads ccxt's `classification` field
  ONLY — no keyword fallback.
- **Deferred-leg terminal normalization (Flutter, 2026-09-28):**
  `NOT_ATTEMPTED` / `NOT_SUBMITTED` settle without polling and the exact status
  plus `DEPENDENT_LEG_NOT_ATTEMPTED` classification reaches the host.
- **Sell-auth status hook** (`useSellAuth.ts`): wraps
  `GET /sdk/v1/connections/:broker/sell-auth` for SDK consumers who want a
  pre-trade check. Currently advisory — Alphab2bapp + tidi_new read flags
  directly from `connected_brokers`.

- **`SellAuthGate` design-passthrough slot (2026-10-01, SDK `7dc0fda`)**: a
  host may replace the gate's presentation (`sellAuthGate` component
  override, RN + Flutter). The SDK still applies the visibility check and the
  DDPI / standing-authorization short-circuit (`DDPI_AWARE_BROKERS`; in
  `requireSellAuth`, the server-verified `is_authorized_for_sell`) **before**
  any host presentation renders, and the presentation can only answer via
  `onAuthorized` / `onDeclined`. Neither AlphaPro nor tidi mounts the SDK
  `SellAuthGate` today, so no shipped flow changed. SDK mirror:
  `alphaquark-mobile-sdk/docs/SELL_AUTH_REFERENCE.md`.

### 8b. What the SDK does NOT own today

- **Pre-trade gate logic** (deciding whether to show EDIS UI before placing
  a trade): owned by `RebalanceModal.js` / `RebalanceReviewPage.dart`.
- **Day-scope enforcement**: backend-only (sellAuthDayCheck.js).
- **Per-broker EDIS WebView flow**: owned by `DdpiModal.js` /
  `DdpiAuthPage.dart`.
- **`update-edis-status` write path**: app calls backend directly.

### 8c. If we extend SDK to own this directly (planned)

If the SDK widgets take over the pre-trade gate, they must:

1. **Honor the day-scope**: SDK should expose
   `evaluateSellAuth({ brokerEntry, nowFn?: () => Date }): { authorized: bool, reason: 'ddpi' | 'today_tpin' | 'expired_tpin' | 'never_authorized' }`.
   Pure function. `nowFn` injectable for testability.
2. **Live-check integration**: `useSellAuth` already wraps the backend
   `/sell-auth` endpoint. Pre-trade gate widget should call this and AND it
   with the local flag check.
3. **WebView host**: SDK should ship a `<EdisAuthFlow broker={...} />`
   widget that runs the broker-specific WebView and POSTs `update-edis-status`
   on completion. App-side `DdpiModal` / `DdpiAuthPage` becomes a thin wrapper.
4. **Keep the canonical doc here**. Add a `SELL_AUTH_REFERENCE.md` to the SDK
   `docs/` that points back to this doc as the source of truth.

When this lift happens, update §8a/§8b to reflect the new ownership and add
the migration step to `PHASE3_PROGRESS.md`.

---

## 9. Per-broker quirks recorded so far

This section captures non-obvious behavior discovered through production
incidents. Add new rows when new quirks surface.

| Date | Broker | Quirk | Where it bit us |
|---|---|---|---|
| 2026-05-02 | **Angel One** (shared mode) | `connected_brokers[Angel One].clientCode` was NEVER persisted on shared-mode connect. The client_code was only embedded in the SmartAPI Bearer JWT's `username` claim. EDIS UI required clientCode and errored "Angel One credentials missing. Please reconnect." | Backend fix: `Routes/sdk/v1/connections.js` Angel One shared-mode branch now extracts clientCode from JWT and persists it. App fix: `DdpiAuthPage._angelOneFlow` (tidi) JWT-fallback for older users with empty clientCode. |
| 2026-05-02 | **All 14 brokers** | Every connect handler hard-coded `is_authorized_for_sell: false` on connect, wiping the user's prior manual EDIS confirmation on every reconnect. | Backend fix: `userRoutes.js` 14 sites + `MultiBrokerService.addBrokerConnection` use `shouldPreserveSellAuth`. |
| 2026-05-02 | **TPIN/EDIS class** | First "preserve" fix kept flag indefinitely — wrong, EDIS expires daily. Stored TRUE from yesterday → user thinks they can sell, broker rejects mid-trade with POA error. | `sell_auth_set_at` timestamp + `shouldPreserveSellAuth` IST day-check. |
| (older) | **Zerodha** | `save-ddpi-status` is the only way to know if today's TPIN session is valid — there's no "is current TPIN session active" introspection on Kite. The endpoint returns the current state by attempting a holdings-margin probe under the user's session. | Pattern shipped in tidi_new `RebalanceReviewPage` line 1470-1488. |
| 2026-09-30 | **Dhan** | The TPIN completion handler updated only the database flag and reopened review while the parent retained its pre-authorization `edis:false` snapshot. Every subsequent Place Order reopened the same TPIN sheet. The gate also used `every()` across the full account, so an unrelated unauthorized holding could block the selected basket. | `DhanTpinModal` now polls `/dhan/edis-status` after the customer confirms CDSL completion, propagates the fresh response to its parent, and reopens review only when every selected SELL has enough approved quantity. All app Dhan gates use the same selected-trade helper. |
| 2026-09-29 | **Fyers** | Mobile pre-blocked on cached `is_authorized_for_sell=false`, treated generic rejected/empty/transport failures as TPIN, and hosted `submit-holdings` HTML in a second native Modal that could sit behind the information sheet. | Removed the cached pre-gate across recommendation/cart/rebalance surfaces; `hasExplicitSellAuthRejection` is now the control-flow authority; the CDSL form uses the app-root `PublisherWebViewOverlay` while the native sheet is hidden. |
| 2026-09-29 | **Groww / portal recovery** | After the customer acknowledged manual sell authorization, an empty recalculation was treated as authoritative alignment. The app showed a green success screen and could auto-mark the subscriber execution `executed`, even though the reviewed SELLs had no broker-confirmed completion. | Recovery calculations now carry UI-only sell-authorization context. An empty tagged result renders **Sell Authorization Still Pending**, keeps the rebalance incomplete, and is excluded from the already-aligned auto-acknowledgement path. Genuine zero-trade calculations without recovery context are unchanged. |
| 2026-09-30 | **Dhan / Tidi quantity recovery** | Dhan rejected all requested SELLs with `DH-906 Validate Qty from CDSL`; ccxt left the rows unclassified and Tidi accepted the CDSL callback/attestation before live approved quantities had propagated. | ccxt maps the rejection to `SELL_AUTH_REVOKED`. Tidi requires exact live quantity coverage after callback and before dispatch. Zero successful SELLs continue to withhold every dependent BUY; at least one successful SELL preserves the established BUY continuation. |
| 2026-05-04 | **IIFL, Axis, Kotak (2nd path), catch-all (Angel One)** | `ReferenceError: currentUser is not defined` → HTTP 500 on connect. The sell-auth-preserve sed replacement used `currentUser?.is_authorized_for_sell` but 4 of 14 broker blocks in `userRoutes.js` didn't declare `const currentUser = userData[0]`. JS optional chaining on an undeclared variable throws ReferenceError (unlike `typeof` which doesn't). | Fix: inserted `const currentUser = userData[0]` in the 4 missing blocks. Lesson: sed across many sites can introduce ReferenceErrors — always verify each block has the variables the replacement references. |
| 2026-05-07 | **Angel One** (DDPI sync) | `userDetails.ddpi_enabled` was never updated when DDPI was activated at the broker — the DdpiModal `handleProceed` auto-skip path only set `is_authorized_for_sell: true`. Result: the RebalanceModal sell-auth gate (`!ddpi_enabled && !is_authorized_for_sell`) re-fired every day after the daily TPIN reset, even though DDPI was permanently active server-side. SmartAPI's `verifyDis` returning `errorcode: AG1000` is the canonical signal "DDPI is active at the broker"; we now use it. | `DdpiModal.handleProceed(ddpiActive)` accepts an optional flag; auto-skip path detects AG1000 (or the legacy "already registered with CDSL" message phrasing) and passes `ddpiActive: true`, which adds `ddpi_enabled: true` to the `PUT /api/update-edis-status` payload. Backend route already supported the field — frontend just wasn't passing it. TPIN-completion path (WebView returnURL hit) keeps the default `false` since TPIN doesn't imply DDPI is set. |
| 2026-05-07 | **Angel One** | SmartAPI rate-limits BOTH `getHolding` AND `verifyDis` at ~1 req/sec. The mobile `AngleOneTpinModal` re-fired `/angelone/verify-edis` on every parent re-render (useEffect dep was the `userDetails` object reference, which flips frequently). Result: SmartAPI returned 403 "Access denied because of exceeding access rate" → ccxt threw `RATE_LIMITED` → either HTTP 500 to mobile OR (when `getHolding` was the rate-limited call) the backend fell into `create_error_response('no holdings found for user.')` and returned `200 { edis: false, data: {} }`. Mobile then opened the DDPI modal with empty form data, the "Proceed" button was enabled (because `!{}` is `false` in JS), user clicked it, and CDSL rejected with **"Some data is missing in posted Form"**. Three-bug compound failure. | Frontend fix (`src/components/DdpiModal.js`): (1) deps narrowed to primitive `jwtToken`/`userEmail` instead of `userDetails` object; (2) `verifyFiredRef` guard so verify-edis fires once per modal open; (3) reset guard on close; (4) button enable now checks `hasUsableEdisData` (DPId + ReqId + TransDtls all present) — not the truthy-empty `{}`. Backend fix (`brokers/angelone/angelone.py verify_dis`): retry once with 1.5s backoff on rate-limit for both `getHolding` and `verifyDis`, surface RATE_LIMITED as a clean error response with actionable message. Lesson: empty object `{}` is truthy — never use `!data` to gate UI; check the specific fields you need. |

---

## 10. Documentation update contract — BLOCKING

> **🔴 EVERY commit that touches sell-auth surfaces MUST update this doc IN
> THE SAME COMMIT. No exceptions.**

**Surfaces in scope:**

1. Backend persist paths:
   - `Routes/userRoutes.js` (any broker connect-broker handler)
   - `Routes/UpdateEdisStatus.js`
   - `Routes/sdk/v1/connections.js` (any broker exchange-token / connect branch)
   - `services/MultiBrokerService.js`
   - `Routes/Broker/<Broker>.js` (per-broker update-key paths)
   - `Models/userModel.js` (any field on userSchema or connectedBrokerSchema
     in the sell-auth set: `ddpi_enabled`, `is_authorized_for_sell`,
     `sell_auth_set_at`, `sell_auth_revoked_at`, `sell_auth_revoke_reason`,
     `tpin_enabled`)
   - `utils/sellAuthDayCheck.js`

2. Backend live-check endpoints:
   - `aq_backend_github/Routes/Broker/*` proxies to ccxt's verify-dis /
     save-ddpi-status / edis-status / verify-edis endpoints

3. ccxt-side classification + auto-revoke:
   - `trading_logic/sell_auth_revoke.py` (or wherever the SELL_AUTH_REVOKED
     classifier lives)
   - `app_<broker>.py` verify-dis / edis-status routes

4. Mobile app pre-trade gates:
   - tidi_new: `RebalanceReviewPage.dart` (per-broker if-blocks),
     `DdpiAuthPage.dart` (any broker flow)
   - Alphab2bapp: `RebalanceModal.js` (per-broker if-blocks),
     `DdpiModal.js`, `ZerodhaTpinModal.js`, `AngleOneTpinModel`, etc.

5. SDK widgets:
   - `alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/edis_modal.dart`
   - `alphaquark-mobile-sdk/packages/rn/src/components/EdisModal.tsx`
   - `state/edis_detection.dart` / `state/edisDetection.ts`
   - `hooks/useSellAuth.ts`

**What "update this doc" means:**

- New broker added → add a row in §4 per-broker matrix
- New live-check endpoint added → update §4 column "Live server-side check" + §7a + §8
- New flag added → update §2 + §6
- New code path added → update §6c "Required code paths"
- New per-broker quirk discovered → add a row in §9
- SDK ownership changed → update §8

**Mirror docs:**

The SDK + tidi_new should keep lightweight `SELL_AUTH_REFERENCE.md` files
that point here. If those need an update too (because the SDK / tidi-app
side changed), update them in the same commit.

**CLAUDE.md blocking rule:**

This rule is mirrored in:
- `Alphab2bapp/CLAUDE.md` § Sell-auth blocking rule
- `tidi_new/tidistockmobileapp/CLAUDE.md` § Sell-auth blocking rule
- `aq_backend_github/CLAUDE.md` § Sell-auth blocking rule
- `ccxt-india/CLAUDE.md` § Sell-auth blocking rule
- `alphaquark-mobile-sdk/CLAUDE.md` § Sell-auth blocking rule (when added)

A commit that touches a sell-auth surface without updating those CLAUDE.md
references AND this doc is incomplete and must be amended before merging.
