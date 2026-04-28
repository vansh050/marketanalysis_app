/**
 * Test fixtures for trade execution and order data.
 */

export const SAMPLE_STOCK_DETAIL = {
  tradingSymbol: 'RELIANCE-EQ',
  transactionType: 'BUY',
  exchange: 'NSE',
  segment: 'EQUITY',
  productType: 'DELIVERY',
  orderType: 'MARKET',
  price: 0,
  quantity: 10,
  priority: 1,
  tradeId: 'trade-001',
  token: '500325',
};

export const SAMPLE_SELL_ORDER = {
  ...SAMPLE_STOCK_DETAIL,
  transactionType: 'SELL',
  tradeId: 'trade-002',
};

export const SAMPLE_LIMIT_ORDER = {
  ...SAMPLE_STOCK_DETAIL,
  orderType: 'LIMIT',
  price: 2500,
  tradeId: 'trade-003',
};

export const SAMPLE_GTT_ORDER = {
  ...SAMPLE_STOCK_DETAIL,
  orderType: 'GTT',
  gttCheck: true,
  price: 2600,
  triggerPrice: 2550,
  tradeId: 'trade-004',
  entryLeg: {price: 2550, triggerPrice: 2540},
  leg1: {price: 2700, triggerPrice: 2690},
  leg2: {price: 2400, triggerPrice: 2410},
};

export const SAMPLE_GTT_OCO_ORDER = {
  ...SAMPLE_STOCK_DETAIL,
  orderType: 'GTT_OCO',
  gttCheck: true,
  price: 2600,
  triggerPrice: 2550,
  targetPrice: 2800,
  stoplossPrice: 2300,
  tradeId: 'trade-005',
};

export const SAMPLE_ORDER_RESULTS = {
  success: [
    {
      tradingSymbol: 'RELIANCE-EQ',
      orderStatus: 'COMPLETE',
      orderId: 'ORD-001',
      message: 'Order placed successfully',
    },
  ],
  rejected: [
    {
      tradingSymbol: 'RELIANCE-EQ',
      orderStatus: 'REJECTED',
      message: 'Insufficient funds',
    },
  ],
  edisRejected: [
    {
      tradingSymbol: 'RELIANCE-EQ',
      orderStatus: 'REJECTED',
      message: 'CDSL TPIN authorization required for sell',
      symbol: 'RELIANCE-EQ',
    },
  ],
};

export const SAMPLE_HOLDINGS = [
  {symbol: 'RELIANCE', quantity: 10, avgPrice: 2500, exchange: 'NSE'},
  {symbol: 'TCS', quantity: 5, avgPrice: 3500, exchange: 'NSE'},
  {symbol: 'INFY', quantity: 20, avgPrice: 1500, exchange: 'NSE'},
  {symbol: 'HDFC', quantity: 8, avgPrice: 2800, exchange: 'NSE'},
];

export const SAMPLE_TARGET_ALLOCATION = [
  {symbol: 'RELIANCE', value: 30, price: 2600, exchange: 'NSE'},
  {symbol: 'TCS', value: 25, price: 3600, exchange: 'NSE'},
  {symbol: 'WIPRO', value: 20, price: 450, exchange: 'NSE'},
  {symbol: 'INFY', value: 25, price: 1550, exchange: 'NSE'},
];

export const SAMPLE_ORDER_BOOK_RESPONSE = {
  zerodha: [
    {
      order_id: 'ZRD-001',
      tradingsymbol: 'RELIANCE-EQ',
      exchange: 'NSE',
      transaction_type: 'BUY',
      quantity: 10,
      filled_quantity: 10,
      average_price: 2500,
      order_type: 'MARKET',
      status: 'COMPLETE',
      order_timestamp: '2024-01-15T10:30:00',
      variety: 'regular',
    },
  ],
  angelOne: [
    {
      uniqueorderid: 'ANG-001',
      tradingsymbol: 'RELIANCE-EQ',
      exchange: 'NSE',
      transactiontype: 'BUY',
      quantity: 10,
      filledshares: 10,
      averageprice: 2500,
      ordertype: 'MARKET',
      orderstatus: 'complete',
      updatetime: '2024-01-15T10:30:00',
      variety: 'NORMAL',
    },
  ],
};

export const SAMPLE_REBALANCE_RESPONSE = {
  success: {
    status: 0,
    buy: [
      {symbol: 'WIPRO', quantity: 44, price: 450, value: 19800},
    ],
    sell: [
      {symbol: 'HDFC', quantity: 8, price: 2800, value: 22400},
    ],
    totalValue: 100000,
    minInvestmentValue: 50000,
  },
  shortfall: {
    status: 0,
    buy: [{symbol: 'WIPRO', quantity: 5, price: 450, value: 2250}],
    sell: [],
    totalValue: 30000,
    minInvestmentValue: 50000,
  },
  tokenExpired: {
    status: 1,
    message: 'Token expired',
  },
  backendError: {
    status: 2,
    message: 'Internal server error',
  },
};

export const SAMPLE_CONFIG_DATA = {
  config: {
    REACT_APP_HEADER_NAME: 'test-advisor',
  },
  apiKeys: {
    angelOneApiKey: 'config-angel-api-key',
  },
  REACT_APP_ANGEL_ONE_API_KEY: 'env-angel-api-key',
};
