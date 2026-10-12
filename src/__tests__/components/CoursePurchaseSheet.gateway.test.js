/**
 * App course checkout follows the advisor's supportAQ gateway (2026-10-12):
 *   cashfree → existing CashFree order; razorpay → native Razorpay on a
 *   server-priced order, then /confirm; payu / phonepe → advisor website.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity, Linking } from 'react-native';

jest.mock('react-native-razorpay', () => ({ open: jest.fn() }));
jest.mock('react-native-cashfree-pg-sdk', () => ({
  CFPaymentGatewayService: { setCallback: jest.fn(), setEventSubscriber: jest.fn(), doPayment: jest.fn(), removeCallback: jest.fn(), removeEventSubscriber: jest.fn() },
}));
jest.mock('cashfree-pg-api-contract', () => ({
  CFDropCheckoutPayment: jest.fn(), CFEnvironment: {}, CFPaymentComponentBuilder: jest.fn(() => ({ add() { return this; }, build: () => ({}) })),
  CFPaymentModes: {}, CFSession: jest.fn(), CFThemeBuilder: jest.fn(() => {
    const b = { build: () => ({}) };
    ['setNavigationBarBackgroundColor', 'setNavigationBarTextColor', 'setButtonBackgroundColor', 'setButtonTextColor', 'setPrimaryTextColor', 'setSecondaryTextColor'].forEach((m) => { b[m] = () => b; });
    return b;
  }),
}), { virtual: true });
jest.mock('@react-native-firebase/auth', () => ({ getAuth: () => ({ currentUser: { email: 'buyer@x.com' } }) }));
jest.mock('../../FunctionCall/services/StudentPaymentService', () => ({
  __esModule: true,
  default: { getGateway: jest.fn(), startCourseCheckout: jest.fn(), confirm: jest.fn(), status: jest.fn(), waitForFinal: jest.fn() },
}));
jest.mock('../../FunctionCall/services/CashFreeOrderService', () => ({ __esModule: true, default: { createCourseOrder: jest.fn(), getOrderStatus: jest.fn() } }));
jest.mock('../../FunctionCall/services/GumletService', () => ({ __esModule: true, default: { confirmCoursePurchase: jest.fn(), claimFreeCourse: jest.fn() } }));
jest.mock('../../FunctionCall/services/CouponService', () => ({ __esModule: true, default: {} }));
jest.mock('../../utils/cashfreeEnv', () => ({ getCashfreeEnvironment: () => 'SANDBOX', friendlyPaymentError: (e, d) => d }));

const RazorpayCheckout = require('react-native-razorpay');
const students = require('../../FunctionCall/services/StudentPaymentService').default;
const cashfree = require('../../FunctionCall/services/CashFreeOrderService').default;
const CoursePurchaseSheet = require('../../components/CoursePurchaseSheet').default;

const COURSE = { _id: 'c1', title: 'Options 101', price: 999 };
const ID = 'SPO0123456789abcdef0123';

async function payWith() {
  const onPurchased = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(<CoursePurchaseSheet visible course={COURSE} onClose={() => {}} onPurchased={onPurchased} />);
  });
  const inputs = tree.root.findAllByType(TextInput);
  const byPh = (ph) => inputs.find((i) => i.props.placeholder === ph);
  await act(async () => {
    inputs[1].props.onChangeText('Asha');
    byPh('10-digit mobile').props.onChangeText('9876543210');
  });
  const pay = tree.root.findAllByType(TouchableOpacity).find((t) => t.props.style && t.props.onPress && t.props.onPress.name === 'handlePay');
  await act(async () => { await pay.props.onPress(); });
  return { tree, onPurchased };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.IS_REACT_ACT_ENVIRONMENT = true;
});

test('razorpay advisor: native checkout on the server order, then confirm → paid', async () => {
  students.getGateway.mockResolvedValue({ gateway: 'razorpay', website: 'https://arfs.alphaquark.in' });
  students.startCourseCheckout.mockResolvedValue({ orderId: ID, gateway: 'razorpay', amount: 999, checkout: { key: 'rzp_live_k', orderId: 'order_X', amount: 99900, prefill: { email: 'buyer@x.com' } } });
  RazorpayCheckout.open.mockResolvedValue({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_X', razorpay_signature: 'sig' });
  students.confirm.mockResolvedValue({ status: 'fulfilled' });
  const { onPurchased } = await payWith();
  expect(students.startCourseCheckout).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'c1', mobile: '9876543210' }));
  expect(students.startCourseCheckout.mock.calls[0][0]).not.toHaveProperty('amount');
  expect(RazorpayCheckout.open).toHaveBeenCalledWith(expect.objectContaining({ key: 'rzp_live_k', order_id: 'order_X', amount: 99900 }));
  expect(students.confirm).toHaveBeenCalledWith(ID, { razorpay: { paymentId: 'pay_1', orderId: 'order_X', signature: 'sig' } });
  expect(cashfree.createCourseOrder).not.toHaveBeenCalled();
  expect(onPurchased).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: 'paid', orderId: ID }));
});

test('razorpay closed without paying: server asked once, nothing granted', async () => {
  students.getGateway.mockResolvedValue({ gateway: 'razorpay' });
  students.startCourseCheckout.mockResolvedValue({ orderId: ID, gateway: 'razorpay', checkout: { key: 'k', orderId: 'order_X', amount: 99900 } });
  RazorpayCheckout.open.mockRejectedValue({ code: 0, description: 'Payment cancelled by user' });
  students.status.mockResolvedValue({ status: 'created' });
  const { onPurchased } = await payWith();
  expect(students.status).toHaveBeenCalledWith(ID);
  expect(students.confirm).not.toHaveBeenCalled();
  expect(onPurchased).not.toHaveBeenCalled();
});

test('cashfree advisor: the existing CashFree order path runs, no Razorpay', async () => {
  students.getGateway.mockResolvedValue({ gateway: 'cashfree' });
  cashfree.createCourseOrder.mockResolvedValue({ data: { payment_session_id: 's', order_id: 'o' }, subscription: { cashfree_order_id: 'o' } });
  await payWith();
  expect(cashfree.createCourseOrder).toHaveBeenCalled();
  expect(students.startCourseCheckout).not.toHaveBeenCalled();
  expect(RazorpayCheckout.open).not.toHaveBeenCalled();
});

test('phonepe / payu advisor: sent to the advisor website course page, no order created', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  students.getGateway.mockResolvedValue({ gateway: 'phonepe', website: 'https://demo.alphaquark.in' });
  await payWith();
  expect(open).toHaveBeenCalledWith('https://demo.alphaquark.in/course/c1');
  expect(students.startCourseCheckout).not.toHaveBeenCalled();
  expect(cashfree.createCourseOrder).not.toHaveBeenCalled();
});
