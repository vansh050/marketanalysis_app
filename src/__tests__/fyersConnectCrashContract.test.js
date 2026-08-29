const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/BrokerConnectionModal/FyersConnect.js'),
  'utf8',
);

describe('Fyers OAuth render contract', () => {
  test('defines the style object passed to FyersConnectUI', () => {
    expect(source).toContain('styles={styles}');
    expect(source).toContain('const styles = StyleSheet.create({');
    expect(source).toContain('webViewContainer:');
    expect(source).toContain('webView: {flex: 1}');
  });
});
