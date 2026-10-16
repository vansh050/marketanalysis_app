import {normalizeBespokeCategory} from './planCategories';
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

export const resolvePricingOptions = (plan) => {
    if (!plan) return [];
    const options = [];
    if (isValidPrice(plan?.amount)) {
        options.push({
            value: Number(plan.amount),
            label: `${plan.duration || 1} months`,
            period: 'onetime',
        });
    }
    if (plan.planType === 'onetime' && Array.isArray(plan.onetimeOptions)) {
        plan.onetimeOptions.forEach((opt, index) => {
            if (!isValidPrice(opt?.amountWithoutGst)) return;
            options.push({
                value: Number(opt.amountWithoutGst),
                label: opt.label || `${opt.duration} days`,
                period: `onetime-${index}`,
            });
        });
    }
    [
        ['monthly', 'Monthly'],
        ['quarterly', 'Quarterly'],
        ['half-yearly', '6 months'],
        ['yearly', '12 months'],
    ].forEach(([period, label]) => {
        const value = plan?.pricingWithoutGst?.[period] ?? plan?.pricing?.[period];
        if (isValidPrice(value)) options.push({value: Number(value), label, period});
    });
    return options;
};

export const resolvePrimaryPricing = (plan) => {
    const options = resolvePricingOptions(plan);
    return options[0] || null;
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
    const pricingOptions = resolvePricingOptions(plan).map(option => ({
        ...option,
        price: formatINR(option.value),
    }));
    const discount = Number(plan.discountPercentage) || 0;
    const originalValue = pricing && discount > 0 && discount < 100
        ? Math.round(pricing.value / (1 - discount / 100))
        : pricing?.value;
    return {
        id: plan._id || plan.id || plan.model_name,
        badgeTop,
        badgeBot,
        name: plan.model_name || plan.name || 'Model Portfolio',
        price: pricing ? formatINR(pricing.value) : '—',
        priceSuffix: PERIOD_SUFFIX[pricing?.period] || '',
        pricingOptions,
        originalPrice: originalValue ? formatINR(originalValue) : null,
        saveBadge: discount > 0 ? `Save ${Math.round(discount)}%` : null,
        freq: pricing?.label || 'Monthly',
        minInvest: formatMinInvest(plan.minInvestment),
        volatility: formatVolatility(plan.volatility),
        cagr: formatCagr(plan),
        isSubscribed: Boolean(plan.subscription),
        timeCyclePlan: plan.timeCyclePlan === true,
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
    const pricingOptions = resolvePricingOptions(plan).map(option => ({
        ...option,
        price: formatINR(option.value),
    }));
    const rawValidity = plan.validity ?? plan.duration;
    const validity = rawValidity
        ? `${rawValidity}${typeof rawValidity === 'number' ? ' Months' : ''}`
        : pricing?.label || 'See plan details';
    return {
        id: plan._id || plan.id || plan.model_name,
        name: plan.model_name || plan.name || 'Bespoke Plan',
        priceOrig: hasDiscount ? formatINR(original) : null,
        priceNow: formatINR(value),
        pricingOptions,
        validity,
        retentionRate: plan.retentionRate ?? plan.retention_rate ?? '—',
        freq: pricing?.label || 'Monthly',
        freqVariant: pricing?.period === 'monthly' ? null : 'amber',
        saveBadge: hasDiscount ? `Save ${savePct}%` : null,
        isSubscribed: Boolean(plan.subscription),
        // Advisor-defined bespoke category (null = plain "Bespoke").
        category: normalizeBespokeCategory(plan.bespoke_category),
    };
};
