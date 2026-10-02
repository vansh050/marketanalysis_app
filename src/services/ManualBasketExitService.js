/**
 * Customer-owned manual basket exit API.
 *
 * Firebase identity is fetched synchronously for this mutation (the global
 * observe-mode interceptor is intentionally fail-open). The backend ignores
 * any caller-supplied email and scopes the basket family to this token email.
 * See docs/APP_ARCHITECTURE.md "Customer manual basket exit".
 */
import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import Config from 'react-native-config';

import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';

const headers = async configData => {
  const user = getAuth()?.currentUser;
  if (!user) throw new Error('Please sign in again before recording a manual exit.');
  const firebaseToken = await user.getIdToken(true);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${firebaseToken}`,
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key':
      Config.REACT_APP_AQ_ENCRYPTED_KEY ||
      generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
  };
};

const post = async (path, body, configData) => {
  const response = await axios.post(
    `${server.server.baseUrl}api/admin/basket-manual-exit/customer/${path}`,
    body,
    {headers: await headers(configData)},
  );
  return response.data;
};

export const previewManualBasketExit = (basketId, configData) =>
  post('preview', {basketId}, configData);

export const applyManualBasketExit = (payload, configData) =>
  post('apply', payload, configData);
