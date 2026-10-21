/**
 * Admin-curated Featured plans across plan types (Plan.is_featured, toggled on
 * the web admin Plan card). Pure: takes the two catalog lists the home summary
 * already fetches and returns shaped cards tagged with `kind` + `raw`.
 */
import { shapeMpPlan, shapeBespokePlan } from './alphanomyPlanShape';

export const buildFeaturedPlans = (mpList, bespokeList) => {
    const rows = [
        ...(mpList || []).map((raw, order) => ({raw, kind: 'mp', order})),
        ...(bespokeList || []).map((raw, order) => ({raw, kind: 'bespoke', order})),
    ].filter(row => row.raw?.is_featured === true);
    const rank = row => (Number.isFinite(Number(row.raw?.priority)) && row.raw?.priority !== null
        ? Number(row.raw.priority)
        : Infinity);
    rows.sort((a, b) => rank(a) - rank(b)
        || (a.kind === b.kind ? 0 : a.kind === 'mp' ? -1 : 1)
        || a.order - b.order);
    return rows
        .map(({raw, kind}) => {
            const shaped = kind === 'mp' ? shapeMpPlan(raw) : shapeBespokePlan(raw);
            return shaped ? {...shaped, kind, raw} : null;
        })
        .filter(Boolean);
};
