const fs = require('fs');

describe('authentication brand header', () => {
  test.each([
    'designs/default/screens/LoginScreen.js',
    'designs/default/screens/SignupScreen.js',
  ])('%s keeps long tenant names visible on narrow or font-scaled devices', screenPath => {
    const source = fs.readFileSync(screenPath, 'utf8');

    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('minimumFontScale={0.8}');
    expect(source).toContain('allowFontScaling={false}');
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain('paddingRight: 4');
  });
});
