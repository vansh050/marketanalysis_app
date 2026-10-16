const babel = require('@babel/core');

const plugin = require('../scripts/babel-plugin-design-literals');

const compile = source => babel.transformSync(source, {
  babelrc: false,
  configFile: false,
  plugins: [plugin],
}).code;

describe('design literal compiler', () => {
  const originalDesign = process.env.DESIGN_VARIANT;

  afterEach(() => {
    if (originalDesign === undefined) delete process.env.DESIGN_VARIANT;
    else process.env.DESIGN_VARIANT = originalDesign;
  });

  test('keeps default literals pixel-identical and removes marker imports', () => {
    process.env.DESIGN_VARIANT = 'default';
    const result = compile(`
      import { designColor, designFont } from './design/literalTokens';
      const style = { color: designColor('0056b7'), fontFamily: designFont('Satoshi-Medium') };
    `);
    expect(result).toContain('"#0056b7"');
    expect(result).toContain('"Satoshi-Medium"');
    expect(result).not.toContain('literalTokens');
  });

  test('loads color and font overrides only from the selected design folder', () => {
    process.env.DESIGN_VARIANT = '__fixtures__/literal_override';
    const result = compile(`
      import { designColor, designFont } from './design/literalTokens';
      const style = { color: designColor('0056b7'), fontFamily: designFont('Satoshi-Medium') };
    `);
    expect(result).toContain('"#123456"');
    expect(result).toContain('"Poppins-Medium"');
  });

  test('designToken compiles to the default design value and removes the marker import', () => {
    process.env.DESIGN_VARIANT = 'default';
    const defaults = require('../designs/default/tokens/hostTokens.json');
    const result = compile(`
      import { designToken } from './design/literalTokens';
      const style = { color: designToken('watchlist.rowText') };
    `);
    expect(result).toContain(JSON.stringify(defaults['watchlist.rowText']));
    expect(result).not.toContain('designToken');
    expect(result).not.toContain('literalTokens');
  });

  test('designToken takes a variant override and keeps other names at the default', () => {
    process.env.DESIGN_VARIANT = '__fixtures__/host_token_override';
    const defaults = require('../designs/default/tokens/hostTokens.json');
    const result = compile(`
      import { designToken } from './design/literalTokens';
      const a = designToken('watchlist.rowText');
      const b = designToken('watchlist.rowMuted');
    `);
    expect(result).toContain('const a = "#abcdef"');
    expect(result).toContain(`const b = ${JSON.stringify(defaults['watchlist.rowMuted'])}`);
  });

  test('a null designToken (unset) compiles to undefined, never the string "null"', () => {
    process.env.DESIGN_VARIANT = 'default';
    const defaults = require('../designs/default/tokens/hostTokens.json');
    expect(defaults['brokerSheet.guideAccent']).toBeNull();
    const result = compile(`
      import { designToken } from './design/literalTokens';
      const accent = designToken('brokerSheet.guideAccent') || fallback;
      const style = { color: designToken('brokerSheet.egress.bold.color') };
    `);
    expect(result).toContain('const accent = undefined || fallback');
    expect(result).toContain('color: undefined');
    expect(result).not.toContain('"null"');
  });

  test('designToken rejects names the default design does not define', () => {
    process.env.DESIGN_VARIANT = 'default';
    expect(() => compile(`
      import { designToken } from './design/literalTokens';
      const a = designToken('nope.missing');
    `)).toThrow(/Unknown designToken "nope.missing"/);
  });

  test('a variant may not override names the default design does not define', () => {
    process.env.DESIGN_VARIANT = '__fixtures__/host_token_bad';
    expect(() => compile(`
      import { designToken } from './design/literalTokens';
      const a = designToken('watchlist.rowText');
    `)).toThrow(/overrides names the default design does not define: watchlist.notAToken/);
  });
});
