const fs = require('fs');
const path = require('path');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = TestRenderer;

jest.mock('axios', () => ({get: jest.fn(), post: jest.fn()}));
jest.mock('react-native-webview', () => {
  const R = require('react');
  return {WebView: props => R.createElement('WebView', props)};
});
jest.mock('../utils/courseAuthHeaders', () => ({
  getAuthedHeaders: jest.fn(async () => ({
    'X-Advisor-Subdomain': 'kyzenresearch',
    Authorization: 'Bearer firebase-id-token',
  })),
}));
jest.mock('../theme/useTokens', () => () => ({
  colors: {brand: {primary: '#111111', gradientEnd: '#222222'}},
}));

const axios = require('axios');
const WhatsAppMitcModal = require(
  '../components/ModelPortfolioComponents/WhatsAppMitcModal',
).default;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const render = async props => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(WhatsAppMitcModal, {
        open: true,
        name: 'Asha',
        phone: '+91 98765 43210',
        planId: '',
        onClose: jest.fn(),
        onComplete: jest.fn(),
        ...props,
      }),
    );
  });
  await flush();
  return renderer;
};

describe('WhatsAppMitcModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    axios.get.mockReset();
    axios.post.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  test('starts consent with the 10-digit number and loads the embedded signing page', async () => {
    axios.post.mockResolvedValue({data: {sign_url: 'https://hostingsol.alphaquark.in/sign/tok'}});
    const renderer = await render({planId: 'plan-1'});

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toMatch(/api\/mitc\/consent\/start$/);
    expect(body).toEqual({name: 'Asha', phone: '9876543210', plan_id: 'plan-1'});
    expect(options.headers.Authorization).toBe('Bearer firebase-id-token');

    const webview = renderer.root.findByType('WebView');
    expect(webview.props.source.uri).toBe('https://hostingsol.alphaquark.in/sign/tok?embed=1');
  });

  test('an invalid mobile never starts consent', async () => {
    const renderer = await render({phone: '12345'});
    expect(axios.post).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain('valid 10-digit Indian mobile');
  });

  test('the page signal completes only after the server confirms the signature', async () => {
    axios.post.mockResolvedValue({data: {sign_url: 'https://hostingsol.alphaquark.in/sign/tok'}});
    const onComplete = jest.fn();
    const renderer = await render({onComplete});
    const webview = renderer.root.findByType('WebView');
    const signed = {nativeEvent: {data: JSON.stringify({type: 'aq-consent', status: 'signed'})}};

    axios.get.mockResolvedValueOnce({data: {completed: false}});
    await act(async () => { await webview.props.onMessage(signed); });
    expect(onComplete).not.toHaveBeenCalled();

    axios.get.mockResolvedValueOnce({data: {completed: true}});
    await act(async () => { await webview.props.onMessage(signed); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params).toEqual({plan_id: ''});
  });

  test('the status poll completes a signature the page never announced', async () => {
    axios.post.mockResolvedValue({data: {sign_url: 'https://hostingsol.alphaquark.in/sign/tok'}});
    axios.get.mockResolvedValue({data: {completed: true}});
    const onComplete = jest.fn();
    await render({onComplete});
    await act(async () => { jest.advanceTimersByTime(4000); });
    await flush();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when closed', async () => {
    const renderer = await render({open: false});
    expect(renderer.toJSON()).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('MPInvestNowModal WhatsApp MITC branch', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ModelPortfolioComponents/MPInvestNowModal.js'),
    'utf8',
  );
  const digioPayment = source
    .split('const handleDigioPayment = async')[1]
    .split('const handlePayment = async')[0];

  test('WhatsApp mode is decided before any Digio document is created', () => {
    expect(digioPayment.indexOf('if (useWhatsAppMitc)')).toBeGreaterThan(-1);
    expect(digioPayment.indexOf('if (useWhatsAppMitc)')).toBeLessThan(
      digioPayment.indexOf('openDigioModal()'),
    );
  });

  test('payment continues only from a server-confirmed signature', () => {
    expect(source).toContain('api/mitc/consent/status');
    expect(source).toMatch(/onComplete=\{\(\) => \{\s*setWhatsappMitcOpen\(false\);\s*handlePaymentType\(\);/);
  });

  test('consent scope mirrors the server gate', () => {
    expect(source).toContain("config?.perPlanDigio === true ? specificPlan?._id || '' : ''");
  });
});
