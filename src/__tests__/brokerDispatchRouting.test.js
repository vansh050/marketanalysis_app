/**
 * Routing matrix guard for BrokerConnectModalDispatch — mirrors
 * docs/BROKER_CONNECTION.md § "Broker connect routing matrix". Child screens
 * are stubbed; the test asserts WHICH screen the dispatcher selects.
 */
let mockRuntimeConfig = {};
let mockSdkFlag = 'true';

const stub = name => {
  const Component = () => null;
  Component.displayName = name;
  return {__esModule: true, default: Component};
};

jest.mock('react-native-config', () => ({
  get REACT_APP_USE_SDK_BROKER_FLOW() {
    return mockSdkFlag;
  },
}));
jest.mock('../context/ConfigContext', () => ({useConfig: () => mockRuntimeConfig}));
jest.mock('../utils/accountEmail', () => ({getAccountEmailAsync: async () => 'a@b.c'}));
jest.mock('../services/ModelPortfolioService', () => ({startAccountReconciliation: jest.fn()}));
jest.mock('../utils/brokerConnectionVerification', () => ({verifyPersistedBrokerConnection: jest.fn()}));
jest.mock('../components/iiflmodal', () => stub('IIFLModal'));
for (const [path, name] of [
  ['icicimodal', 'ICICIUPModal'],
  ['upstoxModal', 'UpstoxModal'],
  ['MotilalModal', 'MotilalModal'],
  ['ZerodhaConnectModal', 'ZerodhaConnectModal'],
  ['HDFCconnectModal', 'HDFCconnectModal'],
  ['DhanConnectModal', 'DhanConnectModal'],
  ['AliceBlueConnect', 'AliceBlueConnect'],
  ['FyersConnect', 'FyersConnect'],
  ['KotakModal', 'KotakModal'],
  ['GrowwConnectModal', 'GrowwConnectModal'],
  ['AxisConnectModal', 'AxisConnectModal'],
  ['ArihantConnectModal', 'ArihantConnectModal'],
  ['DefinEdgeConnectModal', 'DefinEdgeConnectModal'],
  ['Phase3SdkBrokerModal', 'Phase3SdkBrokerModal'],
  ['DeviceTotpReconnectGate', 'DeviceTotpReconnectGate'],
  ['AngelOneCautionaryWarning', 'AngelOneCautionaryWarning'],
  ['AngleoneBookingModal', 'AngleoneBookingModal'],
]) {
  jest.doMock(`../components/BrokerConnectionModal/${path}`, () => stub(name));
}

const Dispatch = require('../components/BrokerConnectionModal/BrokerConnectModalDispatch').default;

const route = (brokerName, extra = {}) => {
  const element = Dispatch({brokerName, isVisible: true, onClose() {}, ...extra});
  const name = element?.type?.displayName;
  const fallback = element?.props?.fallback?.type?.displayName;
  return fallback ? `${name}(${fallback})` : name;
};

describe('broker connect routing matrix', () => {
  beforeEach(() => {
    mockRuntimeConfig = {};
    mockSdkFlag = 'true';
  });

  test('Angel One never reaches the shared-SmartAPI legacy sheet', () => {
    expect(route('Angel One')).toBe('Phase3SdkBrokerModal');
    mockRuntimeConfig = {deviceTotpEnabled: true};
    expect(route('Angel One')).toBe('DeviceTotpReconnectGate(Phase3SdkBrokerModal)');
    mockSdkFlag = 'false';
    expect(route('Angel One')).toBe('DeviceTotpReconnectGate(Phase3SdkBrokerModal)');
    mockRuntimeConfig = {};
    expect(route('Angel One')).toBe('Phase3SdkBrokerModal');
  });

  test('device-TOTP tenants: gate brokers wrap their host modal', () => {
    mockRuntimeConfig = {deviceTotpEnabled: true};
    expect(route('Fyers')).toBe('DeviceTotpReconnectGate(FyersConnect)');
    expect(route('Zerodha')).toBe('DeviceTotpReconnectGate(ZerodhaConnectModal)');
    expect(route('Motilal Oswal')).toBe('DeviceTotpReconnectGate(MotilalModal)');
    expect(route('Upstox')).toBe('UpstoxModal');
    expect(route('Dhan')).toBe('DhanConnectModal');
    expect(route('Kotak')).toBe('KotakModal');
    expect(route('Groww')).toBe('GrowwConnectModal');
    expect(route('Arihant')).toBe('ArihantConnectModal');
    expect(route('Definedge')).toBe('DefinEdgeConnectModal');
    expect(route('AliceBlue')).toBe('AliceBlueConnect');
  });

  test('SDK lane by default; IIFL stays native', () => {
    for (const broker of ['Fyers', 'Zerodha', 'Upstox', 'Kotak', 'Dhan', 'AliceBlue', 'ICICI Direct']) {
      expect(route(broker)).toBe('Phase3SdkBrokerModal');
    }
    expect(route('IIFL Securities')).toBe('IIFLModal');
  });

  test('AliceBlue legacy flag still selects the native modal', () => {
    mockRuntimeConfig = {aliceBlueDeviceLoginEnabled: true};
    expect(route('AliceBlue')).toBe('AliceBlueConnect');
  });
});
