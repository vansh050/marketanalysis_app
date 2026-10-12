/**
 * Course purchase from the app (2026-10-12).
 * The app must enroll through the server's verified routes, never the
 * admin-only /client-course/add:
 *   paid → POST /client-course/purchase (Firebase Bearer)
 *   ₹0   → POST /client-course/claim-free (Firebase Bearer)
 * and the order carries couponId so the server can recompute the price.
 */
jest.mock('axios');
jest.mock('../../utils/courseAuthHeaders', () => ({
  getPublicHeaders: jest.fn(() => ({ 'X-Advisor-Subdomain': 'prod' })),
  getAuthedHeaders: jest.fn(async () => ({ 'X-Advisor-Subdomain': 'prod', Authorization: 'Bearer t' })),
  getOptionalAuthHeaders: jest.fn(async () => ({ 'X-Advisor-Subdomain': 'prod' })),
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: { server: { baseUrl: 'https://server.alphaquark.in/' } },
}));
jest.mock('react-native-config', () => ({ REACT_APP_ADVISOR_SPECIFIC_TAG: 'prod' }));

const axios = require('axios');
const gumletService = require('../../FunctionCall/services/GumletService').default;

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
  axios.post.mockResolvedValue({ data: { success: true } });
  axios.get.mockResolvedValue({ data: { success: true } });
});

test('paid confirmation goes to the verified purchase route with a Bearer', async () => {
  await gumletService.confirmCoursePurchase({ courseId: 'c1', orderId: 'o1', name: 'A' });
  const [url, body, opts] = axios.post.mock.calls[0];
  expect(url).toBe('https://server.alphaquark.in/api/gumlet/client-course/purchase');
  expect(body).toEqual({ courseId: 'c1', orderId: 'o1', name: 'A' });
  expect(opts.headers.Authorization).toBe('Bearer t');
});

test('free enrollment goes to claim-free with the coupon', async () => {
  await gumletService.claimFreeCourse({ courseId: 'c1', couponId: 'k1', name: 'A' });
  const [url, body, opts] = axios.post.mock.calls[0];
  expect(url).toBe('https://server.alphaquark.in/api/gumlet/client-course/claim-free');
  expect(body).toEqual({ courseId: 'c1', couponId: 'k1', name: 'A' });
  expect(opts.headers.Authorization).toBe('Bearer t');
});

test('the app no longer exposes the admin-only enrollment writer', () => {
  expect(gumletService.addClientCourse).toBeUndefined();
});

test('enrollment lookup is identity-bound (Bearer, no email param)', async () => {
  await gumletService.getClientCourseDetails('someone@else.com', 'c1');
  const [url, opts] = axios.get.mock.calls[0];
  expect(url).toBe('https://server.alphaquark.in/api/gumlet/client-course/details');
  expect(opts.params).toEqual({ courseId: 'c1' });
  expect(opts.headers.Authorization).toBe('Bearer t');
});

test('the course order carries the coupon and an optional GSTIN', async () => {
  const cashfreeOrderService = require('../../FunctionCall/services/CashFreeOrderService').default;
  const base = { amount: 499, customerId: 'A-1', user_email: 'a@b.com', mobileNumber: '9999999999', pan: '', course: { _id: 'c1', title: 'C' }, name: 'A' };
  await cashfreeOrderService.createCourseOrder({ ...base, couponId: 'k1', gstin: '27AAPFU0939F1ZV' });
  let body = axios.post.mock.calls[0][1];
  expect(body.couponId).toBe('k1');
  expect(body.gstin).toBe('27AAPFU0939F1ZV');
  await cashfreeOrderService.createCourseOrder(base);
  body = axios.post.mock.calls[1][1];
  expect('gstin' in body).toBe(false);
});
