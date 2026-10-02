const path = require('path');
const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const {
  getDesignLiteralCacheKey,
} = require('./scripts/babel-plugin-design-literals');

const defaultConfig = getDefaultConfig(__dirname);
const { resolver: { sourceExts, assetExts } } = defaultConfig;
// Worktrees commonly symlink node_modules to the canonical checkout. Metro's
// explicit module map must use the real directory or release bundling can
// report an existing @babel/runtime helper as missing.
const NODE_MODULES_PATH = fs.realpathSync(path.resolve(__dirname, 'node_modules'));

// @alphaquark/mobile-sdk lives outside this project root at ../../alphaquark-mobile-sdk
// (STANDARD LAYOUT, see below). npm installs it as a symlink into
// node_modules/@alphaquark/mobile-sdk, but Metro's default resolver doesn't follow
// symlinks across watchFolder boundaries — it returned "Unable to resolve module
// @alphaquark/mobile-sdk". Two-part fix:
//   1. extraNodeModules — direct path map so the import bypasses node_modules lookup.
//   2. watchFolders — Metro needs to file-watch the SDK's source/lib so the
//      project rebuilds when the SDK is re-tsc'd.
// Scoped to ONLY the SDK path (not the whole parent dir, which has unrelated projects
// and would tank Metro's startup).
//
// STANDARD LAYOUT (decided 2026-06-11): the SDK checkout lives at
// `../../alphaquark-mobile-sdk` relative to this repo — i.e. repo under
// <root>/github/Alphab2bapp, SDK under <root>/alphaquark-mobile-sdk. The
// package.json `file:` dep points there (commit 681ac2d). MAC DEVS: place
// your SDK checkout at that depth (move it up one level if it currently
// sits as a direct sibling), then re-run npm install.
//
// The probe below keeps BOTH depths working for Metro so a not-yet-moved
// checkout still bundles — but `npm install` only honors the package.json
// path, so the `../../` layout is the one that fully works.
// Standard layout (`../../`) is probed first; the `../` fallback keeps a
// not-yet-moved sibling checkout bundling. On machines where the real SDK
// sits at `../`, a `../../alphaquark-mobile-sdk` symlink → the real checkout
// makes the standard path resolve (see CHANGELOG 2026-06-12).
const SDK_PATH_CANDIDATES = [
  path.resolve(__dirname, '../../alphaquark-mobile-sdk/packages/rn'),
  path.resolve(__dirname, '../alphaquark-mobile-sdk/packages/rn'),
];
const SDK_PATH =
  SDK_PATH_CANDIDATES.find((p) => fs.existsSync(p)) || SDK_PATH_CANDIDATES[0];
const WATCH_FOLDERS = [SDK_PATH];
if (!NODE_MODULES_PATH.startsWith(`${__dirname}${path.sep}`)) {
  WATCH_FOLDERS.push(NODE_MODULES_PATH);
}

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  // Metro does not track the build-time literals.json dependency because the
  // Babel plugin replaces the marker call with a string literal. Put the
  // selected variant plus the literal maps in Metro's global transform key so
  // restarting Metro after either changes cannot reuse a half-reskinned cache.
  cacheVersion: `1.0-${getDesignLiteralCacheKey()}`,
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    resolverMainFields: ['sbmodern', 'react-native', 'browser', 'main'],
    // Direct path map for the SDK package itself, plus its peer deps —
    // when SDK files (sitting at SDK_PATH/lib/...) `require('react')`,
    // Metro must resolve to the HOST app's react copy, not look in the
    // SDK's parent directories. Without these, Metro errors with
    // "Unable to resolve module react" because the SDK lives outside
    // the project root.
    extraNodeModules: {
      '@alphaquark/mobile-sdk': SDK_PATH,
      react: path.join(NODE_MODULES_PATH, 'react'),
      'react-native': path.join(NODE_MODULES_PATH, 'react-native'),
      'react-native-webview': path.resolve(
        NODE_MODULES_PATH,
        'react-native-webview',
      ),
      // SDK is shipped as compiled JS with babel-transformed async/await
      // → require('@babel/runtime/helpers/asyncToGenerator') etc. Ensure
      // those resolve to the host app's @babel/runtime install.
      '@babel/runtime': path.join(NODE_MODULES_PATH, '@babel/runtime'),
    },
  },
  watchFolders: WATCH_FOLDERS,
};

module.exports = mergeConfig(defaultConfig, config);
