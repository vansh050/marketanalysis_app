/**
 * SubscriptionMandateService — CashFree eNACH recurring-mandate client (P4, web-parity).
 *
 * ⚠️ SCAFFOLD — NOT wired into the live pay button yet. Gated on the two D4-spike
 * verification gates (docs/ENACH_SPIKE_D4.md):
 *   G1 — confirm the backend /subscriptions create response carries a
 *        `subscription_session_id` (native SDK path) and/or an auth link (WebView path).
 *   G2 — device smoke of the native doSubscription return callback.
 *
 * Per the spike the PRIMARY path is native `CFPaymentGatewayService.doSubscription`
 * (react-native-cashfree-pg-sdk, already used for doPayment at the MPInvestNowModal
 * seam — D16); the WebView hosted auth-link is the fallback. This module currently
 * implements the SAFE pieces — the backend create call + the WebView fallback URL —
 * and leaves the native SDK call as the documented next step so nothing speculative
 * ships before G1/G2. ₹0 AUTH = mandate registration, not a charge (the first real
 * debit promotes provisional→realized; the customer sees ProvisionalBanner meanwhile).
 *
 * Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.3 (D4/D16).
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getPublicHeaders } from '../../utils/courseAuthHeaders';
import { validateChargeableAmount } from '../../utils/validateChargeableAmount';

const BASE = `${server.server.baseUrl}api/cashfree`;

class SubscriptionMandateService {
    /**
     * Ask the backend to create a CashFree recurring subscription (2025-01-01
     * Subscriptions API). The ₹0 guard applies to the FIRST-DEBIT amount, NOT the ₹0
     * AUTH itself. Returns the raw server payload; G1 confirms which of
     * `subscription_session_id` (native) / auth-link (WebView) it carries.
     *
     * NOTE: the exact backend route is confirmed during G1 — wire it here then.
     */
    async createMandateSubscription({
        firstDebitAmount,
        planId,
        frequency,
        user_email,
        mobileNumber,
        pan,
        name,
        route = 'initiate-recurring',
    }) {
        const guard = validateChargeableAmount(firstDebitAmount);
        if (!guard.ok) {
            const err = new Error(guard.message);
            err.code = guard.reason;
            err.blockedByGuard = true;
            throw err;
        }
        const res = await axios.post(
            `${BASE}/${route}`,
            {
                amount: String(firstDebitAmount),
                planId,
                frequency,
                user_email,
                mobileNumber: String(mobileNumber || ''),
                pan,
                name,
            },
            { headers: getPublicHeaders() },
        );
        return res.data;
    }

    /**
     * WebView fallback: pull the hosted authorization URL from the create response,
     * tolerating the field names the Subscriptions API can use. The caller renders
     * this in a react-native-webview and watches for the return/redirect.
     */
    getAuthUrl(createResponse) {
        const d = createResponse?.data || createResponse || {};
        return (
            d.authLink ||
            d.auth_link ||
            d.subscription_url ||
            d.authorisation_details?.authLink ||
            d.data?.authLink ||
            null
        );
    }

    /**
     * NATIVE path (G2 — not implemented until device-verified): once G1 confirms a
     * `subscription_session_id`, authorize via the already-installed SDK:
     *
     *   import { CFPaymentGatewayService, CFSubscription, ... } from
     *     'react-native-cashfree-pg-sdk';
     *   // build a CFSubscription session from subscription_session_id + subscription_id,
     *   // CFPaymentGatewayService.doSubscription(session), then poll status.
     *
     * Deliberately omitted here so no unverified SDK call ships before the device smoke.
     */
}

export default new SubscriptionMandateService();
