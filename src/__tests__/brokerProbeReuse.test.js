/**
 * Accept Rebalance probed the broker three times on one tap (2026-10-02).
 * The hook now reuses a successful probe for 30 s when asked, never reuses
 * a failed / disconnected probe, and drops the cache on reconnect events.
 */
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: fn => fn,
}));
jest.mock('axios', () => ({get: jest.fn()}));
jest.mock('react-native-config', () => ({}));
jest.mock('../utils/serverConfig', () => ({server: {baseUrl: 'https://x/'}}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 't'}));
jest.mock('../FunctionCall/fetchFunds', () => ({fetchFunds: jest.fn()}));
jest.mock('../screens/TradeContext', () => ({
  useTrade: () => ({
    funds: null,
    broker: 'Zerodha',
    brokerStatus: 'connected',
    userDetails: {user_broker: 'Zerodha', jwtToken: 'j'},
    configData: {config: {REACT_APP_HEADER_NAME: 'prod'}},
    getUserDeatils: jest.fn(),
    setFunds: jest.fn(),
  }),
}));

import axios from 'axios';
import {fetchFunds} from '../FunctionCall/fetchFunds';
import eventEmitter from '../components/EventEmitter';
import {
  useRefreshBrokerStatus,
  invalidateBrokerProbe,
  BROKER_PROBE_REUSE_MS,
} from '../hooks/useRefreshBrokerStatus';

const user = status => ({
  data: {User: {user_broker: 'Zerodha', connect_broker_status: status, jwtToken: 'j'}},
});
const live = {status: 0, data: {availablecash: 1000}};

describe('broker probe reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateBrokerProbe();
  });
  const probe = useRefreshBrokerStatus('a@b.com');

  test('a connected probe is reused inside the window', async () => {
    axios.get.mockResolvedValue(user('connected'));
    fetchFunds.mockResolvedValue(live);
    await probe({forceNetwork: true});
    const second = await probe({forceNetwork: true, reuseWithinMs: BROKER_PROBE_REUSE_MS});
    expect(second.reused).toBe(true);
    expect(fetchFunds).toHaveBeenCalledTimes(1);
  });

  test('without reuseWithinMs every forced call probes', async () => {
    axios.get.mockResolvedValue(user('connected'));
    fetchFunds.mockResolvedValue(live);
    await probe({forceNetwork: true});
    await probe({forceNetwork: true});
    expect(fetchFunds).toHaveBeenCalledTimes(2);
  });

  test('an expired / failed funds probe is never reused', async () => {
    axios.get.mockResolvedValue(user('connected'));
    fetchFunds.mockResolvedValue({status: 1, message: 'token expired'});
    await probe({forceNetwork: true});
    await probe({forceNetwork: true, reuseWithinMs: BROKER_PROBE_REUSE_MS});
    expect(fetchFunds).toHaveBeenCalledTimes(2);
  });

  test('a reconnect or placed order drops the cache', async () => {
    axios.get.mockResolvedValue(user('connected'));
    fetchFunds.mockResolvedValue(live);
    await probe({forceNetwork: true});
    eventEmitter.emit('refreshEvent', {source: 'Zerodha broker connection'});
    await probe({forceNetwork: true, reuseWithinMs: BROKER_PROBE_REUSE_MS});
    await probe({forceNetwork: true});
    eventEmitter.emit('OrderPlacedReferesh');
    await probe({forceNetwork: true, reuseWithinMs: BROKER_PROBE_REUSE_MS});
    expect(fetchFunds).toHaveBeenCalledTimes(4);
  });
});

describe('Accept Rebalance wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
  const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
  const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');

  test('get-repair overlaps the probe only for an already-connected broker and is used only for the same broker', () => {
    expect(card).toContain("brokerStatus === 'connected' && broker ? broker : null");
    expect(card).toContain('const earlyBroker = recentRepair ? broker : overlapBroker;');
    expect(card).toContain('if (earlyBroker && probed.broker !== earlyBroker) {');
  });

  test('the second and third probes reuse the first', () => {
    expect(card).toContain('reuseWithinMs: BROKER_PROBE_REUSE_MS');
    expect(card).toContain('liveSession: freshStatus');
    expect(advices).toContain('const handedSession = options.liveSession;');
    // calculate still routes an expired token to reconnect
    expect(advices).toContain('response?.data?.sessionExpired === true');
  });
});
