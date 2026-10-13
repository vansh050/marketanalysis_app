/**
 * GumletService — mobile viewer-only subset of /api/gumlet/*.
 *
 * Three calls:
 *   - listCollections()                       — catalog (no auth required by
 *                                               the server, but we still send
 *                                               the standard public headers).
 *                                               Filter `kind !== 'webinar'`
 *                                               in the caller so the auto-
 *                                               managed webinar container
 *                                               doesn't show up in Courses.
 *   - getCourse(courseId)                     — full modules + lessons payload.
 *   - getPlaybackToken(lessonId, courseId)    — Firebase ID-token Bearer +
 *                                               server-side enrollment check;
 *                                               returns { embedUrl, url,
 *                                               expiresAt, drm, format }.
 *
 * Purchase: confirmCoursePurchase (paid, gateway-verified) and
 * claimFreeCourse (₹0). Both enroll the Firebase identity.
 *
 * Admin CRUD (collections/create, demo-course/create, lesson/module mutators,
 * trailer-token, the admin-only client-course/add) is intentionally
 * omitted — the app never writes enrollments directly.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getPublicHeaders, getAuthedHeaders, getOptionalAuthHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/gumlet`;

class GumletService {
  async listCollections() {
    const res = await axios.get(`${BASE}/collections`, { headers: getPublicHeaders() });
    return res.data;
  }

  async getCourse(courseId) {
    // A draft course is returned only to its admins / enrolled customers
    // (server, 2026-10-12), so send the sign-in when there is one.
    const res = await axios.get(`${BASE}/collections/${courseId}`, { headers: await getOptionalAuthHeaders() });
    return res.data;
  }

  /**
   * Server contract:
   *   200 → { success, data: { assetId, embedUrl, url, expiresAt, drm, format } }
   *   401 → Firebase ID-token bad / missing
   *   403 → enrollment missing / lesson not in this course
   *   503 → ASSET_NOT_READY (encoding still in progress)
   * Errors are re-thrown unchanged so the caller can branch on
   * `error.response?.status`.
   */
  async getPlaybackToken(lessonId, courseId) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(
      `${BASE}/playback-token/${lessonId}`,
      { courseId },
      { headers },
    );
    return res.data?.data;
  }

  /**
   * Resume + watch metering (server since 2026-10-13). All best-effort:
   *   getCourseProgress → { [lessonId]: { lastPositionSeconds, durationSeconds, completed } }
   *   upsertLessonProgress → POST /lessons/:lessonId/progress
   *   reportWatchTime → POST /lessons/:lessonId/watch ({ courseId, seconds }),
   *     feeds AlphaQuark's monthly viewer-hour billing.
   */
  async getCourseProgress(courseId) {
    const headers = await getAuthedHeaders();
    const res = await axios.get(`${BASE}/courses/${courseId}/progress`, { headers });
    return res.data?.data || {};
  }

  async upsertLessonProgress(lessonId, body) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(`${BASE}/lessons/${lessonId}/progress`, body, { headers });
    return res.data;
  }

  async reportWatchTime(lessonId, body) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(`${BASE}/lessons/${lessonId}/watch`, body, { headers });
    return res.data;
  }

  /**
   * Paid purchase confirmation (server: POST /client-course/purchase).
   * The server verifies the CashFree order is PAID, belongs to the signed-in
   * account and this course, and matches the server-computed price, then
   * enrolls the token identity. Idempotent on orderId.
   *   200 → { success, data, action }
   *   402 → ORDER_NOT_PAID (not verifiable yet — the cron will enroll)
   *   403/409 → binding / amount mismatch
   * Errors are re-thrown so the caller can branch on response.status.
   */
  async confirmCoursePurchase({ courseId, orderId, name }) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(`${BASE}/client-course/purchase`, { courseId, orderId, name }, { headers });
    return res.data;
  }

  /**
   * ₹0 enrollment (free course or 100% coupon). The server recomputes the
   * price and refuses anything above ₹0 (402), consumes the coupon
   * atomically (409 when exhausted) and enrolls the token identity.
   */
  async claimFreeCourse({ courseId, couponId, name }) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(`${BASE}/client-course/claim-free`, { courseId, couponId, name }, { headers });
    return res.data;
  }

  /**
   * The signed-in caller's enrollment in a course (server:
   * GET /client-course/details, Firebase-verified — the identity comes from
   * the token; `userEmail` is kept for call-site compatibility, unused).
   *   200 → { success: true, data: { course: { startDate, endDate, ... } } }
   *   404 → not enrolled.
   */
  async getClientCourseDetails(userEmail, courseId) {
    const res = await axios.get(`${BASE}/client-course/details`, {
      headers: await getAuthedHeaders(),
      params: { courseId },
    });
    return res.data;
  }
}

export default new GumletService();
