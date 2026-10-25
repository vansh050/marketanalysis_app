/**
 * AppPaymentGateway — the one place the app decides which gateway takes a
 * payment, plus the PhonePe pieces every purchase screen shares.
 *
 * supportAQ → Payment Gateway Config has two switches: the website gateway
 * (`active_gateway`) and an optional APP gateway (`app_active_gateway`; empty
 * = follow the website). The backend resolves the app's choice:
 *   - plans:            GET /api/adminControl/get-payment-platform
 *   - courses/webinars: GET /api/student-payments/gateway?channel=android|ios
 * so a supportAQ switch reaches the app on the next purchase, no release.
 *
 * `dispatchAppCheckout` never falls through to Razorpay. A screen without an
 * initiator for the active gateway shows an error and logs a critical
 * anomaly — the silent Razorpay fallback is what left PhonePe tenants unable
 * to take payment in the app (2026-10-14).
 */
import axios from 'axios';
import { Alert, AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../../config/env';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getTenantSubdomain } from '../../utils/variantHelper';
import { logFrontendAnomaly } from '../../utils/Logging';

export const APP_GATEWAYS = Object.freeze(['cashfree', 'razorpay', 'payu', 'phonepe']);

export const appChannel = () => (Platform.OS === 'ios' ? 'ios' : 'android');

const headers = (headerName) => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': headerName || getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

export function normalizeGateway(value) {
  const g = String(value || '').trim().toLowerCase();
  return APP_GATEWAYS.includes(g) ? g : null;
}

/**
 * The gateway for a plan purchase in the app (supportAQ app switch, else the
 * website gateway). Resolves null when the lookup fails — callers must not
 * guess a gateway in that case.
 */
export async function fetchAppPaymentPlatform({ headerName } = {}) {
  try {
    const res = await axios.get(`${server.server.baseUrl}api/adminControl/get-payment-platform`, {
      headers: headers(headerName),
      timeout: 10000,
    });
    return normalizeGateway(res?.data?.paymentPlatform);
  } catch (error) {
    console.warn('[AppPaymentGateway] get-payment-platform failed:', error?.message);
    return null;
  }
}

/**
 * Run the screen's initiator for `gateway`.
 * handlers: { cashfree: { oneTime, recurring }, razorpay: {...}, payu: {...}, phonepe: {...} }
 * Returns the initiator's result, or false when none exists.
 */
export function dispatchAppCheckout({ surface, gateway, recurring = false, handlers = {}, configData }) {
  const kind = recurring ? 'recurring' : 'oneTime';
  const g = normalizeGateway(gateway);
  const handler = g ? handlers?.[g]?.[kind] : null;
  if (typeof handler !== 'function') {
    logFrontendAnomaly(
      'app_checkout_gateway_unhandled',
      'critical',
      { surface, gateway: gateway || null, recurring: Boolean(recurring), platform: Platform.OS },
      configData,
    );
    Alert.alert(
      'Payment unavailable',
      g
        ? 'Online payment is not available here right now. Please contact your advisor.'
        : 'We could not load the payment options. Please check your connection and try again.',
    );
    return false;
  }
  return handler();
}

// ── PhonePe instrument group (UPI / net banking vs cards) ────────────────

/**
 * The PhonePe payment groups this advisor offers. With instrument routing an
 * advisor has one merchant ID per group, so the order must be opened on the
 * group the buyer will pay with. [] when not configured / unreadable.
 */
export async function fetchPhonePeInstrumentGroups({ headerName } = {}) {
  try {
    const res = await axios.get(`${server.server.baseUrl}api/payment-gateway/client-config`, {
      headers: headers(headerName),
      timeout: 10000,
    });
    const groups = res?.data?.config?.phonepe?.payment_instrument_groups;
    return Array.isArray(groups) ? groups.filter((g) => g && g.id) : [];
  } catch (error) {
    console.warn('[AppPaymentGateway] client-config failed:', error?.message);
    return [];
  }
}

/**
 * Ask the buyer for a PhonePe group when there is a real choice.
 * Resolves the group id, undefined (no choice needed — server default), or
 * null when the buyer cancels.
 */
export async function choosePhonePeGroup({ headerName, recurring = false } = {}) {
  if (recurring) return undefined;
  const groups = await fetchPhonePeInstrumentGroups({ headerName });
  if (groups.length <= 1) return groups[0]?.id;
  return new Promise((resolve) => {
    Alert.alert(
      'Choose how you want to pay',
      'You will complete the payment securely on PhonePe.',
      [
        ...groups.map((g) => ({ text: g.label || g.id, onPress: () => resolve(g.id) })),
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

// ── Course / webinar orders opened in a browser (PhonePe) ───────────────

const STUDENT_PENDING_KEY = 'aq_student_pending_order';

export async function rememberPendingStudentOrder(orderId, meta = {}) {
  await AsyncStorage.setItem(
    STUDENT_PENDING_KEY,
    JSON.stringify({ orderId, advisor: getTenantSubdomain(), createdAt: Date.now(), ...meta }),
  );
}

export async function takePendingStudentOrder() {
  try {
    const pending = JSON.parse((await AsyncStorage.getItem(STUDENT_PENDING_KEY)) || 'null');
    if (!pending?.orderId) return null;
    if (pending.advisor && pending.advisor !== getTenantSubdomain()) return null;
    return pending;
  } catch (_error) {
    return null;
  }
}

export async function clearPendingStudentOrder() {
  await AsyncStorage.removeItem(STUDENT_PENDING_KEY).catch(() => {});
}

/** channelMetadata PhonePe needs for an app-channel order. */
export function phonePeAppMetadata() {
  // Loaded lazily so screens that never pay with PhonePe (and their tests)
  // do not need the native module.
  const DeviceInfo = require('react-native-device-info').default;
  return { appId: DeviceInfo.getBundleId(), channelVersion: DeviceInfo.getSystemVersion() };
}

/**
 * Open a hosted checkout URL and resolve when the buyer is back in the app
 * (AppState → active, or a deep link), or after `timeoutMs`.
 */
export async function openAndAwaitReturn(url, { timeoutMs = 15 * 60 * 1000 } = {}) {
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (!supported) throw new Error('The payment page cannot be opened on this device');
  return new Promise((resolve, reject) => {
    let left = false;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      appSub.remove();
      linkSub.remove();
      resolve(value);
    };
    const appSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') left = true;
      else if (left) finish('returned');
    });
    const linkSub = Linking.addEventListener('url', () => finish('deeplink'));
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    Linking.openURL(url).catch((error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      appSub.remove();
      linkSub.remove();
      reject(error);
    });
  });
}
