/**
 * Centralized broker session validation utility.
 * Replaces scattered inline token checks across trade modals.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const BROKER_SESSION_KEY = 'broker_session_date';

/**
 * All brokers that require a valid jwtToken for order placement.
 */
export const BROKERS_REQUIRING_TOKEN = [
  'AliceBlue',
  'Angel One',
  'Dhan',
  'Fyers',
  'Groww',
  'Hdfc Securities',
  'ICICI Direct',
  'IIFL Securities',
  'Kotak',
  'Motilal Oswal',
  'Upstox',
  'Zerodha',
];

/**
 * Get today's date string in IST (YYYY-MM-DD).
 */
const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
};

/**
 * Record that a broker session was established.
 * Call this after a successful broker connection/token refresh.
 */
export const saveBrokerSessionTime = async (broker) => {
  try {
    const sessionData = JSON.parse(
      (await AsyncStorage.getItem(BROKER_SESSION_KEY)) || '{}',
    );
    sessionData[broker] = getTodayIST();
    await AsyncStorage.setItem(BROKER_SESSION_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.warn('[BrokerSession] Failed to save session time:', e);
  }
};

/**
 * Check if the broker session was established today.
 * Indian broker tokens typically expire at end of trading day.
 * Returns true if session is from today, false otherwise.
 */
export const isBrokerSessionFresh = async (broker) => {
  try {
    const sessionData = JSON.parse(
      (await AsyncStorage.getItem(BROKER_SESSION_KEY)) || '{}',
    );
    return sessionData[broker] === getTodayIST();
  } catch (e) {
    return false;
  }
};

/**
 * Validate broker session before placing orders.
 * Checks: (1) broker requires token, (2) token exists, (3) session is from today.
 * Shows Toast error and returns false if invalid.
 *
 * @param {string} broker - Broker name
 * @param {string|null|undefined} jwtToken - Current JWT token
 * @param {object} [options] - Optional config
 * @param {boolean} [options.checkFreshness=false] - Also check if session is from today
 * @returns {Promise<boolean>} true if session is valid, false otherwise
 */
export const validateBrokerSession = async (broker, jwtToken, options = {}) => {
  if (!BROKERS_REQUIRING_TOKEN.includes(broker)) {
    return true;
  }

  if (!jwtToken) {
    Toast.show({
      type: 'error',
      text1: 'Session Expired',
      text2:
        'Broker session expired. Please reconnect your broker and try again.',
    });
    return false;
  }

  if (options.checkFreshness) {
    const fresh = await isBrokerSessionFresh(broker);
    if (!fresh) {
      Toast.show({
        type: 'error',
        text1: 'Session May Have Expired',
        text2:
          'Your broker session may have expired. Please reconnect if order placement fails.',
      });
      // Return true — let the user try, since we're not 100% certain it expired
      return true;
    }
  }

  return true;
};
