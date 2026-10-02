jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../utils/Logging', () => ({logPayment: jest.fn()}));
jest.mock('../../FunctionCall/services/PaymentStatusService', () => ({
  checkFullPaymentStatus: jest.fn(),
  PaymentStatus: {SUCCESS: 'SUCCESS', PENDING: 'PENDING', NOT_FOUND: 'NOT_FOUND', FAILED: 'FAILED'},
  DigioStatus: {PENDING: 'PENDING', FAILED: 'FAILED'},
}));
jest.mock('../../utils/cashfreeEnv', () => ({
  describeStoredPaymentFailure: jest.fn(() => ({title: 'Payment failed', message: 'Try again.'})),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPendingPaymentData,
  getPendingPayment,
  savePendingPayment,
} from '../../FunctionCall/services/PendingPaymentManager';

describe('PendingPaymentManager checkout recovery context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage._reset();
  });

  test('PY-05 preserves plan, coupon, payment identity and gateway across native recovery storage', async () => {
    const pending = createPendingPaymentData({
      orderId: 'synthetic-order-123',
      subscriptionId: 'synthetic-subscription-123',
      userEmail: 'synthetic@example.invalid',
      planId: 'synthetic-plan-123',
      paymentType: 'recurring',
      amount: 999,
      planDetails: {
        _id: 'synthetic-plan-123',
        name: 'Synthetic monthly plan',
        duration: 30,
        advisor_email: 'advisor@example.invalid',
      },
      userDetails: {
        name: 'Synthetic User',
        email: 'synthetic@example.invalid',
        pan: 'AAAAA0000A',
        phone: '9999999999',
        countryCode: '+91',
      },
      couponId: 'synthetic-coupon-id',
      couponCode: 'SYNTHETIC10',
      gateway: 'cashfree',
      frequency: 'monthly',
    });

    await savePendingPayment(pending);
    const recovered = await getPendingPayment();

    expect(recovered).toEqual(expect.objectContaining({
      orderId: 'synthetic-order-123',
      subscriptionId: 'synthetic-subscription-123',
      planId: 'synthetic-plan-123',
      couponId: 'synthetic-coupon-id',
      couponCode: 'SYNTHETIC10',
      gateway: 'cashfree',
      frequency: 'monthly',
    }));
    expect(recovered.planDetails).toEqual(expect.objectContaining({
      _id: 'synthetic-plan-123',
      name: 'Synthetic monthly plan',
    }));
  });
});
