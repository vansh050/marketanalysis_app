// Safe wrapper for react-native-config to prevent crashes when native module fails
let Config = {};

try {
  const NativeConfig = require('react-native-config');
  Config = NativeConfig.default || NativeConfig || {};
} catch (error) {
  console.warn('react-native-config failed to load, using empty config:', error.message);
  Config = {};
}

export default Config;
