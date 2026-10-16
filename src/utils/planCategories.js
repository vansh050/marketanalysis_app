/**
 * Plan categories for customer surfaces (prod-alphaquark-github
 * docs/BESPOKE_PLAN_CATEGORIES.md).
 *
 * A bespoke plan's category is the advisor-typed `bespoke_category` on the
 * plan (free text, normalised the same way as the backend's
 * utilities/bespokeCategory.js). Plans without one are listed under plain
 * "Bespoke". Category images come from GET /api/admin/plan-categories and are
 * looked up with `categoryImageKey`. Pure helpers — no React, no network.
 */
export const UNCATEGORISED_BESPOKE = null;

export const normalizeBespokeCategory = value => {
  if (typeof value !== 'string') {return null;}
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed ? collapsed.slice(0, 40) : null;
};

export const categoryImageKey = (kind, name) =>
  `${kind}::${String(name || '').replace(/\s+/g, ' ').trim().toLowerCase()}`;

export const categoryImagesFromRows = rows => {
  const images = {};
  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (row?.image && row?.kind) {images[categoryImageKey(row.kind, row.name)] = row.image;}
  });
  return images;
};

// Groups shaped bespoke plans (each carrying `category`) in catalogue order:
// a category appears where its first plan appears (plans arrive sorted by
// the advisor's priority), and uncategorised plans form a trailing
// "Bespoke" group. Category matching ignores case.
export const groupBespokePlansByCategory = (plans, {uncategorisedLabel = 'Bespoke'} = {}) => {
  const groups = [];
  const byKey = new Map();
  let uncategorised = null;
  (plans || []).forEach(plan => {
    if (!plan) {return;}
    const name = normalizeBespokeCategory(plan.category);
    if (!name) {
      if (!uncategorised) {uncategorised = {key: '__bespoke__', name: null, label: uncategorisedLabel, plans: []};}
      uncategorised.plans.push(plan);
      return;
    }
    const key = name.toLowerCase();
    if (!byKey.has(key)) {
      const group = {key, name, label: name, plans: []};
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).plans.push(plan);
  });
  return uncategorised ? [...groups, uncategorised] : groups;
};

// Resolves each group's uploaded image so presentations never need the key
// helper (designs may not import src/ modules).
export const attachCategoryImages = (groups, images) =>
  (groups || []).map(group => ({
    ...group,
    image: group?.name ? images?.[categoryImageKey('bespoke', group.name)] || null : null,
  }));

export const modelPortfolioCategoryImage = images =>
  images?.[categoryImageKey('model portfolio', 'Model Portfolio')] || null;

export const planMatchesBespokeCategory = (plan, category) => {
  if (category === undefined) {return true;}
  const name = normalizeBespokeCategory(plan?.category);
  if (category === UNCATEGORISED_BESPOKE) {return !name;}
  return Boolean(name) && name.toLowerCase() === String(category).toLowerCase();
};
