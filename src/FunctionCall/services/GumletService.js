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
 * Admin CRUD (collections/create, demo-course/create, lesson/module mutators,
 * trailer-token, client-course/add) is intentionally omitted — mobile is
 * viewer-only for v1.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getPublicHeaders, getAuthedHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/gumlet`;

class GumletService {
  async listCollections() {
    const res = await axios.get(`${BASE}/collections`, { headers: getPublicHeaders() });
    return res.data;
  }

  async getCourse(courseId) {
    const res = await axios.get(`${BASE}/collections/${courseId}`, { headers: getPublicHeaders() });
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
   * Post-payment enrollment writer. Mirrors web's pattern in
   * courseDetailsPage.handleAddCourseClient — called TWICE in the web
   * flow: once before CashFree popup (orderId stamp, no payment_status)
   * and again after SUCCESS (transactionId + payment_status filled in).
   * Server is idempotent on orderId. Action returned in
   * `data.action`: 'created' | 'pushed' | 'extended' | 'idempotent_update'.
   *
   * The cashfree_webhook → cron path is the safety net if the FE flow
   * doesn't complete — so a network drop / tab close after CF SUCCESS
   * still results in the enrollment landing within ~5 minutes.
   */
  async addClientCourse(payload) {
    // Public headers — server doesn't require Firebase auth here
    // (guest checkout supported on web). Header pair still required.
    const res = await axios.post(
      `${BASE}/client-course/add`,
      payload,
      { headers: getPublicHeaders() },
    );
    return res.data;
  }

  /**
   * Returns the caller's enrollment row in a specific course (or null
   * if not enrolled). Server contract:
   *   200 → { success: true, data: { course: { startDate, endDate, ... }, modules, ... } }
   *   404 → enrollment row not found (caller is NOT enrolled).
   * Header-only — no Firebase Bearer required. Mirrors web's
   * `GumletService.getClientCourseDetails(userEmail, courseId)` exactly.
   *
   * Used by CourseDetailScreen to flip the "Get free access" / "Enroll now"
   * CTA to "Purchased" once the user has an active enrollment — without
   * this query the button stays in the un-purchased state forever, even
   * after a successful free-enroll write.
   */
  async getClientCourseDetails(userEmail, courseId) {
    const res = await axios.get(`${BASE}/client-course/details`, {
      headers: getPublicHeaders(),
      params: { userEmail, courseId },
    });
    return res.data;
  }
}

export default new GumletService();
