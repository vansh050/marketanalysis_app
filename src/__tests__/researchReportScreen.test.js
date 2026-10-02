import React from 'react';
import {act, create} from 'react-test-renderer';
import ResearchReportScreen from '../screens/Home/ResearchReportScreen';
import useLTPStore from '../components/AdviceScreenComponents/DynamicText/useLtpStore';
import WebSocketManager from '../components/AdviceScreenComponents/DynamicText/WebSocketManager';

jest.mock('@react-navigation/native', () => ({useNavigation: () => ({goBack: jest.fn()})}));
jest.mock('react-native-fs', () => ({}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('lucide-react-native', () => ({FileText: 'FileText', Search: 'Search', Download: 'Download', Filter: 'Filter', Calendar: 'Calendar', ChevronLeft: 'ChevronLeft'}));
jest.mock('@react-native-firebase/auth', () => ({getAuth: () => ({currentUser: null})}));
jest.mock('../screens/TradeContext', () => ({useTrade: () => ({configData: {}})}));
jest.mock('../context/ConfigContext', () => ({useConfig: () => ({})}));
jest.mock('../utils/accountEmail', () => ({getAccountEmail: () => 'review@example.test'}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: jest.fn(() => 'test-token')}));
jest.mock('../utils/variantHelper', () => ({
  getAdvisorSubdomain: () => 'test',
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    configData?.subdomain ||
    'test',
}));
jest.mock('../utils/serverConfig', () => ({__esModule: true, default: {server: {baseUrl: 'https://backend.test/'}, ccxtServer: {baseUrl: 'https://ccxt.test/'}, ccxtWs: {httpUrl: 'https://quotes.test'}}}));
jest.mock('../components/AdviceScreenComponents/DynamicText/WebSocketManager', () => { const instance = {subscribeToAllSymbols: jest.fn().mockResolvedValue(undefined)}; return {__esModule: true, default: {getInstance: jest.fn(() => instance)}}; });
jest.mock('../design/useDesign', () => ({
  useComponent: () => require('../../designs/default/screens/ResearchReportScreen').default,
}));

let tree;
const originalFetch = global.fetch;
beforeEach(() => {
  useLTPStore.setState({ltps: {}});
  global.fetch = jest.fn().mockResolvedValue({json: async () => ({success: true, reports: [], data: []})});
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = undefined;
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

// Navigation mounts this screen without a MarketDataProvider. Keep the real
// price hooks/store in these tests so a missing-provider crash is observable.
test('opens without a market context provider, including an empty report list', async () => {
  await act(async () => { tree = create(<ResearchReportScreen />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Research Report');
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

test('renders reports, subscribes to quotes and updates prices from the shared store', async () => {
  global.fetch.mockImplementation(async url => ({json: async () => url.includes('ccxt.test')
    ? {success: true, reports: [{_id: 'report-1', symbol: 'INFY', link: 'https://example.test/report.pdf', createdAt: '2026-09-10T12:00:00Z'}]}
    : {success: true, reports: [], data: []}}));
  await act(async () => { tree = create(<ResearchReportScreen />); });
  expect(JSON.stringify(tree.toJSON())).toContain('INFY');
  expect(JSON.stringify(tree.toJSON())).toContain('LTP unavailable');
  expect(WebSocketManager.getInstance().subscribeToAllSymbols).toHaveBeenCalledWith([{symbol: 'INFY'}]);
  await act(async () => { useLTPStore.getState().setLTP('INFY', 1520); });
  expect(JSON.stringify(tree.toJSON())).toContain('₹1,520');
});
