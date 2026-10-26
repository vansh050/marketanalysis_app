jest.mock('axios', () => ({post: jest.fn()}));
jest.mock('react-native-webview', () => ({WebView: () => null}));
jest.mock('../../utils/customerAuthHeaders', () => ({
  getCustomerAuthHeaders: jest.fn(async () => ({Authorization: 'Bearer ID'})),
}));
jest.mock('../../utils/SecurityTokenManager', () => ({generateToken: jest.fn(() => 'APPKEY')}));
jest.mock('../../utils/variantHelper', () => ({getTenantSubdomain: jest.fn(() => 'prod')}));
jest.mock('../../utils/serverConfig', () => ({server: {baseUrl: 'https://node.test/'}}));

import axios from 'axios';
import {fetchVoiceUrl} from '../../components/SupportWidget/VoiceCallWebView';

describe('fetchVoiceUrl', () => {
  beforeEach(() => axios.post.mockReset());

  test('asks Node as the signed-in user, never the brain with an app key', async () => {
    axios.post.mockResolvedValue({data: {token: 'T', voiceUrl: 'https://brain.test/voice?token=T'}});
    await expect(fetchVoiceUrl()).resolves.toBe('https://brain.test/voice?token=T');
    const [url, body, opts] = axios.post.mock.calls[0];
    expect(url).toBe('https://node.test/api/support/voice-token');
    expect(body).toEqual({surface: 'customer'});
    expect(opts.headers).toMatchObject({
      'X-Advisor-Subdomain': 'prod',
      'aq-encrypted-key': 'APPKEY',
      Authorization: 'Bearer ID',
    });
    expect(JSON.stringify(body)).not.toMatch(/senderRef|advisor/);
  });

  test('fails when Node returns no token', async () => {
    axios.post.mockResolvedValue({data: {}});
    await expect(fetchVoiceUrl()).rejects.toThrow('no_token');
  });
});
