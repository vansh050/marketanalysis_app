/**
 * LiveKitService — mobile mirror of prod-alphaquark-github/src/services/LiveKitService.js.
 *
 * All endpoints live under /api/livekit/* on the Node backend. Discovery
 * endpoints (list, public detail) use the standard header pair. Purchase
 * + status-poll require a Firebase Bearer (the backend enforces
 * caller.email == body.userEmail since commit c8512b9, 2026-05-30) — we
 * use getOptionalAuthHeaders so signed-in callers get the Bearer
 * attached automatically. Authed endpoints (viewer token, host token,
 * admin) require a Bearer outright.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.1.
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import {
  getPublicHeaders,
  getAuthedHeaders,
  getOptionalAuthHeaders,
} from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/livekit`;

class LiveKitService {
  // ---------------------------------------------------------------------------
  // Public discovery (no auth)
  // ---------------------------------------------------------------------------

  async listPublicWebinars() {
    const res = await axios.get(`${BASE}/webinars/list`, { headers: getPublicHeaders() });
    return res.data?.data;
  }

  // Opportunistically authed — when the caller is signed in, the backend
  // returns `isEnrolled` + `enrolledEmail` so WebinarDetailScreen can
  // render the LiveRoom directly for returning registrants instead of
  // re-asking them to register. Anonymous callers get the same payload
  // with isEnrolled=false. Matches web's getPublicWebinar shape.
  async getPublicWebinar(lessonId) {
    const headers = await getOptionalAuthHeaders();
    const res = await axios.get(`${BASE}/webinars/${lessonId}/public`, {
      headers,
    });
    return res.data?.data;
  }

  // ---------------------------------------------------------------------------
  // Purchase — requires Firebase Bearer + caller.email == userEmail
  // (backend commit c8512b9, 2026-05-30). Free path returns
  //   { paymentStatus: 'free', courseId, buyerEmail }
  // Paid path returns
  //   { paymentStatus: 'pending', orderId, cashfree: {...} }
  // ---------------------------------------------------------------------------

  async purchaseWebinarTicket(lessonId, { userEmail, userName, mobile, returnUrl }) {
    const headers = await getOptionalAuthHeaders();
    const res = await axios.post(
      `${BASE}/webinars/${lessonId}/purchase`,
      { userEmail, userName, mobile, returnUrl },
      { headers },
    );
    return res.data?.data;
  }

  async getWebinarPurchaseStatus(orderId) {
    const headers = await getOptionalAuthHeaders();
    const res = await axios.get(`${BASE}/webinars/purchase-status/${orderId}`, {
      headers,
    });
    return res.data?.data;
  }

  /**
   * Poll the purchase-status endpoint until `paid`, `failed`, or timeout.
   * Mirrors the web helper's AbortController + early-yield-on-abort shape so
   * callers can cancel cleanly on unmount.
   */
  async pollWebinarPurchaseUntilTerminal(orderId, { timeoutMs = 180000, intervalMs = 3000, signal } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) return { paymentStatus: 'aborted', orderId };
      const s = await this.getWebinarPurchaseStatus(orderId);
      if (s.paymentStatus === 'paid' || s.paymentStatus === 'failed') return s;
      await new Promise((resolve) => {
        const t = setTimeout(resolve, intervalMs);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve();
          }, { once: true });
        }
      });
    }
    return { paymentStatus: signal?.aborted ? 'aborted' : 'timeout', orderId };
  }

  // ---------------------------------------------------------------------------
  // Live-class viewer token (Firebase + verifyEnrollment server-side)
  // Returns { url, token, ttlSeconds }
  // ---------------------------------------------------------------------------

  async getViewerToken(lessonId, courseId) {
    const headers = await getAuthedHeaders();
    const res = await axios.post(`${BASE}/token/${lessonId}`, { courseId }, { headers });
    return res.data?.data;
  }
}

export default new LiveKitService();
