# GTT Mobile Cert Checklist — newly-enabled brokers (Groww / Angel One / Dhan / ICICI Direct)

**Created:** 2026-07-13 · **Owner:** _(assign)_
**Why this exists:** the 2026-07-13 GTT reconciliation (`src/utils/gttSupport.js` +
`StockAdvices.js`, see CHANGELOG) switched the mobile customer-GTT gate from the
stale hardcoded `['upstox','zerodha']` list to the shared-truth `isGttNativeBroker`.
That turned **Zerodha customer-GTT OFF** (unambiguously safe — no cert needed) and
turned **Groww, Angel One, Dhan, ICICI Direct ON**. Those four have **never placed a
GTT via the mobile app** and MUST pass the per-broker cert below before going
customer-live, per web **`docs/GTT_ARCHITECTURE.md §6`** (the platform certification
playbook — this doc is the mobile-side execution of it).

> 🔴 **Do NOT ship the four newly-enabled brokers to customers until each row of §3
> is signed off.** Server-side lifecycle is already built + enforce-mode on web
> (ccxt `buy_sell_gtt_all_brokers.py`, poller adapters); the OPEN risk is the
> **mobile GTT credential payload** (see §2), which web does not share.

---

## 1. Per-broker capability (from `gttSupport.js` — the gate you're certifying)

| Broker | Native? | Equity GTT | F&O GTT | OCO (SL+PT) | Notes |
|---|---|---|---|---|---|
| **Upstox** | yes (already live) | ✅ | ✅ | ✅ | Baseline — already certified in prod. |
| **Groww** | yes (NEW) | ✅ | ✅ | ✅ | Full GTT + OCO. |
| **Angel One** | yes (NEW) | ✅ | ❌ | ❌ | SmartAPI: equity **single-trigger only**. An OCO leg → routes to regular. |
| **Dhan** | yes (NEW) | ✅ | ✅ | ❌ | Forever Order: **single-trigger only**. OCO leg → regular. |
| **ICICI Direct** | yes (NEW) | ❌ | ✅ | ✅ | Breeze: **F&O only**. An equity GTT leg → routes to regular. |
| **Zerodha** | **NO** (now OFF) | — | — | — | Kite Publisher can't place GTT; gttCheck orders place as REGULAR. No cert needed — verify §4 instead. |

`isGttNativeBroker(broker, exchange, isOco)` enforces the per-leg gating above. A
leg outside a broker's capability is NOT native and falls into `regularOrders`.

---

## 2. 🔴 Mobile-specific pre-req — GTT credential payload (do this FIRST, once per broker)

Web and mobile build the GTT order payload **differently**. Mobile's GTT switch
(`StockAdvices.js` `getOrderPayload(isGtt=true)`) sends **decrypted** credentials
via `checkValidApiAnSecret` (AES-decrypt), whereas the mobile REGULAR path sends
raw. The four new GTT cases were added mirroring each broker's regular-payload
credential SHAPE, but the decrypt-vs-raw convention for these brokers on the GTT
path was **not verifiable from the frontend**. Confirm on first live-fire:

For each broker, capture the outbound request to
`{ccxtServer}/{broker}/process-trades` (proxy/log) for a GTT order and confirm the
ccxt handler **accepts and authenticates** the credential shape mobile sends:

| Broker | GTT payload sends (mobile) | Confirm ccxt accepts |
|---|---|---|
| Groww | `{trades, user_broker, user_email, jwtToken}` | ☐ |
| Dhan | `+ clientCode, jwtToken` | ☐ |
| Angel One | `+ apiKey:angelOneApiKey (config, NOT decrypted), secretKey:decrypted, jwtToken` | ☐ |
| ICICI Direct | `+ apiKey:decrypted, secretKey:decrypted, jwtToken` | ☐ |

If a broker's GTT handler expects a DIFFERENT convention (e.g. raw secretKey), fix
the case in `StockAdvices.js` before proceeding to §3. **A wrong credential shape
fails silently as a rejected/unplaced GTT — this is the single most likely
failure mode.**

---

## 3. Cert procedure — run per broker (mirrors GTT_ARCHITECTURE §6)

Pre-conditions: a real test account connected to the broker on a real build, small
funds, a valid liquid symbol (equity **and** an F&O contract for ICICI/Dhan/Groww),
market data flowing.

### 3a. Place + cancel cert (any time, incl. off-market)
1. From an advice with `gttCheck=true`, execute as this broker's customer.
2. Confirm the mobile UI routes it as GTT (not regular) for the correct segment
   (equity for Groww/Angel; **F&O for ICICI**; equity+F&O for Dhan/Groww).
3. Verify the trigger appears in the **broker's own GTT/Forever-order book** with the
   right symbol / qty / trigger price / side.
4. Cancel it (broker side or app) → confirm it disappears and the poller flips
   `CANCELLED` with a Telegram alert ≤ 2 min (`basketDerivativeStatusPoll.js`).
   → **Proves:** creds, placement, id-match, status vocab, record-back, alert.

### 3b. Live-fire cert (market hours, 1 share/lot)
1. Place a GTT with a trigger **just off CMP** so it fires quickly.
2. On fire: poller shows `TRIGGERED`, the fired order id is attributed back through
   the canonical writers, and the customer's book matches the broker (C4).
   → **Proves:** the fired-trigger → order-id path (the invisible-fill risk).

### 3c. Segment / OCO gating (negative-routing cert)
- **ICICI Direct:** send an **equity** gttCheck order → confirm it routes to
  **regular** (NOT a native GTT). Send an **F&O** one → native GTT. ✅ = `isGttNativeBroker` segment gate works.
- **Angel One / Dhan:** send an **OCO** advice (SL + PT set together, `isGttOcoLeg`
  true) → confirm the OCO leg routes to **regular** (never an unlinked
  double-exit), and a single-trigger leg routes native.
- **Groww / Upstox:** OCO leg routes native (both support OCO).

### 3d. Negative cert (shared)
- Dead/expired token → order fails-soft (no crash, clear error), poller skips.
- Unknown broker status → loud alert, no silent drop.

---

## 4. Zerodha regression check (no cert — just verify OFF)
Zerodha customer-GTT is now OFF. Verify: a Zerodha customer executing a
`gttCheck=true` advice **places REGULAR orders** (the console logs the OFF message
in `StockAdvices.js`), and **no** GTT is attempted against Kite. The advisor-side
synthetic price-alert rail carries the trigger intent.

---

## 5. Sign-off table

| Broker | §2 payload OK | 3a place+cancel | 3b live-fire | 3c segment/OCO | 3d negative | Date | Tester | Go-live |
|---|---|---|---|---|---|---|---|---|
| Groww | ☐ | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| Angel One | ☐ | ☐ | ☐ | ☐ (single-only) | ☐ | | | ☐ |
| Dhan | ☐ | ☐ | ☐ | ☐ (single-only) | ☐ | | | ☐ |
| ICICI Direct | ☐ | ☐ | ☐ | ☐ (F&O only) | ☐ | | | ☐ |
| Zerodha (OFF) | n/a | n/a | n/a | §4 verify ☐ | n/a | | | n/a |

Only flip a broker customer-live after its whole row is ✅. Enablement is per-broker
— certify and ship them independently; do not batch.

## Changelog
| Date | Change |
|------|--------|
| 2026-07-13 | Created alongside the mobile GTT reconciliation (Zerodha OFF; Groww/Angel/Dhan/ICICI ON via `isGttNativeBroker`). Mirrors GTT_ARCHITECTURE §6; adds the mobile-specific §2 credential-payload pre-req. |
