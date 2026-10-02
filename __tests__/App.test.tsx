/**
 * @format
 */

import 'react-native';
import React from 'react';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({currentUser: null}),
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return jest.fn();
  },
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/crashlytics', () => () => ({
  setUserId: jest.fn(() => Promise.resolve()),
  recordError: jest.fn(),
  log: jest.fn(),
}));

jest.mock('@react-native-firebase/messaging', () => () => ({
  getToken: jest.fn(() => Promise.resolve('test-token')),
  onMessage: jest.fn(() => jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('@react-native-firebase/app', () => ({
  firebase: {apps: []},
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  EventType: {ACTION_PRESS: 1},
}));

jest.mock('react-native-linear-gradient', () => {
  const {View} = require('react-native');
  return View;
});
jest.mock('react-native-toast-message', () => () => null);

jest.mock('react-native-pure-jwt', () => ({
  decode: jest.fn(() => Promise.resolve({})),
  sign: jest.fn(() => Promise.resolve('test-jwt')),
}));

jest.mock('../src/components/Navigation', () => () => null);
jest.mock('../src/utils/authTokenInterceptor', () => ({}));
jest.mock('../src/services/ZerodhaOAuthService', () => ({
  handleOAuthCallback: jest.fn(() => Promise.resolve({success: true})),
}));
jest.mock('../src/utils/smartLink', () => ({
  handleSmartLink: jest.fn(() => Promise.resolve(false)),
  captureInstallReferrer: jest.fn(),
}));
jest.mock('../src/sdk/SdkProviderRoot', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
  isSdkIntegrationEnabled: () => false,
}));
jest.mock(
  '../src/design/DesignProvider',
  () => ({children}: {children: React.ReactNode}) => children,
);
jest.mock('../src/design/useDesign', () => ({
  useComponent: () => () => null,
}));
jest.mock('../src/theme/useTokens', () => () => ({
  colors: {brand: {gradientStart: '#000000'}},
}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const {View} = require('react-native');
  return {GestureHandlerRootView: View};
});
jest.mock('../src/components/SupportWidget/SupportWidget', () => () => null);
jest.mock('../src/GlobalUIModals/ModalManager', () => () => null);
jest.mock('../src/GlobalUIModals/BrokerAlertModal', () => () => null);
jest.mock('../src/UpdateAppModal', () => ({AppUpdateChecker: () => null}));
jest.mock('../src/components/PublisherWebViewOverlay', () => ({
  PublisherWebViewHost: () => null,
}));
jest.mock('../src/components/CartContext', () => ({
  CartProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/components/ModalContext', () => ({
  ModalProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/components/SocialProofProvider', () => ({
  SocialProofProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/screens/TradeContext', () => ({
  TradeProvider: ({children}: {children: React.ReactNode}) => children,
  useTrade: () => ({
    userDetails: null,
    setUserDetails: jest.fn(),
    configData: null,
  }),
}));
jest.mock('../src/context/ConfigContext', () => ({
  ConfigProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/context/GstConfigContext', () => ({
  GstConfigProvider: ({children}: {children: React.ReactNode}) => children,
}));

import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

it('renders correctly', async () => {
  let tree: renderer.ReactTestRenderer;
  await renderer.act(async () => {
    tree = renderer.create(<App />);
    await Promise.resolve();
  });
  await renderer.act(async () => {
    tree.unmount();
  });
});
