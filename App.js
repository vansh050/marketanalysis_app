import 'react-native-gesture-handler';
import React, {useState, useEffect} from 'react';
import {StatusBar, SafeAreaView, Linking, Alert} from 'react-native';
import Toast from 'react-native-toast-message';
import axios from 'axios';
// Session-token migration Phase 1 — installs a fail-open axios request
// interceptor that attaches Authorization: Bearer <firebase-id-token> to
// our own API calls (observe-mode only, backend enforces nothing yet).
// See src/utils/authTokenInterceptor.js.
import './src/utils/authTokenInterceptor';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {getAuth, onAuthStateChanged} from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import notifee, {EventType} from '@notifee/react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  useSafeAreaInsets,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { handleOAuthCallback } from './src/services/ZerodhaOAuthService';
import { handleSmartLink, captureInstallReferrer } from './src/utils/smartLink';
import Config from 'react-native-config';

import Navigation from './src/components/Navigation';
import {CartProvider} from './src/components/CartContext';
import {ModalProvider} from './src/components/ModalContext';
import {SocialProofProvider} from './src/components/SocialProofProvider';
import DesignProvider from './src/design/DesignProvider';
import useTokens from './src/theme/useTokens';
import server from './src/utils/serverConfig';
import {TradeProvider} from './src/screens/TradeContext';
import {ConfigProvider} from './src/context/ConfigContext';
import SupportWidget from './src/components/SupportWidget/SupportWidget';
import {GstConfigProvider} from './src/context/GstConfigContext';
import eventEmitter from './src/components/EventEmitter';
import {
  getAccountEmailAsync,
  ACCOUNT_EMAIL_EVENT,
} from './src/utils/accountEmail';
import ModalManager from './src/GlobalUIModals/ModalManager';
import BrokerAlertModal from './src/GlobalUIModals/BrokerAlertModal';
import {AppUpdateChecker} from './src/UpdateAppModal';
import {PublisherWebViewHost} from './src/components/PublisherWebViewOverlay';
import DdpiDeclarationPrompt from './src/components/SellAuth/DdpiDeclarationPrompt';
import SdkProviderRoot, {
  isSdkIntegrationEnabled,
} from './src/sdk/SdkProviderRoot';
import {useComponent} from './src/design/useDesign';

// Module-level wrappers — hoisted out of the App body so their component
// identity is STABLE across App re-renders. Declaring them inline inside the
// App function (`const SdkRootWrapper = ...`, `const CustomStatusBar = ...`)
// created a new arrow-function component type on every App render. React then
// unmounted/remounted the subtree on every parent state change, with two
// production symptoms:
//   1) TextInput values "fluctuating" / disappearing as the user typed — the
//      navigation tree's screen useState (LoginScreen email/password) was
//      reset because the subtree remounted under the recreated wrapper.
//   2) Keyboard appearing then dismissing — every CustomStatusBar remount
//      re-invoked the native StatusBar setter; Android treated that as a
//      window-focus event and the IME dropped its connection.
// `isSdkIntegrationEnabled()` reads a build-time env var, so the off branch
// resolves to a JSX fragment (no passthrough component needed).
const SdkOn = ({userEmail, children}) => (
  <SdkProviderRoot userEmail={userEmail}>{children}</SdkProviderRoot>
);

const CustomStatusBar = ({barStyle}) => {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const statusBg = tokens.colors.brand.gradientStart;
  return (
    <LinearGradient
      colors={[statusBg, statusBg]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
      style={{height: insets.top}}>
      <StatusBar
        animated={true}
        barStyle={barStyle || 'light-content'}
        translucent={true}
        backgroundColor="transparent"
      />
    </LinearGradient>
  );
};

// App-root banner slot (regulatory strip etc.). Resolved from the active
// design variant — the default registers a no-op, forks override it. Must be
// a module-level component (like CustomStatusBar/SdkOn) rendered INSIDE
// <DesignProvider>, because useComponent reads the DesignContext that
// DesignProvider provides — App itself is the parent, not a child.
const RootBannerSlot = () => {
  const RootBanner = useComponent('composites.RootBanner');
  return <RootBanner />;
};

const App = () => {
  const [isSplashCompleted, setSplashCompleted] = useState(false);
  const [iscomplete, setcomplete] = useState(false);
  // const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  const [userEmail, setUserEmail] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    // App-root identity. This value feeds SdkProviderRoot's `userEmail` (the
    // SDK session-mint identity), SupportWidget and the user-details fetch
    // below — so reading `user.email` directly left Apple "Hide My Email"
    // users with NO SDK session at all (every SDK-gated broker Connect
    // button stays disabled on !ready) and no support/user context.
    // getAccountEmailAsync applies the Apple-aware precedence. See
    // src/utils/accountEmail.js.
    const resolveIdentity = async user => {
      if (!user) {
        setUserEmail(null);
        return;
      }
      try {
        setUserEmail((await getAccountEmailAsync()) || null);
      } catch {
        setUserEmail(user.email || null);
      }
    };

    // Handle user state changes
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUser(user);
      // Correlate production crashes to the authenticated Firebase account
      // without sending email addresses or broker credentials to Crashlytics.
      // An empty ID clears stale identity after logout/account switching.
      crashlytics().setUserId(user?.uid || '');
      resolveIdentity(user);
      if (initializing) {
        setInitializing(false);
      }
    });

    // The auth listener fires BEFORE an Apple user submits the email screen,
    // so the identity can resolve after this effect has already run.
    const onResolved = email => setUserEmail(email || null);
    eventEmitter.on(ACCOUNT_EMAIL_EVENT, onResolved);

    // Cleanup subscription
    return () => {
      unsubscribe();
      eventEmitter.off(ACCOUNT_EMAIL_EVENT, onResolved);
    };
  }, [initializing]);

  useEffect(() => {
    // Foreground event listener
    notifee.onForegroundEvent(({type, detail}) => {
      //  console.log('detail app:',detail);
      if (type === EventType.ACTION_PRESS) {
        const {pressAction, notification} = detail;

        if (pressAction.id === 'buy_sell') {
          const {symbol, trade_id, type} = notification.data;
          //console.log(`Action: ${type === 'BUY' ? 'BUY NOW' : 'SELL NOW'}`);
          // console.log('Symbol:', symbol);
          // console.log('Trade ID:', trade_id);
        }

        if (pressAction.id === 'ignore') {
          console.log('User chose to ignore the notification.');
        }
      }
    });

    // Background event listener
    notifee.onBackgroundEvent(async ({type, detail}) => {
      console.log('detail app:', detail);
      if (type === EventType.ACTION_PRESS) {
        const {pressAction, notification} = detail;

        if (pressAction.id === 'buy_sell') {
          const {symbol, trade_id, type} = notification.data;
          console.log(`Action: ${type === 'BUY' ? 'BUY NOW' : 'SELL NOW'}`);
          console.log('Symbol:', symbol);
          console.log('Trade ID:', trade_id);
        }

        if (pressAction.id === 'ignore') {
          console.log('User chose to ignore the notification.');
        }
      }
    });

    // Deep link listener for Zerodha OAuth callback
    const handleDeepLink = async (event) => {
      const url = event.url;
      console.log('[App] Deep link received:', url);

      // Campaign smart link (app-links.alphaquark.in/l/<tenant>?utm_*&dl=).
      // Captures UTM attribution + routes to the dl destination. If it was a
      // smart link, stop here so the Zerodha handler doesn't also run.
      if (url && (await handleSmartLink(url))) {
        return;
      }

      // Check if it's a Zerodha OAuth callback
      const scheme = Config?.REACT_APP_DEEP_LINK_SCHEME || 'rgxapp';
      if (url && url.startsWith(`${scheme}://zerodha/callback`)) {
        console.log('[App] Zerodha OAuth callback detected');

        const result = await handleOAuthCallback(url);

        if (result.success) {
          Alert.alert('Success', result.message || 'Zerodha connected successfully!');
        } else {
          Alert.alert('Error', result.error || 'Failed to connect Zerodha');
        }
      }
    };

    // Listen for deep link events
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    // Handle app launch from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // First-launch deferred deep link: recover UTM from the Play Install
    // Referrer when the user installed via a smart link (Android only; no-op
    // otherwise and when the native module isn't bundled yet).
    captureInstallReferrer();

    return () => {
      linkingSubscription.remove();
    };
  }, []);

  // Do not override Text/TextInput font scaling. Respecting the operating
  // system's accessibility text size is the native equivalent of allowing
  // browser zoom on the public site.

  const getUserDetails = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
      );
      const user = response.data.User;
      //   console.log('the user details i get :',user?.phone_number, user?.phone_number.toString().length >= 9)
      if (user?.phone_number && user?.phone_number.toString().length >= 9) {
        setcomplete(true);
      } else {
        setcomplete(false);
      }
    } catch (error) {
      //  console.error("Error fetching user details:::;;:", error);
      setcomplete(false);
    } finally {
      setcomplete(false);
    }
  };

  useEffect(() => {
    // Simulate Splash Screen for 2 seconds
    setTimeout(() => {
      setSplashCompleted(true);
    }, 2000);
  }, []);

  useEffect(() => {
    if (!!user) {
      getUserDetails();
    }
  }, [!!user]);

  // CustomStatusBar + SdkOn are hoisted to module scope (top of file) so
  // their component identity stays stable across App re-renders. See the
  // comment there for the production symptoms that motivated the move.
  //
  // The SDK on/off branches are inlined as JSX below (not a wrapper variable)
  // so the navigation subtree's parent component identity is stable —
  // recreating a wrapper component on each render remounted the whole tree
  // and wiped every screen's useState. Behind REACT_APP_SDK_INTEGRATION=true.
  const sdkOn = isSdkIntegrationEnabled();

  return (
    <SafeAreaProvider style={{flex: 1}}>
      <GestureHandlerRootView style={{flex: 1}}>
        <DesignProvider>
          <CustomStatusBar barStyle={'dark-content'} />
          <SocialProofProvider>
            <CartProvider>
              <ConfigProvider>
                <TradeProvider>
                  <GstConfigProvider>
                  <ModalProvider>
                    {sdkOn ? (
                      <SdkOn userEmail={userEmail}>
                        <SafeAreaView style={{flex: 1}}>
                          <RootBannerSlot />
                          <Navigation
                            iscomplete={iscomplete}
                            userEmail={userEmail}
                            isAuthenticated={!!user}
                          />
                          <Toast />
                        </SafeAreaView>
                        <ModalManager />
                        <BrokerAlertModal />
                        <DdpiDeclarationPrompt />
                        <SupportWidget userEmail={userEmail} visible={!!user} />
                        <AppUpdateChecker />
                        <PublisherWebViewHost />
                      </SdkOn>
                    ) : (
                      <>
                        <SafeAreaView style={{flex: 1}}>
                          <RootBannerSlot />
                          <Navigation
                            iscomplete={iscomplete}
                            userEmail={userEmail}
                            isAuthenticated={!!user}
                          />
                          <Toast />
                        </SafeAreaView>
                        <ModalManager />
                        <BrokerAlertModal />
                        <DdpiDeclarationPrompt />
                        <SupportWidget userEmail={userEmail} visible={!!user} />
                        <AppUpdateChecker />
                        <PublisherWebViewHost />
                      </>
                    )}
                  </ModalProvider>
                  </GstConfigProvider>
                </TradeProvider>
              </ConfigProvider>
            </CartProvider>
          </SocialProofProvider>
        </DesignProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
