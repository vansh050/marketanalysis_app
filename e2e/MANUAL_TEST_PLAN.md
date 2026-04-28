# Manual Test Plan — AlphaQuark B2B Mobile App (Android)

**Version:** 1.0
**App Package:** com.arpint.alphaquark
**Platform:** Android (Emulator + Physical Device)
**Equivalent Web Tests:** `../prod-alphaquark-github/cypress/e2e/`

---

## Test Environment Setup

| Item | Value |
|------|-------|
| Emulator | Pixel 6 API 34 (Android 14) |
| Test User Email | testuser@alphaquark.in |
| Test User Password | Test@12345 |
| Connected Broker | Zerodha (pre-connected) |
| API Server | https://server.alphaquark.in |
| CCXT Server | https://ccxtprod.alphaquark.in |

---

## 1. AUTHENTICATION (AUTH)

### AUTH-001: App Cold Start
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | App freshly installed, no stored login |
| **Steps** | 1. Launch app from home screen |
| | 2. Wait for splash screen to finish |
| | 3. Observe login screen |
| **Expected** | Splash screen shows, then Login screen with: Email input (placeholder "Email address"), Password input (placeholder "Password"), "Log In" button, "Forgot Password?" link, "Sign in with Google" button, "Sign in with Apple" button, "Don't have an account? Sign Up" link |
| **Pass Criteria** | All elements visible, no crash, no blank screen |

### AUTH-002: Login with Valid Email/Password
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | On Login screen, valid test account exists |
| **Steps** | 1. Tap email field, type "testuser@alphaquark.in" |
| | 2. Tap password field, type "Test@12345" |
| | 3. Tap "Log In" button |
| | 4. Wait for loading to complete |
| **Expected** | Loading indicator appears → Home screen loads with bottom tabs: Home, Orders, Portfolio, [News/Plans], More |
| **Pass Criteria** | Bottom tab bar visible, Home tab active, no error toast |

### AUTH-003: Login with Invalid Email Format
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen |
| **Steps** | 1. Type "notanemail" in email field |
| | 2. Type "anypassword" in password field |
| | 3. Tap "Log In" |
| **Expected** | Error message or toast: "Please enter a valid email" or similar. Does NOT navigate away from login screen |
| **Pass Criteria** | Validation error shown, stays on Login screen |

### AUTH-004: Login with Wrong Password
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen, valid email but wrong password |
| **Steps** | 1. Type valid email "testuser@alphaquark.in" |
| | 2. Type wrong password "WrongPass123" |
| | 3. Tap "Log In" |
| **Expected** | Error toast: "Invalid credentials" or Firebase auth error. Stays on login screen |
| **Pass Criteria** | Error shown, no navigation to home |

### AUTH-005: Login with Empty Fields
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen |
| **Steps** | 1. Leave both fields empty |
| | 2. Tap "Log In" |
| **Expected** | Validation error for required fields |
| **Pass Criteria** | Error shown, no API call made |

### AUTH-006: Password Visibility Toggle
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On Login screen |
| **Steps** | 1. Type "Test@12345" in password field |
| | 2. Observe password is masked (dots) |
| | 3. Tap eye icon to toggle visibility |
| | 4. Observe password text is visible |
| | 5. Tap eye icon again |
| **Expected** | Password toggles between masked and visible |
| **Pass Criteria** | Eye icon works, text toggles correctly |

### AUTH-007: Forgot Password Flow
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen |
| **Steps** | 1. Tap "Forgot Password?" |
| | 2. Observe ResetPassword screen loads |
| | 3. Enter email "testuser@alphaquark.in" |
| | 4. Tap "Send" or "Reset" button |
| **Expected** | ResetPassword screen shows email input → Success message "Reset link sent" or similar |
| **Pass Criteria** | Screen loads, email accepted, success/confirmation shown |

### AUTH-008: Navigate to Signup
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen |
| **Steps** | 1. Tap "Sign Up" link |
| | 2. Observe Signup screen loads |
| | 3. Verify fields: Name, Email, Password, Terms checkbox |
| | 4. Tap back or "Already have an account? Sign In" |
| **Expected** | Signup screen renders with all fields → Returns to Login |
| **Pass Criteria** | Navigation works both ways, no crash |

### AUTH-009: Google Sign-In Button
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Login screen, Google account configured on device |
| **Steps** | 1. Tap "Sign in with Google" |
| | 2. Google account picker should appear |
| **Expected** | Google sign-in dialog opens (native Android dialog) |
| **Pass Criteria** | Dialog appears without crash. (Cancel to avoid actual login in test) |

### AUTH-010: Logout
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in, on any screen |
| **Steps** | 1. Tap "More" bottom tab |
| | 2. Scroll down to find "Logout" |
| | 3. Tap "Logout" |
| | 4. Confirm if dialog appears |
| **Expected** | Returns to Login screen. Bottom tabs disappear. Stored auth cleared |
| **Pass Criteria** | Login screen visible, re-launching app shows login (not home) |

### AUTH-011: Session Persistence
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Successfully logged in |
| **Steps** | 1. Force close the app (swipe from recents) |
| | 2. Re-launch the app |
| **Expected** | Home screen loads directly (skips login). Session restored from AsyncStorage |
| **Pass Criteria** | No login screen on re-launch |

---

## 2. HOME SCREEN & STOCK RECOMMENDATIONS (HOME)

### HOME-001: Home Screen Loads After Login
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in |
| **Steps** | 1. Observe Home screen |
| | 2. Check for stock recommendation cards or "No advice" message |
| **Expected** | Home screen shows either: Trade recommendation cards (BUY/SELL with symbol, qty, price), OR "No advice available" / "Connect your broker" message |
| **Pass Criteria** | Content visible, no blank screen, no crash |

### HOME-002: Stock Recommendation Card Display
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in, advisor has sent recommendations |
| **Steps** | 1. Observe recommendation card |
| | 2. Verify fields: Stock symbol, Exchange (NSE/BSE), Transaction type (BUY/SELL), Quantity, Price range |
| **Expected** | Card shows all trade fields correctly formatted |
| **Pass Criteria** | Symbol visible, BUY/SELL badge colored, quantity is number |

### HOME-003: Tap Recommendation → Review Trade Modal
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Recommendation card visible, broker connected |
| **Steps** | 1. Tap "Execute" / "Place Order" / "Review" button on card |
| | 2. Observe Review Trade modal |
| | 3. Verify: Symbol, Qty (editable), Price, Total amount, BUY/SELL indicator |
| | 4. Do NOT tap confirm — tap close/back |
| **Expected** | Review modal opens with trade details. Qty can be incremented/decremented. Close returns to home |
| **Pass Criteria** | Modal opens/closes, all fields present |

### HOME-004: Review Trade — Quantity Adjustment
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Review Trade modal open |
| **Steps** | 1. Note current quantity |
| | 2. Tap "+" to increase |
| | 3. Verify quantity incremented and total updated |
| | 4. Tap "−" to decrease |
| | 5. Verify quantity decremented and total updated |
| **Expected** | Quantity changes, total recalculates in real-time |
| **Pass Criteria** | Math is correct, min qty = 1 |

### HOME-005: Home Screen Sub-Tabs
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in, on Home screen |
| **Steps** | 1. If sub-tabs exist (Advice, Model Portfolio, Knowledge Hub), tap each |
| | 2. Verify each tab loads its content |
| **Expected** | Each sub-tab shows relevant content without crash |
| **Pass Criteria** | Tab switching works, content loads |

### HOME-006: Pull-to-Refresh
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Home screen |
| **Steps** | 1. Pull down on the screen |
| | 2. Observe loading indicator |
| | 3. Wait for refresh to complete |
| **Expected** | Loading spinner appears, data refreshes, recommendations update |
| **Pass Criteria** | Refresh completes without error |

### HOME-007: Ignore Trade
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Recommendation card visible |
| **Steps** | 1. Tap "Ignore" or swipe to dismiss on a recommendation |
| | 2. Confirm if dialog appears |
| | 3. Verify card removed from list |
| | 4. Navigate to More → Ignored Trades |
| | 5. Verify ignored trade appears there |
| **Expected** | Card removed from home, appears in Ignored Trades list |
| **Pass Criteria** | Trade moves correctly between lists |

---

## 3. ORDERS (ORD)

### ORD-001: Order Screen Loads
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in |
| **Steps** | 1. Tap "Orders" bottom tab |
| | 2. Observe order list |
| **Expected** | Order screen shows with tabs (Placed/Rejected) or order list or "No orders" empty state |
| **Pass Criteria** | Screen loads, no crash |

### ORD-002: Placed Orders Tab
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Orders screen |
| **Steps** | 1. Tap "Placed" / "Executed" tab |
| | 2. Observe order cards |
| | 3. Each card should show: Symbol, Qty, Price, Status (COMPLETE/PENDING), Time |
| **Expected** | Placed orders listed with status badges |
| **Pass Criteria** | Correct statuses (green=complete, yellow=pending, red=rejected) |

### ORD-003: Rejected Orders Tab
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Orders screen |
| **Steps** | 1. Tap "Rejected" / "Failed" tab |
| | 2. Observe rejected order cards |
| | 3. Each card should show: Symbol, Rejection reason |
| **Expected** | Rejected orders listed with error messages |
| **Pass Criteria** | Rejection reasons visible |

### ORD-004: Order Detail View
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Orders exist |
| **Steps** | 1. Tap on an order card |
| | 2. Observe detail view/modal |
| **Expected** | Full order details: Order ID, Symbol, Exchange, Qty, Price, Status, Timestamp, Broker |
| **Pass Criteria** | All fields present, back navigation works |

---

## 4. PORTFOLIO (PORT)

### PORT-001: Portfolio Screen Loads
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in, broker connected with holdings |
| **Steps** | 1. Tap "Portfolio" bottom tab |
| | 2. Observe portfolio summary and holdings list |
| **Expected** | Summary shows: Invested Value, Current Value, P&L (absolute + percentage). Holdings list shows individual stocks |
| **Pass Criteria** | Numbers formatted correctly (₹ symbol, commas), P&L colored (green/red) |

### PORT-002: Holdings List Detail
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Portfolio screen with holdings |
| **Steps** | 1. Observe each holding row |
| | 2. Verify: Symbol, Qty, Avg Price, LTP (live price), P&L |
| **Expected** | Each holding shows real-time LTP (via WebSocket), P&L updates |
| **Pass Criteria** | LTP values present, P&L calculated correctly |

### PORT-003: Multi-Broker Filter
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Multiple brokers connected |
| **Steps** | 1. Tap broker filter dropdown (e.g., "All Brokers") |
| | 2. Select specific broker (e.g., "Zerodha") |
| | 3. Observe holdings filter to that broker only |
| | 4. Select "All" again |
| **Expected** | Holdings filter by broker. "All" shows aggregated view |
| **Pass Criteria** | Filter works, totals recalculate per broker |

### PORT-004: Empty Portfolio State
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in, no broker connected |
| **Steps** | 1. Tap "Portfolio" tab |
| **Expected** | Empty state: "Connect your broker to view holdings" or similar with CTA button |
| **Pass Criteria** | Friendly message, no crash |

### PORT-005: Portfolio Refresh
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On Portfolio screen |
| **Steps** | 1. Pull down to refresh |
| | 2. Wait for API response |
| **Expected** | Holdings and LTP refresh. Loading indicator shows briefly |
| **Pass Criteria** | Refresh completes, data updates |

---

## 5. MODEL PORTFOLIO (MP)

### MP-001: Model Portfolio List Screen
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in, advisor has published model portfolios |
| **Steps** | 1. Navigate to Model Portfolio (via Home tab, drawer, or Plans tab) |
| | 2. Observe strategy cards |
| **Expected** | Strategy cards showing: Name, CAGR/Returns, Risk level, Min Investment, Subscribe/Invest button |
| **Pass Criteria** | At least one strategy card visible |

### MP-002: Strategy Detail View
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On Model Portfolio list |
| **Steps** | 1. Tap on a strategy card |
| | 2. Observe detail screen |
| | 3. Verify: Stock composition table (Symbol, Weight %), Performance chart, Subscribe button |
| | 4. Tap back |
| **Expected** | Detail screen loads with full strategy info |
| **Pass Criteria** | Composition table visible, weights sum to ~100% |

### MP-003: Subscribe to Strategy
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Strategy not yet subscribed, broker connected |
| **Steps** | 1. Tap "Subscribe" / "Invest Now" on a strategy |
| | 2. Observe subscription flow (investment amount, payment, consent) |
| | 3. Do NOT complete payment in test |
| **Expected** | Subscription flow opens: Amount selection → Payment gateway OR broker execution screen |
| **Pass Criteria** | Flow initiates without error. Cancel returns to list |

### MP-004: Rebalance Notification & Execution
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Already subscribed to a strategy, rebalance published |
| **Steps** | 1. Observe rebalance notification/badge on Model Portfolio |
| | 2. Tap to open rebalance review |
| | 3. Verify: BUY trades (new stocks), SELL trades (exit stocks), quantities, prices |
| | 4. Verify fund availability display |
| | 5. Do NOT execute — tap close |
| **Expected** | Rebalance review shows correct BUY/SELL trades matching advisor's published rebalance |
| **Pass Criteria** | Trade list correct, fund info visible, close works |

### MP-005: Rebalance with Insufficient Funds
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Subscribed to strategy, broker has low balance |
| **Steps** | 1. Open rebalance review |
| | 2. Observe fund warning/shortfall message |
| **Expected** | Warning: "Insufficient funds" or "Portfolio shortfall" with current vs required amount. User can still proceed (warning, not blocker) |
| **Pass Criteria** | Warning shown with correct numbers |

### MP-006: Model Portfolio Performance Screen
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Subscribed to strategy |
| **Steps** | 1. Navigate to MP Performance screen |
| | 2. Observe performance metrics |
| **Expected** | Performance chart, CAGR, total return, benchmark comparison |
| **Pass Criteria** | Chart renders, numbers are formatted |

---

## 6. BROKER CONNECTION (BROKER)

### BROKER-001: Broker List Display
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in |
| **Steps** | 1. Navigate to More → Broker Setting (or Subscription screen) |
| | 2. Observe broker list |
| **Expected** | All supported brokers listed: Zerodha, Angel One, Upstox, ICICI Direct, Kotak, Dhan, Fyers, AliceBlue, HDFC Securities, Groww, Motilal Oswal, Axis Securities. IIFL marked as "temporarily unavailable" |
| **Pass Criteria** | All broker names visible with logos |

### BROKER-002: OAuth Broker Connection (Zerodha)
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Zerodha not connected |
| **Steps** | 1. Tap "Zerodha" from broker list |
| | 2. Observe Kite Publisher WebView opens |
| | 3. Verify Zerodha login page loads in WebView |
| | 4. Do NOT login — tap back/close |
| **Expected** | WebView opens with Zerodha login. Closing returns to broker list |
| **Pass Criteria** | WebView loads, close works, no crash |

### BROKER-003: Credential Broker Connection (Dhan)
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Dhan not connected |
| **Steps** | 1. Tap "Dhan" from broker list |
| | 2. Observe credential input form: Client Code, Access Token fields |
| | 3. Enter test values |
| | 4. Do NOT submit — tap close |
| **Expected** | Input form with Client Code and Access Token fields |
| **Pass Criteria** | Form renders, fields accept input |

### BROKER-004: Kotak Connection (TOTP Flow)
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Kotak not connected |
| **Steps** | 1. Tap "Kotak" from broker list |
| | 2. Observe credential form: Consumer Key, Consumer Secret, Mobile Number, MPIN, TOTP, UCC |
| | 3. Verify all 6 fields present |
| **Expected** | All required fields visible for Kotak's complex auth flow |
| **Pass Criteria** | Form renders with all fields |

### BROKER-005: Connected Broker Status
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | At least one broker connected |
| **Steps** | 1. Open broker list |
| | 2. Observe connected broker shows "Connected" / green status |
| | 3. Observe disconnect/reconnect option |
| **Expected** | Connected broker shows active status with option to disconnect |
| **Pass Criteria** | Status indicator correct |

### BROKER-006: Expired Broker Session
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Broker connected yesterday (session expired) |
| **Steps** | 1. Open broker list |
| | 2. Observe expired broker shows "Session Expired" / orange status |
| | 3. Tap to reconnect |
| **Expected** | Expired status shown with "Reconnect" option. Tapping opens auth flow |
| **Pass Criteria** | Correct status, reconnect flow works |

### BROKER-007: IIFL Unavailable Message
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On broker list |
| **Steps** | 1. Find IIFL Securities in list |
| | 2. Tap on it |
| **Expected** | Toast or alert: "IIFL Securities integration is temporarily unavailable. Please use another broker." |
| **Pass Criteria** | User informed, not allowed to proceed |

---

## 7. NAVIGATION (NAV)

### NAV-001: Bottom Tab Navigation
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Logged in |
| **Steps** | 1. Tap "Home" → verify Home content |
| | 2. Tap "Orders" → verify Orders content |
| | 3. Tap "Portfolio" → verify Portfolio content |
| | 4. Tap "More" → verify Settings content |
| | 5. Tap "Home" → verify return to Home |
| **Expected** | Each tab shows correct screen content. Active tab highlighted |
| **Pass Criteria** | All 5 tabs navigate correctly |

### NAV-002: Drawer Navigation
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Swipe from right edge to open drawer |
| | 2. Verify items: Broker Setting, Product Catalog, Model Portfolio, Ignored Trades, Privacy Policy, Terms & Conditions, Logout |
| | 3. Tap "Model Portfolio" → verify screen loads |
| | 4. Go back, re-open drawer |
| | 5. Tap "Ignored Trades" → verify screen loads |
| **Expected** | Drawer opens with all items. Each item navigates correctly |
| **Pass Criteria** | All drawer items work |

### NAV-003: Android Back Button
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in, on a sub-screen |
| **Steps** | 1. Navigate: Home → More → Privacy Policy |
| | 2. Press Android back button |
| | 3. Verify returns to More/Settings screen |
| | 4. Press back again |
| | 5. Verify returns to Home (or stays in app) |
| **Expected** | Back button follows navigation stack. Does NOT exit app from main tabs |
| **Pass Criteria** | Correct back navigation, no premature app exit |

### NAV-004: Deep Link Navigation
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | App installed |
| **Steps** | 1. Open notification that deep links to a specific screen |
| | 2. Verify correct screen opens |
| **Expected** | Deep link navigates to correct screen |
| **Pass Criteria** | Screen matches deep link target |

---

## 8. SETTINGS & LEGAL (SET)

### SET-001: Settings Screen Sections
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Tap "More" bottom tab |
| | 2. Verify sections: Account (profile, email, phone), Insights (notifications, watchlist), Broker Settings, Legal (privacy, terms), Logout |
| **Expected** | All settings menu items visible with correct labels |
| **Pass Criteria** | All items present, tappable |

### SET-002: Account Profile View
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Tap "More" → tap profile/account section |
| | 2. Verify: Name, Email, Phone number displayed |
| **Expected** | User details shown correctly |
| **Pass Criteria** | Email matches logged-in user |

### SET-003: Privacy Policy Page
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On Settings screen |
| **Steps** | 1. Tap "Privacy Policy" |
| | 2. Observe content loads (WebView or ScrollView) |
| **Expected** | Privacy policy text visible, scrollable |
| **Pass Criteria** | Content loads, no blank page |

### SET-004: Terms & Conditions Page
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On Settings screen |
| **Steps** | 1. Tap "Terms & Conditions" |
| | 2. Observe content loads |
| **Expected** | Terms text visible, scrollable |
| **Pass Criteria** | Content loads |

### SET-005: Notification Settings
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | On Settings screen |
| **Steps** | 1. Tap notifications / push notifications |
| | 2. Observe notification list or settings |
| **Expected** | Notification list or "No notifications" empty state |
| **Pass Criteria** | Screen loads |

---

## 9. PAYMENT & SUBSCRIPTION (PAY)

### PAY-001: Plans/Pricing Screen
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Navigate to Plans/Pricing (via tab or Settings) |
| | 2. Observe plan cards |
| **Expected** | Plan cards with: Name, Price (₹), Duration (Monthly/Annual), Features list, "Subscribe" button |
| **Pass Criteria** | Plans displayed with correct pricing |

### PAY-002: Payment Gateway Opens
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | On pricing screen |
| **Steps** | 1. Tap "Subscribe" on a plan |
| | 2. Observe payment gateway (Razorpay/Cashfree) opens |
| | 3. Verify payment options: UPI, Card, Net Banking |
| | 4. Cancel payment (tap X or back) |
| **Expected** | Payment gateway UI appears. Cancel returns to app without error |
| **Pass Criteria** | Gateway opens, cancel works |

### PAY-003: Payment History
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Logged in, previous payments exist |
| **Steps** | 1. Navigate to Payment History screen |
| | 2. Observe invoice list |
| **Expected** | List of invoices with: Date, Amount, Plan name, Status (Paid/Pending) |
| **Pass Criteria** | Invoices listed or empty state |

---

## 10. EDGE CASES & STABILITY (EDGE)

### EDGE-001: No Network / Airplane Mode
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Enable airplane mode |
| | 2. Try navigating to Portfolio tab |
| | 3. Try pull-to-refresh on Home |
| | 4. Disable airplane mode |
| | 5. Pull-to-refresh |
| **Expected** | Offline: Shows error toast "No internet" or cached data. NOT a crash. Online: Data refreshes normally |
| **Pass Criteria** | Graceful offline handling, recovery after reconnect |

### EDGE-002: App Background/Foreground
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | Logged in, on Portfolio screen |
| **Steps** | 1. Press Home button (background app) |
| | 2. Wait 30 seconds |
| | 3. Return to app from recents |
| **Expected** | App resumes on Portfolio screen. Auth session preserved. No re-login required |
| **Pass Criteria** | State preserved, no crash |

### EDGE-003: Rapid Tab Switching
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Rapidly tap: Home → Orders → Portfolio → More → Home (repeat 3x) |
| **Expected** | App remains responsive, no ANR (App Not Responding), no crash |
| **Pass Criteria** | App stable after stress |

### EDGE-004: Screen Rotation
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Logged in, on Portfolio screen |
| **Steps** | 1. Rotate to landscape |
| | 2. Verify content reflows |
| | 3. Rotate back to portrait |
| **Expected** | Content adapts to orientation. No data loss, no crash |
| **Pass Criteria** | Layout works in both orientations |

### EDGE-005: Low Memory / App Kill
| Field | Value |
|-------|-------|
| **Priority** | P2 — Regression |
| **Precondition** | Logged in |
| **Steps** | 1. Open many other apps to pressure memory |
| | 2. Return to AlphaQuark app |
| **Expected** | App either resumes from saved state OR cold starts with session preserved (auto-login) |
| **Pass Criteria** | No crash, auth preserved |

### EDGE-006: Empty States (No Broker)
| Field | Value |
|-------|-------|
| **Priority** | P1 — Regression |
| **Precondition** | New user, no broker connected |
| **Steps** | 1. Navigate to each screen: Home, Orders, Portfolio, Model Portfolio |
| | 2. Verify each shows appropriate empty state |
| **Expected** | Each screen shows: "Connect your broker" or "No data" with CTA button, NOT a crash or blank screen |
| **Pass Criteria** | Friendly empty states on all screens |

### EDGE-007: Broker Session Expired During Trading
| Field | Value |
|-------|-------|
| **Priority** | P0 — Smoke |
| **Precondition** | Broker connected but token expired |
| **Steps** | 1. Try to execute a trade recommendation |
| | 2. Observe error handling |
| **Expected** | Toast: "Session Expired. Please reconnect your broker." Trade NOT executed |
| **Pass Criteria** | Error caught, user informed, no partial execution |

---

## Test Summary

| Category | P0 (Smoke) | P1 (Regression) | P2 (Low) | Total |
|----------|-----------|-----------------|----------|-------|
| Authentication | 3 | 5 | 3 | 11 |
| Home/Trading | 3 | 4 | 0 | 7 |
| Orders | 1 | 2 | 1 | 4 |
| Portfolio | 1 | 3 | 1 | 5 |
| Model Portfolio | 3 | 2 | 1 | 6 |
| Broker Connection | 1 | 4 | 2 | 7 |
| Navigation | 1 | 2 | 1 | 4 |
| Settings | 0 | 1 | 4 | 5 |
| Payment | 0 | 2 | 1 | 3 |
| Edge Cases | 1 | 3 | 3 | 7 |
| **Total** | **14** | **28** | **17** | **59** |
