/**
 * AccountSettingsScreen — container (Phase G batch 2, 2026-05-02)
 *
 * Owns: useTrade, useConfig, Firebase getAuth, APP_VARIANTS lookup,
 * feature-flag conditional logic (hide change manager), menu item
 * construction with navigation callbacks.
 * Renders presentation resolved from `screens.AccountSettingsScreen`.
 */

import React, { useState } from 'react';
import { Platform } from 'react-native';
import axios from 'axios';
import { useConfig } from '../../context/ConfigContext';
import APP_VARIANTS from '../../utils/Config';
import {
    Link,
    BookPlus,
    GraduationCap,
    Receipt,
    Crown,
    Tags,
    LogOut,
    Bookmark,
    BookOpen,
    Video,
    Trash2,
    UserPlus,
} from 'lucide-react-native';
import { getAuth } from '@react-native-firebase/auth';
import DeviceInfo from 'react-native-device-info';
import Config from '../../utils/safeConfig';
import { useTrade } from '../TradeContext';
import { useComponent } from '../../design/useDesign';
import ProfileModal from '../../components/ProfileModal';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { getAccountEmail, setAccountEmail } from '../../utils/accountEmail';

const AccountSettingsScreen = ({ navigation }) => {
    const { userDetails, getUserDeatils } = useTrade();
    // Profile-edit modal: opened from the alphanomy presentation's "Edit"
    // pill on the gradient profile card. Same `<ProfileModal>` the legacy
    // Drawer renders — its body handles the form, save, and toast; we just
    // mount it here so the alphanomy variant has somewhere to open it from.
    const [showProfileModal, setShowProfileModal] = useState(false);
    const config = useConfig();
    const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
    const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
    const fallbackConfig = APP_VARIANTS[validVariant] || {};

    const showBackgroundLogo = config?.showBackgroundLogo !== false;
    const backgroundLogo = config?.backgroundLogo || config?.logo || fallbackConfig.logo;

    const auth = getAuth();
    const user = auth.currentUser;
    const imageUrl = user?.photoURL;

    const getInitials = name => {
        return name?.length > 0 ? name[0]?.toUpperCase() : '';
    };

    const handleMenuPress = screenName => {
        if (navigation?.navigate) {
            navigation.navigate(screenName);
        }
    };

    // Optional, user-initiated account linking for Sign-in-with-Apple
    // "Hide My Email" users. Their account identity is the
    // @privaterelay.appleid.com alias (see App-Store-Guideline-4 relay-identity
    // fix in LoginScreen) — so if they already subscribed under a REAL email,
    // that subscription lives under a different account. This lets them prove
    // ownership of the real email (EmailScreenAppleLogin already OTP-verifies)
    // and re-key the local identity to it. It is NOT a login gate — Guideline 4
    // only forbids REQUIRING email entry after Sign in with Apple; an opt-in
    // Settings action is allowed. Row is shown ONLY for relay identities on iOS
    // (invisible to everyone else — no fleet-wide UX change).
    const currentIdentity = getAccountEmail();
    const isRelayIdentity =
        /@privaterelay\.appleid\.com$/i.test(String(currentIdentity || ''));

    const handleLinkExistingAccount = () => {
        navigation.navigate('EmailScreenAppleLogin', {
            onSubmit: async verifiedEmail => {
                if (!verifiedEmail) return;
                const email = String(verifiedEmail).trim().toLowerCase();
                try {
                    // Idempotent upsert so linking to a not-yet-existing account
                    // still lands somewhere; if the real-email account already
                    // exists (the common case) this is a harmless no-op update.
                    await axios
                        .post(
                            `${server.server.baseUrl}api/user/`,
                            { email, name: userDetails?.name || email.split('@')[0] },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Advisor-Subdomain': getAdvisorSubdomain(),
                                    'aq-encrypted-key': generateToken(
                                        Config.REACT_APP_AQ_KEYS,
                                        Config.REACT_APP_AQ_SECRET,
                                    ),
                                },
                            },
                        )
                        .catch(() => {});
                    // Re-key: emits ACCOUNT_EMAIL_EVENT so every screen reading
                    // useAccountEmail() (incl. TradeContext) re-hydrates.
                    await setAccountEmail(email);
                    // Belt-and-suspenders explicit refetch under the new identity.
                    await getUserDeatils?.();
                    navigation.navigate('AccountSettingsScreen');
                } catch (e) {
                    console.warn('Account link failed:', e?.message);
                }
            },
        });
    };

    const menuItems = [
        {
            id: 'account',
            title: 'Account',
            items: [
                {
                    icon: Link,
                    label: 'Broker Account',
                    onPress: () => handleMenuPress('Broker Setting'),
                },
                {
                    icon: Crown,
                    label: 'My Subscription',
                    onPress: () => handleMenuPress('MySubscriptionsScreen'),
                },
                ...(Platform.OS === 'ios' && isRelayIdentity
                    ? [
                        {
                            icon: UserPlus,
                            label: 'Link an existing account',
                            onPress: handleLinkExistingAccount,
                        },
                    ]
                    : []),
                ...((() => {
                    const hideChangeManagerCodes = Config?.REACT_APP_HIDE_CHANGE_MANAGER_FOR_CODES
                        ?.split(',')
                        .map(code => code.trim().toUpperCase()) || [];
                    const currentCode = Config?.ADVISOR_RA_CODE?.toUpperCase() || '';
                    // "Change Manager" lets a user switch which advisor/RA they
                    // sit under — only meaningful on the multi-advisor PARENT app
                    // (APP_VARIANT 'alphaquark' = AlphaQuark B2B). Whitelabel
                    // builds (alphanomy, zamzamcapital, rgxresearch, arfs, …) are
                    // single-tenant, so the option is hidden there by default.
                    // Still force-overridable via the existing flags.
                    const appVariant = Config?.APP_VARIANT || 'alphaquark';
                    const isWhitelabel = appVariant !== 'alphaquark';
                    const shouldHide = isWhitelabel ||
                        Config?.REACT_APP_HIDE_CHANGE_MANAGER === 'true' ||
                        hideChangeManagerCodes.includes(currentCode);
                    return !shouldHide;
                })()
                    ? [
                        {
                            icon: Tags,
                            label: 'Change Manager',
                            // Navigation registers this screen as "Advisor Change".
                            // The former display-label route ("Manager Change") did
                            // not exist in any navigator and produced a red-screen
                            // console error instead of opening the manager picker.
                            onPress: () => handleMenuPress('Advisor Change'),
                        },
                    ]
                    : []),
            ],
        },
        {
            id: 'insights',
            title: 'Insights',
            items: [
                {
                    icon: BookPlus,
                    label: 'Research Report',
                    onPress: () => handleMenuPress('ResearchReportScreen'),
                },
                {
                    icon: Bookmark,
                    label: 'Watchlists',
                    onPress: () => handleMenuPress('WatchList'),
                },
                {
                    icon: Receipt,
                    label: 'My Invoices',
                    onPress: () => handleMenuPress('PaymentHistoryScreen'),
                },
                {
                    icon: GraduationCap,
                    label: 'Knowledge Hub',
                    onPress: () => handleMenuPress('KnowledgeHub'),
                },
                // Courses + Webinars surfaced here (under Insights) because
                // the legacy right-drawer (Navigation.js:1040) has
                // swipeEnabled:false and no openDrawer caller anywhere in
                // src/, so the drawer entries added in commit bf33977 are
                // unreachable. Account Settings is the existing
                // bottom-tab-reachable home for ancillary navigation.
                // Same coursesEnabled / webinarsEnabled gating as the
                // drawer rows (Navigation.js:893-917).
                ...(config?.coursesEnabled
                    ? [
                        {
                            icon: BookOpen,
                            label: 'Courses',
                            onPress: () => handleMenuPress('MyCourses'),
                        },
                    ]
                    : []),
                ...(config?.webinarsEnabled
                    ? [
                        {
                            icon: Video,
                            label: 'Webinars',
                            onPress: () => handleMenuPress('WebinarsList'),
                        },
                    ]
                    : []),
            ],
        },
        {
            id: 'legal',
            title: 'Legal',
            items: [
                {
                    icon: Link,
                    label: 'Privacy Policy',
                    onPress: () => handleMenuPress('Privacy Policy'),
                },
                {
                    icon: Link,
                    label: 'Terms & Conditions',
                    onPress: () => handleMenuPress('Terms & Conditions'),
                },
                // In-app account deletion — required by Google Play for any
                // app with account creation. Soft-delete + SEBI retention
                // carve-out handled server-side (DELETE /api/account/delete);
                // see docs/ACCOUNT_DELETION_ARCHITECTURE.md.
                {
                    icon: Trash2,
                    label: 'Delete Account',
                    onPress: () => handleMenuPress('DeleteAccountScreen'),
                },
                {
                    icon: LogOut,
                    label: 'Log Out',
                    onPress: () => handleMenuPress('Logout'),
                    isLogout: true,
                },
            ],
        },
    ];

    const gradientStart = config?.gradient1 || '#002651';
    const gradientEnd = config?.gradient2 || '#0056B7';

    const Presentation = useComponent('screens.AccountSettingsScreen');

    // Variant-facing app-version string (e.g. "Alphanomy v1.0.0 · Build 1").
    // DeviceInfo.getVersion / getBuildNumber are sync from JS-side cached
    // BuildConfig values, so no async fetch needed. Default presentation
    // ignores `appVersion` / `whiteLabelText`; alphanomy reads them.
    const versionName = DeviceInfo.getVersion();
    const buildNumber = DeviceInfo.getBuildNumber();
    const whiteLabelText = Config?.REACT_APP_WHITE_LABEL_TEXT || 'Alphanomy';
    const appVersion = `${whiteLabelText} v${versionName} · Build ${buildNumber}`;

    return (
        <>
            <Presentation
                viewModel={{
                    userName: userDetails?.name,
                    userEmail: userDetails?.email,
                    imageUrl,
                    userInitials: getInitials(userDetails?.name),
                    menuItems,
                    gradientStart,
                    gradientEnd,
                    showBackgroundLogo,
                    backgroundLogo,
                    // Additive — default presentation ignores these.
                    appVersion,
                    whiteLabelText,
                }}
                actions={{
                    onGoBack: () => navigation?.goBack(),
                    // Routes to the new design-system NotificationListScreen
                    // (HTML § "08 · Notifications" port, registered via
                    // designs/{default,alphanomy}/index.js as
                    // `screens.NotificationListScreen`). The legacy
                    // `PushNotificationScreen` route is still wired in
                    // Navigation.js but no in-app bell points at it on the
                    // alphanomy fork — see docs/DESIGN_MIGRATION_PROGRESS.md
                    // § 2026-05-06 NotificationListScreen wiring.
                    onNavigateNotifications: () => navigation?.navigate('NotificationListScreen'),
                    // Profile-edit pill on the alphanomy gradient card.
                    // Default presentation doesn't surface an Edit affordance
                    // and ignores this action.
                    onEditProfile: () => setShowProfileModal(true),
                }}
            />
            <ProfileModal
                showModal={showProfileModal}
                setShowModal={setShowProfileModal}
                setModalHelp={() => {}}
                userEmail={userDetails?.email}
                getUserDeatils={getUserDeatils}
            />
        </>
    );
};

export default AccountSettingsScreen;
