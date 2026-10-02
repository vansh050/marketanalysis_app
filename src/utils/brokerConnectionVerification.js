import axios from 'axios';
import Config from 'react-native-config';
import server from './serverConfig';
import {generateToken} from './SecurityTokenManager';
import {getTenantSubdomain} from './variantHelper';

const DEFAULT_ATTEMPTS = 2;
const DEFAULT_DELAY_MS = 450;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const normaliseBroker = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const brokerAliases = value => {
  const broker = normaliseBroker(value);
  if (broker === 'hdfc securities' || broker === 'hdfc') {
    return new Set(['hdfc securities', 'hdfc']);
  }
  if (broker === 'angelone' || broker === 'angel one') {
    return new Set(['angelone', 'angel one']);
  }
  if (broker === 'kotak neo' || broker === 'kotak') {
    return new Set(['kotak neo', 'kotak']);
  }
  return new Set([broker]);
};

// Keep persistence verification on the same runtime tenant as the connect
// writer. Falling back to the build env here makes an AlphaB2B session that
// selected MoneyMan read `prod.users` after writing `moneyman.users` (or vice
// versa), which looks exactly like a failed broker save.
export const resolveAdvisorSubdomain = configData =>
  getTenantSubdomain(configData);

export const brokerNamesMatch = (actual, expected) => {
  const actualNames = brokerAliases(actual);
  const expectedNames = brokerAliases(expected);
  return [...actualNames].some(name => expectedNames.has(name));
};

export const persistedBrokerMatches = (user, expectedBroker) => {
  if (!user || !expectedBroker) return false;
  if (user.connect_broker_status !== 'connected') return false;

  // NOTE: `noBrokerRequired` is deliberately NOT checked here. It is a user
  // PREFERENCE ("I'm happy to continue without a broker"), not connection
  // state, and the two coexist legitimately: a customer who once chose the
  // brokerless path and later connects a broker keeps the flag until a writer
  // clears it. Treating it as disqualifying rejected a fully connected,
  // unexpired Zerodha session on 2026-09-17 and blocked the very account the
  // gate was built for. The backend clears the flag on connect
  // (MultiBrokerService + the per-broker writers) so the rebalance ENTRY gate
  // stops reading such accounts as brokerless — that is where the flag
  // matters. Verification only answers "is the broker I just connected now
  // canonical and live?".
  const canonicalBroker = user.primary_broker || user.user_broker;
  if (!brokerNamesMatch(canonicalBroker, expectedBroker)) return false;

  // Older accounts only have top-level credentials. New multi-broker accounts
  // may additionally carry connected_brokers; when the array exists, require
  // the selected broker's slot to be connected as well.
  if (Array.isArray(user.connected_brokers) && user.connected_brokers.length) {
    const entry = user.connected_brokers.find(item =>
      brokerNamesMatch(item?.broker, expectedBroker),
    );
    if (!entry || (entry.status && entry.status !== 'connected')) return false;
  }

  return true;
};

export async function verifyPersistedBrokerConnection({
  broker,
  userEmail,
  configData,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
}) {
  if (!broker || !userEmail) {
    throw new Error('Broker connection verification is missing account details.');
  }

  let lastError;
  let contradicted = false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${encodeURIComponent(userEmail)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': resolveAdvisorSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 8000,
        },
      );
      const user = response.data?.User;
      if (persistedBrokerMatches(user, broker)) {
        return user;
      }
      if (user) {
        // We positively READ the account and it contradicts the broker the
        // user just connected. This is the real failed-save signal.
        contradicted = true;
        lastError = new Error(
          `${broker} login completed, but the saved broker connection could not be verified.`,
        );
      } else {
        lastError = new Error(
          `No account record came back while verifying ${broker}.`,
        );
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt + 1 < attempts) await sleep(delayMs);
  }

  if (!contradicted) {
    // We could not READ the record (network, wrong/missing tenant header, 404,
    // unexpected payload). That is not evidence the save failed, and blocking
    // on it turns any read-path defect into a fleet-wide inability to connect
    // a broker — which is exactly what happened on 2026-09-17. Fail OPEN here
    // and let the rebalance-entry gate, which re-reads canonical state before
    // any order path, remain the backstop.
    console.warn(
      '[brokerConnectionVerification] could not read the account to verify',
      broker,
      '-',
      lastError?.message,
    );
    return null;
  }

  const error = new Error(
    lastError?.response?.data?.message ||
      lastError?.message ||
      `Unable to verify the saved ${broker} connection.`,
  );
  error.code = 'BROKER_PERSISTENCE_NOT_VERIFIED';
  error.retryable = true;
  throw error;
}
