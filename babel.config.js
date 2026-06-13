
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['dotenv-import', {
      moduleName: '@env',
      path: '.env',
    }],
    // reanimated 4.1.0 + react-native-worklets/plugin (NOT
    // react-native-reanimated/plugin which is for reanimated 3). This fork
    // holds back on the reanimated downgrade upstream made (to 3.19.5). See
    // SYNC.md "Per-fork holds".
    'react-native-worklets/plugin',
  ],
};
