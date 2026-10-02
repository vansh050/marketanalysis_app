/**
 * The default navigation manifest must reproduce the pre-manifest app
 * EXACTLY (docs/CONFIGURABLE_NAVIGATION_DESIGN.md §6 "default-manifest
 * snapshot"). The expectations below are the hand-written pre-refactor
 * structure of src/components/Navigation.js (MainTabNavigator) and
 * src/screens/Home/AccountSettingsScreen.js (menuItems) as of 2026-10-01.
 * If this test fails, the refactor changed what customers see.
 */
import defaultManifest from '../../../designs/default/navigation';
import {resolveNavigation} from '../../navigation/resolveNavigation';

const resolve = (flags = {}) => resolveNavigation(defaultManifest, {defaultManifest, flags});

const rows = layout =>
  layout.moreSections.map(section => ({
    title: section.title,
    rows: section.items.map(item =>
      item.expand ? `[${item.expand}]` : `${item.label} -> ${item.route || item.action}`,
    ),
  }));

test('tabs, order, labels and first tab match the pre-manifest app', () => {
  const layout = resolve();
  expect(layout.tabs.map(t => [t.routeName, t.label, t.kind])).toEqual([
    ['Home', 'Home', 'screen'],
    ['Orders', 'Orders', 'screen'],
    ['Portfolio', 'Portfolio', 'screen'],
    ['Plans', 'Plans', 'screen'],
    ['More', 'More', 'action'],
  ]);
  expect(layout.initialRouteName).toBe('Home');
  expect(layout.chrome).toEqual({legacyToolbar: true, tabBarHeight: 60});
  expect(layout.preLoginRoute).toBe('Onboarding');
  expect(layout.warnings).toEqual([]);
});

test('More menu with every optional flag OFF matches the pre-manifest menu', () => {
  expect(rows(resolve())).toEqual([
    {title: 'Account', rows: ['Broker Account -> Broker Setting', 'My Subscription -> MySubscriptionsScreen']},
    {
      title: 'Insights',
      rows: [
        'Research Report -> ResearchReportScreen',
        'Watchlists -> WatchList',
        'My Invoices -> PaymentHistoryScreen',
        'Knowledge Hub -> KnowledgeHub',
        'Recommendation Messages -> RecommendationMessages',
      ],
    },
    {title: 'More Links', rows: ['[tenantLinks]']},
    {
      title: 'Legal',
      rows: [
        'Privacy Policy -> Privacy Policy',
        'Terms & Conditions -> Terms & Conditions',
        'Delete Account -> DeleteAccountScreen',
        'Log Out -> Logout',
      ],
    },
  ]);
});

test('More menu with every optional flag ON matches the pre-manifest menu', () => {
  const layout = resolve({
    appleRelayIdentity: true,
    changeManagerVisible: true,
    coursesEnabled: true,
    webinarsEnabled: true,
  });
  const [account, insights] = rows(layout);
  expect(account.rows).toEqual([
    'Broker Account -> Broker Setting',
    'My Subscription -> MySubscriptionsScreen',
    'Link an existing account -> linkAccount',
    'Change Manager -> Advisor Change',
  ]);
  expect(insights.rows.slice(-2)).toEqual(['Courses -> MyCourses', 'Webinars -> WebinarsList']);
});

test('only Delete Account and Log Out are destructive (red) rows', () => {
  const destructive = resolve()
    .moreSections.flatMap(s => s.items)
    .filter(item => item.destructive)
    .map(item => item.key);
  expect(destructive).toEqual(['deleteAccount', 'logout']);
});
