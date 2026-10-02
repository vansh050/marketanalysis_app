# Web MP Parity Tasks — Open Work for `prod-alphaquark-github`

> **Source:** Mobile MP audit completed 2026-05-11. This doc captures gaps where mobile has shipped UX that web doesn't yet have. Each task is self-contained — the web team should be able to pick one up without re-doing the analysis.
> **Mobile canonical:** `docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (this repo).
> **Web canonical:** `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (independent, ~80 K, last touched 2026-04-28).
> **Backend reference:** `aq_backend_github` + `ccxt-india`. Routes referenced here exist on production today.

---

## 🟡 Task 1 — Manual placement recovery in `MPStatusModal` (partially done 2026-05-11)

**Status update 2026-05-11:** Web ALREADY had a working manual-confirm flow via a checkbox per failed row → `PUT /rebalance/update/user-portfolio/latest/keys` (ccxt-india side). The original 🔴 framing was wrong — web isn't blocked, the UX is just less flexible than mobile's per-row editor.

What was missing: advisor-side stamping (`model_portfolio.rebalanceHistory[].adviceEntries[].status → "executed"` + `manually_placed_at`). Without this, the advisor dashboard still showed the row as failed after the user manually placed it. **Fixed 2026-05-11**: `MPStatusModal.confirmManualOrders` now also calls `PUT /api/model-portfolio-db-update/manual-placement` per confirmed stock (best-effort, idempotent). `RebalanceCard` threads `modelId={modelPortfolioModelId}` through. See web `docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 8.1` for full flow.

**Still TODO (downgraded from 🔴 to 🟡):**
- Per-row qty + price editor instead of checkbox-only — currently web confirms with the displayed qty/price from the failed-order record. Mobile lets the user override (e.g. "I had less capital so I placed 5 not 10"). This is a UX polish, not a blocker.

Sections below describe the original full port if web wants to swap UX from checkbox to inline editor.

**Mobile reference:** `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js`
- Inline qty/price editor: `:82-95`, `:669-…`
- `POST /rebalance/resolve-single-order` call: `:190`
- `PUT /api/model-portfolio-db-update/manual-placement` call: `:290`
- Toast + local row mutation: `:317-345`

**Backend (already exists, idempotent):**
- `aq_backend_github/Routes/modalPortfolioOrderPlace.js:141` — `PUT /manual-placement`
- `ccxt-india/apps/app_model_portfolio.py` — `POST /rebalance/resolve-single-order`

**Web target file:** `prod-alphaquark-github/src/Home/ModelPortfolioSection/MPStatusModal.js`

**Payload shapes (from mobile callsites):**

```js
// PUT /api/model-portfolio-db-update/manual-placement
{
  userEmail,
  modelId,
  modelName,
  uniqueId,
  user_broker,             // string — current broker name e.g. "Zerodha"
  symbol: item.symbol || item.tradingSymbol,
  exchange: item.exchange,
  transactionType: item.transactionType,   // "BUY" | "SELL"
  actualQty: number,
  actualPrice: number      // optional — blank or non-negative
}

// Response (idempotent):
{ message, symbol, actualQty, actualPrice,
  executionStatus: "executed" | "partial",
  idempotent: boolean }     // true if entry was already executed
```

**Local UI mutation pattern after success** (so the user sees the row flip without re-fetching):

```js
// In your local results state:
{
  ...prevRow,
  orderStatus: 'manually_placed',   // counts as success in isOrderPending()
  orderPlacement: 'success',
  quantity: qtyNum,
  ...(priceNum !== null ? { price: priceNum } : {}),
  message_aq: 'Manually placed',
  orderStatusMessage: 'Marked as manually placed.',
}
```

**Acceptance criteria:**
- [ ] Inline "Mark as placed" button on every FAILURE row in `MPStatusModal`.
- [ ] Editor exposes qty (required) + price (optional, blank or non-negative).
- [ ] On submit: `PUT /api/model-portfolio-db-update/manual-placement`, mutate row locally, show success toast.
- [ ] On idempotent response: still mutate row locally (treat as success).
- [ ] On error: toast with error message, leave row state unchanged.
- [ ] Gate UI on presence of `modelId` (mobile gates at L674).
- [ ] Emit refresh event in your equivalent of `portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, ...)` after success.

**Estimated effort:** ~half day. Mostly JSX porting.

**Cross-repo docs to update:**
- `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 7` (manual override).
- `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 14` add manual-placement row.

---

## 🟡 Task 2 — Cautionary-listing + LOW_FUNDS classification banners

**Severity:** Functional gap. Web users see generic rejection toasts; they don't get the structured "these specific stocks are cautionary, you need to place them manually" or "you need ₹X more in your account" guidance. Mobile renders both, including an Angel-One-specific funds-required parser.

**Mobile reference:** `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js`
- Cautionary-listing filter: `:389-409` — matches `cautionary` AND `listing` in `orderStatusMessage`.
- LOW_FUNDS filter: `:410-469` — matches:
  - `classification: 'LOW_FUNDS'` on response (set by ccxt-india / backend SDK route)
  - `insufficient fund` / `low fund` / `insufficient margin` / `insufficient balance` in the message
- Angel One funds parser: extracts `Available funds - Rs. {x} . You require Rs. {y}` and sums Required across all rejected rows. Negative Available is rendered red (margin debit).

**Web target file:** `prod-alphaquark-github/src/Home/ModelPortfolioSection/MPStatusModal.js`

**Why both banners can render together:** a single batch can hit both reasons (production case 2026-04-29 Angel One: 7 cautionary + 19 LOW_FUNDS).

**Acceptance criteria:**
- [ ] Yellow cautionary-listing banner listing affected stocks as pills, with copy: "Place these manually via your broker app."
- [ ] Red insufficient-funds banner with summed Required amount when parseable.
- [ ] Status header summary reflects which banners are showing (not a stale "some orders are pending" claim).
- [ ] Both banners can co-render on the same execution.

**Estimated effort:** ~1 day.

**Cross-repo docs to update:**
- `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 13` (error handling).

---

## 🟡 Task 3 — Stale-broker banner on portfolio holdings tab

**Severity:** Functional gap. When a user switches their connected broker, the backend creates a fresh empty `model_portfolio_user` doc for the new broker. The aq_backend `subscription-raw-amount` endpoint falls back to ANY broker if the current broker has no record — so web silently displays old-broker holdings on the Portfolio Holdings tab. Mobile detects this and shows a yellow warning banner.

**Mobile reference:** `src/screens/Home/AfterSubscriptionScreen.js`
- Detection logic: `:159` (`isStalebrokerData` flag)
- Banner render: `:603`
- Detection condition: CCXT returns empty for current broker BUT `subscription-raw-amount` returns data from another broker. Set true.

**Web target file:** Likely `prod-alphaquark-github/src/Home/ModelPortfolioSection/` — equivalent of mobile's AfterSubscriptionScreen, currently called `AfterSubscriptionScreen` or similar.

**Acceptance criteria:**
- [ ] Yellow banner appears on Portfolio Holdings tab when current-broker CCXT response is empty AND subscription endpoint returns wrong-broker data.
- [ ] Banner copy explains the user is seeing stale data; offer "View holdings for [old broker]" or "Connect [current broker]" CTA.

**Estimated effort:** ~1 hour.

---

## 🟡 Task 4 — Repair-trades UI (mobile-side gap; web mostly implemented)

**Severity:** Functional gap on mobile. **Web is mostly done.** The original "both clients partial" framing was inaccurate — see "Current state" below. Decisions captured 2026-05-11; ready to implement on mobile.

### Current state (corrected)

**Web — implemented ✅:**
- `prod-alphaquark-github/src/Home/LivePortfolioSection/Home.js:364-393` auto-calls `POST /rebalance/get-repair` once per portfolio load, stores result in `modelPortfolioRepairTrades` state.
- `ModalPFList.js:236-239` matches each MP card to its repair entry by `modelId === latest.model_Id` and `failedTrades.length > 0`; sets `repair="repair"` prop on the affected `ModalPFCard`.
- `RebalanceCard.js:672-727` — when user clicks Accept/Retry on a repair-flagged card, bypasses fresh `/rebalance/calculate`, builds `repairBuy[]` / `repairSell[]` directly from `failedTrades`, opens `UpdateRebalanceModal` with the delta pre-populated.
- `skipRepairRef` (`RebalanceCard.js:143`) bypasses repair-mode if the user explicitly accepts a fresh rebalance, so a new advisor publish naturally moves the user off the repair shortcut.

**Mobile — endpoint wired, UI absent ❌:**
- `src/services/ModelPortfolioService.js` exposes the get-repair call but no component invokes it.
- `RebalanceCard.js` only knows `status === 'partial'` from the user's execution record and shows "Retry Rebalance"; clicking goes through the normal `/rebalance/calculate` path — which recomputes from scratch against the *advisor's current target*, not the original failed-trades delta.

### Backend (existing)

`POST /rebalance/get-repair` — `ccxt-india/apps/app_model_portfolio.py:1375`
- Request: `{ modelName[], advisor, userEmail, userBroker }`
- Response: `{ status, message, models: [{ modelName, uniqueId, userBroker, failedTrades[], message, modelId }] }`
- DummyBroker is excluded (route returns 404). `db_manager.repair()` excludes rows already executed (including those flipped to executed by mobile/web manual-placement § Task 1).

### Decisions (2026-05-11)

| Question | Decision |
|---|---|
| Semantics | **Option A — port web's pattern.** Re-attempt the *specific orders* that failed last time, exact same qty/exchange. Backend already excludes manually-placed rows. |
| New-rebalance bypass | Adopt web's `skipRepairRef` pattern. The natural progression — when the advisor publishes a new rebalance, the user moves to it; we surface the new rebalance, not the stale repair. |
| Cautionary / GSM / restricted-scrip rows | **Show them but mark visually as "likely to fail again"** and prompt manual placement (using the same § Task 1 manual-placement editor). Both surfaced and labelled, not hidden. |
| Price / LTP refresh | **Re-fetch LTP on repair-modal open.** Display fresh prices; keep qty unchanged. (Get-repair returns failed-trades quantity but no current price; we fetch via `MarketDataContext` / `useWebSocketCurrentPrice`.) |
| Stale-rebalance TTL | **No explicit TTL.** When the advisor publishes a new rebalance, the user does the new rebalance. The repair shortcut effectively expires because the user has a fresher Accept action available; we never need a time-based hide. |

### Mobile implementation plan

**Files to touch (mobile):**
1. `src/screens/TradeContext.js` — fetch repair-trades on the same load cycle as `getModelPortfolioStrategyDetails` (mirror web's `Home.js` pattern). Expose `modelPortfolioRepairTrades` from the context.
2. `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` — read repair state, match against the card's `model_Id`, pass a `repair` prop / boolean into the click handler. Build `repairBuy[]` / `repairSell[]` from `failedTrades` when the user taps "Retry Rebalance" on a repair-flagged card; skip fresh `/rebalance/calculate`; open `RebalanceModal` (or `MPReviewTradeModal`) with pre-populated delta.
3. `src/components/AdviceScreenComponents/RebalanceModal.js` (or the MP review modal) — on repair-mode open, refresh LTP via `MarketDataContext` for each repair symbol; show updated price next to original failed-rebalance price for transparency.
4. `RebalanceCard.js` — visual marker on rows that match known-bad statuses (cautionary listing / restricted scrip / GSM). Pull the categorisation helper used by `RecommendationSuccessModal.js:389-409` so the matching rule is shared, not duplicated. Show a "Place this manually" CTA on those rows that opens the § Task 1 manual-placement editor.
5. `skipRepairRef`-equivalent: mobile already has `rebalanceBrokerModalOpenedAt` for unrelated intent TTL (§ 5f in canonical doc). Add a similar `skipRepairRef = useRef(false)` set to true when the user clicks Accept on a non-repair card.
6. CHANGELOG entry + canonical doc update (new § 6g or extend § 6c on repair UI behaviour).

**Backend touches:** None. Endpoint + categorisation rules already in place.

**Mobile acceptance criteria:**
- [ ] On portfolio load, `get-repair` is called once; failures don't block the rest of the load.
- [ ] `RebalanceCard` shows the repair shortcut only when `failedTrades.length > 0` AND user's execution record allows it.
- [ ] Click on repair-flagged Retry opens `MPReviewTradeModal`/`RebalanceModal` with `repairBuy[]`/`repairSell[]` pre-populated.
- [ ] LTP is refreshed inside the modal; original failed-rebalance price still visible for transparency.
- [ ] Cautionary / GSM / restricted-scrip rows are marked with a visual chip and a CTA to open the manual-placement editor.
- [ ] Bypass: when user clicks Accept on a non-repair (fresh) card, `skipRepairRef.current = true` for that session.
- [ ] No TTL needed — repair shortcut naturally fades when a new rebalance lands.

### Web acceptance criteria

Web is already implemented except for the cautionary-marking + LTP-refresh refinements:

- [ ] `UpdateRebalanceModal` re-fetches LTP on open in repair mode (currently displays original failed-rebalance price unchanged).
- [ ] Cautionary / GSM rows are visually marked and offer a "place manually" CTA → opens § Task 1 manual-placement editor on that row only.

**Cross-repo docs to update:**
- Mobile canonical: `docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6` — new sub-section documenting the repair pattern.
- Web canonical: `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` — extend with cautionary-marking + LTP-refresh notes when those land.

**Estimated effort:**
- Mobile: ~1-1.5 days (the bulk of the work; auto-fetch + card flagging + delta-pre-populate + cautionary marking + LTP refresh).
- Web refinements: ~half day (cautionary marking + LTP refresh on existing flow).

---

## 🟡 Task 5 — SDK execute path (Phase C)

**Severity:** Architecture parity, not user-visible regression. Mobile is gated on `REACT_APP_USE_SDK_EXECUTE_ADVICE=true` and routes through `sdkClient.executeAdvice({kind: 'mpRebalance', ...})` → `POST /sdk/v1/orders/place-rebalance` (which runs the full post-execution chain). Web has zero SDK execute consumers — always hits legacy `/rebalance/process-trade`. This means Phase C feature-flag flips don't affect web.

**Web target file:** `prod-alphaquark-github/src/Home/ModelPortfolioSection/UpdateRebalanceModal.js`

**Mobile reference:** `src/components/ModelPortfolioComponents/MPReviewTradeModal.js:436, 1375`

**Acceptance criteria:**
- [ ] Web `UpdateRebalanceModal` reads `REACT_APP_USE_SDK_EXECUTE_ADVICE`.
- [ ] When true, calls SDK execute (need to add SDK client to web bundle).
- [ ] Falls back to legacy `/rebalance/process-trade` on SDK failure.
- [ ] Both lanes get the post-execution chain (DB update + subscriber-execution + status-check-queue).

**Estimated effort:** Larger — depends on whether SDK client is web-bundled today. ~1-2 days if SDK is web-ready; up to a week if it needs porting.

**Cross-repo docs to update:**
- `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 12` (SDK integration).
- `docs/SDK_INTEGRATION_GUIDE.md § 16` (parity divergences table — mobile-only RN today).

---

## 🟢 Task 6 — Doc parity reminder (not work, just a process)

**Severity:** Process. Three MP architecture docs exist and they drift:
- `Alphab2bapp/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (mobile canonical, last touched 2026-05-11)
- `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (web independent, last touched 2026-04-28)
- `ccxt-india/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (pointer-grade, last touched per repo)

**Recommendation:** any MP backend or schema change should update **all three** in the same commit cycle. Same pattern as the existing SDK orchestration mirror docs (`docs/SDK_ORCHESTRATION_REFERENCE.md` in sibling repos).

---

## Open questions for product

1. ~~**Repair UX** (Task 4)~~ — resolved 2026-05-11. Option A (port web's pattern with cautionary marking + LTP refresh). Spec in § Task 4.
2. **SDK execute on web** (Task 5) — is web ever expected to consume `@alphaquark/mobile-sdk`, or do we maintain two parallel implementations indefinitely? If the former, prioritise; if the latter, archive Task 5.
3. **Multi-broker UI** — both clients single-broker today. Schema supports per-broker docs. Out of scope here; tracked in `MODEL_PORTFOLIO_ARCHITECTURE.md § 17.6`.

---

## How to use this doc

- Pick a task, file an issue in the web repo with the file:line refs from above.
- Update `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` § 14 row in the same PR (per the doc parity rule).
- Strike through completed tasks here; link the PR.

| Task | Owner | Status | PR |
|---|---|---|---|
| 🟡 1 — Manual placement | claude | advisor-side stamping done 2026-05-11; per-row qty/price editor still open | _local commit pending_ |
| 🟡 2 — Cautionary + LOW_FUNDS banners | _unassigned_ | open | _none_ |
| 🟡 3 — Stale-broker banner | _unassigned_ | open | _none_ |
| 🟡 4 — Repair-trades UI | claude | mobile fully shipped 2026-05-11 (wiring + delta + LTP refresh + cautionary chip + Mark-as-Placed CTA); web refinements still open | _local_ |
| 🟡 5 — SDK execute path | _blocked on architecture decision_ | open | _none_ |
| 🟢 6 — Doc parity process | n/a | recurring | n/a |
