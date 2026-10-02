const fs = require('fs');
const path = require('path');
const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('AlphaQuark cold-launch theme safety', () => {
  test('the static fallback is the production blue theme', () => {
    const variants = read('whitelabel/appVariants.js');
    const alphaquark = variants.split('alphaquark: {')[1].split('zamzamcapital:')[0];
    expect(alphaquark).toContain("themeColor: '#0056B7'");
    expect(alphaquark).toContain("mainColor: '#0056B7'");
    expect(alphaquark).toContain("gradient1: '#0056B7'");
    expect(alphaquark).toContain("gradient2: '#002651'");
    expect(alphaquark).not.toContain("gradient1: '#F0F0F0'");
  });

  test('a successful remote config refreshes the safe theme cache', () => {
    const context = read('src/context/ConfigContext.js');
    expect(context).toContain("const THEME_CACHE_KEY = '@app:configThemeCache'");
    expect(context).toContain('themeCacheFromConfig(newConfig, validVariant)');
    expect(context).toContain('await AsyncStorage.setItem(');
    expect(context).not.toContain('JSON.stringify(newConfig)');
  });
});
