/**
 * SDK design-passthrough slots (docs/SDK_DESIGN_PASSTHROUGH.md § 9), rendered
 * through the real @alphaquark/mobile-sdk package with this app's React
 * Native jest setup (the SDK package has no RN renderer of its own).
 *
 * Contract: a host slot replaces PRESENTATION only — the SDK keeps
 * validation, encryption, the sell-auth short-circuit, amount maths and
 * every API call. Also pins that AlphaPro's own registry
 * (designs/default/sdk/index.js) keeps rendering the SDK built-ins.
 *
 * Requires the SDK lib to be built (npm run ota:sdk:build).
 */
jest.mock('react-native-webview', () => ({ WebView: () => null, default: () => null }));

const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const SDK = require('@alphaquark/mobile-sdk');
const {
  AqSdkClient,
  AqSdkProvider,
  BrokerCredentialForm,
  SellAuthGate,
  ModifyInvestmentSheet,
  KitePublisherWebView,
} = SDK;
const appSdkRegistry = require('../../designs/default/sdk').default;

function makeClient(calls) {
  const c = new AqSdkClient({
    baseUrl: 'https://server.example.test',
    mintSession: async (userRef) => ({
      token: 'tok', tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      userRef, scopes: ['connections:write'],
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
      return new Response(JSON.stringify({ ok: true, currentValue: 120, grossPnl: 22, estimatedCosts: 2, netPnl: 20 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  c.__ready = c.setUser('u@example.com');
  return c;
}

async function mount(element) {
  const client = element.props && element.props.client;
  if (client && client.__ready) await client.__ready;
  let r;
  await act(async () => { r = TestRenderer.create(element); });
  await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
  return r;
}

const texts = (r) => r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);

describe('brokerCredentialForm presentation slot', () => {
  test('host view renders SDK state; SDK still validates, encrypts and dispatches', async () => {
    const calls = [];
    let last;
    const View = (p) => { last = p; return null; };
    const onSuccess = jest.fn();
    await mount(
      React.createElement(AqSdkProvider, { client: makeClient(calls), userRef: 'u@example.com', components: { brokerCredentialForm: View } },
        React.createElement(BrokerCredentialForm, {
          broker: 'Groww', encrypt: (n, v) => 'enc:' + v, onSuccess, onError: jest.fn(),
        })));
    expect(last.viewModel.stage).toBe('credentials');
    expect(last.viewModel.fields.map((f) => f.name)).toEqual(['apiKey', 'growwTotpSeed']);
    expect(last.viewModel.submitLabel).toMatch(/Groww/);

    // Empty submit: SDK validation, no network call.
    await act(async () => { last.actions.submit(); });
    expect(Object.keys(last.viewModel.errors).length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.url.includes('/connect'))).toHaveLength(0);

    await act(async () => { last.actions.setField('apiKey', 'k1'); last.actions.setField('growwTotpSeed', 'JBSWY3DPEHPK3PXP'); });
    expect(last.viewModel.values).toEqual({ apiKey: 'k1', growwTotpSeed: 'JBSWY3DPEHPK3PXP' });
    await act(async () => { last.actions.submit(); await new Promise((r) => setTimeout(r, 20)); });
    const connect = calls.find((c) => c.url.includes('/sdk/v1/connections/Groww/connect'));
    expect(connect).toBeTruthy();
    expect(connect.body).toMatchObject({ apiKey: 'enc:k1', growwTotpSeed: 'enc:JBSWY3DPEHPK3PXP' });
    expect(onSuccess).toHaveBeenCalled();
  });

  test('registry re-exporting the SDK widget itself renders the default (no recursion)', async () => {
    const r = await mount(
      React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components: { brokerCredentialForm: BrokerCredentialForm } },
        React.createElement(BrokerCredentialForm, { broker: 'Groww', onSuccess: jest.fn(), onError: jest.fn() })));
    expect(texts(r)).toContain('Connect Groww');
  });
});

describe('sellAuthGate slot', () => {
  const gate = (components, userDetails) => React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components },
    React.createElement(SellAuthGate, { visible: true, brokerName: 'Zerodha', userDetails, onAuthorized: jest.fn(), onDeclined: jest.fn() }));

  test('host presentation renders when authorization is needed', async () => {
    let last;
    const View = (p) => { last = p; return null; };
    await mount(gate({ sellAuthGate: View }, {}));
    expect(last.brokerName).toBe('Zerodha');
    expect(typeof last.onAuthorized).toBe('function');
  });

  test('DDPI short-circuit stays in the SDK: host view never renders', async () => {
    const View = jest.fn(() => null);
    await mount(gate({ sellAuthGate: View }, { ddpi_status: 'ddpi' }));
    expect(View).not.toHaveBeenCalled();
  });
});

describe('modifyInvestmentSheet + rebalancePnlChoice slots', () => {
  test('host sheet gets SDK amount maths; submit calls the SDK', async () => {
    const calls = [];
    let last;
    const View = (p) => { last = p; return null; };
    const onSuccess = jest.fn();
    await mount(React.createElement(AqSdkProvider, { client: makeClient(calls), userRef: 'u@example.com', components: { modifyInvestmentSheet: View } },
      React.createElement(ModifyInvestmentSheet, { visible: true, onClose: jest.fn(), onSuccess, modelName: 'Alpha', modelId: 'm1', currentAmount: 100 })));
    expect(last.viewModel.pnl).toMatchObject({ netPnl: 20 });
    await act(async () => { last.actions.setInputAmount('50abc'); });
    expect(last.viewModel.inputAmount).toBe('50');
    expect(last.viewModel.totalAmount).toBe(150);
    await act(async () => { last.actions.setIncludePnl(true); });
    expect(last.viewModel.totalAmount).toBe(170);
    await act(async () => { last.actions.submit(); await new Promise((r) => setTimeout(r, 20)); });
    expect(calls.some((c) => c.method === 'POST' || c.method === 'PUT')).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(170);
  });

  test('P&L choice slot replaces only the toggle in the default sheet', async () => {
    let last;
    const Choice = (p) => { last = p; return null; };
    await mount(React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components: { rebalancePnlChoice: Choice } },
      React.createElement(ModifyInvestmentSheet, { visible: true, onClose: jest.fn(), modelName: 'Alpha', modelId: 'm1', currentAmount: 100 })));
    expect(last).toMatchObject({ investedAmount: 100, currentValue: 120, netPnl: 20, includePnl: false });
  });
});

describe('kitePublisherHeader slot', () => {
  test('host header gets the completion-guarded close', async () => {
    let last;
    const Header = (p) => { last = p; return null; };
    const onClose = jest.fn();
    await mount(React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components: { kitePublisherHeader: Header } },
      React.createElement(KitePublisherWebView, { visible: true, apiKey: 'k', basket: [], onComplete: jest.fn(), onClose })));
    expect(last.title).toMatch(/Kite/);
    act(() => { last.onClose(); last.onClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('brokerWebViewHeader slot', () => {
  const { WebViewBrokerAuthFlow } = SDK;
  const flow = (components, extra = {}) => React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components },
    React.createElement(WebViewBrokerAuthFlow, { broker: 'Zerodha', onSuccess: jest.fn(), onError: jest.fn(), onClose: extra.onClose || jest.fn(), ...extra }));

  test('provider header renders when no renderHeader prop is given', async () => {
    let last;
    const Header = (p) => { last = p; return null; };
    const onClose = jest.fn();
    await mount(flow({ brokerWebViewHeader: Header }, { onClose }));
    expect(last).toMatchObject({ brokerName: 'Zerodha', title: 'Connecting Zerodha' });
    act(() => last.onClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('an explicit renderHeader prop still wins', async () => {
    const Header = jest.fn(() => null);
    const renderHeader = jest.fn(() => null);
    await mount(flow({ brokerWebViewHeader: Header }, { renderHeader }));
    expect(renderHeader).toHaveBeenCalled();
    expect(Header).not.toHaveBeenCalled();
  });
});


describe('AlphaPro registry keeps the SDK built-ins', () => {
  test('header and P&L slots are null (SDK built-in); picker slot is reserved', () => {
    expect(appSdkRegistry.brokerWebViewHeader).toBeNull();
    expect(appSdkRegistry.kitePublisherHeader).toBeNull();
    expect(appSdkRegistry.rebalancePnlChoice).toBeNull();
    expect(appSdkRegistry.brokerSelectionList).toBeNull();
  });

  test('the registry as a whole renders the SDK default credential form and header', async () => {
    const form = await mount(
      React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components: appSdkRegistry },
        React.createElement(BrokerCredentialForm, { broker: 'Groww', onSuccess: jest.fn(), onError: jest.fn() })));
    expect(texts(form)).toContain('Connect Groww');

    const kite = await mount(
      React.createElement(AqSdkProvider, { client: makeClient([]), userRef: 'u@example.com', components: appSdkRegistry },
        React.createElement(KitePublisherWebView, { visible: true, apiKey: 'k', basket: [], onComplete: jest.fn(), onClose: jest.fn() })));
    expect(texts(kite)).toContain('Zerodha Kite — Review & Place');
  });
});
