/**
 * RiaBillingService — mobile client for the RIA AUM-Billing customer read surface.
 * Mirrors prod-alphaquark-github/src/services/RiaBillingService.js (the /me/* reads).
 *
 * P0 scaffold (docs/WEB_PARITY_MIGRATION_2026-06.md §4.4). Read-only:
 *   - value-history  → Performance section (P1)
 *   - invoices       → Fee Statement in PaymentHistoryScreen (P1, D15)
 *   - contract       → billing_mode gate (AUA) + contract strip
 *   - invoice PDF    → returned as bytes for the native viewer/share (D7/D15)
 *
 * HOST (Codex T7 — RESOLVED): RIA routes live on the NODE server
 * (`server.server.baseUrl` = server.alphaquark.in), same as LiveKit — NOT the
 * ccxt comms host that backs the legacy PaymentHistory invoices. Do not move these
 * to the ccxt base.
 *
 * AUTH (D6): every call sends the Firebase ID-token Bearer via getAuthedHeaders().
 * `email` is still passed for parity with web, but the BACKEND must derive/verify
 * identity from the token before returning financial data (IDOR hardening, §8.2) —
 * the client never asserts identity. When that lands, drop the email param here.
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getAuthedHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/ria-billing`;

class RiaBillingService {
  /** Aggregate + per-MP value history → { ok, summary, series, by_model }. */
  async getValueHistory(email) {
    const headers = await getAuthedHeaders();
    const res = await axios.get(`${BASE}/me/value-history`, { headers, params: { email } });
    return res.data;
  }

  /** Customer's own RIA invoices → { ok, count, invoices[] }. */
  async getMyInvoices(email) {
    const headers = await getAuthedHeaders();
    const res = await axios.get(`${BASE}/me/invoices`, { headers, params: { email } });
    return res.data;
  }

  /** Billing contract → { ok, contract:{ billing_mode, billing_period, ... } }.
   *  Fee Statement renders only when contract.billing_mode === 'AUA'. */
  async getMyContract(email) {
    const headers = await getAuthedHeaders();
    const res = await axios.get(`${BASE}/me/contract`, { headers, params: { email } });
    return res.data;
  }

  /**
   * Fetch the print-optimized invoice as bytes (authed). Returns
   * { data: ArrayBuffer, contentType }. The CALLER (PaymentHistoryScreen's existing
   * PDF helper, per D15) writes it to cache and opens it in the native viewer / share
   * sheet — there is no browser tab on mobile, so no window.open here (contrast web).
   */
  async fetchInvoicePdf(invoiceId, email) {
    const headers = await getAuthedHeaders();
    const res = await axios.get(`${BASE}/me/invoice/${invoiceId}/pdf`, {
      headers,
      params: { email },
      responseType: 'arraybuffer',
    });
    return {
      data: res.data,
      contentType: res.headers?.['content-type'] || 'application/pdf',
    };
  }
}

export default new RiaBillingService();
