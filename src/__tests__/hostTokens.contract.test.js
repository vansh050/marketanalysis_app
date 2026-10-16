/**
 * Named host tokens contract (release/deploy_5.2).
 *
 * Shared host surfaces (broker connect sheet, egress-IP callout, rebalance,
 * watchlist, education, profile, connections, toast…) take their colours and
 * fonts from designToken('<surface>.<role>'). The default design defines every
 * name in designs/default/tokens/hostTokens.json with the value the screen
 * hard-coded before (null = unset). A variant restyles them by overriding names
 * in designs/<variant>/tokens/hostTokens.json — never by branching in src/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const DEFAULTS = require('../../designs/default/tokens/hostTokens.json');

const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
  return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [full] : [];
});
const SOURCES = walk(path.join(ROOT, 'src')).concat([path.join(ROOT, 'App.js')]);
// Default-design presentations may use host tokens too (e.g. ResearchReport).
const DESIGN_SOURCES = walk(path.join(ROOT, 'designs')).filter(f => !f.includes('__fixtures__'));
const USED = new Set();
for (const file of SOURCES.concat(DESIGN_SOURCES)) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/designToken\('([A-Za-z0-9_.]+)'\)/g)) USED.add(m[1]);
}

describe('named host tokens', () => {
  test('every designToken name used in src/ is defined by the default design', () => {
    const missing = [...USED].filter(name => !(name in DEFAULTS));
    expect(missing).toEqual([]);
  });

  test('the default design defines no unused names', () => {
    expect(Object.keys(DEFAULTS).filter(name => !USED.has(name))).toEqual([]);
  });

  test('default values are colours, font names or null (unset)', () => {
    for (const [name, value] of Object.entries(DEFAULTS)) {
      expect([name, value === null || typeof value === 'string']).toEqual([name, true]);
    }
  });

  test('the old variant switch and literal remap are gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/design/themedColor.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'designs/literalRemaps.js'))).toBe(false);
    for (const file of SOURCES.concat(DESIGN_SOURCES)) {
      const src = fs.readFileSync(file, 'utf8');
      expect([file, /themedColor|isHostSkinActive|literalRemaps/.test(src)]).toEqual([file, false]);
    }
  });

  test('the runtime fallback returns the default design value', () => {
    const {designToken} = require('../design/literalTokens');
    expect(designToken('watchlist.rowText')).toBe(DEFAULTS['watchlist.rowText']);
    expect(designToken('brokerSheet.guideAccent')).toBeUndefined();
  });

  test('log out always resets the stack to Login', () => {
    const src = read('src/screens/Authentication/LogOutScreen.js');
    expect(src).toContain("navigation.reset({ index: 0, routes: [{ name: 'Login' }] })");
    expect(src).not.toContain("navigation.replace('Login')");
  });
});
