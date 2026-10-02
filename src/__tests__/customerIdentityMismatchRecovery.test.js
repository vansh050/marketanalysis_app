const fs = require('fs');

/**
 * 2026-09-18: a customer opened the app after a rebalance and sat on
 * "Portfolio recommendations could not be refreshed" with a Retry button that
 * could never work. The server had returned 403 MF_CUSTOMER_IDENTITY_MISMATCH
 * (the Firebase token proved a different customer than the URL asked for), and
 * the response interceptor replayed only 401 — so Retry re-issued a
 * byte-identical request and got the same 403 forever.
 *
 * These pin the three pieces that remove the dead end. See
 * prod-alphaquark-github/docs/server_issues/2026-09-18-customer-identity-403.md
 */
describe('customer identity mismatch recovery', () => {
  const interceptor = fs.readFileSync(
    'src/utils/authTokenInterceptor.js',
    'utf8',
  );
  const tradeContext = fs.readFileSync('src/screens/TradeContext.js', 'utf8');
  const homeScreen = fs.readFileSync('src/screens/Home/HomeScreen.js', 'utf8');

  test('a 403 identity mismatch is replayed once with a fresh token', () => {
    expect(interceptor).toContain(
      "IDENTITY_MISMATCH_CODE = 'MF_CUSTOMER_IDENTITY_MISMATCH'",
    );
    expect(interceptor).toContain('error?.response?.status === 403');
    expect(interceptor).toContain('__identityMismatchRetried');
    expect(interceptor).toContain('resolveFirebaseToken(true)');
  });

  test('the replay is bounded — a second mismatch announces instead of looping', () => {
    expect(interceptor).toContain('announceIdentityMismatch');
    expect(interceptor).toContain('identityMismatchAnnounced');
  });

  test('the 401 replay is left intact', () => {
    expect(interceptor).toContain('error?.response?.status === 401');
    expect(interceptor).toContain('__firebaseAuthRetried');
  });

  test('the interceptor does not overwrite the stored account email', () => {
    // accountEmail.js treats the typed email as identity on purpose, because
    // an Apple relay alias matches no backend record. Rewriting it from the
    // Firebase user here would regress that.
    expect(interceptor).not.toContain('ACCOUNT_EMAIL_KEY');
    expect(interceptor).not.toContain('setItem');
  });

  test('TradeContext separates a mismatch from a transient error', () => {
    expect(tradeContext).toContain(
      "error?.response?.data?.code === 'MF_CUSTOMER_IDENTITY_MISMATCH'",
    );
    expect(tradeContext).toContain("isIdentityMismatch ? 'identityMismatch' : 'error'");
  });

  test('Home offers signing in again, not a Retry that cannot work', () => {
    expect(homeScreen).toContain(
      "modelPortfolioEntitlementsStatus === 'identityMismatch'",
    );
    expect(homeScreen).toContain('Signed in as a different account');
    expect(homeScreen).toContain("navigation.navigate('More')");
    // The transient-error branch must survive alongside it.
    expect(homeScreen).toContain(
      'Portfolio recommendations could not be refreshed',
    );
  });
});
