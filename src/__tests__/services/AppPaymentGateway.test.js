/**
 * The app follows the gateway chosen in supportAQ (app switch, else the
 * website gateway) on every purchase screen, and never silently falls back
 * to Razorpay — that fallback left PhonePe tenants unable to take payment in
 * the app (2026-10-14).
 */
import fs from 'fs';
import path from 'path';

jest.mock('axios');
jest.mock('react-native-config', () => ({ REACT_APP_AQ_KEYS: 'k', REACT_APP_AQ_SECRET: 's' }));
jest.mock('react-native-device-info', () => ({ getBundleId: () => 'com.test', getSystemVersion: () => '14' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/SecurityTokenManager', () => ({ generateToken: () => 'tok' }));
jest.mock('../../utils/serverConfig', () => ({ __esModule: true, default: { server: { baseUrl: 'https://api.test/' } } }));
jest.mock('../../utils/variantHelper', () => ({ getTenantSubdomain: () => 'tenant' }));
jest.mock('../../utils/Logging', () => ({ logFrontendAnomaly: jest.fn() }));

import axios from 'axios';
import { Alert } from 'react-native';
import { logFrontendAnomaly } from '../../utils/Logging';
import {
  choosePhonePeGroup,
  dispatchAppCheckout,
  fetchAppPaymentPlatform,
} from '../../FunctionCall/services/AppPaymentGateway';

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('dispatchAppCheckout', () => {
  const handlers = {
    cashfree: { oneTime: jest.fn(() => 'cf1'), recurring: jest.fn(() => 'cfR') },
    phonepe: { oneTime: jest.fn(() => 'pp1'), recurring: jest.fn(() => 'ppR') },
  };

  test('runs the initiator for the active gateway and plan type', () => {
    expect(dispatchAppCheckout({ surface: 't', gateway: 'PhonePe', handlers })).toBe('pp1');
    expect(dispatchAppCheckout({ surface: 't', gateway: 'cashfree', recurring: true, handlers })).toBe('cfR');
  });

  test('a gateway with no initiator fails loudly instead of using Razorpay', () => {
    expect(dispatchAppCheckout({ surface: 't', gateway: 'payu', handlers })).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
    expect(logFrontendAnomaly).toHaveBeenCalledWith(
      'app_checkout_gateway_unhandled', 'critical', expect.objectContaining({ gateway: 'payu' }), undefined,
    );
  });

  test('an unknown gateway never guesses one', () => {
    expect(dispatchAppCheckout({ surface: 't', gateway: null, handlers })).toBe(false);
  });
});

test('fetchAppPaymentPlatform returns null when the lookup fails', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline'));
  expect(await fetchAppPaymentPlatform()).toBeNull();
  axios.get.mockResolvedValueOnce({ data: { paymentPlatform: 'PHONEPE' } });
  expect(await fetchAppPaymentPlatform()).toBe('phonepe');
});

describe('choosePhonePeGroup', () => {
  test('one group needs no question', async () => {
    axios.get.mockResolvedValueOnce({ data: { config: { phonepe: { payment_instrument_groups: [{ id: 'upi_netbanking' }] } } } });
    expect(await choosePhonePeGroup()).toBe('upi_netbanking');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('two groups ask the buyer; cancel returns null', async () => {
    axios.get.mockResolvedValue({
      data: { config: { phonepe: { payment_instrument_groups: [{ id: 'upi_netbanking', label: 'UPI' }, { id: 'cards', label: 'Cards' }] } } },
    });
    Alert.alert.mockImplementationOnce((_t, _m, buttons) => buttons[1].onPress());
    expect(await choosePhonePeGroup()).toBe('cards');
    Alert.alert.mockImplementationOnce((_t, _m, buttons) => buttons[2].onPress());
    expect(await choosePhonePeGroup()).toBeNull();
  });

  test('recurring never asks', async () => {
    expect(await choosePhonePeGroup({ recurring: true })).toBeUndefined();
  });
});

describe('purchase screens are wired to the shared gateway rules', () => {
  test('model-portfolio / Bespoke buy sheet dispatches PhonePe and sends capital', () => {
    const src = read('src/components/ModelPortfolioComponents/MPInvestNowModal.js');
    expect(src).toContain('dispatchAppCheckout({');
    expect(src).toMatch(/phonepe: \{\s*oneTime: \(\) => initiatePhonePePayment/);
    const phonePe = src.slice(src.indexOf('const initiatePhonePePayment'), src.indexOf('const handlePaymentType'));
    expect(phonePe).toContain('capital: invetAmount');
    expect(phonePe).toContain('paymentInstrumentGroup');
  });

  test('course and webinar sheets handle PhonePe natively and send the app channel', () => {
    expect(read('src/components/CoursePurchaseSheet.js')).toContain("if (gw?.gateway === 'phonepe')");
    expect(read('src/components/BuyWebinarTicketSheet.js')).toContain("purchase.gateway === 'phonepe'");
    expect(read('src/FunctionCall/services/StudentPaymentService.js')).toContain("params: { channel:");
    expect(read('src/FunctionCall/services/LiveKitService.js')).toContain("channel: Platform.OS === 'ios' ? 'ios' : 'android'");
    expect(read('src/FunctionCall/services/CashFreeOrderService.js')).toContain("channel: Platform.OS === 'ios' ? 'ios' : 'android'");
  });
});
