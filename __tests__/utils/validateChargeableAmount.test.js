/**
 * validateChargeableAmount — unit + REGRESSION guard (P4, D10/D11).
 * The regression case: a coupon that drives the final amount to ₹0 must be REFUSED
 * (the web revenue-leak fix), while a normal positive amount still passes (so the
 * existing course-purchase happy path is not broken by adding the guard).
 */
import { validateChargeableAmount } from '../../src/utils/validateChargeableAmount';

describe('validateChargeableAmount', () => {
    it('passes a normal positive amount (happy path stays working)', () => {
        const r = validateChargeableAmount(3100);
        expect(r.ok).toBe(true);
        expect(r.amount).toBe(3100);
    });

    it('passes a numeric string amount', () => {
        expect(validateChargeableAmount('499').ok).toBe(true);
    });

    it('REGRESSION: refuses ₹0 (100%-discount coupon) with manual-activation message', () => {
        const r = validateChargeableAmount(0);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('zero_amount');
        expect(r.message).toMatch(/manual activation/i);
    });

    it('refuses negative amounts', () => {
        expect(validateChargeableAmount(-50).ok).toBe(false);
    });

    it('refuses null / undefined / NaN / empty as invalid', () => {
        expect(validateChargeableAmount(null).ok).toBe(false);
        expect(validateChargeableAmount(undefined).ok).toBe(false);
        expect(validateChargeableAmount('abc').ok).toBe(false);
        expect(validateChargeableAmount('').ok).toBe(false);
        expect(validateChargeableAmount(null).reason).toBe('invalid_amount');
    });
});
