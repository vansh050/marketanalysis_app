# API Reference Documentation

## Table of Contents
- [Authentication APIs](#authentication-apis)
- [Trading APIs](#trading-apis)
- [Model Portfolio APIs](#model-portfolio-apis)
- [User Management APIs](#user-management-apis)
- [Educational Content APIs](#educational-content-apis)
- [Notification APIs](#notification-apis)
- [Broker Integration APIs](#broker-integration-apis)
- [Payment APIs](#payment-apis)
- [Advisor Configuration APIs](#advisor-configuration-apis)

---

## Base URLs

```javascript
// Main Server
const MAIN_SERVER = 'https://your-server.com/';

// CCXT Server (Trading & Broker Integration)
const CCXT_SERVER = 'https://your-ccxt-server.com/';
```

## Authentication Headers

All API requests require the following headers:

```javascript
{
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': 'your-subdomain',
  'aq-encrypted-key': 'generated-token'
}
```

**Token Generation:**
```javascript
import { generateToken } from '../utils/SecurityTokenManager';

const token = generateToken(
  Config.REACT_APP_AQ_KEYS,
  Config.REACT_APP_AQ_SECRET
);
```

---

## Authentication APIs

### 1. Get User Details

**Endpoint:** `GET /api/user/getUser/:email`

**Description:** Fetch user profile information

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/user/getUser/${userEmail}`,
  { headers }
);
```

**Response:**
```json
{
  "User": {
    "email": "user@example.com",
    "name": "John Doe",
    "phone_number": "9876543210",
    "advisor": "AlphaQuark",
    "broker": "zerodha",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## Trading APIs

### 1. Get All Trades

**Endpoint:** `POST /api/trades/get`

**Description:** Fetch all trading recommendations for a user

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  advisor: "AlphaQuark"
};

const response = await axios.post(
  `${CCXT_SERVER}api/trades/get`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "trades": [
    {
      "trade_id": "TRD123456",
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "type": "BUY",
      "quantity": 10,
      "price": 2500.50,
      "target": 2700.00,
      "stop_loss": 2400.00,
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "advice_type": "bespoke"
    }
  ]
}
```

### 2. Execute Trade

**Endpoint:** `POST /api/trades/execute`

**Request:**
```javascript
const payload = {
  trade_id: "TRD123456",
  userEmail: "user@example.com",
  broker: "zerodha",
  quantity: 10,
  price: 2500.50
};
```

**Response:**
```json
{
  "success": true,
  "order_id": "ORD789012",
  "message": "Trade executed successfully"
}
```

### 3. Ignore Trade

**Endpoint:** `POST /api/trades/ignore`

**Request:**
```javascript
const payload = {
  trade_id: "TRD123456",
  userEmail: "user@example.com",
  reason: "Not interested"
};
```

### 4. Mark Trade as Manually Placed

**Endpoint:** `PUT /api/recommendation`

**Description:** Mark a bespoke trade as manually placed (user placed outside the app). Used by the "Continue without broker" flow in StockAdvices.

**Request:**
```javascript
const payload = {
  uid: "trade_id",           // trade._id or trade.tradeId
  trade_place_status: "manually_placed"
};

const response = await axios.put(
  `${MAIN_SERVER}api/recommendation`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true
}
```

**Notes:** This is called in a loop for each selected trade when the user confirms manual placement. After all PUTs complete, `getAllTrades()` is called to refresh the recommendation list.

---

## Model Portfolio APIs

### 1. Get Model Portfolio Strategies

**Endpoint:** `POST /rebalance/get-strategies`

**Description:** Fetch all model portfolio strategies for a user

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  advisor: "AlphaQuark"
};

const response = await axios.post(
  `${CCXT_SERVER}rebalance/get-strategies`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "strategies": [
    {
      "model_name": "Aggressive Growth",
      "model_id": "MDL001",
      "advisor": "AlphaQuark",
      "subscription_status": "active",
      "last_updated": "2024-01-15T00:00:00Z",
      "model": {
        "rebalanceHistory": [
          {
            "rebalanceDate": "2024-01-15",
            "model_Id": "MDL001",
            "stocks": [
              {
                "symbol": "RELIANCE",
                "action": "BUY",
                "quantity": 10,
                "weight": 15.5
              }
            ],
            "subscriberExecutions": [
              {
                "user_email": "user@example.com",
                "status": "pending",
                "executed_at": null
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 2. Get Rebalance Repair Trades

**Endpoint:** `POST /rebalance/get-repair`

**Description:** Fetch failed trades that need repair

**Request:**
```javascript
const payload = {
  modelName: ["Aggressive Growth", "Conservative"],
  advisor: "AlphaQuark",
  userEmail: "user@example.com",
  userBroker: "zerodha"
};

const response = await axios.post(
  `${CCXT_SERVER}rebalance/get-repair`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "models": [
    {
      "modelId": "MDL001",
      "modelName": "Aggressive Growth",
      "failedTrades": [
        {
          "symbol": "RELIANCE",
          "quantity": 10,
          "reason": "Insufficient funds",
          "failed_at": "2024-01-15T10:30:00Z"
        }
      ]
    }
  ]
}
```

### 3. Execute Rebalance

**Endpoint:** `POST /rebalance/execute`

**Request:**
```javascript
const payload = {
  model_id: "MDL001",
  rebalance_date: "2024-01-15",
  userEmail: "user@example.com",
  broker: "zerodha"
};
```

---

## User Management APIs

### 1. Update User Profile

**Endpoint:** `PUT /api/user/update`

**Request:**
```javascript
const payload = {
  email: "user@example.com",
  name: "John Doe",
  phone_number: "9876543210"
};
```

### 2. Get User Holdings

**Endpoint:** `POST /api/holdings/get`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  broker: "zerodha"
};
```

**Response:**
```json
{
  "holdings": [
    {
      "symbol": "RELIANCE",
      "quantity": 10,
      "average_price": 2450.00,
      "current_price": 2500.50,
      "pnl": 505.00,
      "pnl_percentage": 2.06
    }
  ]
}
```

### 3. Get User Funds

**Endpoint:** `POST /api/funds/get`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  broker: "zerodha"
};
```

**Response:**
```json
{
  "funds": {
    "available_cash": 50000.00,
    "used_margin": 25000.00,
    "available_margin": 75000.00
  }
}
```

---

## Educational Content APIs

### 1. Get Blogs

**Endpoint:** `GET /api/blogs`

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/blogs`,
  { headers }
);
```

**Response:**
```json
{
  "blogs": [
    {
      "id": "BLG001",
      "title": "Understanding Stock Market Basics",
      "description": "A comprehensive guide...",
      "image_base64": "data:image/jpeg;base64,...",
      "content": "Full blog content...",
      "created_at": "2024-01-15T00:00:00Z",
      "author": "John Doe"
    }
  ]
}
```

### 2. Get Videos

**Endpoint:** `GET /api/videos`

**Response:**
```json
{
  "videos": [
    {
      "id": "VID001",
      "title": "Technical Analysis Tutorial",
      "youtube_url": "https://youtube.com/watch?v=...",
      "thumbnail": "https://...",
      "duration": "15:30",
      "created_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

### 3. Get PDFs

**Endpoint:** `GET /api/pdfs`

**Response:**
```json
{
  "pdfs": [
    {
      "id": "PDF001",
      "title": "Trading Strategies Guide",
      "file_url": "https://...",
      "file_size": "2.5 MB",
      "created_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

---

## Notification APIs

### 1. Save FCM Token

**Endpoint:** `PUT /comms/fcm/save`

**Description:** Save Firebase Cloud Messaging token for push notifications

**Request:**
```javascript
const payload = {
  email: "user@example.com",
  fcm_token: "firebase-token-string"
};

const response = await axios.put(
  `${CCXT_SERVER}comms/fcm/save`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token saved successfully"
}
```

### 2. Get Notifications

**Endpoint:** `GET /api/notifications/:email`

**Response:**
```json
{
  "notifications": [
    {
      "id": "NOT001",
      "title": "New Trade Recommendation",
      "body": "RELIANCE - BUY",
      "type": "bespoke",
      "read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Broker Integration APIs

### 1. Connect Broker

**Endpoint:** `POST /broker/connect`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  broker: "zerodha",
  access_token: "broker-access-token",
  refresh_token: "broker-refresh-token"
};
```

### 2. Disconnect Broker

**Endpoint:** `POST /broker/disconnect`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  broker: "zerodha"
};
```

### 3. Refresh Broker Token

**Endpoint:** `POST /broker/refresh-token`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  broker: "zerodha",
  refresh_token: "broker-refresh-token"
};
```

### 4. Get Broker Status

**Endpoint:** `GET /broker/status/:email`

**Response:**
```json
{
  "broker": "zerodha",
  "connected": true,
  "token_valid": true,
  "expires_at": "2024-01-16T00:00:00Z"
}
```

---

## Payment APIs

### 1. Create Payment Order

**Endpoint:** `POST /api/payment/create-order`

**Request:**
```javascript
const payload = {
  userEmail: "user@example.com",
  plan_id: "PLN001",
  amount: 999.00,
  currency: "INR"
};
```

**Response:**
```json
{
  "order_id": "ORD123456",
  "amount": 999.00,
  "currency": "INR",
  "payment_gateway": "cashfree",
  "payment_session_id": "session_123"
}
```

### 2. Verify Payment

**Endpoint:** `POST /api/payment/verify`

**Request:**
```javascript
const payload = {
  order_id: "ORD123456",
  payment_id: "PAY789012",
  signature: "payment-signature"
};
```

**Response:**
```json
{
  "success": true,
  "subscription_active": true,
  "valid_until": "2025-01-15T00:00:00Z"
}
```

### 3. Get Payment History

**Endpoint:** `GET /api/payment/history/:email`

**Response:**
```json
{
  "payments": [
    {
      "order_id": "ORD123456",
      "amount": 999.00,
      "status": "success",
      "plan_name": "Premium Monthly",
      "payment_date": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Advisor Configuration APIs

These APIs manage advisor-specific configurations including Digio settings, theme customization, and feature flags.

### Complete Configuration Schema

The advisor configuration includes the following fields:

| Category | Field | Type | Description |
|----------|-------|------|-------------|
| **Basic Info** | `subdomain` | string | Unique identifier (e.g., 'zamzamcapital') |
| | `appName` | string | Display name of the app |
| **Contact** | `email` | string | General contact email |
| | `supportEmail` | string | Support email |
| | `contactEmail` | string | Contact form email |
| | `adminEmail` | string | Admin notifications email |
| **Auth** | `googleWebClientId` | string | Google OAuth client ID |
| **Digio** | `digioCheck` | enum | 'beforePayment' or 'afterPayment' |
| | `digioEnabled` | boolean | Enable/disable Digio (default: true) |
| | `otpBasedAuthentication` | boolean | Use OTP instead of Aadhaar |
| **Features** | `modelPortfolioEnabled` | boolean | Enable model portfolios |
| | `bespokePlansEnabled` | boolean | Enable bespoke plans |
| **Payment** | `paymentPlatform` | enum | 'razorpay' or 'cashfree' |
| | `razorpayKey` | string | Razorpay API key |
| | `cashfreeAppId` | string | Cashfree App ID |
| **API Keys** | `advisorSpecificTag` | string | Advisor tag for API calls |
| | `advisorRaCode` | string | RA code (e.g., 'INA000123456') |
| **Branding** | `themeColor` | hex | Primary theme color |
| | `logo` | URL | Main logo image |
| | `toolbarlogo` | URL | Toolbar logo image |
| | `mainColor` | hex | Main app color |
| | `secondaryColor` | hex | Secondary color |
| | `gradient1` | hex | Gradient start |
| | `gradient2` | hex | Gradient end |
| | `placeholderText` | hex | Placeholder text color |
| **Layout** | `homeScreenLayout` | enum | 'layout1' or 'layout2' |
| **Cards** | `cardBorderWidth` | number | Card border width |
| | `cardElevation` | number | Card shadow elevation |
| | `cardVerticalMargin` | number | Card vertical margin |
| **Navigation** | `tabIconColor` | hex | Tab icon color |
| | `bottomTabBorderTopWidth` | number | Tab bar border width |
| | `bottomTabBg` | hex | Tab bar background |
| | `selectedTabColor` | hex | Selected tab color |
| **Basket** | `basket1` | hex | Basket gradient start |
| | `basket2` | hex | Basket gradient end |
| | `basketColor` | hex | Basket main color |
| | `basketSymbolBg` | hex | Basket symbol background |
| **Payment Modal** | `paymentModal` | object | See below |
| **Empty State** | `emptyStateUi` | object | See below |

**Payment Modal Object:**
```json
{
  "headerBg": "#0056B7",
  "stepActiveColor": "#0056B7",
  "stepCompletedColor": "#29A400",
  "buttonPrimaryBg": "#0056B7",
  "buttonSecondaryBg": "#0056B7",
  "accentColor": "#0056B7",
  "checkboxActiveColor": "#29A400",
  "linkColor": "#0056B7",
  "progressBarColor": "#0056B7"
}
```

**Empty State UI Object:**
```json
{
  "backgroundColor": "#6B1400",
  "darkerColor": "#3A0B00",
  "mediumColor": "#4D2418",
  "brighterColor": "#8B2500",
  "mutedColor": "#5A3327",
  "lightColor": "#F8E8E5",
  "mediumLightShade": "#F5DDD8",
  "lightWarmColor": "#E4F1FE"
}
```

---

### 1. Get Advisor Config by Subdomain

**Endpoint:** `GET /api/app-advisor/get?appSubdomain={subdomain}`

**Description:** Fetch complete advisor configuration by subdomain

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/app-advisor/get?appSubdomain=zamzamcapital`,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subdomain": "zamzamcapital",
    "appName": "Zamzam Capital",
    "email": "info@zamzam.com",
    "supportEmail": "support@zamzam.com",
    "contactEmail": "contact@zamzam.com",
    "adminEmail": "admin@zamzam.com",
    "googleWebClientId": "xxx.apps.googleusercontent.com",
    "digioCheck": "beforePayment",
    "digioEnabled": true,
    "otpBasedAuthentication": false,
    "modelPortfolioEnabled": true,
    "bespokePlansEnabled": true,
    "paymentPlatform": "razorpay",
    "razorpayKey": "rzp_xxx",
    "advisorSpecificTag": "ZAMZAM",
    "advisorRaCode": "INA000123456",
    "themeColor": "#1E40AF",
    "logo": "https://cdn.example.com/zamzam-logo.png",
    "toolbarlogo": "https://cdn.example.com/zamzam-toolbar.png",
    "mainColor": "#0D021F",
    "secondaryColor": "#ffffff",
    "gradient1": "#F0F0F0",
    "gradient2": "#773D9A",
    "placeholderText": "#B893F1",
    "homeScreenLayout": "layout1",
    "cardBorderWidth": 1.5,
    "cardElevation": 0,
    "cardVerticalMargin": 3,
    "tabIconColor": "#fff",
    "bottomTabBorderTopWidth": 0,
    "bottomTabBg": "#242424",
    "selectedTabColor": "#8555EF",
    "basket1": "#6A29CA",
    "basket2": "#4F0A9E",
    "basketColor": "#600CC0",
    "basketSymbolBg": "#6D0DD6",
    "paymentModal": {
      "headerBg": "#0056B7",
      "stepActiveColor": "#0056B7",
      "stepCompletedColor": "#29A400",
      "buttonPrimaryBg": "#0056B7",
      "buttonSecondaryBg": "#0056B7",
      "accentColor": "#0056B7",
      "checkboxActiveColor": "#29A400",
      "linkColor": "#0056B7",
      "progressBarColor": "#0056B7"
    },
    "emptyStateUi": {
      "backgroundColor": "#6B1400",
      "darkerColor": "#3A0B00",
      "mediumColor": "#4D2418",
      "brighterColor": "#8B2500",
      "mutedColor": "#5A3327",
      "lightColor": "#F8E8E5",
      "mediumLightShade": "#F5DDD8",
      "lightWarmColor": "#E4F1FE"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  }
}
```

### 2. Get Advisor Config by RA Code

**Endpoint:** `GET /api/advisor-config-env/getConfig/{raCode}`

**Description:** Fetch advisor configuration by RA code

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/advisor-config-env/getConfig/INA000123456`,
  { headers }
);
```

**Response:**
```json
{
  "config": {
    "REACT_APP_ADVISOR_SPECIFIC_TAG": "ZAMZAM",
    "REACT_APP_HEADER_NAME": "zamzamcapital",
    "REACT_APP_DIGIO_CHECK": "beforePayment",
    "REACT_APP_DIGIO_ENABLED": "true",
    "REACT_APP_OTP_BASED_AUTHENTICATION": "false"
  },
  "advisorName": "Zamzam Capital"
}
```

### 3. Create Advisor Config

**Endpoint:** `POST /api/app-advisor/create`

**Description:** Create a new advisor configuration. Fails if subdomain already exists.

**Request:**
```javascript
const payload = {
  subdomain: "newadvisor",
  appName: "New Advisor App",
  themeColor: "#1E40AF",
  digioCheck: "afterPayment",
  digioEnabled: true,
  otpBasedAuthentication: false,
  modelPortfolioEnabled: true,
  bespokePlansEnabled: true,
  paymentPlatform: "razorpay",
  apiKeys: {
    advisorSpecificTag: "NEWADV",
    advisorRaCode: "INA000654321"
  }
};

const response = await axios.post(
  `${MAIN_SERVER}api/app-advisor/create`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subdomain": "newadvisor",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Advisor config created successfully"
}
```

### 4. Update Advisor Config

**Endpoint:** `PUT /api/app-advisor/update`

**Description:** Update existing advisor configuration

**Request:**
```javascript
const payload = {
  subdomain: "zamzamcapital",
  themeColor: "#2563EB",
  digioCheck: "afterPayment"
};

const response = await axios.put(
  `${MAIN_SERVER}api/app-advisor/update`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Advisor config updated successfully"
}
```

### 5. Update Digio Configuration

**Endpoint:** `PUT /api/app-advisor/update-digio`

**Description:** Update Digio-specific configuration for an advisor

**Request:**
```javascript
const payload = {
  subdomain: "zamzamcapital",
  REACT_APP_DIGIO_CHECK: "afterPayment",    // 'beforePayment' or 'afterPayment'
  REACT_APP_DIGIO_ENABLED: true,            // Enable/disable Digio entirely
  REACT_APP_OTP_BASED_AUTHENTICATION: false // Use OTP instead of Aadhaar
};

const response = await axios.put(
  `${MAIN_SERVER}api/app-advisor/update-digio`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Digio config updated successfully"
}
```

**Digio Configuration Options:**

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `REACT_APP_DIGIO_CHECK` | string | `beforePayment`, `afterPayment` | When to trigger Digio verification |
| `REACT_APP_DIGIO_ENABLED` | boolean | `true`, `false` | Enable/disable Digio for advisor |
| `REACT_APP_OTP_BASED_AUTHENTICATION` | boolean | `true`, `false` | Use OTP instead of Aadhaar verification |

**Digio Flow Based on Configuration:**

- `beforePayment`: Select Plan → **Digio Verification** → Payment → Success
- `afterPayment`: Select Plan → Payment → **Digio Verification** → Success

### 6. Update Theme Configuration

**Endpoint:** `PUT /api/app-advisor/update-theme`

**Description:** Update theme/branding configuration for an advisor (colors, layout, styling)

**Request:**
```javascript
const payload = {
  subdomain: "zamzamcapital",
  // Branding & Theme Colors
  themeColor: "#1E40AF",
  mainColor: "#0D021F",
  secondaryColor: "#ffffff",
  gradient1: "#F0F0F0",
  gradient2: "#773D9A",
  placeholderText: "#B893F1",
  logo: "https://cdn.example.com/logo.png",
  toolbarlogo: "https://cdn.example.com/toolbar-logo.png",
  // Layout
  homeScreenLayout: "layout1",  // 'layout1' or 'layout2'
  // Card Styling
  cardBorderWidth: 1.5,
  cardElevation: 0,
  cardVerticalMargin: 3,
  // Bottom Tab Styling
  tabIconColor: "#fff",
  bottomTabBorderTopWidth: 0,
  bottomTabBg: "#242424",
  selectedTabColor: "#8555EF",
  // Basket Colors
  basket1: "#6A29CA",
  basket2: "#4F0A9E",
  basketColor: "#600CC0",
  basketSymbolBg: "#6D0DD6",
  // Nested objects (optional)
  paymentModal: {
    headerBg: "#0056B7",
    stepActiveColor: "#0056B7",
    stepCompletedColor: "#29A400",
    buttonPrimaryBg: "#0056B7",
    buttonSecondaryBg: "#0056B7",
    accentColor: "#0056B7",
    checkboxActiveColor: "#29A400",
    linkColor: "#0056B7",
    progressBarColor: "#0056B7"
  },
  emptyStateUi: {
    backgroundColor: "#6B1400",
    darkerColor: "#3A0B00",
    mediumColor: "#4D2418",
    brighterColor: "#8B2500",
    mutedColor: "#5A3327",
    lightColor: "#F8E8E5",
    mediumLightShade: "#F5DDD8",
    lightWarmColor: "#E4F1FE"
  }
};

const response = await axios.put(
  `${MAIN_SERVER}api/app-advisor/update-theme`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Theme config updated successfully"
}
```

### 7. Update Feature Flags

**Endpoint:** `PUT /api/app-advisor/update` (with feature flag fields)

**Description:** Update feature flags for an advisor

**Request:**
```javascript
const payload = {
  subdomain: "zamzamcapital",
  modelPortfolioEnabled: true,
  bespokePlansEnabled: true
};

const response = await axios.put(
  `${MAIN_SERVER}api/app-advisor/update`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Feature flags updated successfully"
}
```

### 8. Update Payment Configuration

**Endpoint:** `PUT /api/app-advisor/update` (with payment fields)

**Description:** Update payment gateway configuration for an advisor

**Request:**
```javascript
const payload = {
  subdomain: "zamzamcapital",
  paymentPlatform: "razorpay",  // 'razorpay' or 'cashfree'
  razorpayKey: "rzp_live_xxx",
  cashfreeAppId: "xxx",
  cashfreeSecretKey: "xxx"  // Will be encrypted on backend
};

const response = await axios.put(
  `${MAIN_SERVER}api/app-advisor/update`,
  payload,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Payment config updated successfully"
}
```

### 9. List All Advisor Configs (Admin)

**Endpoint:** `GET /api/app-advisor/list`

**Description:** List all advisor configurations (admin only)

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/app-advisor/list`,
  { headers }
);
```

**Response:**
```json
{
  "data": [
    {
      "subdomain": "zamzamcapital",
      "appName": "Zamzam Capital",
      "digioCheck": "beforePayment"
    },
    {
      "subdomain": "alphaquark",
      "appName": "AlphaQuark",
      "digioCheck": "afterPayment"
    }
  ],
  "count": 2
}
```

### 10. Delete Advisor Config

**Endpoint:** `DELETE /api/app-advisor/delete?subdomain={subdomain}`

**Description:** Delete an advisor configuration

**Request:**
```javascript
const response = await axios.delete(
  `${MAIN_SERVER}api/app-advisor/delete?subdomain=oldadvisor`,
  { headers }
);
```

**Response:**
```json
{
  "success": true,
  "message": "Advisor config deleted successfully"
}
```

---

## Best Performers API

### Get Best Performers

**Endpoint:** `GET /api/bestperformers`

**Request:**
```javascript
const response = await axios.get(
  `${CCXT_SERVER}api/bestperformers`,
  {
    headers,
    params: {
      advisor: "AlphaQuark",
      period: "1M" // 1D, 1W, 1M, 3M, 6M, 1Y
    }
  }
);
```

**Response:**
```json
{
  "performers": [
    {
      "symbol": "RELIANCE",
      "returns": 15.5,
      "period": "1M",
      "current_price": 2500.50,
      "change": 325.50
    }
  ]
}
```

---

## WebSocket APIs

### Real-time Price Updates

**Connection:**
```javascript
import io from 'socket.io-client';

const socket = io(CCXT_SERVER, {
  transports: ['websocket'],
  query: {
    userEmail: 'user@example.com'
  }
});

// Subscribe to symbols
socket.emit('subscribe', {
  symbols: ['RELIANCE', 'TCS', 'INFY']
});

// Listen for updates
socket.on('price_update', (data) => {
  console.log(data);
  // { symbol: 'RELIANCE', ltp: 2500.50, change: 1.2 }
});
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 200 | Success | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Invalid or missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

---

## Rate Limiting

- **Rate Limit:** 100 requests per minute per user
- **Burst Limit:** 20 requests per second

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

---

## Pagination

For endpoints that return lists:

**Request:**
```javascript
const response = await axios.get(
  `${MAIN_SERVER}api/trades`,
  {
    headers,
    params: {
      page: 1,
      limit: 20,
      sort: 'created_at',
      order: 'desc'
    }
  }
);
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Testing APIs

### Using Postman

1. Import the API collection
2. Set environment variables:
   - `BASE_URL`
   - `API_KEY`
   - `API_SECRET`
3. Generate auth token
4. Make requests

### Using cURL

```bash
curl -X POST https://your-server.com/api/trades/get \
  -H "Content-Type: application/json" \
  -H "X-Advisor-Subdomain: your-subdomain" \
  -H "aq-encrypted-key: your-token" \
  -d '{"userEmail": "user@example.com", "advisor": "AlphaQuark"}'
```

---

**Last Updated:** December 2024

---

## Backend Implementation Notes (for supportAQ / aq_backend_github)

### Database Collection: `app_advisors`

The backend should use a single collection to store all advisor configurations. This integrates with the existing advisor management system.

### Required MongoDB Schema:

```javascript
const advisorConfigSchema = new mongoose.Schema({
  // Unique identifier
  subdomain: { type: String, required: true, unique: true, lowercase: true },

  // Basic Info
  appName: { type: String, default: '' },

  // Contact Info
  email: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  adminEmail: { type: String, default: '' },

  // Authentication
  googleWebClientId: { type: String, default: '' },

  // Digio Configuration
  digioCheck: { type: String, enum: ['beforePayment', 'afterPayment'], default: 'beforePayment' },
  digioEnabled: { type: Boolean, default: true },
  otpBasedAuthentication: { type: Boolean, default: false },

  // Feature Flags
  modelPortfolioEnabled: { type: Boolean, default: true },
  bespokePlansEnabled: { type: Boolean, default: true },

  // Payment Configuration
  paymentPlatform: { type: String, enum: ['razorpay', 'cashfree'], default: 'cashfree' },
  razorpayKey: { type: String, default: '' },
  cashfreeAppId: { type: String, default: '' },
  cashfreeSecretKey: { type: String, default: '' },

  // API Keys (nested)
  apiKeys: {
    advisorSpecificTag: { type: String, default: '' },
    advisorRaCode: { type: String, default: '' }
  },

  // Branding & Theme Colors
  themeColor: { type: String, default: '#000000' },
  logo: { type: String, default: '' },
  toolbarlogo: { type: String, default: '' },
  mainColor: { type: String, default: '#000000' },
  secondaryColor: { type: String, default: '#F0F0F0' },
  gradient1: { type: String, default: '#F0F0F0' },
  gradient2: { type: String, default: '#F0F0F0' },
  placeholderText: { type: String, default: '#FFFFFF' },

  // Layout
  homeScreenLayout: { type: String, enum: ['layout1', 'layout2'], default: 'layout2' },

  // Card Styling
  cardBorderWidth: { type: Number, default: 0 },
  cardElevation: { type: Number, default: 3 },
  cardVerticalMargin: { type: Number, default: 3 },

  // Bottom Tab Styling
  tabIconColor: { type: String, default: '#000' },
  bottomTabBorderTopWidth: { type: Number, default: 1.5 },
  bottomTabBg: { type: String, default: '#fff' },
  selectedTabColor: { type: String, default: '#000' },

  // Basket Colors
  basket1: { type: String, default: '#9D2115' },
  basket2: { type: String, default: '#6B1207' },
  basketColor: { type: String, default: '#721E30' },
  basketSymbolBg: { type: String, default: '#8D2952' },

  // Payment Modal (nested)
  paymentModal: {
    headerBg: { type: String, default: '#0056B7' },
    stepActiveColor: { type: String, default: '#0056B7' },
    stepCompletedColor: { type: String, default: '#29A400' },
    buttonPrimaryBg: { type: String, default: '#0056B7' },
    buttonSecondaryBg: { type: String, default: '#0056B7' },
    accentColor: { type: String, default: '#0056B7' },
    checkboxActiveColor: { type: String, default: '#29A400' },
    linkColor: { type: String, default: '#0056B7' },
    progressBarColor: { type: String, default: '#0056B7' }
  },

  // Empty State UI (nested)
  emptyStateUi: {
    backgroundColor: { type: String, default: '#6B1400' },
    darkerColor: { type: String, default: '#3A0B00' },
    mediumColor: { type: String, default: '#4D2418' },
    brighterColor: { type: String, default: '#8B2500' },
    mutedColor: { type: String, default: '#5A3327' },
    lightColor: { type: String, default: '#F8E8E5' },
    mediumLightShade: { type: String, default: '#F5DDD8' },
    lightWarmColor: { type: String, default: '#E4F1FE' }
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create index for faster lookups
advisorConfigSchema.index({ subdomain: 1 });
advisorConfigSchema.index({ 'apiKeys.advisorRaCode': 1 });
```

### API Endpoint Implementation Guide:

1. **GET /api/app-advisor/get** - Query by `appSubdomain` param
2. **GET /api/advisor-config-env/getConfig/:raCode** - Query by `apiKeys.advisorRaCode`
3. **POST /api/app-advisor/create** - Insert new document, validate subdomain uniqueness
4. **PUT /api/app-advisor/update** - Update by subdomain, use `$set` for partial updates
5. **PUT /api/app-advisor/update-digio** - Specialized update for Digio fields only
6. **PUT /api/app-advisor/update-theme** - Specialized update for theme fields only
7. **GET /api/app-advisor/list** - Return all documents (admin only)
8. **DELETE /api/app-advisor/delete** - Delete by subdomain

### Integration with supportAQ:

The supportAQ dashboard should provide UI for:
- Creating new advisor configurations
- Updating individual configuration categories (Digio, Theme, Features, Payment)
- Viewing all advisor configurations
- Deleting advisor configurations

All changes made through supportAQ will be immediately reflected in the mobile app via the ConfigContext API fetch.
