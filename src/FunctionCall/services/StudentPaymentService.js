/**
 * StudentPaymentService — course payments on the gateway the advisor chose
 * in supportAQ, when that gateway is not CashFree (2026-10-12).
 *
 *   GET  /api/student-payments/gateway          { gateway, website }
 *   POST /api/student-payments/course/checkout  server-priced order
 *   POST /api/student-payments/confirm          after Razorpay returns
 *   GET  /api/student-payments/status/:orderId  poll
 *
 * The server prices the order, opens it on the advisor's own gateway account
 * and decides "paid" by asking the gateway. CashFree advisors keep the
 * existing CashFree flow in CoursePurchaseSheet.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5;
 * prod-alphaquark-github docs/COURSES_ARCHITECTURE.md §7.10.
 */

import axios from 'axios';
import { Platform } from 'react-native';
import server from '../../utils/serverConfig';
import { getPublicHeaders, getAuthedHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/student-payments`;

class StudentPaymentService {
  /** { gateway: 'cashfree'|'razorpay'|'payu'|'phonepe'|null, website } */
  async getGateway() {
    // channel lets the backend apply supportAQ's app-only gateway switch.
    const res = await axios.get(`${BASE}/gateway`, {
      headers: getPublicHeaders(),
      params: { channel: Platform.OS === 'ios' ? 'ios' : 'android' },
      timeout: 15000,
    });
    return res.data?.data || { gateway: null, website: null };
  }

  /**
   * Resolves { orderId, gateway, amount, checkout }. Rejects with
   * err.code from the server (USE_CASHFREE, USE_CLAIM_FREE,
   * COURSE_GATEWAY_NOT_CONFIGURED, COUPON_INVALID, …).
   */
  async startCourseCheckout({ courseId, couponId, name, mobile, pan, gstin, paymentInstrumentGroup, channelMetadata }) {
    try {
      const res = await axios.post(
        `${BASE}/course/checkout`,
        {
          courseId, couponId, name, mobile, pan, gstin,
          channel: Platform.OS === 'ios' ? 'ios' : 'android',
          // PhonePe: the payment group the buyer chose (its own merchant ID).
          ...(paymentInstrumentGroup ? { paymentInstrumentGroup } : {}),
          ...(channelMetadata ? { channelMetadata } : {}),
        },
        { headers: await getAuthedHeaders(), timeout: 30000 },
      );
      return res.data.data;
    } catch (err) {
      const data = err?.response?.data || {};
      const e = new Error(data.message || err?.message || 'Payment could not be started');
      e.code = data.error || err?.code;
      e.status = err?.response?.status;
      throw e;
    }
  }

  async confirm(orderId, gatewayResponse = {}) {
    const res = await axios.post(`${BASE}/confirm`, { orderId, ...gatewayResponse }, { headers: getPublicHeaders(), timeout: 30000 });
    return res.data?.data;
  }

  async status(orderId) {
    const res = await axios.get(`${BASE}/status/${encodeURIComponent(orderId)}`, { headers: getPublicHeaders(), timeout: 30000 });
    return res.data?.data;
  }

  /** Poll until fulfilled / failed / expired, or time runs out. */
  async waitForFinal(orderId, { timeoutMs = 45000, intervalMs = 3000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      try {
        last = await this.status(orderId);
        if (['fulfilled', 'failed', 'expired'].includes(last?.status)) {
          return last;
        }
      } catch (_) {
        // transient — keep polling
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return last || { status: 'created', orderId };
  }
}

export default new StudentPaymentService();
