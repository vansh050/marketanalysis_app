/**
 * subscriptionStatus — single source of truth for "is the customer
 * actively subscribed to plan X?" Mirrors web's
 * `prod-alphaquark-github/src/Home/PricingSection/IPOCard.js`
 * `hasActiveSubscription` (the version that consults `clientData.groups`
 * before falling back to a fuzzy subscriptions-array match).
 *
 * Three call sites today:
 *   - MySubscriptionsScreen — iterates every plan, renders only the
 *     ones that resolve to `active` or `renew`.
 *   - MPPerformanceScreen / BespokePerformanceScreen — checks a single
 *     model name and gates entitlement features on it.
 *
 * Why a shared module: each screen previously inlined its own copy of
 * the same matcher with slightly different bugs. The MySubscriptions
 * one missed the groups check (every plan showed "Active"); the
 * Performance ones also missed groups AND the cancelled-status guard.
 * Centralising means future tweaks land in one place.
 *
 * Cross-ref: docs/CHANGELOG.md 2026-06-09 — My Subscriptions: every MP
 * plan marked "Active".
 */

import moment from 'moment';

export const ACCEPTABLE_DATE_FORMATS = [
  'D MMM YYYY, HH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  moment.ISO_8601,
];

// Web parity: collapses [-_<whitespace>] to a single underscore so
// "MP Test1" / "MP-Test1" / "mp_test1" all canonicalise. The previous
// inline mobile normaliser only handled `\s+`, so the dash variant
// didn't match.
export const normalizeGroupName = name => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/%20/g, ' ')
    .replace(/[-_\s]+/g, '_')
    .trim();
};

// Web parity: covers deleted / cancelled / canceled. Mobile's previous
// inline checks only excluded `deleted`.
export const isInactiveSubStatus = sub => {
  const status = (sub?.status || sub?.subStatus || '').toLowerCase();
  return status === 'deleted' || status === 'cancelled' || status === 'canceled';
};

// "pick the latest expiry from a candidate list" — extracted so both
// the groups branch and the fallback subscriptions branch share it.
// Returns one of { status: 'active' | 'renew' | 'expired', expiry, daysLeft,
// subscription } or null when nothing usable.
const pickLatestSubscription = liveSubs => {
  const neverExpiring = liveSubs.filter(
    sub => sub.expiry === null || sub.expiry === undefined,
  );
  if (neverExpiring.length > 0) {
    return {status: 'active', expiry: null, subscription: neverExpiring[0]};
  }
  const validSubs = liveSubs.filter(sub =>
    sub.expiry
      ? moment(sub.expiry, ACCEPTABLE_DATE_FORMATS, true).isValid()
      : false,
  );
  if (validSubs.length === 0) return null;
  const latestSub = validSubs.sort(
    (a, b) =>
      moment(b.expiry, ACCEPTABLE_DATE_FORMATS) -
      moment(a.expiry, ACCEPTABLE_DATE_FORMATS),
  )[0];
  const expiryDate = moment(latestSub?.expiry, ACCEPTABLE_DATE_FORMATS);
  const daysLeft = expiryDate.diff(moment(), 'days');
  if (daysLeft < 0) {
    return {status: 'expired', expiry: latestSub.expiry, subscription: latestSub};
  }
  if (daysLeft <= 7) {
    return {status: 'renew', expiry: latestSub.expiry, daysLeft, subscription: latestSub};
  }
  return {status: 'active', expiry: latestSub.expiry, daysLeft, subscription: latestSub};
};

/**
 * Resolve the subscription status for a single plan name against the
 * full `/api/all-clients/user/<email>` payload.
 *
 * @param {string} planName - The plan title to look up.
 * @param {object|array} clientData - Either the full clientData object
 *   (`{ subscriptions, groups, ... }`) or, for legacy call sites, the
 *   bare subscriptions array. Passing the full object is strongly
 *   preferred — it's the only shape that enables the `groups` check
 *   (the authoritative "yes, this user actually subscribed" signal).
 * @returns {{ status: 'active' | 'renew' | 'expired' | 'none',
 *             expiry?: string | null,
 *             daysLeft?: number,
 *             subscription?: object }}
 */
export const getSubscriptionStatus = (planName, clientData) => {
  const subscriptions = Array.isArray(clientData)
    ? clientData
    : clientData?.subscriptions || [];
  const groups = Array.isArray(clientData) ? [] : clientData?.groups || [];
  const normalizedPlan = normalizeGroupName(planName);
  if (!normalizedPlan) return {status: 'none'};

  // 1. Authoritative path — does the user have a `groups` entry whose
  // name matches this plan? If yes, restrict to the subscription rows
  // tagged with the same plan and pick the latest non-inactive one.
  // Exact match only (post-normalization): a substring fallback here
  // let a deleted plan's group/subscription row (e.g. "test") falsely
  // match an unrelated plan whose name merely contains it as a prefix
  // (e.g. "test 1") — see markup tester report 2026-07-16.
  // normalizeGroupName already collapses spaces/dashes/underscores so
  // legitimate formatting variants of the SAME name ("MP Test1" vs
  // "MP-Test1") already compare equal without substring matching.
  const matchingGroup = groups.find(group => {
    const nGroup = normalizeGroupName(group);
    return nGroup === normalizedPlan;
  });

  if (matchingGroup) {
    const groupSubs = subscriptions.filter(sub => {
      const nSub = normalizeGroupName(sub?.plan);
      return nSub === normalizedPlan;
    });
    const liveGroupSubs = groupSubs.filter(sub => !isInactiveSubStatus(sub));
    if (liveGroupSubs.length === 0) {
      // The user is in this group but every subscription row was
      // marked deleted/cancelled — flag as expired so the UI signals
      // the access lapsed instead of stale "Active".
      return groupSubs.length > 0
        ? {status: 'expired'}
        : {status: 'active', expiry: null};
    }
    const subResult = pickLatestSubscription(liveGroupSubs);
    return subResult || {status: 'active', expiry: null};
  }

  // 2. Fallback — no group match. Some legacy users have subscription
  // rows without a parallel `groups[]` update. Match by plan name only,
  // exact (post-normalization) — see note above on why substring
  // matching was removed.
  if (!subscriptions.length) return {status: 'none'};
  const matchingPlanSubs = subscriptions.filter(sub => {
    const nSub = normalizeGroupName(sub?.plan);
    return nSub === normalizedPlan;
  });
  if (matchingPlanSubs.length === 0) return {status: 'none'};
  const liveSubs = matchingPlanSubs.filter(sub => !isInactiveSubStatus(sub));
  if (liveSubs.length === 0) return {status: 'none'};
  return pickLatestSubscription(liveSubs) || {status: 'active', expiry: null};
};

// Convenience for callers that just want the string ("none" | "active"
// | "renew" | "expired"). Existing performance screens used this shape.
export const getSubscriptionStatusString = (planName, clientData) =>
  getSubscriptionStatus(planName, clientData).status;
