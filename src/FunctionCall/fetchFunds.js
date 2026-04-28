import axios from 'axios';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import Config from 'react-native-config';

export const fetchFunds = async (
  broker,
  clientCode,
  apiKey, // kept for backward compatibility but not used
  jwtToken,
  secretKey, // kept for backward compatibility but not used
  sid,
  serverId,
  userEmail,
) => {
  if (!broker) {
    return null;
  }

  let data, url;

  // Server fetches apiKey/secretKey from DB using userEmail
  // We only need to pass accessToken, userEmail, and broker-specific identifiers
  switch (broker) {
    case 'IIFL Securities':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}iifl/funds`;
      break;
    case 'ICICI Direct':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}icici/funds`;
      break;
    case 'Upstox':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}upstox/funds`;
      break;
    case 'Angel One':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}angelone/funds`;
      break;
    case 'Motilal Oswal':
      if (!jwtToken) return;
      data = JSON.stringify({
        clientCode: clientCode,
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}motilal-oswal/funds`;
      break;
    case 'Zerodha':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}zerodha/funds`;
      break;
    case 'Hdfc Securities':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}hdfc/funds`;
      break;
    case 'Kotak':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        sid,
        serverId: serverId ? serverId : '',
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}kotak/funds`;
      break;
    case 'Dhan':
      if (!jwtToken) return;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}dhan/funds`;
      break;
    case 'Groww':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}groww/funds`;
      break;
    case 'AliceBlue':
      if (!jwtToken) return;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}aliceblue/funds`;
      break;
    case 'Fyers':
      if (!jwtToken) return;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}fyers/funds`;
      break;
    case 'Axis Securities':
      if (!jwtToken) return;
      data = JSON.stringify({
        accessToken: jwtToken,
        clientCode: clientCode,
        userEmail,
      });
      url = `${server.ccxtServer.baseUrl}axis/funds`;
      break;
    default:
      return; // If the broker is not recognized
  }

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain':
          Config.REACT_APP_HEADER_NAME || '',
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    });

    return response.data;
  } catch (error) {
    return error?.response?.data;
  }
};
