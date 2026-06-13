/**
 * CashFreeOrderService — thin helpers around the Node CashFree routes
 * mobile course-purchase needs.
 *
 *   POST /api/cashfree/admin-token-purchase
 *       Server creates the CF order + returns
 *       `{ subscription: { cashfree_order_id, ... },
 *          data: { order_id, payment_session_id, ... } }`.
 *       For course purchase, the `order_tags` get the courseId /
 *       courseTitle / validityDurationDays / userId / name we send so
 *       the server-side webhook + reconciliation cron can recover the
 *       enrollment if the FE flow doesn't complete.
 *
 *   GET /api/cashfree?orderId=<cashfree_order_id>
 *       Reads the latest order row. `data[0].payment_status` is one of
 *       'SUCCESS' | 'FAILED' | 'PENDING' (we mainly check SUCCESS to
 *       fan out the post-payment enrollment write).
 *
 * Mirrors web's courseDetailsPage.handleUnlockPayment flow.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
 */

import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { getPublicHeaders } from '../../utils/courseAuthHeaders';
import { validateChargeableAmount } from '../../utils/validateChargeableAmount';

const BASE = `${server.server.baseUrl}api/cashfree`;

class CashFreeOrderService {
  /**
   * Create the CashFree order for a course purchase. Server stamps the
   * course identifiers onto `order_tags` so the webhook can recover the
   * enrollment if our post-payment write fails.
   *
   * Returns the raw server response so the caller can pick out both
   * `data.payment_session_id` (for the SDK) and `subscription.cashfree_order_id`
   * (for the post-payment status check + addClientCourse stamp).
   */
  async createCourseOrder({ amount, customerId, user_email, mobileNumber, pan, course, name, userId }) {
    // P4 (web-parity D10): block a ₹0 (100%-coupon) order before it reaches the
    // gateway — the gateway succeeds at ₹0 and the buyer is entitled without paying.
    // Shared guard, identical to the subscription path. See WEB_PARITY_MIGRATION §5.3.
    const guard = validateChargeableAmount(amount);
    if (!guard.ok) {
      const err = new Error(guard.message);
      err.code = guard.reason;
      err.blockedByGuard = true;
      throw err;
    }
    const res = await axios.post(
      `${BASE}/admin-token-purchase`,
      {
        amount: String(amount),
        customerId,
        user_email,
        mobileNumber: String(mobileNumber),
        pan,
        advisor: Config.REACT_APP_ADVISOR_SPECIFIC_TAG,
        // Course-purchase markers — embedded in CF order_tags so the
        // webhook + reconciliation cron can write the CCL row server-side
        // as a safety net for FE failures.
        courseId: course._id,
        courseTitle: course.title,
        validityDurationDays: course.validityDurationDays,
        userId,
        name,
      },
      { headers: getPublicHeaders() },
    );
    return res.data;
  }

  /**
   * Read the latest CashFree row for the given order. Returns
   * `{ payment_status, order_id, cf_payment_id, ... }` (the first row
   * in the server's response array).
   */
  async getOrderStatus(orderId) {
    const res = await axios.get(BASE, {
      headers: getPublicHeaders(),
      params: { orderId },
    });
    return res.data?.data?.[0] || null;
  }
}

export default new CashFreeOrderService();
