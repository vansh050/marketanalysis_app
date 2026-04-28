/**
 * Loads broker credentials from .env.broker file.
 * Returns structured credential objects per broker.
 * All fields are optional — tests auto-skip when credentials are missing.
 */
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env.broker')});

const env = process.env;

module.exports = {
  aq: {
    apiKey: env.AQ_API_KEY,
    apiSecret: env.AQ_API_SECRET,
    testEmail: env.AQ_TEST_EMAIL,
    subdomain: env.AQ_ADVISOR_SUBDOMAIN || 'alphaquark',
  },

  testSafety: {
    symbol: env.TEST_STOCK_SYMBOL || 'RELIANCE',
    exchange: env.TEST_STOCK_EXCHANGE || 'NSE',
    qty: parseInt(env.TEST_ORDER_QTY || '1', 10),
  },

  zerodha: {
    email: env.ZERODHA_EMAIL,
    userId: env.ZERODHA_USER_ID,
    apiKey: env.ZERODHA_API_KEY,
    apiSecret: env.ZERODHA_API_SECRET,
    accessToken: env.ZERODHA_ACCESS_TOKEN,
    totpSecret: env.ZERODHA_TOTP_SECRET,
    tpin: env.ZERODHA_TPIN,
  },

  angelone: {
    email: env.ANGELONE_EMAIL,
    clientId: env.ANGELONE_CLIENT_ID,
    password: env.ANGELONE_PASSWORD,
    apiKey: env.ANGELONE_API_KEY,
    totpSecret: env.ANGELONE_TOTP_SECRET,
  },

  kotak: {
    email: env.KOTAK_EMAIL,
    ucc: env.KOTAK_UCC,
    consumerKey: env.KOTAK_CONSUMER_KEY,
    consumerSecret: env.KOTAK_CONSUMER_SECRET,
    mobile: env.KOTAK_MOBILE,
    mpin: env.KOTAK_MPIN,
    totpSecret: env.KOTAK_TOTP_SECRET,
  },

  upstox: {
    email: env.UPSTOX_EMAIL,
    clientId: env.UPSTOX_CLIENT_ID,
    apiKey: env.UPSTOX_API_KEY,
    apiSecret: env.UPSTOX_API_SECRET,
    accessToken: env.UPSTOX_ACCESS_TOKEN,
    totpSecret: env.UPSTOX_TOTP_SECRET,
  },

  fyers: {
    email: env.FYERS_EMAIL,
    userId: env.FYERS_USER_ID,
    appId: env.FYERS_APP_ID,
    secretKey: env.FYERS_SECRET_KEY,
    accessToken: env.FYERS_ACCESS_TOKEN,
    totpSecret: env.FYERS_TOTP_SECRET,
  },

  dhan: {
    email: env.DHAN_EMAIL,
    clientId: env.DHAN_CLIENT_ID,
    accessToken: env.DHAN_ACCESS_TOKEN,
  },

  groww: {
    email: env.GROWW_EMAIL,
    accessToken: env.GROWW_ACCESS_TOKEN,
  },

  aliceblue: {
    email: env.ALICEBLUE_EMAIL,
    clientId: env.ALICEBLUE_CLIENT_ID,
    apiKey: env.ALICEBLUE_API_KEY,
    totpSecret: env.ALICEBLUE_TOTP_SECRET,
  },

  icici: {
    email: env.ICICI_EMAIL,
    userId: env.ICICI_USER_ID,
    apiKey: env.ICICI_API_KEY,
    apiSecret: env.ICICI_API_SECRET,
    accessToken: env.ICICI_ACCESS_TOKEN,
  },

  motilal: {
    email: env.MOTILAL_EMAIL,
    clientCode: env.MOTILAL_CLIENT_CODE,
    apiKey: env.MOTILAL_API_KEY,
    totpSecret: env.MOTILAL_TOTP_SECRET,
  },

  axis: {
    email: env.AXIS_EMAIL,
    userId: env.AXIS_USER_ID,
    accessToken: env.AXIS_ACCESS_TOKEN,
  },

  hdfc: {
    email: env.HDFC_EMAIL,
    userId: env.HDFC_USER_ID,
    apiKey: env.HDFC_API_KEY,
    apiSecret: env.HDFC_API_SECRET,
    accessToken: env.HDFC_ACCESS_TOKEN,
  },

  iifl: {
    email: env.IIFL_EMAIL,
    clientCode: env.IIFL_CLIENT_CODE,
    accessToken: env.IIFL_ACCESS_TOKEN,
  },

  dummybroker: {
    // DummyBroker needs no credentials — always available
    enabled: true,
  },
};
