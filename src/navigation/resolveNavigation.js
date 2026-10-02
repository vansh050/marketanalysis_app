/**
 * resolveNavigation — pure manifest → navigation layout resolver.
 *
 * Input: the active variant's navigation manifest (already merged over the
 * default manifest by resolveDesign) + runtime boolean flags.
 * Output:
 *   {
 *     tabs:            [{key, routeName, label, icon, kind}],
 *     initialRouteName,
 *     moreSections:    [{id, title, items: [{key, label, icon, route?, action?, destructive?} | {expand}]}],
 *     preLoginRoute,   // first pre-login route when phone-first login is on
 *     chrome:          {legacyToolbar, tabBarHeight},
 *     warnings:        [string],
 *   }
 *
 * Never throws and never returns an empty tab bar: a bad manifest degrades to
 * the default manifest's tabs plus warnings. Required entries (catalog
 * `required: true`) are re-added when a manifest drops them.
 *
 * Runtime flags can only HIDE catalog entries (`requires`). Structure comes
 * from the bundled manifest (docs/CONFIGURABLE_NAVIGATION_DESIGN.md §5).
 */

import {
    TAB_CATALOG,
    MORE_ITEM_CATALOG,
    PRE_LOGIN_CATALOG,
    MAX_TABS,
} from './screenCatalog';

const DEFAULT_CHROME = {legacyToolbar: true, tabBarHeight: 60};

const slug = title =>
    String(title || 'section')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const tabEntry = (key, spec = {}) => {
    const catalog = TAB_CATALOG[key];
    return {
        key,
        routeName: catalog.routeName,
        label: typeof spec.label === 'string' && spec.label ? spec.label : catalog.defaultLabel,
        icon: typeof spec.icon === 'string' && spec.icon ? spec.icon : catalog.defaultIcon,
        kind: catalog.kind || 'screen',
    };
};

const normaliseTabSpec = spec => (typeof spec === 'string' ? {key: spec} : spec || {});

function resolveTabs(manifestTabs, fallbackTabs, warnings) {
    const build = (list, collectWarnings) => {
        const seen = new Set();
        const out = [];
        for (const raw of Array.isArray(list) ? list : []) {
            const spec = normaliseTabSpec(raw);
            if (!TAB_CATALOG[spec.key]) {
                if (collectWarnings) warnings.push(`unknown_tab:${spec.key}`);
                continue;
            }
            if (seen.has(spec.key)) {
                if (collectWarnings) warnings.push(`duplicate_tab:${spec.key}`);
                continue;
            }
            seen.add(spec.key);
            out.push(tabEntry(spec.key, spec));
        }
        return out;
    };

    let tabs = build(manifestTabs, true);
    if (tabs.length === 0) {
        warnings.push('no_valid_tabs:fallback_to_default');
        tabs = build(fallbackTabs, false);
    }

    // Required tabs (More) are re-added last, the conventional position.
    for (const [key, catalog] of Object.entries(TAB_CATALOG)) {
        if (catalog.required && !tabs.some(t => t.key === key)) {
            warnings.push(`required_tab_added:${key}`);
            tabs.push(tabEntry(key));
        }
    }

    if (tabs.length > MAX_TABS) {
        warnings.push(`too_many_tabs:${tabs.length}`);
        const required = tabs.filter(t => TAB_CATALOG[t.key].required);
        const optional = tabs.filter(t => !TAB_CATALOG[t.key].required);
        const kept = new Set(optional.slice(0, MAX_TABS - required.length).map(t => t.key));
        tabs = tabs.filter(t => TAB_CATALOG[t.key].required || kept.has(t.key));
    }
    return tabs;
}

function resolveMore(manifestMenu, flags, warnings) {
    const placed = new Set();
    const sections = [];
    for (const section of Array.isArray(manifestMenu) ? manifestMenu : []) {
        const items = [];
        for (const key of Array.isArray(section?.items) ? section.items : []) {
            const catalog = MORE_ITEM_CATALOG[key];
            if (!catalog) {
                warnings.push(`unknown_more_item:${key}`);
                continue;
            }
            if (placed.has(key)) {
                warnings.push(`duplicate_more_item:${key}`);
                continue;
            }
            placed.add(key);
            if (catalog.requires && !flags[catalog.requires]) continue;
            items.push({key, ...catalog});
        }
        sections.push({
            id: section?.id || slug(section?.title),
            title: section?.title || '',
            items,
        });
    }

    // Re-add required rows the manifest omitted into the last section
    // (conventionally Legal), or a new Legal section if there is none.
    const missing = Object.entries(MORE_ITEM_CATALOG)
        .filter(([key, c]) => c.required && !placed.has(key))
        .map(([key, c]) => ({key, ...c}));
    if (missing.length) {
        missing.forEach(item => warnings.push(`required_more_item_added:${item.key}`));
        if (sections.length === 0) sections.push({id: 'legal', title: 'Legal', items: []});
        sections[sections.length - 1].items.push(...missing);
    }
    return sections;
}

function resolvePreLogin(manifestPreLogin, warnings) {
    const valid = (Array.isArray(manifestPreLogin) ? manifestPreLogin : []).filter(key => {
        if (PRE_LOGIN_CATALOG[key]) return true;
        warnings.push(`unknown_pre_login:${key}`);
        return false;
    });
    // PhoneLogin is the only screen that actually signs the user in; a
    // sequence without it would strand the user on the carousel.
    if (!valid.includes('phoneLogin')) {
        if (valid.length) warnings.push('pre_login_missing_phone_login');
        return PRE_LOGIN_CATALOG.onboardingCarousel.routeName;
    }
    return PRE_LOGIN_CATALOG[valid[0]].routeName;
}

export function resolveNavigation(manifest, {defaultManifest = {}, flags = {}} = {}) {
    const m = manifest || {};
    const warnings = [];

    const tabs = resolveTabs(m.tabs, defaultManifest.tabs, warnings);
    const screenTabs = tabs.filter(t => t.kind !== 'action');
    let initial = screenTabs.find(t => t.key === m.initialTab);
    if (!initial) {
        if (m.initialTab) warnings.push(`initial_tab_unavailable:${m.initialTab}`);
        initial = screenTabs[0] || tabs[0];
    }

    const chromeIn = m.chrome || {};
    const height = Number(chromeIn.tabBarHeight);
    const chrome = {
        legacyToolbar:
            typeof chromeIn.legacyToolbar === 'boolean'
                ? chromeIn.legacyToolbar
                : DEFAULT_CHROME.legacyToolbar,
        tabBarHeight:
            Number.isFinite(height) && height >= 40 && height <= 120
                ? height
                : DEFAULT_CHROME.tabBarHeight,
    };

    return {
        tabs,
        initialRouteName: initial.routeName,
        moreSections: resolveMore(m.moreMenu, flags, warnings),
        preLoginRoute: resolvePreLogin(m.preLogin, warnings),
        chrome,
        warnings,
    };
}

export default resolveNavigation;
