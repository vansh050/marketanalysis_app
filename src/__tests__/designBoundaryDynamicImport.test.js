/**
 * The design-boundary audit must treat dynamic import() as a dependency edge.
 *
 * On prod web (2026-09-29) `lazy(() => import('../../src/...'))` let four
 * variant files pull app containers into designs/ while an import/require-only
 * audit reported zero violations. This app had no such file, but the audit had
 * the same gap; these tests keep it closed.
 */
const path = require('path');

const {auditSource, ROOT} = require('../../scripts/audit-design-boundaries');

const variantFile = path.join(ROOT, 'designs', 'example', 'screens', 'Thing.js');
const specifiers = source => auditSource(source, variantFile).map(f => f.specifier);

test('flags a lazy dynamic import of a src/ screen', () => {
  expect(
    specifiers("const S = React.lazy(() => import('../../../src/screens/Home/HomeScreen'));"),
  ).toEqual(['../../../src/screens/Home/HomeScreen']);
});

test('flags a no-substitution template literal dynamic import', () => {
  expect(specifiers('import(`../../../src/utils/serverConfig`);')).toEqual([
    '../../../src/utils/serverConfig',
  ]);
});

test('flags an unresolvable (non-literal) dynamic import', () => {
  expect(specifiers('const load = p => import(`${p}`);')).toEqual(['<dynamic-import:non-literal>']);
});

test('allows dynamic imports inside designs/ and of allowed src paths', () => {
  expect(specifiers("const C = React.lazy(() => import('../composites/StockCard'));")).toEqual([]);
  expect(specifiers("import('../../../src/theme/useTokens');")).toEqual([]);
});

test('still flags forbidden static imports', () => {
  expect(specifiers("import axios from 'axios';")).toEqual(['axios']);
});
