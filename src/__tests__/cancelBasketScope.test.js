const fs = require('fs');
const path = require('path');

test('basket Reject states recipient scope and sends the logged-in recipient email', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/AdviceScreenComponents/StockAdvices.js'),
    'utf8',
  );
  const start = source.indexOf('const handleCancelBasket');
  const handler = source.slice(start, start + 1400);
  expect(handler).toContain('user_email: userEmail');
  expect(handler).toContain("cancel_scope: 'recipient'");
});
