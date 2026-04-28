module.exports = {
  preset: 'react-native',
  setupFiles: ['./src/__tests__/setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    'src/__tests__/fixtures/',
    'src/__tests__/setup.js',
  ],
  moduleNameMapper: {
    '^react-native-crypto-js$': '<rootDir>/src/__mocks__/react-native-crypto-js.js',
    '^react-native-config$': '<rootDir>/src/__mocks__/react-native-config.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/@react-native-async-storage/async-storage.js',
    '^react-native-toast-message$': '<rootDir>/src/__mocks__/react-native-toast-message.js',
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
