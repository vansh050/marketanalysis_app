const fs = require('fs');

describe('customer recommendation authentication', () => {
  const tradeContext = fs.readFileSync('src/screens/TradeContext.js', 'utf8');
  const authHelper = fs.readFileSync(
    'src/utils/customerAuthHeaders.js',
    'utf8',
  );

  test('awaits verified Firebase identity before fetching recommendations', () => {
    expect(tradeContext).toContain(
      'const customerAuthHeaders = await getCustomerAuthHeaders()',
    );
    expect(tradeContext).toContain('...customerAuthHeaders');
    expect(authHelper).toContain('await user.getIdToken()');
    expect(authHelper).toContain('Authorization: `Bearer ${token}`');
    expect(authHelper).toContain('!user && attempt < attempts');
  });

  test('encodes the customer email in the recommendation query', () => {
    expect(tradeContext).toContain('encodeURIComponent(userEmail)');
  });
});
