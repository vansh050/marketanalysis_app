#!/usr/bin/env node
/**
 * One-way ratchet for presentation literals that still live in src/.
 * Token definitions and tests are excluded deliberately; designs/** is the
 * customization layer and may define literal values. Counts may only fall.
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(__dirname, 'style-literal-baseline.json');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const HEX_COLOR = /#[0-9A-Fa-f]{3,8}\b/g;
const FONT_FAMILY = /fontFamily\s*:\s*['"][^'"]+['"]/g;

const shouldSkipDirectory = directory => {
  const relative = path.relative(SRC_ROOT, directory).split(path.sep);
  return relative.includes('theme') || relative.includes('__tests__');
};

const sourceWithoutComments = (source, filename) => {
  const isTypeScript = /\.tsx?$/.test(filename);
  const ast = parser.parse(source, {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      isTypeScript ? 'typescript' : 'flow',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'dynamicImport',
      'importMeta',
      'optionalChaining',
      'nullishCoalescingOperator',
      'topLevelAwait',
    ],
  });
  const characters = [...source];
  for (const comment of ast.comments || []) {
    for (let index = comment.start; index < comment.end; index += 1) {
      if (characters[index] !== '\n' && characters[index] !== '\r') characters[index] = ' ';
    }
  }
  return characters.join('');
};

const countMatches = (source, filename) => {
  const executableSource = sourceWithoutComments(source, filename);
  return {
    hexColorLiterals: (executableSource.match(HEX_COLOR) || []).length,
    fontFamilyLiterals: (executableSource.match(FONT_FAMILY) || []).length,
  };
};

const scan = (directory, totals = {hexColorLiterals: 0, fontFamilyLiterals: 0}) => {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(target)) scan(target, totals);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    const counts = countMatches(fs.readFileSync(target, 'utf8'), target);
    totals.hexColorLiterals += counts.hexColorLiterals;
    totals.fontFamilyLiterals += counts.fontFamilyLiterals;
  }
  return totals;
};

const totals = scan(SRC_ROOT);
if (process.argv.includes('--print-baseline')) {
  console.log(JSON.stringify(totals, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const regressions = Object.keys(totals).filter(key => totals[key] > baseline[key]);
const stale = Object.keys(totals).filter(key => totals[key] < baseline[key]);

for (const key of regressions) {
  console.error(`NEW_STYLE_LITERAL ${key}: ${totals[key]} exceeds baseline ${baseline[key]}`);
}
for (const key of stale) {
  console.error(`STALE_STYLE_LITERAL_BASELINE ${key}: ${totals[key]} is below baseline ${baseline[key]}`);
}

if (regressions.length || stale.length) {
  console.error('Style literal audit failed. Update the baseline only when counts decrease.');
  process.exit(1);
}

console.log(
  `Style literal audit passed: ${totals.hexColorLiterals} color and ` +
    `${totals.fontFamilyLiterals} font-family literals remain in src/.`,
);
