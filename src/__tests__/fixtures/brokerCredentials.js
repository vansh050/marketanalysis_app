/**
 * Test fixtures for broker credentials across all 14 supported brokers.
 */

export const ZERODHA_CREDENTIALS = {
  jwtToken: 'zerodha-jwt-token-123',
  apiKey: 'zerodha-api-key',
  secretKey: 'zerodha-secret-key',
};

export const ANGEL_ONE_CREDENTIALS = {
  jwtToken: 'angel-jwt-token-456',
  apiKey: 'angel-api-key',
};

export const UPSTOX_CREDENTIALS = {
  jwtToken: 'upstox-jwt-token-789',
  apiKey: 'encrypted_upstox-api-key',
  secretKey: 'encrypted_upstox-secret-key',
};

export const ICICI_CREDENTIALS = {
  jwtToken: 'icici-jwt-token-101',
  apiKey: 'encrypted_icici-api-key',
  secretKey: 'encrypted_icici-secret-key',
};

export const KOTAK_CREDENTIALS = {
  jwtToken: 'kotak-jwt-token-202',
  apiKey: 'encrypted_kotak-consumer-key',
  secretKey: 'encrypted_kotak-consumer-secret',
  sid: 'kotak-sid-303',
  serverId: 'kotak-server-id',
  viewToken: 'kotak-view-token',
};

export const DHAN_CREDENTIALS = {
  jwtToken: 'dhan-jwt-token-404',
  clientCode: 'DHAN-CLIENT-001',
};

export const FYERS_CREDENTIALS = {
  jwtToken: 'fyers-jwt-token-505',
  clientCode: 'FYERS-CLIENT-001',
};

export const IIFL_CREDENTIALS = {
  jwtToken: 'iifl-jwt-token-606',
  clientCode: 'IIFL-CLIENT-001',
};

export const ALICE_BLUE_CREDENTIALS = {
  jwtToken: 'alice-jwt-token-707',
  clientCode: 'ALICE-CLIENT-001',
  apiKey: 'alice-api-key',
};

export const HDFC_CREDENTIALS = {
  jwtToken: 'hdfc-jwt-token-808',
  apiKey: 'encrypted_hdfc-api-key',
};

export const GROWW_CREDENTIALS = {
  jwtToken: 'groww-jwt-token-909',
};

export const MOTILAL_CREDENTIALS = {
  jwtToken: 'motilal-jwt-token-010',
  clientCode: 'MOTILAL-CLIENT-001',
  apiKey: 'encrypted_motilal-api-key',
};

export const AXIS_CREDENTIALS = {
  jwtToken: 'axis-jwt-token-111',
  clientCode: 'AXIS-CLIENT-001',
};

export const DUMMY_CREDENTIALS = {};

export const ALL_BROKER_CREDENTIALS = {
  Zerodha: ZERODHA_CREDENTIALS,
  'Angel One': ANGEL_ONE_CREDENTIALS,
  Upstox: UPSTOX_CREDENTIALS,
  'ICICI Direct': ICICI_CREDENTIALS,
  Kotak: KOTAK_CREDENTIALS,
  Dhan: DHAN_CREDENTIALS,
  Fyers: FYERS_CREDENTIALS,
  'IIFL Securities': IIFL_CREDENTIALS,
  AliceBlue: ALICE_BLUE_CREDENTIALS,
  'Hdfc Securities': HDFC_CREDENTIALS,
  Groww: GROWW_CREDENTIALS,
  'Motilal Oswal': MOTILAL_CREDENTIALS,
  'Axis Securities': AXIS_CREDENTIALS,
  DummyBroker: DUMMY_CREDENTIALS,
};
