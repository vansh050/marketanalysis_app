/**
 * alphanomyPlanShape — pure helpers that turn raw catalog plans (from the
 * MP `getAllStrategy` / bespoke `getAllBespoke` endpoints) into the row
 * shapes the alphanomy variant's HomeScreen and ModelPortfolioScreen
 * expect. Lives in `src/utils/` so the alphanomy presentations stay
 * pure-presentation (no fetch / no formatting logic) and so containers
 * can produce the shaped arrays without duplicating logic.
 *
 * Two consumers:
 *   - `src/screens/Home/hooks/useHomePlanSummary.js` — top-1 from each list
 *   - `src/screens/Drawer/ModelPortfolioScreen.js` (container) — full lists
 *     surfaced via `viewModel.alphanomyPlans = { mp, bespoke }`
 *
 * Pricing-option resolution mirrors `MPCard.getPricingOptions`
 * (monthly → quarterly → half-yearly → yearly → onetime).
 */

const isValidPrice = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

export const resolvePrimaryPricing = (plan) => {
    if (!plan) return null;
    if (plan.planType === 'onetime' && Array.isArray(plan.onetimeOptions)) {
        const opt = plan.onetimeOptions.find((o) => isValidPrice(o?.amountWithoutGst));
        if (opt) {
            return {
                value: Number(opt.amountWithoutGst),
                label: opt.label || `${opt.duration} days`,
                period: 'onetime',
            };
        }
    }
    if (isValidPrice(plan?.pricingWithoutGst?.monthly)) {
        return { value: Number(plan.pricingWithoutGst.monthly), label: 'Monthly', period: 'monthly' };
    }
    if (isValidPrice(plan?.pricingWithoutGst?.quarterly)) {
        return { value: Number(plan.pricingWithoutGst.quarterly), label: 'Quarterly', period: 'quarterly' };
    }
    if (isValidPrice(plan?.pricingWithoutGst?.['half-yearly'])) {
        return { value: Number(plan.pricingWithoutGst['half-yearly']), label: '6 Months', period: 'half-yearly' };
    }
    if (isValidPrice(plan?.pricing?.yearly)) {
        return { value: Number(plan.pricing.yearly), label: 'Yearly', period: 'yearly' };
    }
    return null;
};

const PERIOD_SUFFIX = {
    monthly: '/mo',
    quarterly: '/qtr',
    'half-yearly': '/6mo',
    yearly: '/yr',
    onetime: '',
};

export const formatINR = (n) =>
    Number.isFinite(n)
        ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        : '—';

export const formatVolatility = (v) => {
    if (v == null || v === '') return '—';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') {
        if (v > 0.15) return 'High';
        if (v > 0.1) return 'Medium';
        return 'Low';
    }
    return String(v);
};

export const formatCagr = (plan) => {
    const c = plan?.performance_data?.returns?.cagr;
    if (Number.isFinite(c)) return `${Number(c).toFixed(1)}%`;
    return '—';
};

export const formatMinInvest = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 100000) {
        const lakhs = n / 100000;
        return `₹${
            Number.isInteger(lakhs) ? lakhs.toFixed(0) : lakhs.toFixed(1)
        }L`;
    }
    return `₹${n.toLocaleString('en-IN')}`;
};

/**
 * Shape an MP catalog plan as the alphanomy "hero" row used both on the
 * HomeScreen Model-Portfolios section and on the ModelPortfolioScreen
 * "Model Portfolio" tab.
 */
export const shapeMpPlan = (plan, { badgeTop = 'TOP', badgeBot = '100' } = {}) => {
    if (!plan) return null;
    const pricing = resolvePrimaryPricing(plan);
    return {
        id: plan._id || plan.id || plan.model_name,
        badgeTop,
        badgeBot,
        name: plan.model_name || plan.name || 'Model Portfolio',
        price: pricing ? formatINR(pricing.value) : '—',
        priceSuffix: PERIOD_SUFFIX[pricing?.period] || '',
        freq: pricing?.label || 'Monthly',
        minInvest: formatMinInvest(plan.minInvestment),
        volatility: formatVolatility(plan.volatility),
        cagr: formatCagr(plan),
        // Validity used by the white plan-card variant (MP tab on Plans).
        validity: pricing?.label ? `${pricing.label} validity` : 'Monthly validity',
    };
};

/**
 * Shape a bespoke catalog plan as the alphanomy "bespoke" row used both
 * on the HomeScreen Top-Bespoke section and on the ModelPortfolioScreen
 * Bespoke tab. Mirrors the legacy MPCardBespoke discount logic
 * (originalAmount > current → derive Save N% badge).
 */
export const shapeBespokePlan = (plan) => {
    if (!plan) return null;
    const pricing = resolvePrimaryPricing(plan);
    const value = pricing?.value || 0;
    const original = Number(plan?.originalAmount) || 0;
    const hasDiscount = original > value && value > 0;
    const savePct = hasDiscount
        ? Math.round(((original - value) / original) * 100)
        : 0;
    return {
        id: plan._id || plan.id || plan.model_name,
        name: plan.model_name || plan.name || 'Bespoke Plan',
        priceOrig: hasDiscount ? formatINR(original) : null,
        priceNow: formatINR(value),
        validity: pricing?.label ? `${pricing.label} validity` : 'Monthly validity',
        freq: pricing?.label || 'Monthly',
        freqVariant: pricing?.period === 'monthly' ? null : 'amber',
        saveBadge: hasDiscount ? `Save ${savePct}%` : null,
    };
};
