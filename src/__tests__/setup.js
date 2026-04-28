/**
 * Jest setup file for React Native test environment.
 * Provides polyfills and global mocks needed by the test suite.
 */

// Polyfill for btoa/atob (used in brokerAuth.js)
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// Mock react-native modules that aren't available in test environment
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Suppress noisy console output during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('[BrokerSession]') ||
     args[0].includes('[rebalanceHelpers]'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
