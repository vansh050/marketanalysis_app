import {
  getGoogleSignInUserMessage,
  isGoogleSignInCancellation,
  isGoogleSignInConfigurationError,
} from '../../utils/googleSignInError';

describe('isGoogleSignInCancellation', () => {
    it.each([
        [{ code: 'SIGN_IN_CANCELLED' }],
        [{ code: '12501', message: 'Sign in action cancelled' }],
        [{ message: 'The user canceled the sign-in flow' }],
    ])('accepts expected cancellation variants', (error) => {
        expect(isGoogleSignInCancellation(error)).toBe(true);
    });

    it.each([
        [{ code: 'auth/network-request-failed', message: 'Network unavailable' }],
        [{ code: 'auth/user-disabled' }],
        [new Error('No ID token returned')],
        [null],
    ])('does not hide real Google sign-in failures', (error) => {
        expect(isGoogleSignInCancellation(error)).toBe(false);
    });
});

describe('isGoogleSignInConfigurationError', () => {
  test.each([
    [{code: '10'}, true],
    [{code: 'DEVELOPER_ERROR'}, true],
    [{message: '10 DEVELOPER_ERROR'}, true],
    [{code: 'SIGN_IN_CANCELLED'}, false],
    [{code: 'auth/network-request-failed'}, false],
  ])('classifies %p as %p', (error, expected) => {
    expect(isGoogleSignInConfigurationError(error)).toBe(expected);
  });
});

describe('getGoogleSignInUserMessage', () => {
  test('distinguishes an app API credential failure from a user login failure', () => {
    expect(getGoogleSignInUserMessage({response: {status: 401}})).toContain(
      'app build could not authenticate',
    );
  });

  test('keeps network failures actionable', () => {
    expect(
      getGoogleSignInUserMessage({code: 'auth/network-request-failed'}),
    ).toContain('internet connection');
  });
});
