
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    './scripts/babel-plugin-design-literals.js',
    ['dotenv-import', {
      moduleName: '@env',
      path: '.env',
    }],
    // MarketAnalysis intentionally remains on Reanimated 4 + Worklets while
    // the fork's New Architecture animation stack is validated separately.
    'react-native-worklets/plugin',
  ],
};
