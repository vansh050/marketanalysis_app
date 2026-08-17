import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import Config from 'react-native-config';

import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../utils/variantHelper';

export async function recordStandaloneManualPlacement(payload, configData) {
  const user = getAuth()?.currentUser;
  if (!user) throw new Error('Please sign in again before recording the trade.');
  const firebaseToken = await user.getIdToken(true);
  const response = await axios.post(
    `${server.server.baseUrl}api/recommendation/customer/manual-placement`,
    payload,
    {headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firebaseToken}`,
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
      'aq-encrypted-key': Config.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
    }},
  );
  return response.data;
}
