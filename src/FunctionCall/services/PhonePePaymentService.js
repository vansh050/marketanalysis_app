import axios from 'axios';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../../utils/variantHelper';

const PENDING_KEY = 'aq_phonepe_pending_order';

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

export async function createPhonePeOrder(payload) {
  const channel = Platform.OS === 'ios' ? 'ios' : 'android';
  const response = await axios.post(
    `${server.server.baseUrl}api/phonepe/orders`,
    {
      ...payload,
      channel,
      channelMetadata: {
        appId: DeviceInfo.getBundleId(),
        channelVersion: DeviceInfo.getSystemVersion(),
      },
    },
    { headers: headers(), timeout: 30000 },
  );
  if (!response.data?.redirectUrl || !response.data?.merchantOrderId) {
    throw new Error(response.data?.message || 'PhonePe did not return a checkout URL');
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({
    merchantOrderId: response.data.merchantOrderId,
    advisor: getTenantSubdomain(),
    createdAt: Date.now(),
  }));
  return response.data;
}

export async function openPhonePeCheckout(payload) {
  const order = await createPhonePeOrder(payload);
  const supported = await Linking.canOpenURL(order.redirectUrl);
  if (!supported) throw new Error('The PhonePe checkout URL cannot be opened on this device');
  await Linking.openURL(order.redirectUrl);
  return order;
}

export async function getPhonePeOrderStatus(merchantOrderId) {
  const response = await axios.get(
    `${server.server.baseUrl}api/phonepe/orders/${encodeURIComponent(merchantOrderId)}/status`,
    { headers: headers(), timeout: 30000 },
  );
  if (['COMPLETED', 'FAILED'].includes(response.data?.state)) {
    await AsyncStorage.removeItem(PENDING_KEY);
  }
  return response.data;
}

export async function getPendingPhonePeOrderId() {
  try {
    const pending = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) || 'null');
    if (pending?.advisor && pending.advisor !== getTenantSubdomain()) return null;
    return pending?.merchantOrderId || null;
  } catch (_error) {
    return null;
  }
}

export async function pollPhonePeOrder(merchantOrderId, { attempts = 10, delayMs = 3000 } = {}) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await getPhonePeOrderStatus(merchantOrderId);
    if (['COMPLETED', 'FAILED'].includes(result?.state)) return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { state: 'PENDING', merchantOrderId };
}
