const fs = require('fs');

const DefaultScreen = () => null;
const CustomScreen = () => null;
const DefaultReview = () => null;
const CustomReview = () => null;
const defaultColorBuilder = () => ({brand: {primary: '#000000'}});
const customColorBuilder = () => ({brand: {primary: '#ff0000'}});

jest.mock('../../designs/registry', () => ({
  DEFAULT_VARIANT_NAME: 'default',
  VARIANTS: {
    default: {
      name: 'default',
      tokens: {buildColors: defaultColorBuilder, buildSpacing: () => ({md: 12})},
      components: {'screens.HomeScreen': DefaultScreen},
      sdk: {tradeReviewSheet: DefaultReview},
    },
    custom: {
      name: 'custom',
      tokens: {buildColors: customColorBuilder},
      components: {'screens.HomeScreen': CustomScreen},
      sdk: {tradeReviewSheet: CustomReview},
    },
  },
}));

const {
  resolveDesign,
  validateVariantContract,
} = require('../design/resolveDesign');

describe('design variant contract', () => {
  test('merges tokens, app components, and SDK slots over the default floor', () => {
    const resolved = resolveDesign({name: 'custom', source: 'prop'});

    expect(resolved.variant).toBe('custom');
    expect(resolved.tokens.buildColors).toBe(customColorBuilder);
    expect(resolved.tokens.buildSpacing()).toEqual({md: 12});
    expect(resolved.components['screens.HomeScreen']).toBe(CustomScreen);
    expect(resolved.sdk.tradeReviewSheet).toBe(CustomReview);
  });

  test('keeps the default SDK map when no custom variant is selected', () => {
    const resolved = resolveDesign({name: 'default', source: 'fallback'});
    expect(resolved.sdk.tradeReviewSheet).toBe(DefaultReview);
  });

  test('rejects component and SDK slot names missing from the default contract', () => {
    const defaultVariant = {
      components: {'screens.HomeScreen': DefaultScreen},
      sdk: {tradeReviewSheet: DefaultReview},
    };
    expect(() =>
      validateVariantContract('invalidComponent', defaultVariant, {
        components: {'screens.PrivateOnly': CustomScreen},
      }),
    ).toThrow('unknown component key(s): screens.PrivateOnly');
    expect(() =>
      validateVariantContract('invalidSdk', defaultVariant, {
        sdk: {privateOnlyWidget: CustomReview},
      }),
    ).toThrow('unknown SDK slot key(s): privateOnlyWidget');
  });

  test('wires every token family and SDK overrides into runtime providers', () => {
    const tokenHook = fs.readFileSync('src/theme/useTokens.js', 'utf8');
    for (const family of [
      'Assets',
      'Colors',
      'Spacing',
      'Typography',
      'Radii',
      'Shadows',
    ]) {
      expect(tokenHook).toContain(`buildVariant${family}`);
    }

    const sdkRoot = fs.readFileSync('src/sdk/SdkProviderRoot.js', 'utf8');
    expect(sdkRoot).toContain('const {sdk: sdkComponents} = useDesign()');
    expect(sdkRoot).toContain('components={sdkComponents}');
  });

  test('keeps the ConfigContext value stable between unrelated provider renders', () => {
    const configContext = fs.readFileSync('src/context/ConfigContext.js', 'utf8');

    expect(configContext).toContain('const contextValue = useMemo(');
    expect(configContext).toContain('[config, loading]');
    expect(configContext).toContain('value={contextValue}');
    expect(configContext).not.toContain('value={{ ...config, configLoading: loading }}');
  });

  test('routes visible app chrome through registered shell presentations', () => {
    const registry = fs.readFileSync('designs/default/index.js', 'utf8');
    const navigation = fs.readFileSync('src/components/Navigation.js', 'utf8');

    expect(registry).toContain("'shell.AppHeader': AppHeader");
    expect(registry).toContain("'shell.MainTabBar': MainTabBar");
    expect(navigation).toContain("useComponent('shell.AppHeader')");
    expect(navigation).toContain("useComponent('shell.MainTabBar')");
    expect(navigation).toContain(
      '<DesignTabBar {...props} height={navLayout.chrome.tabBarHeight} />',
    );
    // Tabs come from the variant navigation manifest, not hard-coded JSX.
    expect(navigation).toContain('navLayout.tabs.map(');
    expect(navigation).not.toContain("selectedVariant === 'arfs'");
    expect(navigation).not.toContain('const CustomTabBarIcon');
  });

  test('routes the customer news surface through the design registry', () => {
    const registry = fs.readFileSync('designs/default/index.js', 'utf8');
    const controller = fs.readFileSync(
      'src/screens/Home/NewsScreen/NewsScreen.js',
      'utf8',
    );
    const presentation = fs.readFileSync(
      'designs/default/screens/NewsScreen.js',
      'utf8',
    );

    expect(registry).toContain("'screens.NewsScreen': NewsScreen");
    expect(controller).toContain("useComponent('screens.NewsScreen')");
    expect(controller).toContain('slots={{');
    expect(presentation).not.toContain('axios');
    expect(presentation).not.toContain('useTrade');
    expect(presentation).not.toContain('react-native-config');
  });
});
