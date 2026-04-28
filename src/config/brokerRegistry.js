/**
 * Centralized broker registry — single source of truth for all broker metadata.
 * Replaces 13 separate broker modal files with a data-driven config.
 *
 * Auth types:
 *   - oauth: Pure OAuth WebView (Zerodha, Angel One, Groww, Dhan, AliceBlue, Axis)
 *   - hybrid: Credential form first, then OAuth WebView (Upstox, ICICI, HDFC, Fyers, Motilal)
 *   - credential: Pure credential form with API validation (Kotak)
 */

export const BROKER_AUTH_TYPE = {
  OAUTH: 'oauth',
  HYBRID: 'hybrid',
  CREDENTIAL: 'credential',
};

/**
 * @typedef {Object} BrokerField
 * @property {string} label - Display label
 * @property {string} key - API parameter key
 * @property {boolean} isSecret - Whether to mask input
 * @property {string} [placeholder] - Input hint
 * @property {string} [validation] - Regex pattern for validation
 * @property {string} [validationError] - Error message when validation fails
 */

/**
 * @typedef {Object} BrokerConfig
 * @property {string} name - Display name (e.g., "Angel One")
 * @property {string} key - Unique key (e.g., "angelone")
 * @property {string} authType - One of BROKER_AUTH_TYPE values
 * @property {string} [apiBrokerName] - Name used in API calls (defaults to name)
 * @property {BrokerField[]} fields - Credential form fields (empty for pure OAuth)
 * @property {string} [logoKey] - Logo identifier for asset lookup
 * @property {string} [youtubeVideoId] - Setup instruction video
 * @property {string[]} [instructionSteps] - Setup guide steps
 * @property {string} [redirectUrl] - Custom redirect URL for OAuth
 */

/** @type {BrokerConfig[]} */
export const brokerRegistry = [
  {
    name: 'Zerodha',
    key: 'zerodha',
    authType: BROKER_AUTH_TYPE.OAUTH,
    logoKey: 'zerodha',
    fields: [],
  },
  {
    name: 'Angel One',
    key: 'angelone',
    authType: BROKER_AUTH_TYPE.OAUTH,
    logoKey: 'angelone',
    fields: [],
  },
  {
    name: 'Groww',
    key: 'groww',
    // Migrated 2026-04-20 OAUTH → CREDENTIAL (approval-mode), then
    // 2026-04-21 approval-mode → TOTP-seed (parity with web 9ed5c25).
    // Groww deprecated partner-API order placement in 2026-04. The
    // supported path as of 2026-04-21 is user-created API Key + Base32
    // TOTP seed via Groww's "Generate TOTP token" dialog on
    // groww.in/trade-api/api-keys, with a per-customer IP whitelist.
    // Seed is stored AES-256-CBC encrypted server-side; daily refresh
    // is a one-tap call to /api/groww/refresh-token. Session access
    // tokens reset daily at 6 AM IST.
    authType: BROKER_AUTH_TYPE.CREDENTIAL,
    logoKey: 'groww',
    fields: [
      {
        label: 'API Key',
        key: 'apiKey',
        isSecret: false,
        placeholder: 'Paste your Groww API Key',
      },
      {
        label: 'TOTP Secret Key (Base32)',
        key: 'totp_seed',
        isSecret: true,
        // NB: this must be the Base32 string shown BELOW the QR on
        // Groww's "Generate TOTP token" dialog, NOT the long JWT-style
        // value in the "TOTP Token" field at the top of that dialog.
        // Field label mirrors GrowwConnectModal.js for consistency.
        placeholder: 'Paste the ~32-char Base32 secret below the QR (A–Z, 2–7)',
      },
    ],
  },
  {
    name: 'Dhan',
    key: 'dhan',
    authType: BROKER_AUTH_TYPE.OAUTH,
    logoKey: 'dhan',
    fields: [],
  },
  {
    name: 'AliceBlue',
    key: 'aliceblue',
    authType: BROKER_AUTH_TYPE.OAUTH,
    logoKey: 'aliceblue',
    fields: [],
  },
  {
    name: 'Axis Securities',
    key: 'axis',
    authType: BROKER_AUTH_TYPE.OAUTH,
    logoKey: 'axis',
    fields: [],
  },
  {
    name: 'Upstox',
    key: 'upstox',
    authType: BROKER_AUTH_TYPE.HYBRID,
    logoKey: 'upstox',
    youtubeVideoId: 'yfTXrjl0k3E',
    fields: [
      { label: 'API Key', key: 'apiKey', isSecret: false, placeholder: 'Enter API key' },
      { label: 'Secret Key', key: 'secretKey', isSecret: true, placeholder: 'Enter secret key' },
    ],
  },
  {
    name: 'ICICI Direct',
    key: 'icicidirect',
    authType: BROKER_AUTH_TYPE.HYBRID,
    apiBrokerName: 'ICICI Direct',
    logoKey: 'icici',
    youtubeVideoId: 'XFLjL8hOctI',
    fields: [
      { label: 'API Key', key: 'apiKey', isSecret: false, placeholder: 'Enter API key' },
      { label: 'Secret Key', key: 'secretKey', isSecret: true, placeholder: 'Enter secret key' },
    ],
  },
  {
    name: 'Hdfc Securities',
    key: 'hdfc',
    authType: BROKER_AUTH_TYPE.HYBRID,
    logoKey: 'hdfc',
    youtubeVideoId: 'iziwR2zLLvk',
    fields: [
      { label: 'API Key', key: 'apiKey', isSecret: false, placeholder: 'Enter API key' },
      { label: 'Secret Key', key: 'secretKey', isSecret: true, placeholder: 'Enter secret key' },
    ],
  },
  {
    name: 'Fyers',
    key: 'fyers',
    authType: BROKER_AUTH_TYPE.HYBRID,
    logoKey: 'fyers',
    youtubeVideoId: 'blhTiePBIg0',
    fields: [
      { label: 'App ID', key: 'clientCode', isSecret: false, placeholder: 'Enter App ID' },
      { label: 'Secret ID', key: 'secretKey', isSecret: true, placeholder: 'Enter Secret ID' },
    ],
  },
  {
    name: 'Motilal Oswal',
    key: 'motilal',
    authType: BROKER_AUTH_TYPE.HYBRID,
    logoKey: 'motilal',
    youtubeVideoId: 'gGKedxU-sQ0',
    redirectUrl: 'https://ccxtprod.alphaquark.in/motilal-oswal/callback',
    fields: [
      { label: 'Client Code', key: 'clientCode', isSecret: false, placeholder: 'Enter client code' },
      { label: 'API Key', key: 'apiKey', isSecret: false, placeholder: 'Enter API key' },
    ],
  },
  {
    name: 'Kotak',
    key: 'kotak',
    authType: BROKER_AUTH_TYPE.CREDENTIAL,
    apiBrokerName: 'Kotak Neo',
    logoKey: 'kotak',
    fields: [
      { label: 'Unique Client Code', key: 'ucc', isSecret: false, placeholder: 'Enter your UCC Code' },
      { label: 'API Access Token', key: 'apiKey', isSecret: true, placeholder: 'e.g. ec6a746c-e44b-455e-abf2-c13352b2fc45' },
      {
        label: 'Mobile Number', key: 'mobileNumber', isSecret: false,
        placeholder: 'Enter 10-digit mobile number',
        validation: '^\\d{10}$', validationError: 'Must be exactly 10 digits',
      },
      {
        label: 'M-PIN', key: 'mpin', isSecret: true,
        placeholder: 'Enter 6-digit M-PIN',
        validation: '^\\d{6}$', validationError: 'Must be exactly 6 digits',
      },
      {
        label: 'TOTP', key: 'totp', isSecret: false,
        placeholder: 'Enter 6-digit TOTP',
        validation: '^\\d{6}$', validationError: 'Must be exactly 6 digits',
      },
    ],
  },
];

/**
 * Look up a broker config by name (case-insensitive).
 * @param {string} name
 * @returns {BrokerConfig|undefined}
 */
export const getBrokerByName = (name) => {
  const lower = name?.toLowerCase();
  return brokerRegistry.find(
    (b) => b.name.toLowerCase() === lower || b.key === lower ||
           (b.apiBrokerName && b.apiBrokerName.toLowerCase() === lower),
  );
};

/**
 * Look up a broker config by key.
 * @param {string} key
 * @returns {BrokerConfig|undefined}
 */
export const getBrokerByKey = (key) =>
  brokerRegistry.find((b) => b.key === key);

/**
 * Get the API-facing broker name (e.g., "Kotak Neo" for Kotak).
 * @param {BrokerConfig} config
 * @returns {string}
 */
export const getApiBrokerName = (config) =>
  config.apiBrokerName || config.name;

export default brokerRegistry;
