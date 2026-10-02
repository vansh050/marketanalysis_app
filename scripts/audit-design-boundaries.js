#!/usr/bin/env node
/**
 * Enforces the presentation-only boundary documented in
 * docs/DESIGN_SYSTEM_ARCHITECTURE.md.
 *
 * New files under designs/ may import React/RN rendering dependencies, other
 * design files, token hooks, assets, styles, and an explicit set of pure
 * formatters. Network clients, storage, Firebase, navigation, app contexts,
 * services, and src-owned UI containers are forbidden. Historical violations
 * are recorded by exact file+specifier in design-boundary-baseline.json; the
 * audit fails both when a new violation appears and when a stale baseline
 * entry remains after cleanup, making the exception list a one-way ratchet.
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const DESIGNS_ROOT = path.join(ROOT, 'designs');
const BASELINE_PATH = path.join(__dirname, 'design-boundary-baseline.json');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const FORBIDDEN_PACKAGES = [
  'axios',
  '@react-native-async-storage/async-storage',
  '@react-native-firebase/',
  '@react-navigation/',
  'firebase',
  'react-query',
  'react-native-file-viewer',
  'react-native-fs',
  'react-native-iap',
  'react-native-inappbrowser-reborn',
  'react-native-keychain',
  'react-native-permissions',
  'react-native-share',
  'socket.io-client',
  'zustand',
];
const ALLOWED_SRC_PREFIXES = [
  'src/assets/',
  'src/design/',
  'src/theme/',
];
const ALLOWED_SRC_FILES = new Set([
  'src/config/brokerDdpiHelp.js',
  'src/utils/adviceDisplay.js',
  'src/utils/basketOrderState.js',
  'src/utils/formatCurrency.js',
  'src/utils/gstHelpers.js',
  'src/utils/orderStatusUtils.js',
  'src/utils/orderUtils.js',
  'src/utils/resolveImageUrl.js',
  'src/utils/sellAuthMessage.js',
  'src/utils/nba/brokerStatus.js',
  'src/utils/nba/nbaRanking.js',
  'src/utils/nba/portfolioHealth.js',
  'src/utils/nba/portfolioTransition.js',
]);

const PARSE_OPTIONS = {
  sourceType: 'unambiguous',
  plugins: [
    'jsx',
    'typescript',
    'classProperties',
    'objectRestSpread',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'decorators-legacy',
  ],
};

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function packageIsForbidden(specifier) {
  return FORBIDDEN_PACKAGES.some(name =>
    name.endsWith('/') ? specifier.startsWith(name) : specifier === name,
  );
}

function resolveRelative(fromFile, specifier) {
  const absolute = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [absolute];
  for (const extension of EXTENSIONS) {
    candidates.push(`${absolute}${extension}`);
  }
  for (const extension of EXTENSIONS) {
    candidates.push(path.join(absolute, `index${extension}`));
  }
  return candidates.find(candidate => fs.existsSync(candidate)) || absolute;
}

function srcImportIsAllowed(target) {
  const relative = path.relative(ROOT, target).split(path.sep).join('/');
  if (!relative.startsWith('src/')) {
    return true;
  }
  if (relative.endsWith('.styles.js') || relative.endsWith('.styles.ts')) {
    return true;
  }
  if (ALLOWED_SRC_FILES.has(relative)) {
    return true;
  }
  return ALLOWED_SRC_PREFIXES.some(prefix => relative.startsWith(prefix));
}

function collectSpecifiers(node, specifiers = []) {
  if (!node || typeof node !== 'object') {
    return specifiers;
  }
  if (node.type === 'ImportDeclaration' && typeof node.source?.value === 'string') {
    specifiers.push({specifier: node.source.value, line: node.loc?.start?.line || 0});
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments?.[0]?.type === 'StringLiteral'
  ) {
    specifiers.push({specifier: node.arguments[0].value, line: node.loc?.start?.line || 0});
  }
  // Dynamic import() is a dependency edge like any other. On prod web,
  // `lazy(() => import('../../src/...'))` let variant files pull app containers
  // into designs/ past an import/require-only audit (2026-09-29); close the
  // same gap here. Babel emits CallExpression(callee: Import) or
  // ImportExpression depending on options. A non-literal specifier cannot be
  // resolved statically, so it is a violation in its own right.
  const isDynamicImport =
    (node.type === 'CallExpression' && node.callee?.type === 'Import') ||
    node.type === 'ImportExpression';
  if (isDynamicImport) {
    const source = node.type === 'ImportExpression' ? node.source : node.arguments?.[0];
    const line = node.loc?.start?.line || 0;
    if (source?.type === 'StringLiteral') {
      specifiers.push({specifier: source.value, line});
    } else if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) {
      specifiers.push({specifier: source.quasis[0].value.cooked, line});
    } else {
      specifiers.push({specifier: '<dynamic-import:non-literal>', line});
    }
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'fetch'
  ) {
    specifiers.push({specifier: '<global:fetch>', line: node.loc?.start?.line || 0});
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach(child => collectSpecifiers(child, specifiers));
    } else if (value && typeof value === 'object' && value.type) {
      collectSpecifiers(value, specifiers);
    }
  }
  return specifiers;
}

function classify(file, specifier) {
  if (specifier.startsWith('.')) {
    return srcImportIsAllowed(resolveRelative(file, specifier)) ? null : 'src-owned module';
  }
  if (packageIsForbidden(specifier)) {
    return 'state/network/navigation package';
  }
  if (specifier.startsWith('<global:')) {
    return 'direct network global';
  }
  if (specifier.startsWith('<dynamic-import:')) {
    return 'unresolvable dynamic import';
  }
  return null;
}

// designs/<variant>/navigation.js is a DATA-ONLY manifest
// (docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.2): no imports at all, and the
// default export must be a pure literal tree (objects, arrays, strings,
// numbers, booleans, null). Functions, identifiers, spreads and computed keys
// would let a design smuggle behaviour into app structure.
const MANIFEST_BASENAME = 'navigation.js';
const LITERAL_TYPES = new Set([
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
]);

function isPureLiteral(node) {
  if (!node) return false;
  if (LITERAL_TYPES.has(node.type)) return true;
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
  if (node.type === 'UnaryExpression') {
    return node.operator === '-' && node.argument?.type === 'NumericLiteral';
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.every(element => element && isPureLiteral(element));
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.every(
      prop =>
        prop.type === 'ObjectProperty' &&
        !prop.computed &&
        (prop.key.type === 'Identifier' || prop.key.type === 'StringLiteral') &&
        isPureLiteral(prop.value),
    );
  }
  return false;
}

function auditManifest(ast, file, findings) {
  const relativeFile = path.relative(ROOT, file).split(path.sep).join('/');
  const add = (specifier, line) => {
    const id = `${relativeFile} :: ${specifier}`;
    findings.set(id, {id, relativeFile, specifier, line, reason: 'navigation manifest must be data only'});
  };
  for (const {specifier, line} of collectSpecifiers(ast)) {
    add(specifier, line);
  }
  const body = ast.program?.body || [];
  const exportDefault = body.find(node => node.type === 'ExportDefaultDeclaration');
  if (!exportDefault) {
    add('<manifest:no-default-export>', 0);
    return;
  }
  if (!isPureLiteral(exportDefault.declaration)) {
    add('<manifest:non-literal-default-export>', exportDefault.loc?.start?.line || 0);
  }
  for (const node of body) {
    if (node.type !== 'ExportDefaultDeclaration' && node.type !== 'EmptyStatement') {
      add(`<manifest:extra-statement:${node.type}>`, node.loc?.start?.line || 0);
    }
  }
}

function auditAst(ast, file, findings) {
  if (path.basename(file) === MANIFEST_BASENAME) {
    auditManifest(ast, file, findings);
    return;
  }
  for (const {specifier, line} of collectSpecifiers(ast)) {
    const reason = classify(file, specifier);
    if (!reason) {
      continue;
    }
    const relativeFile = path.relative(ROOT, file).split(path.sep).join('/');
    const id = `${relativeFile} :: ${specifier}`;
    findings.set(id, {id, relativeFile, specifier, line, reason});
  }
}

function audit() {
  const findings = new Map();
  for (const file of walk(DESIGNS_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parser.parse(source, PARSE_OPTIONS);
    } catch (error) {
      console.error(`DESIGN_PARSE_ERROR ${path.relative(ROOT, file)}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    auditAst(ast, file, findings);
  }
  return findings;
}

/** Audit one source string as if it lived at `file` (tests use this). */
function auditSource(source, file) {
  const findings = new Map();
  auditAst(parser.parse(source, PARSE_OPTIONS), file, findings);
  return [...findings.values()];
}

function main() {
  const findings = audit();
  const baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')));

  if (process.argv.includes('--print-baseline')) {
    console.log(JSON.stringify([...findings.keys()].sort(), null, 2));
    process.exit(process.exitCode || 0);
  }

  const additions = [...findings.values()].filter(item => !baseline.has(item.id));
  const stale = [...baseline].filter(id => !findings.has(id));

  for (const item of additions) {
    console.error(
      `NEW_DESIGN_BOUNDARY_VIOLATION ${item.relativeFile}:${item.line} ` +
        `imports ${item.specifier} (${item.reason})`,
    );
  }
  for (const id of stale) {
    console.error(`STALE_DESIGN_BOUNDARY_BASELINE ${id}`);
  }

  if (additions.length || stale.length || process.exitCode) {
    console.error(
      `Design boundary audit failed: ${additions.length} new violation(s), ` +
        `${stale.length} stale baseline entr${stale.length === 1 ? 'y' : 'ies'}.`,
    );
    process.exit(1);
  }

  console.log(
    `Design boundary audit passed: ${findings.size} known violation(s) baselined; no new presentation-layer coupling.`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {auditSource, ROOT};
