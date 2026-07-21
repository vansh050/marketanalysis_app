const path = require('path');
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const defaultConfig = getDefaultConfig(__dirname);
const { resolver: { sourceExts, assetExts } } = defaultConfig;

// @alphaquark/mobile-sdk lives outside this project root at
// ../../alphaquark-mobile-sdk/packages/rn — two levels up from this repo
// (marketanalysis_app is under codes/github/, the SDK sits directly under
// codes/). This MUST match the file: dep in package.json
// ("file:../../alphaquark-mobile-sdk/packages/rn") and the node_modules
// symlink; using a single "../" here (github/alphaquark-mobile-sdk) points at
// a path that doesn't exist and crashes Metro at startup with an ENOENT
// fs.watch on a nonexistent directory.
// npm installed it via the file: dep into node_modules/@alphaquark/mobile-sdk
// as a symlink, but Metro's default resolver doesn't follow symlinks across
// watchFolder boundaries — it returned "Unable to resolve module
// @alphaquark/mobile-sdk". Two-part fix:
//   1. extraNodeModules — direct path map so the import bypasses node_modules lookup.
//   2. watchFolders — Metro needs to file-watch the SDK's source/lib so the
//      project rebuilds when the SDK is re-tsc'd.
// Scoped to ONLY the SDK path (not the whole parent dir, which has 50+
// unrelated projects and would tank Metro's startup).
const SDK_PATH = path.resolve(__dirname, '../../alphaquark-mobile-sdk/packages/rn');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...sourceExts, "svg"],
    resolverMainFields: ["sbmodern", "react-native", "browser", "main"],
    // Direct path map for the SDK package itself, plus its peer deps —
    // when SDK files (sitting at SDK_PATH/lib/...) `require('react')`,
    // Metro must resolve to the HOST app's react copy, not look in the
    // SDK's parent directories. Without these, Metro errors with
    // "Unable to resolve module react" because the SDK lives outside
    // the project root.
    extraNodeModules: {
      '@alphaquark/mobile-sdk': SDK_PATH,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      'react-native-webview': path.resolve(
        __dirname,
        'node_modules/react-native-webview',
      ),
      // SDK is shipped as compiled JS with babel-transformed async/await
      // → require('@babel/runtime/helpers/asyncToGenerator') etc. Ensure
      // those resolve to the host app's @babel/runtime install.
      '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
    },
  },
  watchFolders: [SDK_PATH],
};

module.exports = mergeConfig(defaultConfig, config);
