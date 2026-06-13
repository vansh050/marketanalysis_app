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
    const data = res.data || {};
    // Response-shape tolerance (web-parity P4): different coupon backends flag
    // success as `success` / `valid` / presence of a coupon object. Treat any of
    // them as valid so a working coupon isn't rejected on a field-name mismatch.
    const ok =
      data.success === true ||
      data.valid === true ||
      Boolean(data.coupon || data.couponData || data.discount_type);
    if (!ok) {
      throw new Error(data.message || 'Coupon invalid');
    }
    // Normalize the discount → finalAmount defensively. This is the fix for the
    // web "30%-coupon was charging ₹0" leak: never let a percentage coupon collapse
    // the charge to 0 because a flat-amount field was missing. The caller then runs
    // validateChargeableAmount(finalAmount) before the gateway.
    const normalized = normalizeDiscount(data, amount);
    return { ...data, ...normalized };
  }
}

// Compute { discountAmount, finalAmount } from whatever discount shape the server
// returns (percentage vs flat, varied field names), clamped to [0, base].
function normalizeDiscount(data, baseAmount) {
  const base = Number(baseAmount) || 0;
  const type = String(
    data.discount_type || data.coupon_discount_type || data.type || '',
  ).toLowerCase();
  const value = Number(
    data.discount_value ?? data.coupon_discount_value ?? data.value ?? 0,
  );
  // Prefer an explicit server-computed final/discount if present and sane.
  const serverFinal = Number(
    data.final_amount ?? data.finalAmount ?? data.payable_amount ?? NaN,
  );
  let discountAmount;
  if (type.includes('percent') || type === '%') {
    discountAmount = (base * value) / 100;
  } else if (value > 0) {
    discountAmount = value; // flat
  } else {
    discountAmount = base - (Number.isNaN(serverFinal) ? base : serverFinal);
  }
  discountAmount = Math.max(0, Math.min(base, Number(discountAmount) || 0));
  let finalAmount = Number.isNaN(serverFinal)
    ? base - discountAmount
    : serverFinal;
  finalAmount = Math.max(0, finalAmount);
  return { discountAmount, finalAmount };
}

export default new CouponService();
