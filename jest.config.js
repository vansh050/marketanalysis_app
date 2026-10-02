module.exports = {
  preset: 'react-native',
  setupFiles: [
    './src/__tests__/setup.js',
    'react-native-gesture-handler/jestSetup',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/e2e/',
    '/test/broker-qa/',
    'src/__tests__/fixtures/',
    'src/__tests__/setup.js',
  ],
  moduleNameMapper: {
    '^react-native-crypto-js$': '<rootDir>/src/__mocks__/react-native-crypto-js.js',
    '^react-native-config$': '<rootDir>/src/__mocks__/react-native-config.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/@react-native-async-storage/async-storage.js',
    '^react-native-toast-message$': '<rootDir>/src/__mocks__/react-native-toast-message.js',
    // @alphaquark/mobile-sdk is a symlink to ../../alphaquark-mobile-sdk
    // (outside node_modules), so Jest transforms its lib and would resolve
    // babel helpers and a second React copy from the SDK's own folder. Pin
    // them to this app's copies (one React; hooks work).
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^react-native/(.*)$': '<rootDir>/node_modules/react-native/$1',
    '^react-native-webview$': '<rootDir>/node_modules/react-native-webview',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-vector-icons|react-native-webview|react-native-inappbrowser-reborn|lucide-react-native|react-native-svg)/)',
  ],
  collectCoverageFrom: [
    'src/utils/**/*.js',
    'src/services/**/*.js',
    'src/context/**/*.js',
    '!src/**/*.test.js',
    '!src/__mocks__/**',
    '!src/__tests__/fixtures/**',
  ],
};
