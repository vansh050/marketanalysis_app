module.exports = {
  testMatch: ['**/test/broker-qa/__tests__/**/*.test.js'],
  testTimeout: 30000,
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(@otplib|otplib|@scure|@noble)/)',
  ],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {
      presets: [['@babel/preset-env', {targets: {node: 'current'}}]],
    }],
  },
};
