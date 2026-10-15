const {describeUpstoxConnectError} = require('../../utils/upstoxConnectError');

const reject = data => ({response: {status: 400, data}});

test('UDAPI100068 names the Redirect URL to register (Kyzen QA 2026-10-15)', () => {
  const {title, message} = describeUpstoxConnectError(
    reject({error_code: 'UDAPI100068', error_message: "Check your 'client_id' and 'redirect_uri'"}),
    'https://kyzenresearch.com/stock-recommendation',
  );
  expect(title).toBe('Upstox did not accept this API key');
  expect(message).toContain('https://kyzenresearch.com/stock-recommendation');
  expect(message).toContain('UDAPI100068');
});

test("other Upstox errors show Upstox's own message", () => {
  const {message} = describeUpstoxConnectError(reject({error_code: 'UDAPI100050', error_message: 'Invalid IP'}), 'x');
  expect(message).toBe('Invalid IP (UDAPI100050)');
});

test('a network failure is not called wrong credentials', () => {
  expect(describeUpstoxConnectError(new Error('Network Error'), 'x').title).toBe('Could not reach the server');
});

test('an unexplained server error keeps the old wording', () => {
  expect(describeUpstoxConnectError({response: {status: 500, data: {}}}, 'x').title).toBe('Incorrect Credentials');
});
