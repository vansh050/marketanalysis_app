# AlphaPro App - Complete File Catalog

## 📁 Files Organized by Screen/Feature

This document catalogs all files in the AlphaPro app organized by their functionality and screen.

---

## 🏠 HOME SCREEN FILES

### Main Screen
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `HomeScreen.js` | 71.7 KB | **Main home screen** - Dashboard with all sections |
| `QuotesCorousel.js` | 3.8 KB | Stock quotes carousel display |
| `PushNotificationScreen.js` | 57.5 KB | Push notification handler and display |
| `NotificationScreen.js` | 4.3 KB | Notification list screen |
| `ProfileScreen.js` | 471 B | User profile screen |

### Home Screen Components
**Location:** `/src/components/HomeScreenComponents/`

| File Name | Size | Description |
|-----------|------|-------------|
| `BestPerformerSection.js` | 11.6 KB | **Best performing stocks** section |
| `BestPerformerscard.js` | 5.9 KB | Individual best performer card |
| `KnowledgeHub.js` | 39.7 KB | **Educational content hub** |
| `EducationalBlogs.js` | 18.2 KB | **Blog articles** display and modal |
| `EducationalVideos.js` | 12.1 KB | **Video tutorials** display and player |
| `EducationalPDF.js` | 16.3 KB | **PDF resources** viewer and downloader |
| `AllEducationalBlogs.js` | 5.1 KB | Full list of all blogs |
| `AllEducationalVideos.js` | 6.6 KB | Full list of all videos |
| `AllEducationalPDF.js` | 6.1 KB | Full list of all PDFs |
| `AlphaQuarkBanner.js` | 3.8 KB | Promotional banner component |
| `MarketIndices.js` | 7.4 KB | Market indices display (Nifty, Sensex) |
| `ExploreSection.js` | 4.3 KB | Explore features section |
| `AllPlansDetails.js` | 16.0 KB | **All subscription plans** display |
| `PlanCard.js` | 6.9 KB | Individual plan card component |

### Knowledge Hub Screens
**Location:** `/src/components/HomeScreenComponents/KnowledgeHubScreen/`

| File Name | Description |
|-----------|-------------|
| (4 files) | Detailed knowledge hub sub-screens |

---

## 💡 TRADING & ADVICES FILES

### Advice Components
**Location:** `/src/components/AdviceScreenComponents/`

| File Name | Size | Description |
|-----------|------|-------------|
| `StockAdvices.js` | 99.5 KB | **Main stock advice component** - Bespoke recommendations |
| `StockAdviceContent.js` | 30.1 KB | Stock advice card content |
| `RebalanceAdvices.js` | 28.5 KB | **Rebalance recommendations** component |
| `RebalanceAdviceContent.js` | 24.9 KB | Rebalance card content |
| `RebalanceModal.js` | 33.8 KB | Rebalance execution modal |
| `RebalanceDetailsModal.js` | 4.2 KB | Rebalance details popup |
| `AddtoCartModal.js` | 49.1 KB | **Add stocks to cart** modal |
| `AdviceCartScreen.js` | 3.1 KB | Shopping cart for trades |
| `MPStatusModal.js` | 66.3 KB | Model portfolio status modal |
| `NewsCard.js` | 2.6 KB | News article card |
| `EducationalCard.js` | 3.3 KB | Educational content card |
| `EducationalContent.js` | 7.2 KB | Educational content display |
| `StockCardLoading.js` | 19.7 KB | Loading state for stock cards |
| `ReviewTradeText.js` | 2.1 KB | Trade review text component |
| `ReviewTradeTextRebalance.js` | 2.4 KB | Rebalance review text |
| `RepairConfimationModal.js` | 2.5 KB | Failed trade repair confirmation |
| `DummyBrokerHoldingConfirmation.js` | 8.2 KB | Broker holdings confirmation |
| `Checkbox.js` | 775 B | Custom checkbox component |
| `websocketPriceMP.js` | 6.0 KB | WebSocket for real-time prices |
| `ref.js` | 4.2 KB | Reference utilities |

### UI Components for Rebalance
**Location:** `/src/UIComponents/RebalanceAdvicesUI/`

| File Name | Description |
|-----------|-------------|
| `RebalanceCard.js` | Rebalance action card — execution status guards, button state derivation, broker-match logic |

### Dynamic Price Updates
**Location:** `/src/components/AdviceScreenComponents/DynamicText/`

| Contents | Description |
|----------|-------------|
| 21 files | Real-time price update components for different brokers |

---

## 💼 MODEL PORTFOLIO FILES

### Main Screens
**Location:** `/src/screens/Drawer/`

| File Name | Size | Description |
|-----------|------|-------------|
| `ModelPortfolioScreen.js` | 35.4 KB | **Main model portfolio screen** |
| `MPPerformanceScreen.js` | 62.0 KB | **Model portfolio performance** analytics |
| `BespokePerformanceScreen.js` | 60.7 KB | **Bespoke strategy performance** |
| `IgnoreTradesScreen.js` | 50.3 KB | Ignored trades management |
| `ProductCatalogScreen.js` | 17.5 KB | **Product/Plan catalog** |
| `SubscriptionsScreen.js` | 385 B | Subscriptions overview |
| `EmptyStateMP.js` | 1.1 KB | Empty state for model portfolios |
| `CustomTabbar.js` | 1.4 KB | Custom tab bar component |
| `CustomTabbarMPPerformance.js` | 2.0 KB | Tab bar for performance screen |
| `DistributionRowGrid.js` | 11.3 KB | Portfolio distribution grid |

### Model Portfolio Components
**Location:** `/src/components/ModelPortfolioComponents/`

| File Name | Size | Description |
|-----------|------|-------------|
| `MPCard.js` | 20.9 KB | **Model portfolio card** |
| `MPCardBespoke.js` | 18.4 KB | **Bespoke portfolio card** |
| `MPInvestNowModal.js` | 134 KB | **Investment execution modal** (largest file!) |
| `MPReviewTradeModal.js` | 29.8 KB | Trade review before execution |
| `UserStrategySubscribeModal.js` | 37.7 KB | **Strategy subscription modal** |
| `RecommendationSuccessModal.js` | 18.9 KB | Success confirmation modal |
| `PerformanceChart.js` | 15.2 KB | **Performance charts** component |
| `PricingCard.js` | 3.6 KB | Pricing display card |
| `RebalanceTimelineModal.js` | 4.9 KB | Rebalance history timeline |
| `DisclaimerModal.js` | 18.8 KB | Legal disclaimer modal |
| `ConsentPopUp.js` | 2.7 KB | User consent popup |
| `DigioModal.js` | 9.5 KB | Digio e-sign integration |
| `PaymentSuccessModal.js` | 3.4 KB | Payment success screen |
| `DatePickerSection.js` | 2.9 KB | Date picker component |
| `VerificationMethodCheck.js` | 5.0 KB | Verification method selector |

---

## 📋 ORDERS FILES

### Order Management
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `OrderScreen.js` | 32.2 KB | **Main orders screen** - All order history |
| `HistoryScreen.js` | 25.3 KB | **Trading history** screen |
| `PlacedOrderLoadingCard.js` | 1.8 KB | Loading state for placed orders |
| `PositionLTPText.js` | 6.8 KB | Live trading price (LTP) display |

### Order Tab Components
**Location:** `/src/screens/Drawer/`

| File Name | Size | Description |
|-----------|------|-------------|
| `CustomTabbarOrder.js` | 1.4 KB | Custom tab bar for orders screen |

---

## 💰 PAYMENT & SUBSCRIPTION FILES

### Payment Screens
**Location:** `/src/screens/Drawer/`

| File Name | Size | Description |
|-----------|------|-------------|
| `PaymentHistoryScreen.js` | 12.8 KB | **Payment history** - All past payments |

### Subscription & Purchase
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `SubscriptionScreen.js` | 17.8 KB | **Subscription management** screen |
| `AfterSubscriptionScreen.js` | 24.9 KB | Post-subscription success screen |
| `TokenPurchaseModal.js` | 9.6 KB | Token/credit purchase modal |
| `TerminateStrategyModal.js` | 6.8 KB | Strategy cancellation modal |

---

## 📊 PORTFOLIO FILES

### Portfolio Screen
**Location:** `/src/screens/PortfolioScreen/`

| File Name | Size | Description |
|-----------|------|-------------|
| `PortfolioScreen.js` | 57.9 KB | **Main portfolio screen** |
| `PortFolioCard.js` | 4.9 KB | Portfolio summary card |
| `PortFolioCard2.js` | 6.2 KB | Alternative portfolio card |
| `ModelPFCard.js` | 8.5 KB | Model portfolio card |
| `HoldingScoreModal.js` | 8.4 KB | Holdings quality score modal |
| `EmptyMessageCard.js` | 3.9 KB | Empty state message |

---

## 📰 NEWS FILES

### News Screens
**Location:** `/src/screens/Home/NewsScreen/`

| File Name | Size | Description |
|-----------|------|-------------|
| `NewsScreen.js` | 36.1 KB | **Main news screen** - AI-powered search |
| `NewsInfoScreen.js` | 10.5 KB | Individual news article screen |
| `LinkOpeningWeb.js` | 5.3 KB | Web view for external links |

### News Search
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `NewsSearch.js` | 12.6 KB | News search functionality |

---

## 🔐 AUTHENTICATION FILES

### Auth Screens
**Location:** `/src/screens/Authentication/`

| File Name | Description |
|-----------|-------------|
| `LoginScreen.js` | User login screen |
| `SignupScreen.js` | New user registration |
| `PhoneNumberScreen.js` | Phone verification |
| `SignUpRADetails.js` | Additional registration details |
| `TermsModal.js` | Terms and conditions modal |

---

## ⚙️ SETTINGS & ACCOUNT FILES

### Account Settings
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `AccountSettingsScreen.js` | 11.6 KB | **Account settings** screen |

**Location:** `/src/screens/AccountSettingScreen/`

| File Name | Size | Description |
|-----------|------|-------------|
| `ChangeAdvisor.js` | (size) | Change advisor functionality |

### App Settings
**Location:** `/src/screens/Drawer/`

| File Name | Size | Description |
|-----------|------|-------------|
| `PrivacyPolicyScreen.js` | 3.5 KB | Privacy policy |
| `TermandConditionsScreen.js` | 3.6 KB | Terms and conditions |
| `ReviewScreen.js` | 6.8 KB | App review/rating screen |

---

## 🔗 BROKER CONNECTION FILES

### Broker Modals
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `BrokerSelectionModal.js` | 16.2 KB | **Broker selection** modal |
| `BrokerConnectCard.js` | 3.2 KB | Broker connection card |
| `ReviewTradeModal.js` | 48.8 KB | **Generic trade review** modal |
| `ReviewZerodhaTradeModal.js` | 47.0 KB | **Zerodha-specific** review modal |
| `IIFLReviewTradeModal.js` | 13.6 KB | **IIFL-specific** review modal |
| `BasketTradeModal.js` | 25.5 KB | **Basket trading** modal |
| `DdpiModal.js` | 66.0 KB | DDPI (Demat Debit) authorization |
| `TokenExpireBrokerModal.js` | 11.8 KB | Broker token expiry handler |
| `iiflmodal.js` | 6.7 KB | IIFL connection modal |
| `iiflproceedmodal.js` | 7.6 KB | IIFL proceed modal |
| `Kotakproceedmodal.js` | 8.9 KB | Kotak proceed modal |

### Broker Connection Components
**Location:** `/src/components/BrokerConnectionModal/`

| Contents | Description |
|----------|-------------|
| 15 files | Broker-specific connection components for different brokers |

### Broker Errors
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `BrokerConnectionError.js` | 2.1 KB | Broker connection error screen |
| `DisconnectBrokerModal.js` | 3.0 KB | Broker disconnection modal |

---

## 🛠️ SHARED COMPONENTS

### Navigation & Layout
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `Navigation.js` | 37.7 KB | **Main app navigation** |
| `CustomToolbar.js` | 11.7 KB | **Custom toolbar** component |
| `BottomSheetModal.js` | 5.1 KB | Bottom sheet modal |
| `ScreenWrapper.js` | 408 B | Screen wrapper component |
| `SplashScreen.js` | 4.2 KB | App splash screen |

### Modals & Popups
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `ProfileModal.js` | 19.1 KB | User profile modal |
| `ProfileModalHelp.js` | 8.0 KB | Help section in profile |
| `DeleteAdviceModal.js` | 2.6 KB | Delete advice confirmation |
| `IgnoreAdviceModal.js` | 3.4 KB | Ignore advice confirmation |
| `RebalanceChangeDetailModal.js` | 11.5 KB | Rebalance change details |
| `NotificationListScreen.js` | 3.6 KB | Notification list |
| `SocialProofPopup.js` | 1.6 KB | Social proof notifications |

### UI Components
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `CustomFlatlist.js` | 2.6 KB | Custom FlatList component |
| `LoadingSpinner.jsx` | 823 B | Loading spinner |
| `SliderButton.js` | 4.4 KB | Slide to confirm button |
| `IgnoreStockCard.js` | 10.9 KB | Ignored stock card |
| `GlassmorphicText.js` | 1.2 KB | Glassmorphic text effect |
| `LogoSection.js` | 1.6 KB | Logo display component |
| `VideoPlayer.js` | 755 B | Video player component |
| `WebViewScreen.js` | 2.2 KB | WebView component |
| `customToast.js` | 290 B | Custom toast notification |
| `reviewModalitem.js` | 1.3 KB | Review modal item |

---

## 🔄 CONTEXT & STATE MANAGEMENT

### Context Providers
**Location:** `/src/screens/` and `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `TradeContext.js` | 34.6 KB | **Main trading context** - Global state |
| `configContext.js` | 1.7 KB | App configuration context |
| `CartContext.js` | 405 B | Shopping cart context |
| `ModalContext.js` | 683 B | Modal state context |
| `SocialProofProvider.js` | 2.5 KB | Social proof context |
| `InactivityContext.js` | 1.7 KB | User inactivity tracker |
| `AppProvider.js` | 384 B | App-level provider |

### Drawer Context
**Location:** `/src/screens/Drawer/`

| File Name | Size | Description |
|-----------|------|-------------|
| `investContext.js` | 370 B | Investment context |
| `use.js` | 3.3 KB | Custom hooks |

---

## 📊 ADDITIONAL SCREENS

### Watchlist
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `WatchlistScreen.js` | 39.5 KB | **Main watchlist** screen |
| `WatchlistScreen-old.js` | 17.3 KB | Old version (backup) |
| `WishSearch.js` | 22.3 KB | Wishlist search |

### Research & Reports
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `ResearchReportScreen.js` | 25.0 KB | **Research reports** screen |

### Investment Modification
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `ModifyInvestment1.js` | 14.6 KB | Modify investment amount |

### Guides & Help
**Location:** `/src/screens/Home/`

| File Name | Size | Description |
|-----------|------|-------------|
| `stepGuideModal.js` | 5.2 KB | Step-by-step guide modal |

### Notifications
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `NatificationServiceNav.js` | 557 B | Notification service navigation |

### Event Handling
**Location:** `/src/components/`

| File Name | Size | Description |
|-----------|------|-------------|
| `EventEmitter.js` | 106 B | Event emitter utility |

---

## 📈 CUSTOM TAB COMPONENTS

**Location:** `/src/components/CustomHomeTabs/`

| Contents | Description |
|----------|-------------|
| 1 file | Custom home tab component |

---

## 🧰 UTILITY FILES

**Location:** `/src/utils/`

| File Name | Description |
|-----------|-------------|
| `basketUtils.js` | FnO basket utilities: `parseExpiryFromSymbol`, `isBasketExpired`, `netBasketTrades` (ported from web) |
| `brokerAuth.js` | OAuth state generation, nonce management, callback registration |
| `brokerPublisher.js` | Publisher SDK utilities (Kite, Fyers) |
| `brokerSessionUtils.js` | Broker session validation, token freshness checks |
| `brokerSupport.js` | Per-broker feature matrix (order types, GTT, OCO) |
| `ProcessTrades.js` | Centralized order placement pipeline |
| `rebalanceHelpers.js` | Rebalance error detection, broker payload builder, decryption |
| `orderStatusUtils.js` | Order status normalization across brokers |
| `portfolioEvents.js` | Structured event emitter for portfolio lifecycle |
| `tradeUtils.js` | Trade data standardization |
| `SecurityTokenManager.js` | JWT token generation |
| `storageUtils.js` | AsyncStorage wrapper with retry logic |
| `serverConfig.js` | Server endpoints configuration |
| `Config.js` | App variant configuration |
| `isMarketHours.js` | Market hours check (9:15 AM - 3:30 PM IST) |

---

## 📊 FILE STATISTICS

### By Feature Area

| Feature Area | Number of Files | Total Size |
|--------------|----------------|------------|
| **Home Screen** | 26 files | ~250 KB |
| **Trading & Advices** | 21 files | ~400 KB |
| **Model Portfolio** | 15 files | ~450 KB |
| **Orders** | 4 files | ~65 KB |
| **Payment** | 4 files | ~50 KB |
| **Portfolio** | 6 files | ~90 KB |
| **News** | 4 files | ~65 KB |
| **Authentication** | 5 files | ~30 KB |
| **Broker Connection** | 15 files | ~250 KB |
| **Shared Components** | 30+ files | ~200 KB |

### Largest Files

1. `MPInvestNowModal.js` - 134 KB (Model Portfolio investment)
2. `StockAdvices.js` - 99.5 KB (Stock recommendations)
3. `HomeScreen.js` - 71.7 KB (Main home screen)
4. `DdpiModal.js` - 66.0 KB (DDPI authorization)
5. `MPStatusModal.js` - 66.3 KB (Model portfolio status)

---

## 🗂️ DIRECTORY STRUCTURE SUMMARY

```
src/
├── screens/
│   ├── Home/ (26 files)
│   │   └── NewsScreen/ (3 files)
│   ├── Drawer/ (17 files)
│   ├── PortfolioScreen/ (6 files)
│   ├── Authentication/ (5 files)
│   ├── AccountSettingScreen/ (1 file)
│   ├── TradeContext.js
│   └── configContext.js
│
└── components/
    ├── AdviceScreenComponents/ (21 files)
    │   └── DynamicText/ (21 files)
    ├── HomeScreenComponents/ (15 files)
    │   └── KnowledgeHubScreen/ (4 files)
    ├── ModelPortfolioComponents/ (15 files)
    ├── BrokerConnectionModal/ (15 files)
    ├── CustomHomeTabs/ (1 file)
    └── [40+ shared component files]
```

---

## 🎯 Quick Reference by User Journey

### New User Journey
1. `SplashScreen.js` → `LoginScreen.js` → `SignupScreen.js` → `PhoneNumberScreen.js` → `HomeScreen.js`

### Trading Journey
1. `HomeScreen.js` → `StockAdvices.js` → `AddtoCartModal.js` → `ReviewTradeModal.js` → `OrderScreen.js`

### Model Portfolio Journey
1. `HomeScreen.js` → `ModelPortfolioScreen.js` → `MPCard.js` → `UserStrategySubscribeModal.js` → `MPInvestNowModal.js`

### Payment Journey
1. `SubscriptionScreen.js` → `PaymentSuccessModal.js` → `PaymentHistoryScreen.js`

### Learning Journey
1. `HomeScreen.js` → `KnowledgeHub.js` → `EducationalBlogs.js` / `EducationalVideos.js` / `EducationalPDF.js`

---

**Last Updated:** April 2026  
**Total Files Cataloged:** 150+  
**Total Code Size:** ~2+ MB
