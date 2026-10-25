import RNConfig from 'react-native-config';
import Config, {PLATFORM_DEFAULTS} from '../../config/env';

describe('config/env', () => {
  afterEach(() => {
    delete RNConfig.REACT_APP_DIGIO_CHECK;
    delete RNConfig.REACT_APP_URL;
  });

  test('a key missing from .env gets the platform default', () => {
    expect(RNConfig.REACT_APP_NODE_SERVER_API_URL).toBeUndefined();
    expect(Config.REACT_APP_NODE_SERVER_API_URL).toBe(PLATFORM_DEFAULTS.REACT_APP_NODE_SERVER_API_URL);
  });

  test('.env wins over the default, even when empty', () => {
    RNConfig.REACT_APP_DIGIO_CHECK = 'afterPayment';
    expect(Config.REACT_APP_DIGIO_CHECK).toBe('afterPayment');
    RNConfig.REACT_APP_DIGIO_CHECK = '';
    expect(Config.REACT_APP_DIGIO_CHECK).toBe('');
  });

  test('REACT_APP_URL and REACT_APP_ADVISOR_TAG default to the tenant', () => {
    expect(Config.REACT_APP_URL).toBe(RNConfig.REACT_APP_HEADER_NAME);
    expect(Config.REACT_APP_ADVISOR_TAG).toBe(RNConfig.REACT_APP_HEADER_NAME);
    RNConfig.REACT_APP_URL = 'other';
    expect(Config.REACT_APP_URL).toBe('other');
  });

  test('reads are live and writes reach react-native-config', () => {
    Config.REACT_APP_DIGIO_CHECK = 'afterPayment';
    expect(RNConfig.REACT_APP_DIGIO_CHECK).toBe('afterPayment');
  });

  test('identity keys have no default', () => {
    expect(PLATFORM_DEFAULTS.REACT_APP_HEADER_NAME).toBeUndefined();
    expect(PLATFORM_DEFAULTS.REACT_APP_AQ_KEYS).toBeUndefined();
    expect({...Config}.REACT_APP_HEADER_NAME).toBe(RNConfig.REACT_APP_HEADER_NAME);
  });
});
