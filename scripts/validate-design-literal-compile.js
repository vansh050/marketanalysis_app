#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const {
  getDesignLiteralCacheKey,
  loadOverrides,
  resolveVariant,
} = require('./babel-plugin-design-literals');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'designs')];
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

const fixtureEnv = path.join(
  ROOT,
  'scripts',
  '__fixtures__',
  'literal-override.env',
);

const fileSelectedVariant = resolveVariant({
  envPath: fixtureEnv,
  processEnv: {},
});
if (fileSelectedVariant !== '__fixtures__/literal_override') {
  throw new Error(
    `Expected .env-only fixture variant, got ${fileSelectedVariant}`,
  );
}

const shellSelectedVariant = resolveVariant({
  envPath: fixtureEnv,
  processEnv: {DESIGN_VARIANT: 'default'},
});
if (shellSelectedVariant !== 'default') {
  throw new Error(`Shell DESIGN_VARIANT must override .env, got ${shellSelectedVariant}`);
}

const fixtureOverrides = loadOverrides({
  envPath: fixtureEnv,
  processEnv: {},
});
if (
  fixtureOverrides.colors['0056b7'] !== '#123456' ||
  fixtureOverrides.fonts['Satoshi-Medium'] !== 'Poppins-Medium'
) {
  throw new Error('The .env-selected literal override fixture was not loaded');
}

const defaultCacheKey = getDesignLiteralCacheKey({
  envPath: fixtureEnv,
  processEnv: {DESIGN_VARIANT: 'default'},
});
const fixtureCacheKey = getDesignLiteralCacheKey({
  envPath: fixtureEnv,
  processEnv: {},
});
if (defaultCacheKey === fixtureCacheKey) {
  throw new Error('Design literal Metro cache key does not vary by variant');
}

const walk = (directory, files = []) => {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {walk(target, files);}
    else if (EXTENSIONS.has(path.extname(entry.name))) {files.push(target);}
  }
  return files;
};

let compiled = 0;
for (const file of SOURCE_ROOTS.flatMap(sourceRoot => walk(sourceRoot))) {
  const result = babel.transformFileSync(file, {
    cwd: ROOT,
    configFile: path.join(ROOT, 'babel.config.js'),
    babelrc: false,
    filename: file,
  });
  if (/design\/literalTokens/.test(result?.code || '')) {
    throw new Error(`Design literal marker import survived compilation: ${path.relative(ROOT, file)}`);
  }
  compiled += 1;
}

console.log(
  `Design literal compile validation passed for ${compiled} app and design files; ` +
    '.env selection and variant cache keys are deterministic.',
);
