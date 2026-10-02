/**
 * resolveNavigation contract (docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.3):
 * never throws, never returns an empty tab bar, drops unknown keys with a
 * warning, re-adds required entries, and lets runtime flags only hide rows.
 */
import defaultManifest from '../../../designs/default/navigation';
import {resolveNavigation} from '../../navigation/resolveNavigation';

const resolve = (manifest, flags = {}) =>
  resolveNavigation({...defaultManifest, ...manifest}, {defaultManifest, flags});
const routes = layout => layout.tabs.map(t => t.routeName);

test('a variant can reorder, relabel and swap tabs', () => {
  const layout = resolve({
    tabs: [
      {key: 'portfolio', label: 'Holdings'},
      'advice',
      {key: 'news', icon: 'news'},
      'watchlist',
      'more',
    ],
    initialTab: 'portfolio',
  });
  expect(routes(layout)).toEqual(['Portfolio', 'Home', 'News', 'Watchlist', 'More']);
  expect(layout.tabs[0].label).toBe('Holdings');
  expect(layout.initialRouteName).toBe('Portfolio');
  expect(layout.warnings).toEqual([]);
});

test('arfs manifest (News instead of Plans) — the P4 migration target', () => {
  const layout = resolve({
    tabs: ['advice', 'orders', 'portfolio', 'news', 'more'].map(key => ({key})),
  });
  expect(routes(layout)).toEqual(['Home', 'Orders', 'Portfolio', 'News', 'More']);
});

test('unknown and duplicate tab keys are dropped with warnings', () => {
  const layout = resolve({tabs: ['advice', 'bogus', 'advice', 'more']});
  expect(routes(layout)).toEqual(['Home', 'More']);
  expect(layout.warnings).toEqual(['unknown_tab:bogus', 'duplicate_tab:advice']);
});

test('the required More tab is re-added when a manifest drops it', () => {
  const layout = resolve({tabs: ['advice', 'orders', 'portfolio', 'news', 'watchlist']});
  expect(routes(layout)).toEqual(['Home', 'Orders', 'Portfolio', 'News', 'Watchlist', 'More']);
  expect(layout.warnings).toContain('required_tab_added:more');
});

test('more than 6 tabs keeps the first optional ones plus required More', () => {
  const layout = resolve({
    tabs: ['advice', 'orders', 'portfolio', 'plans', 'news', 'watchlist', 'more'],
  });
  expect(routes(layout)).toEqual(['Home', 'Orders', 'Portfolio', 'Plans', 'News', 'More']);
  expect(layout.warnings).toContain('too_many_tabs:7');
});

test('a manifest with no valid tabs falls back to the default tabs, never empty', () => {
  for (const tabs of [[], ['bogus'], null, 'not-an-array']) {
    const layout = resolve({tabs});
    expect(routes(layout)).toEqual(['Home', 'Orders', 'Portfolio', 'Plans', 'More']);
  }
  expect(resolveNavigation(undefined).tabs.map(t => t.routeName)).toEqual(['More']);
});

test('initial tab falls back to the first screen tab, never the More action', () => {
  const layout = resolve({tabs: ['more', 'orders'], initialTab: 'plans'});
  expect(layout.initialRouteName).toBe('Orders');
  expect(layout.warnings).toContain('initial_tab_unavailable:plans');
});

test('runtime flags only hide flag-gated More rows', () => {
  const keys = flags =>
    resolve({}, flags).moreSections.flatMap(s => s.items.map(i => i.key));
  expect(keys({})).not.toContain('courses');
  expect(keys({coursesEnabled: true})).toContain('courses');
});

test('required More rows are re-added when a manifest drops them', () => {
  const layout = resolve({moreMenu: [{title: 'Account', items: ['brokerAccount', 'bogus']}]});
  const [section] = layout.moreSections;
  expect(section.items.map(i => i.key)).toEqual([
    'brokerAccount',
    'privacyPolicy',
    'terms',
    'deleteAccount',
    'logout',
  ]);
  expect(layout.warnings).toEqual(
    expect.arrayContaining([
      'unknown_more_item:bogus',
      'required_more_item_added:deleteAccount',
      'required_more_item_added:logout',
    ]),
  );
});

test('an empty More menu still yields a Legal section with the required rows', () => {
  const layout = resolve({moreMenu: []});
  expect(layout.moreSections).toHaveLength(1);
  expect(layout.moreSections[0].title).toBe('Legal');
});

test('pre-login order: phone login first skips the carousel; invalid lists keep the carousel', () => {
  expect(resolve({preLogin: ['phoneLogin']}).preLoginRoute).toBe('PhoneLogin');
  expect(resolve({preLogin: ['onboardingCarousel', 'phoneLogin']}).preLoginRoute).toBe('Onboarding');
  const noLogin = resolve({preLogin: ['onboardingCarousel']});
  expect(noLogin.preLoginRoute).toBe('Onboarding');
  expect(noLogin.warnings).toContain('pre_login_missing_phone_login');
});

test('chrome: out-of-range tab bar height falls back to 60', () => {
  expect(resolve({chrome: {tabBarHeight: 72}}).chrome.tabBarHeight).toBe(72);
  expect(resolve({chrome: {tabBarHeight: 5}}).chrome.tabBarHeight).toBe(60);
  expect(resolve({chrome: {legacyToolbar: false}}).chrome.legacyToolbar).toBe(false);
});

test('the manifest has no vocabulary for money/compliance flow steps', () => {
  // A design cannot place or reorder these — they are not catalog keys.
  const layout = resolve({
    tabs: ['kycGate', 'mitcSign', 'payment', 'brokerConnect', 'sellAuth', 'placeOrder', 'advice'],
  });
  expect(routes(layout)).toEqual(['Home', 'More']);
});
