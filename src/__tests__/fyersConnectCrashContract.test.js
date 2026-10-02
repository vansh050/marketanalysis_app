const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/BrokerConnectionModal/FyersConnect.js'),
  'utf8',
);
const ui = fs.readFileSync(
  path.join(process.cwd(), 'src/UIComponents/BrokerConnectionUI/FyersConnectUI.js'),
  'utf8',
);

describe('Fyers OAuth render contract', () => {
  test('defines the style object passed to FyersConnectUI', () => {
    expect(source).toContain('styles={styles}');
    expect(source).toContain('const styles = StyleSheet.create({');
    expect(source).toContain('webViewContainer:');
    expect(source).toContain('webView: {flex: 1}');
  });

  test('can continue combined first-connect credentials directly to OAuth', () => {
    expect(source).toContain("initialCredentials?.appSecret || ''");
    expect(source).toContain("initialCredentials?.appId || ''");
    expect(source).toContain('initialEgressReady = false');
    expect(source).toContain('autoStartHandled.current = true');
    expect(source).toContain('setLoading(false);');
  });

  test('keeps large account documents out of the WebView modal and exchanges once', () => {
    expect(source).toContain('setUserId(res.data?.User?._id)');
    expect(source).not.toContain('setUserDetails(res.data.User)');
    expect(source).toContain('!hasConnectedFyers.current');
    expect(source).toContain('[apiKey, fyersAuthCode, secretKey, userId]');
    expect(source).toContain('api/fyers/exchange-token');
    expect(source).not.toContain('clientSecret: apiKey');
  });

  test('records credential-free breadcrumbs and never logs OAuth URLs', () => {
    expect(source).toContain("showWebView ? 'webview_mounted' : 'webview_unmounted'");
    expect(source).toContain("recordFyersBreadcrumb('reconciliation_started'");
    expect(source).toContain("recordFyersBreadcrumb('reconciliation_completed'");
    expect(source).not.toContain("console.log('[Fyers] WebView URL:'");
    expect(source).not.toContain("console.log('[Fyers] Auth URL received:'");
  });

  test('malformed OAuth query segments cannot crash the JS runtime', () => {
    expect(source).toContain("const separator = pair.indexOf('=')");
    expect(source).toContain('if (separator <= 0) return;');
    expect(source).toContain('Ignore malformed third-party query segments');
  });

  test('staged hand-off reuses the gate user id instead of refetching the account', () => {
    expect(source).toContain('useState(initialUserId)');
    expect(source).toContain("recordFyersBreadcrumb('user_id_reused'");
    expect(source).toContain('if (initialUserId) {');
  });

  test('staged hand-off shows one light surface, not a second credential sheet', () => {
    expect(source).toContain('autoStart && initialCredentials && !autoStartFailed');
    expect(source).toContain("'Opening Fyers login…'");
    // Every failure path must reveal the credential sheet for a retry.
    expect(source.match(/setAutoStartFailed\(true\)/g).length).toBeGreaterThanOrEqual(5);
  });

  test('a killed WebView renderer is unmounted instead of left dead on screen', () => {
    expect(source).toContain('const handleWebViewRenderProcessGone');
    expect(source).toContain("'webview_render_process_gone'");
    expect(ui).toContain('onRenderProcessGone={handleWebViewRenderProcessGone}');
    expect(ui).toContain('onContentProcessDidTerminate={handleWebViewRenderProcessGone}');
  });
});
