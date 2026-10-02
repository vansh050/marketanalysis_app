import {isFyersRedirectMismatch} from '../utils/fyersOAuthErrors';

describe('Fyers OAuth redirect mismatch recovery', () => {
  it.each([
    'redirectUrl mismatch',
    'redirect_uri mismatch',
    'Redirect URL: mismatch',
  ])('recognises the broker error: %s', message => {
    expect(isFyersRedirectMismatch(message)).toBe(true);
  });

  it('does not treat ordinary Fyers login content as a mismatch', () => {
    expect(isFyersRedirectMismatch('Login to FYERS')).toBe(false);
  });
});
