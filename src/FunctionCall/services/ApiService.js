import axios from 'axios';
import server from '../../utils/serverConfig';

import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import {useTrade} from '../../screens/TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';

export const getUserDetails = async userEmail => {
  const {configData} = useTrade();
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/user/getUser/${userEmail}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getAdvisorSubdomain(),
          'aq-encrypted-key': encryptApiKey(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      },
    );
    return response.data.User;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

export const getPortfolioPlans = async (advisorTag, userEmail = null) => {
  const {configData} = useTrade();
  try {
    const endpoint = userEmail
      ? `${server.server.baseUrl}api/admin/plan/${advisorTag}/model portfolio/${userEmail}`
      : `${server.server.baseUrl}api/all-plans/specific-advisor/plan/model portfolio/${advisorTag}`;

    const response = await axios.get(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching portfolio plans:', error);
    throw error;
  }
};

export const getBespokePlans = async (advisorTag, userEmail = null) => {
  const {configData} = useTrade();
  try {
    const endpoint = userEmail
      ? `${server.server.baseUrl}api/admin/plan/${advisorTag}/bespoke/${userEmail}`
      : `${server.server.baseUrl}api/all-plans/specific-advisor/plan/bespoke/${advisorTag}`;

    const response = await axios.get(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': encryptApiKey(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching bespoke plans:', error);
    throw error;
  }
};
