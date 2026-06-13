import 'react-native-gesture-handler';
import React, {useState, useEffect} from 'react';
import {StatusBar, Text, TextInput, SafeAreaView, Linking, Alert} from 'react-native';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {getAuth, onAuthStateChanged} from '@react-native-firebase/auth';
import notifee, {EventType} from '@notifee/react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  useSafeAreaInsets,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { handleOAuthCallback } from './src/services/ZerodhaOAuthService';
import Config from 'react-native-config';

import Navigation from './src/components/Navigation';
import {CartProvider} from './src/components/CartContext';
import {ModalProvider} from './src/components/ModalContext';
import {SocialProofProvider} from './src/components/SocialProofProvider';
import DesignProvider from './src/design/DesignProvider';
import server from './src/utils/serverConfig';
import {TradeProvider} from './src/screens/TradeContext';
import {ConfigProvider} from './src/context/ConfigContext';
import {GstConfigProvider} from './src/context/GstConfigContext';
import ModalManager from './src/GlobalUIModals/ModalManager';
import BrokerAlertModal from './src/GlobalUIModals/BrokerAlertModal';
import UpdateAppModal from './src/UpdateAppModal';
import SdkProviderRoot, {
  isSdkIntegrationEnabled,
} from './src/sdk/SdkProviderRoot';

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
  return (
    <LinearGradient
      colors={['rgba(0, 86, 183, 1)', 'rgba(0, 86, 183, 1)']}
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

const App = () => {
  const [isSplashCompleted, setSplashCompleted] = useState(false);
  const [iscomplete, setcomplete] = useState(false);
  // const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  const [userEmail, setUserEmail] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    // Handle user state changes
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUser(user);
      if (user?.email) {
        //console.log('got the emaiiilll:',user?.email);
        setUserEmail(user.email);
      } else {
        setUserEmail(null);
      }
      if (initializing) {
        setInitializing(false);
      }
    });
    // Cleanup subscription
    return unsubscribe;
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

    return () => {
      linkingSubscription.remove();
    };
  }, []);

  if (Text.defaultProps) {
    Text.defaultProps.allowFontScaling = false;
  } else {
    Text.defaultProps = {};
    Text.defaultProps.allowFontScaling = false;
  }

  // Override Text scaling in input fields
  if (TextInput.defaultProps) {
    TextInput.defaultProps.allowFontScaling = false;
  } else {
    TextInput.defaultProps = {};
    TextInput.defaultProps.allowFontScaling = false;
  }

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
      <UpdateAppModal />
      <CustomStatusBar barStyle={'dark-content'} />
      <GestureHandlerRootView style={{flex: 1}}>
        <DesignProvider>
          <SocialProofProvider>
            <CartProvider>
              <ConfigProvider>
                <TradeProvider>
                  <GstConfigProvider>
                  <ModalProvider>
                    {sdkOn ? (
                      <SdkOn userEmail={userEmail}>
                        <SafeAreaView style={{flex: 1}}>
                          <Navigation
                            iscomplete={iscomplete}
                            userEmail={userEmail}
                            isAuthenticated={!!user}
                          />
                          <Toast />
                        </SafeAreaView>
                        <ModalManager />
                        <BrokerAlertModal />
                      </SdkOn>
                    ) : (
                      <>
                        <SafeAreaView style={{flex: 1}}>
                          <Navigation
                            iscomplete={iscomplete}
                            userEmail={userEmail}
                            isAuthenticated={!!user}
                          />
                          <Toast />
                        </SafeAreaView>
                        <ModalManager />
                        <BrokerAlertModal />
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
