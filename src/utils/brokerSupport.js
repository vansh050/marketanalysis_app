/**
 * Broker Support Configuration for Frontend
 *
 * This file defines which order types and features are supported by each broker.
 * Used for displaying appropriate UI options and warnings to users.
 *
 * Order Types:
 * - MARKET: Market order - immediate execution at market price
 * - LIMIT: Limit order - execution at specified price or better
 * - SL: Stop Loss with limit - triggers at stop price, places limit order
 * - SL_M: Stop Loss Market - triggers at stop price, places market order
 * - GTT: Good Till Triggered - order stays active until price condition is met
 * - GTT_OCO: One Cancels Other - GTT with target and stoploss
 */

export const BROKER_SUPPORT = {
  // Fully supported brokers with GTT
  zerodha: {
    name: "Zerodha",
    displayName: "Zerodha (Kite)",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 50,
    },
    notes: "Full GTT support with single and two-leg (OCO). OCO requires both legs same transaction type.",
  },

  upstox: {
    name: "Upstox",
    displayName: "Upstox",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 100,
    },
    notes: "Full GTT support with SINGLE and MULTIPLE (multi-leg) types.",
  },

  angelone: {
    name: "AngelOne",
    displayName: "Angel One",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: false,
    },
    features: {
      slpt: true,
      oco: false,
      gtt_multi_leg: false,
      gtt_max_orders: 50,
    },
    notes: "Single-leg GTT only. For SL+PT, two separate GTT orders are created.",
    surveillanceCheck: true,
  },

  dhan: {
    name: "Dhan",
    displayName: "Dhan",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 100,
    },
    notes: "Forever Orders API provides full GTT and OCO support.",
  },

  fyers: {
    name: "Fyers",
    displayName: "Fyers",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 50,
    },
    notes: "Full GTT support with multiple rules (entry + target + stoploss).",
  },

  icici: {
    name: "ICICI",
    displayName: "ICICI Direct",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 50,
    },
    notes: "Breeze API supports single-leg and three-leg GTT.",
  },

  groww: {
    name: "Groww",
    displayName: "Groww",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: true,
      GTT_OCO: true,
    },
    features: {
      slpt: true,
      oco: true,
      gtt_multi_leg: true,
      gtt_max_orders: 50,
    },
    notes: "Smart Orders API provides GTT and OCO functionality.",
  },

  // Brokers WITHOUT GTT support
  kotak: {
    name: "Kotak",
    displayName: "Kotak Securities",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "GTT orders not supported. Only regular SL/SL_M orders (valid for day only).",
    gttAlternative: "Use SL order type - will be valid only for the trading day.",
  },

  hdfc: {
    name: "HDFC",
    displayName: "HDFC Securities",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "GTT orders not supported. Only regular SL/SL_M orders available.",
    gttAlternative: "Use SL order type - will be valid only for the trading day.",
  },

  iifl: {
    name: "IIFL",
    displayName: "IIFL Securities",
    unavailable: true,
    unavailableReason: "IIFL Securities integration is temporarily unavailable. Please use another broker.",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "IIFL Securities broker integration is temporarily unavailable.",
    gttAlternative: "Use SL order type - will be valid only for the trading day.",
  },

  aliceblue: {
    name: "AliceBlue",
    displayName: "Alice Blue",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "GTT orders not supported. Only regular SL/SL_M orders available.",
    gttAlternative: "Use SL order type - will be valid only for the trading day.",
  },

  motilal_oswal: {
    name: "MotilalOswal",
    displayName: "Motilal Oswal",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "GTT orders not supported. Only regular SL/SL_M orders available.",
    gttAlternative: "Use SL order type - will be valid only for the trading day.",
  },

  axis: {
    name: "Axis Securities",
    displayName: "Axis Securities",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: false,
      SL_M: false,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
    },
    notes: "Supports Market and Limit orders only.",
  },

  nuvama: {
    name: "Nuvama",
    displayName: "Nuvama Wealth",
    orderTypes: {
      MARKET: true,
      LIMIT: true,
      SL: true,
      SL_M: true,
      GTT: false,
      GTT_OCO: false,
    },
    features: {
      slpt: false,
      oco: false,
      gtt_multi_leg: false,
      gtc: true,
    },
    notes: "No GTT, but supports GTC (Good Till Cancelled) duration.",
    gttAlternative: "Use GTC duration option for longer validity.",
  },
};

// Broker name mapping (various formats to normalized key)
const BROKER_NAME_MAP = {
  "angel one": "angelone",
  "angel": "angelone",
  angelone: "angelone",
  zerodha: "zerodha",
  kite: "zerodha",
  upstox: "upstox",
  dhan: "dhan",
  fyers: "fyers",
  "icici direct": "icici",
  icici: "icici",
  groww: "groww",
  kotak: "kotak",
  "kotak securities": "kotak",
  hdfc: "hdfc",
  "hdfc securities": "hdfc",
  iifl: "iifl",
  "iifl securities": "iifl",
  aliceblue: "aliceblue",
  "alice blue": "aliceblue",
  "motilal oswal": "motilal_oswal",
  motilaloswal: "motilal_oswal",
  nuvama: "nuvama",
  axis: "axis",
  "axis securities": "axis",
  "axis direct": "axis",
  axisdirect: "axis",
};

/**
 * Normalize broker name to config key
 */
export const normalizeBrokerName = (brokerName) => {
  if (!brokerName) return null;
  const normalized = brokerName.toLowerCase().trim();
  return BROKER_NAME_MAP[normalized] || normalized.replace(/[\s-]/g, "_");
};

/**
 * Get broker support configuration
 */
export const getBrokerSupport = (brokerName) => {
  const key = normalizeBrokerName(brokerName);
  return BROKER_SUPPORT[key] || null;
};

/**
 * Check if broker is currently available (backend endpoints operational).
 * Returns false for brokers whose backend integration is down.
 */
export const isBrokerAvailable = (brokerName) => {
  const broker = getBrokerSupport(brokerName);
  if (!broker) return true; // Unknown brokers assumed available
  return !broker.unavailable;
};

/**
 * Get unavailability message for a broker.
 */
export const getBrokerUnavailableReason = (brokerName) => {
  const broker = getBrokerSupport(brokerName);
  return broker?.unavailableReason || null;
};

/**
 * Check if specific order type is supported
 */
export const isOrderTypeSupported = (brokerName, orderType) => {
  const broker = getBrokerSupport(brokerName);
  return broker?.orderTypes?.[orderType] === true;
};

/**
 * Check if specific feature is supported
 */
export const isFeatureSupported = (brokerName, feature) => {
  const broker = getBrokerSupport(brokerName);
  return broker?.features?.[feature] === true;
};

/**
 * Get list of GTT-supported brokers
 */
export const getGTTSupportedBrokers = () => {
  return Object.entries(BROKER_SUPPORT)
    .filter(([_, config]) => config.orderTypes.GTT)
    .map(([key, config]) => ({
      key,
      name: config.displayName,
      hasOCO: config.orderTypes.GTT_OCO,
      hasMultiLeg: config.features.gtt_multi_leg,
    }));
};

/**
 * Get list of brokers without GTT support
 */
export const getGTTUnsupportedBrokers = () => {
  return Object.entries(BROKER_SUPPORT)
    .filter(([_, config]) => !config.orderTypes.GTT)
    .map(([key, config]) => ({
      key,
      name: config.displayName,
      alternative: config.gttAlternative,
    }));
};

/**
 * Get warning message for unsupported order type
 */
export const getOrderTypeWarning = (brokerName, orderType) => {
  const broker = getBrokerSupport(brokerName);
  if (!broker) return `Unknown broker: ${brokerName}`;

  if (broker.orderTypes[orderType]) return null; // Supported, no warning

  const warnings = {
    GTT: {
      title: "GTT Not Supported",
      message: `${broker.displayName} does not support GTT (Good Till Triggered) orders.`,
      alternative: broker.gttAlternative || "Orders will be converted to SL type (valid for trading day only).",
      severity: "warning",
    },
    GTT_OCO: {
      title: "OCO Not Supported",
      message: `${broker.displayName} does not support OCO (One Cancels Other) orders.`,
      alternative: "Stop loss and target will be placed as separate GTT orders (if GTT supported) or separate SL orders.",
      severity: broker.orderTypes.GTT ? "info" : "warning",
    },
    SL: {
      title: "Stop Loss Not Supported",
      message: `${broker.displayName} does not support Stop Loss orders.`,
      alternative: null,
      severity: "error",
    },
    SL_M: {
      title: "Stop Loss Market Not Supported",
      message: `${broker.displayName} does not support Stop Loss Market orders.`,
      alternative: "Consider using Stop Loss (SL) with limit price instead.",
      severity: "warning",
    },
  };

  return warnings[orderType] || {
    title: "Order Type Not Supported",
    message: `${orderType} is not supported by ${broker.displayName}`,
    alternative: null,
    severity: "error",
  };
};

/**
 * Get all available order types for a broker
 */
export const getAvailableOrderTypes = (brokerName) => {
  const broker = getBrokerSupport(brokerName);
  if (!broker) return ["MARKET", "LIMIT"]; // Default safe options

  return Object.entries(broker.orderTypes)
    .filter(([_, supported]) => supported)
    .map(([type]) => type);
};

/**
 * Order type display information
 */
export const ORDER_TYPE_INFO = {
  MARKET: {
    label: "Market",
    description: "Execute immediately at market price",
    icon: "Zap",
    color: "blue",
    requiresPrice: false,
    requiresTriggerPrice: false,
  },
  LIMIT: {
    label: "Limit",
    description: "Execute at specified price or better",
    icon: "Target",
    color: "green",
    requiresPrice: true,
    requiresTriggerPrice: false,
  },
  SL: {
    label: "Stop Loss",
    description: "Trigger at stop price, then place limit order (valid for day)",
    icon: "Shield",
    color: "orange",
    requiresPrice: true,
    requiresTriggerPrice: true,
  },
  SL_M: {
    label: "Stop Loss Market",
    description: "Trigger at stop price, then execute at market (valid for day)",
    icon: "ShieldAlert",
    color: "orange",
    requiresPrice: false,
    requiresTriggerPrice: true,
  },
  GTT: {
    label: "GTT",
    description: "Good Till Triggered - stays active until price condition met (up to 1 year)",
    icon: "Clock",
    color: "purple",
    requiresPrice: true,
    requiresTriggerPrice: true,
    badge: "Long Term",
  },
  GTT_OCO: {
    label: "GTT OCO",
    description: "Target + Stop Loss - whichever triggers first cancels the other",
    icon: "GitBranch",
    color: "indigo",
    requiresPrice: true,
    requiresTriggerPrice: true,
    requiresTargetPrice: true,
    requiresStoplossPrice: true,
    badge: "Smart Exit",
  },
};

/**
 * Validate order configuration
 */
export const validateOrderConfig = (order, brokerName) => {
  const errors = [];
  const warnings = [];
  const broker = getBrokerSupport(brokerName);

  if (!broker) {
    errors.push(`Unknown broker: ${brokerName}`);
    return { valid: false, errors, warnings };
  }

  const orderType = order.orderType || order.OrderType || "MARKET";
  const orderInfo = ORDER_TYPE_INFO[orderType];

  // Check if order type is supported
  if (!broker.orderTypes[orderType]) {
    const warning = getOrderTypeWarning(brokerName, orderType);
    if (warning.severity === "error") {
      errors.push(warning.message);
    } else {
      warnings.push(warning);
    }
  }

  // Validate required fields
  if (orderInfo) {
    if (orderInfo.requiresPrice && !order.price && order.price !== 0) {
      errors.push(`${orderType} orders require a price`);
    }
    if (orderInfo.requiresTriggerPrice && !order.triggerPrice) {
      errors.push(`${orderType} orders require a trigger price`);
    }
    if (orderInfo.requiresTargetPrice && !order.targetPrice && !order.profitTarget) {
      errors.push(`${orderType} orders require a target price`);
    }
    if (orderInfo.requiresStoplossPrice && !order.stoplossPrice && !order.stopLoss) {
      errors.push(`${orderType} orders require a stop loss price`);
    }
  }

  // Validate quantity
  if (!order.quantity || order.quantity <= 0) {
    errors.push("Quantity must be greater than 0");
  }

  // Validate symbol
  if (!order.symbol && !order.Symbol) {
    errors.push("Symbol is required");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    broker,
    suggestedFallback: !broker.orderTypes[orderType] && broker.orderTypes.SL ? "SL" : null,
  };
};

/**
 * Get broker connection status message
 */
export const getBrokerConnectionMessage = (status, brokerName) => {
  const broker = getBrokerSupport(brokerName);
  const displayName = broker?.displayName || brokerName;

  const messages = {
    connected: {
      type: "success",
      title: "Broker Connected",
      message: `${displayName} is connected and ready for trading.`,
    },
    disconnected: {
      type: "warning",
      title: "Broker Disconnected",
      message: `${displayName} is not connected. Please connect your broker to place orders.`,
      action: "Connect Broker",
    },
    token_expired: {
      type: "error",
      title: "Session Expired",
      message: `Your ${displayName} session has expired. Please reconnect to continue trading.`,
      action: "Reconnect",
    },
    error: {
      type: "error",
      title: "Connection Error",
      message: `Unable to connect to ${displayName}. Please try again.`,
      action: "Retry",
    },
  };

  return messages[status] || messages.error;
};

/**
 * Format GTT order status for display
 */
export const formatGTTStatus = (status) => {
  const statusMap = {
    ACTIVE: { label: "Active", color: "green", icon: "Clock" },
    TRIGGERED: { label: "Triggered", color: "blue", icon: "Check" },
    CANCELLED: { label: "Cancelled", color: "gray", icon: "X" },
    EXPIRED: { label: "Expired", color: "orange", icon: "AlertCircle" },
    PARTIALLY_TRIGGERED: { label: "Partial", color: "yellow", icon: "AlertTriangle" },
    REJECTED: { label: "Rejected", color: "red", icon: "XCircle" },
    PENDING: { label: "Pending", color: "blue", icon: "Clock" },
    EXECUTED: { label: "Executed", color: "green", icon: "CheckCircle" },
  };

  return statusMap[status] || { label: status, color: "gray", icon: "HelpCircle" };
};

const brokerSupportUtils = {
  BROKER_SUPPORT,
  getBrokerSupport,
  isOrderTypeSupported,
  isFeatureSupported,
  getGTTSupportedBrokers,
  getGTTUnsupportedBrokers,
  getOrderTypeWarning,
  getAvailableOrderTypes,
  ORDER_TYPE_INFO,
  validateOrderConfig,
  getBrokerConnectionMessage,
  formatGTTStatus,
  normalizeBrokerName,
};

export default brokerSupportUtils;
