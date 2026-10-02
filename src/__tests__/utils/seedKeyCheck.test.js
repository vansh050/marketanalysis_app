import {authenticator} from '../../utils/totp';
import {describeSeedCheck} from '../../utils/totpKeyCheck';

describe('describeSeedCheck', () => {
  const seed = 'JBSWY3DPEHPK3PXP';

  it('shows the code the pasted key produces now', () => {
    const text = describeSeedCheck(seed, 'Zerodha');
    expect(text).toContain(authenticator.generate(seed));
    expect(text).toContain("authenticator's Zerodha code must show the same");
  });

  it('accepts lowercase / spaced input like the TOTP generator does', () => {
    expect(describeSeedCheck('jbsw y3dp ehpk 3pxp', 'Fyers')).toContain(authenticator.generate(seed));
  });

  it('shows nothing for an empty or invalid key', () => {
    expect(describeSeedCheck('', 'Zerodha')).toBe('');
    expect(describeSeedCheck('not base32 !!', 'Zerodha')).toBe('');
  });
});
