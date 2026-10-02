/**
 * AccountSettingsScreen — container (Phase G batch 2, 2026-05-02)
 *
 * Owns: useTrade, useConfig, Firebase getAuth, APP_VARIANTS lookup,
 * feature-flag conditional logic (hide change manager), menu item
 * construction with navigation callbacks.
 * Renders presentation resolved from `screens.AccountSettingsScreen`.
 */

import React, { useCallback, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
    MessageSquare,
} from 'lucide-react-native';

import { getAuth } from '@react-native-firebase/auth';
import DeviceInfo from 'react-native-device-info';
import Config from '../../utils/safeConfig';
import { useTrade } from '../TradeContext';
import { useComponent } from '../../design/useDesign';
import useTokens from '../../theme/useTokens';
import ProfileModal from '../../components/ProfileModal';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import { getAccountEmail, setAccountEmail } from '../../utils/accountEmail';
import { countUnreadNotifications } from '../../utils/notificationDedup';
import {getAdvisorContentProfile} from '../../utils/advisorContentProfile';
import { useNavigationLayout } from '../../navigation/useNavigationLayout';

// Catalog icon names (src/navigation/screenCatalog.js MORE_ITEM_CATALOG) →
// lucide components.
const MORE_ICONS = {
    link: Link,
    bookPlus: BookPlus,
    graduationCap: GraduationCap,
    receipt: Receipt,
    crown: Crown,
    tags: Tags,
    logOut: LogOut,
    bookmark: Bookmark,
    bookOpen: BookOpen,
    video: Video,
    trash: Trash2,
    userPlus: UserPlus,
    messageSquare: MessageSquare,
};

// "Change Manager" lets a user switch which advisor/RA they sit under — only
// meaningful on the multi-advisor PARENT app (APP_VARIANT 'alphaquark' =
// AlphaQuark B2B). Whitelabel builds (alphanomy, zamzamcapital, rgxresearch,
// arfs, …) are single-tenant, so the option is hidden there by default.
// Still force-overridable via the existing flags.
const isChangeManagerVisible = () => {
    const hideChangeManagerCodes = Config?.REACT_APP_HIDE_CHANGE_MANAGER_FOR_CODES
        ?.split(',')
        .map(code => code.trim().toUpperCase()) || [];
    const currentCode = Config?.ADVISOR_RA_CODE?.toUpperCase() || '';
    const appVariant = Config?.APP_VARIANT || 'alphaquark';
    const isWhitelabel = appVariant !== 'alphaquark';
    const shouldHide = isWhitelabel ||
        Config?.REACT_APP_HIDE_CHANGE_MANAGER === 'true' ||
        hideChangeManagerCodes.includes(currentCode);
    return !shouldHide;
};

const AccountSettingsScreen = ({ navigation }) => {
    const {
        userDetails,
        getUserDeatils,
        allNotifications,
        getAllNotifcations,
        userEmail,
    } = useTrade();
    // Profile-edit modal: opened from the alphanomy presentation's "Edit"
    // pill on the gradient profile card. Same `<ProfileModal>` the legacy
    // Drawer renders — its body handles the form, save, and toast; we just
    // mount it here so the alphanomy variant has somewhere to open it from.
    const [showProfileModal, setShowProfileModal] = useState(false);
    const config = useConfig();
    const tokens = useTokens();
    const advisorContent = getAdvisorContentProfile();
    const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
    const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
    const fallbackConfig = APP_VARIANTS[validVariant] || {};

    // The translucent background logo reads as a faint white SQUARE patch on
    // the More page for tenants with a rectangular wordmark (tinted white at
    // 15% opacity) — RA request 2026-08-13: whitelabel/content.js flag
    // MONEYMAN_HIDE_BACKGROUND_LOGO hides it for that tenant.
    const showBackgroundLogo =
        !advisorContent.hideBackgroundLogo && config?.showBackgroundLogo !== false;
    const backgroundLogo = config?.backgroundLogo || config?.logo || fallbackConfig.logo;

    const auth = getAuth();
    const user = auth.currentUser;
    const imageUrl = user?.photoURL;
    const hasUnreadNotifications =
        countUnreadNotifications(allNotifications?.notifications) > 0;

    // The More screen can remain mounted while notification read state changes
    // elsewhere. Refresh on focus so its bell always reflects backend state.
    useFocusEffect(
        useCallback(() => {
            // getAllNotifcations is recreated with TradeContext state. Depending
            // on it would refetch after every response while this screen is
            // focused; userEmail is the stable identity that should retrigger.
            // Let the stack transition and first More-screen paint finish
            // before refreshing the global notification feed. Starting this
            // request during tabPress made the More tab appear unresponsive
            // on slower Samsung devices when several startup responses landed
            // in the same frame.
            const task = InteractionManager.runAfterInteractions(() => {
                if (typeof getAllNotifcations === 'function') {
                    getAllNotifcations({background: true});
                }
            });
            return () => task.cancel();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [userEmail]),
    );

    const getInitials = name => {
        return name?.length > 0 ? name[0]?.toUpperCase() : '';
    };

    const handleMenuPress = screenName => {
        if (navigation?.navigate) {
            navigation.navigate(screenName);
        }
    };

    const handleWebsitePage = ({ label, url }) => {
        navigation?.navigate?.('WebViewScreen', {
            title: label,
            url,
            pageType: 'legal',
        });
    };

    // Apple App Store guideline 5.1.1(v) requires an in-app path to account
    // deletion — link-out to a webpage is regularly rejected on iOS review.
    // Navigates to the in-app DeleteAccountScreen (preview + confirm + DELETE
    // /api/account/delete + logout). SEBI 5-year retention carve-out is
    // enumerated in-screen; no external browser step required.
    const handleDeleteAccount = () => {
        handleMenuPress('DeleteAccountScreen');
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
                                    'X-Advisor-Subdomain': getTenantSubdomain(),
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

    // Menu STRUCTURE (sections, order, which rows) comes from the variant's
    // navigation manifest (designs/<variant>/navigation.js `moreMenu`),
    // resolved against src/navigation/screenCatalog.js. Runtime flags below
    // only HIDE catalog rows. Log Out, legal pages and Delete Account are
    // catalog-required: the resolver re-adds them if a manifest drops them
    // (Apple 5.1.1(v) in-app deletion). See
    // docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.
    //
    // Route notes kept from the pre-manifest menu:
    //  - "Change Manager" navigates to "Advisor Change" (the former display-
    //    label route "Manager Change" did not exist in any navigator).
    //  - Recommendation Messages / Courses / Webinars were adopted from the
    //    retired right-drawer (2026-08-01); this screen is their only entry.
    const navLayout = useNavigationLayout({
        appleRelayIdentity: Platform.OS === 'ios' && isRelayIdentity,
        changeManagerVisible: isChangeManagerVisible(),
        coursesEnabled: Boolean(config?.coursesEnabled),
        webinarsEnabled: Boolean(config?.webinarsEnabled),
    });

    const ACTIONS = {
        linkAccount: handleLinkExistingAccount,
    };

    const toMenuItem = item => ({
        icon: MORE_ICONS[item.icon] || Link,
        label: item.label,
        onPress: item.action
            ? ACTIONS[item.action]
            : item.key === 'deleteAccount'
                ? handleDeleteAccount
                : () => handleMenuPress(item.route),
        ...(item.destructive ? { isLogout: true } : {}),
    });

    const menuItems = navLayout.moreSections
        .map(section => ({
            id: section.id,
            title: section.title,
            items: section.items.flatMap(item =>
                item.expand === 'tenantLinks'
                    ? advisorContent.moreLinks.map(link => ({
                        icon: Link,
                        label: link.label,
                        onPress: () => handleWebsitePage(link),
                    }))
                    : [toMenuItem(item)],
            ),
        }))
        // A section left empty (e.g. More Links with no tenant links) is
        // dropped, matching the pre-manifest conditional section.
        .filter(section => section.items.length > 0);

    const gradientStart = tokens.colors.brand.gradientStart;
    const gradientEnd = tokens.colors.brand.gradientEnd;

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
                    hasUnreadNotifications,
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
