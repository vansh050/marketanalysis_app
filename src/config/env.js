// Single entry point for build-time config. Import this, never 'react-native-config'.
//
// react-native-config bakes every .env value into the binary, and each fork's .env
// had grown to ~50 keys, most of them the same platform constant in every app.
// Now .env carries only what makes an app itself (tenant, brand, domains, deep-link
// scheme, broker/payment keys, the public pre-login key pair); everything below is
// the default for every app. A key present in .env — even empty — still wins, so a
// fork that differs sets just that one key.
//
// Live Proxy, not a copy: reads go to react-native-config each time, so tests that
// mock or mutate it keep working.
//
// ⚠️ An OTA bundle built from source older than this file reads react-native-config
// directly and would see none of these defaults on a binary whose .env was trimmed.
// OTA only from the binary's own source (docs/MOBILE_OTA_RELEASES.md).
import RNConfig from 'react-native-config';

// Same value in every app as of 2026-10-26 (they were copied into each .env).
export const PLATFORM_DEFAULTS = Object.freeze({
  REACT_APP_NODE_SERVER_API_URL: 'https://server.alphaquark.in/',
  REACT_APP_CCXT_SERVER_WEBSOCKET_URL: 'https://ccxtprod.alphaquark.in/',
  // Zerodha Kite Connect api_key: public (it is in every login URL); the secret is server-side.
  REACT_APP_ZERODHA_API_KEY: 'b0g1r806oitsamoe',
  REACT_APP_SDK_INTEGRATION: 'true',
  REACT_APP_SDK_BASE_URL: 'https://server.alphaquark.in',
  REACT_APP_SDK_MINT_URL: 'https://app-links.alphaquark.in/sdk/mint',
  REACT_APP_USE_SDK_BROKER_FLOW: 'true',
  REACT_APP_USE_SDK_EXECUTE_ADVICE: 'true',
  REACT_APP_SDK_BROKER_TEST_FIRST: 'false',
  REACT_APP_OTP_BASED_AUTHENTICATION: 'false',
  REACT_APP_AADHAR_BASED_AUTHENTICATION: 'true',
  REACT_APP_DIGIO_CHECK: 'beforePayment',
  REACT_APP_ENV: 'production',
  REACT_APP_CASHFREE_ENV: 'production',
  REACT_APP_PAYU_ENV: 'PRODUCTION',
  REACT_APP_PERCENTAGE_GAIN: '2',
  REACT_APP_ADVICE_SHOW_LATEST_DAYS: '15',
  REACT_APP_HIDE_CHANGE_MANAGER: 'false',
  REACT_APP_HIDE_CHANGE_MANAGER_FOR_CODES: 'ZAMZAMCAPITAL,RGXRESEARCH',
});

// Equal to the tenant (REACT_APP_HEADER_NAME) in almost every app; set them in .env
// only where they differ.
const derived = (key) => {
  if (key === 'REACT_APP_URL' || key === 'REACT_APP_ADVISOR_TAG') return RNConfig.REACT_APP_HEADER_NAME;
  return undefined;
};

const has = (key) => RNConfig != null && Object.prototype.hasOwnProperty.call(RNConfig, key);

const Config = new Proxy({}, {
  get(_, key) {
    if (typeof key !== 'string') return undefined;
    if (has(key)) return RNConfig[key];
    if (key in PLATFORM_DEFAULTS) return PLATFORM_DEFAULTS[key];
    return derived(key);
  },
  set(_, key, value) {
    RNConfig[key] = value;
    return true;
  },
  has(_, key) {
    return has(key) || key in PLATFORM_DEFAULTS || derived(key) !== undefined;
  },
  ownKeys() {
    return [...new Set([...Object.keys(PLATFORM_DEFAULTS), 'REACT_APP_URL', 'REACT_APP_ADVISOR_TAG', ...Object.keys(RNConfig || {})])];
  },
  getOwnPropertyDescriptor(target, key) {
    return { enumerable: true, configurable: true, writable: true, value: this.get(target, key) };
  },
});

export default Config;
