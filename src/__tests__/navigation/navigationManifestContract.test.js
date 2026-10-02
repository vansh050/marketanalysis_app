/**
 * Navigation manifests: variant merge + unknown-key rejection in
 * resolveDesign, and the data-only rule in the design-boundary audit
 * (docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.2, §6).
 */
const path = require('path');

const defaultNavigation = {
  tabs: [{key: 'advice'}, {key: 'more'}],
  initialTab: 'advice',
  chrome: {legacyToolbar: true, tabBarHeight: 60},
};
const customTabs = [{key: 'portfolio'}, {key: 'more'}];

jest.mock('../../../designs/registry', () => ({
  DEFAULT_VARIANT_NAME: 'default',
  VARIANTS: {
    default: {name: 'default', tokens: {}, components: {}, sdk: {}, navigation: defaultNavigation},
    custom: {name: 'custom', navigation: {tabs: customTabs}},
  },
}));

const {resolveDesign, validateVariantContract} = require('../../design/resolveDesign');
const {auditSource, ROOT} = require('../../../scripts/audit-design-boundaries');

describe('resolveDesign navigation merge', () => {
  test('a variant replaces only the manifest keys it declares', () => {
    const {navigation} = resolveDesign({name: 'custom', source: 'prop'});
    expect(navigation.tabs).toBe(customTabs);
    expect(navigation.initialTab).toBe('advice');
    expect(navigation.chrome).toEqual({legacyToolbar: true, tabBarHeight: 60});
  });

  test('the default variant exposes its own manifest', () => {
    expect(resolveDesign({name: 'default', source: 'fallback'}).navigation.tabs).toEqual(
      defaultNavigation.tabs,
    );
  });

  test('unknown top-level manifest keys fail fast', () => {
    expect(() =>
      validateVariantContract('bad', {components: {}, sdk: {}}, {navigation: {drawer: []}}),
    ).toThrow('unknown navigation key(s): drawer');
  });
});

describe('design audit: navigation manifests are data only', () => {
  const manifestFile = path.join(ROOT, 'designs', 'example', 'navigation.js');
  const findings = source => auditSource(source, manifestFile).map(f => f.specifier);

  test('a pure literal manifest passes', () => {
    expect(
      findings("export default {tabs: [{key: 'advice', label: 'Home'}], chrome: {tabBarHeight: 60}};"),
    ).toEqual([]);
  });

  test('any import is rejected, even an otherwise allowed one', () => {
    expect(findings("import x from './tabs';\nexport default {tabs: x};")).toEqual(
      expect.arrayContaining(['./tabs', '<manifest:non-literal-default-export>']),
    );
  });

  test('functions, identifiers and computed values are rejected', () => {
    expect(findings('export default {tabs: () => []};')).toEqual([
      '<manifest:non-literal-default-export>',
    ]);
    expect(findings("const k = 'x';\nexport default {[k]: 1};")).toEqual(
      expect.arrayContaining(['<manifest:non-literal-default-export>']),
    );
  });

  test('a manifest without a default export is rejected', () => {
    expect(findings('export const tabs = [];')).toContain('<manifest:no-default-export>');
  });

  test('ordinary design files are unaffected by the manifest rule', () => {
    const screen = path.join(ROOT, 'designs', 'example', 'screens', 'Thing.js');
    expect(auditSource('export default () => null;', screen)).toEqual([]);
  });
});
