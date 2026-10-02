/**
 * ============================================================================
 * screenCatalog — THE PLACEABLE-SCREEN CONTRACT for variant navigation
 * ============================================================================
 *
 * A variant's navigation manifest (`designs/<variant>/navigation.js`) may
 * only name keys that exist here. The catalog is src-owned and PURE DATA: no
 * component imports, so the resolver stays unit-testable. Navigation.js maps
 * tab keys to screen components; AccountSettingsScreen maps More-menu
 * `action`s to handlers.
 *
 * Route names are the LEGACY names on purpose (Home, Orders, Portfolio, ...):
 * ~25 existing navigate() calls, deep links and push routing target them.
 * Never rename a routeName — add a new key instead.
 *
 * `required: true` entries are compliance/usability floors a manifest cannot
 * remove (the resolver re-adds them): the More tab is the only general entry
 * to Log Out, legal pages and in-app account deletion (Apple 5.1.1(v)).
 *
 * Deliberately ABSENT: every step of auth, KYC, MITC e-sign → payment, and
 * broker connect → sell-auth → review → place. A manifest can link to a
 * flow's entry screen but has no vocabulary for the steps inside it.
 *
 * Design: docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.
 * ============================================================================
 */

export const MAX_TABS = 6;

export const TAB_CATALOG = Object.freeze({
    advice: {routeName: 'Home', defaultLabel: 'Home', defaultIcon: 'home'},
    orders: {routeName: 'Orders', defaultLabel: 'Orders', defaultIcon: 'orders'},
    portfolio: {routeName: 'Portfolio', defaultLabel: 'Portfolio', defaultIcon: 'portfolio'},
    plans: {routeName: 'Plans', defaultLabel: 'Plans', defaultIcon: 'plans'},
    news: {routeName: 'News', defaultLabel: 'News', defaultIcon: 'news'},
    watchlist: {routeName: 'Watchlist', defaultLabel: 'Watchlist', defaultIcon: 'watchlist'},
    // Fake tab: pressing it opens the `More` STACK screen (AccountSettingsScreen).
    more: {
        routeName: 'More',
        defaultLabel: 'More',
        defaultIcon: 'more',
        kind: 'action',
        required: true,
    },
});

/**
 * More-menu rows. `route` rows navigate; `action` rows are handled by the
 * AccountSettingsScreen container. `requires` names a boolean in the flags
 * object the container passes to the resolver (runtime show/hide only).
 */
export const MORE_ITEM_CATALOG = Object.freeze({
    brokerAccount: {label: 'Broker Account', icon: 'link', route: 'Broker Setting'},
    mySubscription: {label: 'My Subscription', icon: 'crown', route: 'MySubscriptionsScreen'},
    linkAccount: {
        label: 'Link an existing account',
        icon: 'userPlus',
        action: 'linkAccount',
        requires: 'appleRelayIdentity',
    },
    changeManager: {
        label: 'Change Manager',
        icon: 'tags',
        route: 'Advisor Change',
        requires: 'changeManagerVisible',
    },
    researchReport: {label: 'Research Report', icon: 'bookPlus', route: 'ResearchReportScreen'},
    watchlists: {label: 'Watchlists', icon: 'bookmark', route: 'WatchList'},
    invoices: {label: 'My Invoices', icon: 'receipt', route: 'PaymentHistoryScreen'},
    knowledgeHub: {label: 'Knowledge Hub', icon: 'graduationCap', route: 'KnowledgeHub'},
    recommendationMessages: {
        label: 'Recommendation Messages',
        icon: 'messageSquare',
        route: 'RecommendationMessages',
    },
    courses: {label: 'Courses', icon: 'bookOpen', route: 'MyCourses', requires: 'coursesEnabled'},
    webinars: {label: 'Webinars', icon: 'video', route: 'WebinarsList', requires: 'webinarsEnabled'},
    // Expands to the tenant's configured website links; a section left empty
    // by it is dropped.
    tenantLinks: {expand: 'tenantLinks'},
    privacyPolicy: {label: 'Privacy Policy', icon: 'link', route: 'Privacy Policy', required: true},
    terms: {label: 'Terms & Conditions', icon: 'link', route: 'Terms & Conditions', required: true},
    deleteAccount: {
        label: 'Delete Account',
        icon: 'trash',
        route: 'DeleteAccountScreen',
        destructive: true,
        required: true,
    },
    logout: {label: 'Log Out', icon: 'logOut', route: 'Logout', destructive: true, required: true},
});

/** Pre-login screens a manifest may order (only when phone-first login is on). */
export const PRE_LOGIN_CATALOG = Object.freeze({
    onboardingCarousel: {routeName: 'Onboarding'},
    phoneLogin: {routeName: 'PhoneLogin'},
});

/** Top-level manifest keys. A variant may override only these. */
export const MANIFEST_KEYS = Object.freeze(['tabs', 'initialTab', 'moreMenu', 'preLogin', 'chrome']);
