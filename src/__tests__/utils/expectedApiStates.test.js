import {isEmptyInvoiceResponse, isPortfolioAccessRestricted} from '../../utils/expectedApiStates';
const error = (status, data) => ({response: {status, data}});
test('recognizes the invoice service empty-account response', () => {
  expect(isEmptyInvoiceResponse(error(404, {status: 1, message: 'No invoices found'}))).toBe(true);
});
test.each([error(404, {message: 'Not Found'}), error(500, {status: 1, message: 'No invoices found'}), error(401, {}), new Error('offline')])('does not hide invoice failures: %j', e => {
  expect(isEmptyInvoiceResponse(e)).toBe(false);
});
test.each([[402, 'payment_required'], [402, 'payment_pending_review'], [403, 'not_entitled']])('recognizes subscription restriction %s %s', (status, code) => {
  expect(isPortfolioAccessRestricted(error(status, {code}))).toBe(true);
});
test.each([error(403, {code: 'invalid_token'}), error(503, {code: 'entitlement_check_failed'}), error(404, {}), new Error('offline')])('does not hide portfolio failures: %j', e => {
  expect(isPortfolioAccessRestricted(e)).toBe(false);
});
