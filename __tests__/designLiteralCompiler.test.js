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
});
