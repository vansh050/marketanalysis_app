/**
 * CouponService — buyer-side coupon check at checkout.
 *
 * Hits the same endpoint web's `PlanSubscribeModal` uses today:
 *
 *   GET /api/offers/coupon-check?couponCode=&planId=&amount=
 *
 * Returns `{ success, ...couponData }` on a valid code; throws (via
 *  `success: false → message`) on invalid / expired / over-limit codes.
 *
 * For courses, pass `planId = courseId` and `amount = priceBeforeDiscount`.
 * The server matches the coupon against the targeted entity and the
 * passed amount.
 *
 * Note: there is a separate /api/course-coupons/{validate,apply} route
 * surface used only by the admin coupon-management UI on web — NOT at
 * buyer checkout. Mobile mirrors web's checkout choice and uses
 * /api/offers/coupon-check.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.7.
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getPublicHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/offers`;

class CouponService {
  /**
   * Check a coupon code. Returns the coupon payload on success; throws
   * an Error with the server's `message` on failure (invalid / expired
   * / not applicable / over-limit / etc.).
   */
  async checkCoupon({ couponCode, planId, amount }) {
    if (!couponCode) throw new Error('Coupon code is required');
    const res = await axios.get(`${BASE}/coupon-check`, {
      params: { couponCode, planId, amount },
      headers: getPublicHeaders(),
    });
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Coupon invalid');
    }
    return res.data;
  }
}

export default new CouponService();
