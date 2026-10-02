import {
  hasCompleteIiflCallback,
  parseIiflCallbackUrl,
} from '../../utils/iiflDirectFlow';

describe('IIFL direct OAuth callback parsing', () => {
  test('accepts the current lowercase callback parameters', () => {
    expect(
      parseIiflCallbackUrl(
        'https://prod.alphaquark.in/stock-recommendation?authcode=A%2B1&clientid=AB123',
      ),
    ).toEqual({authCode: 'A+1', clientCode: 'AB123'});
  });

  test('accepts camel-case callback parameters', () => {
    expect(
      parseIiflCallbackUrl(
        'https://prod.alphaquark.in/stock-recommendation?authCode=AUTH&clientId=CLIENT',
      ),
    ).toEqual({authCode: 'AUTH', clientCode: 'CLIENT'});
  });

  test('keeps compatibility with the retired auth_token spelling', () => {
    expect(
      parseIiflCallbackUrl(
        'https://prod.alphaquark.in/stock-recommendation?auth_token=OLD&clientid=C1',
      ),
    ).toEqual({authCode: 'OLD', clientCode: 'C1'});
  });

  test('requires both values before treating a navigation as the callback', () => {
    expect(hasCompleteIiflCallback('https://markets.iiflcapital.com/')).toBe(false);
    expect(
      hasCompleteIiflCallback(
        'https://prod.alphaquark.in/stock-recommendation?authcode=A&clientid=C',
      ),
    ).toBe(true);
  });
});
