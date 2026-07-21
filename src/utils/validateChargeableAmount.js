/**
 * validateChargeableAmount — the single ₹0 / final-amount guard (P4, web-parity D10).
 *
 * Mirrors the web revenue-leak fix: a 100%-discount coupon must NEVER reach the
 * gateway as a ₹0 charge (the gateway succeeds with ₹0 and the customer is entitled
 * without paying). Both the subscription payment path AND the existing course-purchase
 * path call THIS one helper, so the guard can't drift between them.
 *
 * Pure + deterministic → unit-tested. Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.3.
 *
 * @param {number|string} amount  the FINAL chargeable amount (after coupon/discount)
 * @returns {{ ok: boolean, amount: number, reason?: string, message?: string }}
 *   ok=true  → safe to call the gateway.
 *   ok=false → block the gateway; show `message` (e.g. 100%-discount → manual activation).
 */
const MANUAL_ACTIVATION_MSG =
    '100% discount coupons require manual activation. Please reach out to your manager.';

export function validateChargeableAmount(amount) {
    const n = Number(amount);
    if (amount === null || amount === undefined || amount === '' || Number.isNaN(n)) {
        return {
            ok: false,
            amount: NaN,
            reason: 'invalid_amount',
            message: 'Could not determine the amount. Please try again.',
        };
    }
    if (n <= 0) {
        return {
            ok: false,
            amount: n,
            reason: 'zero_amount',
            message: MANUAL_ACTIVATION_MSG,
        };
    }
    return { ok: true, amount: n };
}

export default validateChargeableAmount;
