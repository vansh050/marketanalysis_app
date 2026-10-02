/**
 * designs/default/navigation.js — DEFAULT NAVIGATION MANIFEST (data only)
 *
 * Declares the app's structure: bottom tabs, first tab, More-menu sections,
 * pre-login screen order and shell chrome. Keys come from
 * src/navigation/screenCatalog.js; the resolver
 * (src/navigation/resolveNavigation.js) validates them.
 *
 * DATA ONLY — no imports, no functions (enforced by
 * scripts/audit-design-boundaries.js). A variant overrides any top-level key
 * in its own designs/<variant>/navigation.js; arrays are replaced whole.
 *
 * This file must reproduce the pre-manifest app exactly (pinned by
 * src/__tests__/navigation/defaultNavigationSnapshot.test.js).
 * Design: docs/CONFIGURABLE_NAVIGATION_DESIGN.md.
 */

export default {
    tabs: [
        {key: 'advice', label: 'Home', icon: 'home'},
        {key: 'orders', label: 'Orders', icon: 'orders'},
        {key: 'portfolio', label: 'Portfolio', icon: 'portfolio'},
        {key: 'plans', label: 'Plans', icon: 'plans'},
        {key: 'more', label: 'More', icon: 'more'},
    ],
    initialTab: 'advice',
    moreMenu: [
        {
            id: 'account',
            title: 'Account',
            items: ['brokerAccount', 'mySubscription', 'linkAccount', 'changeManager'],
        },
        {
            id: 'insights',
            title: 'Insights',
            items: [
                'researchReport',
                'watchlists',
                'invoices',
                'knowledgeHub',
                'recommendationMessages',
                'courses',
                'webinars',
            ],
        },
        {id: 'more-links', title: 'More Links', items: ['tenantLinks']},
        {
            id: 'legal',
            title: 'Legal',
            items: ['privacyPolicy', 'terms', 'deleteAccount', 'logout'],
        },
    ],
    // Only used when advisor config enables phone-first login.
    preLogin: ['onboardingCarousel', 'phoneLogin'],
    chrome: {legacyToolbar: true, tabBarHeight: 60},
};
