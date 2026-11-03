jest.mock('react-native-config', () => ({
  REACT_APP_DOMAIN: 'https://research.markup.club,http://localhost:3000',
  REACT_APP_ZERODHA_API_KEY: 'test-key',
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.example/'},
    ccxtServer: {baseUrl: 'https://ccxt.example/'},
    websocket: {baseUrl: 'https://websocket.example/'},
  },
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'test-token'),
}));
jest.mock('../../utils/accountEmail', () => ({
  getAccountEmailAsync: jest.fn(async () => 'test@example.com'),
}));
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    configData?.subdomain ||
    'test',
  getAdvisorSubdomain: jest.fn(() => 'test'),
}));
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));
jest.mock('../../utils/isMarketHours', () => jest.fn());

import IsMarketHours from '../../utils/isMarketHours';
import {convertToBasketItem} from '../../utils/brokerPublisher';

const symbolMap = {'YESBANK-EQ': {zerodha_symbol: 'YESBANK', exchange: 'NSE', ltp: 15.38}};
const stock = {tradingSymbol: 'YESBANK-EQ', exchange: 'NSE', transactionType: 'BUY',
  quantity: 1, orderType: 'LIMIT', price: 15.4, productType: 'DELIVERY'};

describe('Kite basket variety', () => {
  test('regular while the market is open', () => {
    IsMarketHours.mockReturnValue(true);
    expect(convertToBasketItem('Zerodha', stock, symbolMap).variety).toBe('regular');
  });

  // Kite rejects regular orders after close; a basket only reaches this
  // point after hours when an after-hours window is open.
  test('amo once the market has closed', () => {
    IsMarketHours.mockReturnValue(false);
    expect(convertToBasketItem('Zerodha', stock, symbolMap).variety).toBe('amo');
  });

  test('an explicit override wins', () => {
    IsMarketHours.mockReturnValue(false);
    expect(convertToBasketItem('Zerodha', stock, symbolMap, {variety: 'regular'}).variety).toBe('regular');
  });
});
