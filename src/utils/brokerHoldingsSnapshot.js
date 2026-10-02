import AsyncStorage from '@react-native-async-storage/async-storage';

const HOLDINGS_KEY = '@alphaquark/broker-holdings-snapshot:v1';
const SUMMARY_KEY = '@alphaquark/broker-holdings-summary:v1';

const normalize = value => String(value || '').trim().toLowerCase();

const belongsToAccount = (snapshot, email, broker) => {
  if (!snapshot || normalize(snapshot.email) !== normalize(email)) {
    return false;
  }
  return !broker || !snapshot.broker || normalize(snapshot.broker) === normalize(broker);
};

const read = async key => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

export const saveBrokerHoldingsSnapshot = async ({
  email,
  broker,
  holdings,
  refreshedAt,
}) => {
  if (!email || !holdings || !refreshedAt) {
    return;
  }
  await AsyncStorage.setItem(
    HOLDINGS_KEY,
    JSON.stringify({email, broker, holdings, refreshedAt}),
  );
};

export const loadBrokerHoldingsSnapshot = async (email, broker) => {
  const snapshot = await read(HOLDINGS_KEY);
  return belongsToAccount(snapshot, email, broker) ? snapshot : null;
};

export const saveBrokerHoldingsSummary = async ({
  email,
  broker,
  summary,
  refreshedAt,
}) => {
  if (!email || !summary || !refreshedAt) {
    return;
  }
  await AsyncStorage.setItem(
    SUMMARY_KEY,
    JSON.stringify({email, broker, summary, refreshedAt}),
  );
};

export const loadBrokerHoldingsSummary = async (email, broker) => {
  const snapshot = await read(SUMMARY_KEY);
  return belongsToAccount(snapshot, email, broker) ? snapshot : null;
};
