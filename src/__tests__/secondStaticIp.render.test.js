/**
 * Second whitelisted IP (OVH Mumbai) on the broker connect sheet and in
 * Manage Connections. Mirrors web src/__tests__/components/BackupStaticIp.test.js.
 * Backend: ccxt-india docs/EGRESS_OVH_PRIMARY_DESIGN.md.
 */
jest.mock('axios', () => ({get: jest.fn(), post: jest.fn()}));
jest.mock('@react-native-clipboard/clipboard', () => ({setString: jest.fn()}));
jest.mock('react-native-cashfree-pg-sdk', () => ({CFPaymentGatewayService: {}}));
jest.mock('cashfree-pg-api-contract', () => ({}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 'test-token'}));
// `mock`-prefixed so the factory may read it; tests switch it to {} to run the
// fallback-colour path (a fork once shipped that path with an undefined helper).
const mockColors = {value: {brand: {primary: '#1e9f40'}}};
jest.mock('../theme/useColors', () => ({useColors: () => mockColors.value}));

const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = TestRenderer;
const axios = require('axios');
const {SecondStaticIp} = require('../components/BrokerConnectionModal/EgressIpCallout');
const BackupStaticIp = require('../components/BrokerConnectionModal/BackupStaticIp').default;

const R64 = '2a11:6c7:1103:7001::aaaa';
const OVH = '2402:1f00:8300:5c0:e0::1234';
const entry = (extra = {}) => ({
  status: 'claimed', family: 'ipv6', address: R64,
  ovh_address: OVH, ovh_role: 'secondary', ovh_state: 'not_added', ...extra,
});

const textOf = node => (node.children || [])
  .map(c => (typeof c === 'string' ? c : textOf(c)))
  .join('');
const render = el => {
  let r;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
};
// Native (host) Text nodes that show an IP address, in render order.
const ips = r => r.root
  .findAll(n => typeof n.type === 'string' && n.props.selectable === true)
  .map(textOf)
  .filter(t => /^[0-9a-f:]+$/i.test(t));
const addedButton = r => r.root.findAll(
  n => typeof n.props.onPress === 'function' && textOf(n).includes("I've added it"),
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockColors.value = {brand: {primary: '#1e9f40'}};
});

test('renders and saves without a tenant brand colour (fallback colours)', async () => {
  mockColors.value = {};
  axios.post.mockReturnValue(new Promise(() => {})); // stay in the saving state
  const r = render(<SecondStaticIp brokerKey="upstox" entry={entry()} />);
  expect(ips(r)).toEqual([R64, OVH]);
  await act(async () => {
    addedButton(r).props.onPress();
  });
  expect(textOf(r.root)).not.toContain("I've added it"); // spinner shown instead
});

test('renders nothing without a second IP', () => {
  const r = render(<SecondStaticIp brokerKey="upstox" entry={{address: R64}} />);
  expect(r.toJSON()).toBeNull();
});

test('existing customer: current IP stays primary, OVH is the one to add', () => {
  const r = render(<SecondStaticIp brokerKey="upstox" entry={entry()} />);
  expect(ips(r)).toEqual([R64, OVH]);
  expect(textOf(r.root)).toContain('Primary static IP (already set)');
  expect(textOf(r.root)).toContain('Secondary static IP (add this)');
});

test('new customer: OVH is the primary', () => {
  const r = render(<SecondStaticIp brokerKey="upstox" entry={entry({ovh_role: 'primary'})} />);
  expect(ips(r)).toEqual([OVH, R64]);
});

test("\"I've added it\" posts the broker and moves to waiting", async () => {
  axios.post.mockResolvedValue({data: {status: 0, entry: entry({ovh_state: 'requested'})}});
  const Harness = () => {
    const [e, setE] = React.useState(entry());
    return <SecondStaticIp brokerKey="upstox" entry={e} customerId="cid1" onEntryChange={setE} />;
  };
  const r = render(<Harness />);
  await act(async () => {
    await addedButton(r).props.onPress();
  });
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/egress\/ovh\/added$/),
    {broker: 'upstox', customer_id: 'cid1'},
    expect.any(Object),
  );
  expect(textOf(r.root)).toContain('Waiting for confirmation');
  expect(addedButton(r)).toBeUndefined();
});

test('rejected shows the fix-it note and the button again; confirmed shows no button', () => {
  const rej = render(<SecondStaticIp brokerKey="groww" entry={entry({ovh_state: 'rejected'})} />);
  expect(textOf(rej.root)).toContain('rejected this IP');
  expect(addedButton(rej)).toBeDefined();
  const ok = render(<SecondStaticIp brokerKey="fyers" entry={entry({ovh_state: 'confirmed'})} />);
  expect(textOf(ok.root)).toContain('Active');
  expect(addedButton(ok)).toBeUndefined();
});

test('Manage Connections prompt: hidden without a second IP, no API call for other brokers', async () => {
  axios.get.mockResolvedValue({data: {brokers: {icicidirect: {status: 'claimed', address: R64}}}});
  let r;
  await act(async () => {
    r = TestRenderer.create(<BackupStaticIp broker="ICICI Direct" customerId="cid1" />);
  });
  expect(axios.get.mock.calls[0][1].params).toEqual({customer_id: 'cid1'});
  expect(r.toJSON()).toBeNull();

  axios.get.mockClear();
  await act(async () => {
    r = TestRenderer.create(<BackupStaticIp broker="Zerodha" customerId="cid1" />);
  });
  expect(axios.get).not.toHaveBeenCalled();
  expect(r.toJSON()).toBeNull();
});

test('Manage Connections prompt shows the card when a second IP exists', async () => {
  axios.get.mockResolvedValue({data: {brokers: {upstox: entry()}}});
  let r;
  await act(async () => {
    r = TestRenderer.create(<BackupStaticIp broker="Upstox" customerEmail="a@b.c" />);
  });
  expect(textOf(r.root)).toContain('Add a backup IP');
  expect(ips(r)).toEqual([R64, OVH]);
});
