import {isDigioEnabledFromBackend} from '../../utils/digioConfig';

describe('isDigioEnabledFromBackend', () => {
  it('enables Digio only for an explicit backend true', () => {
    expect(isDigioEnabledFromBackend(true)).toBe(true);
  });

  it.each([false, undefined, null, 'true', 'false'])(
    'does not enable Digio for %p',
    value => {
      expect(isDigioEnabledFromBackend(value)).toBe(false);
    },
  );
});
