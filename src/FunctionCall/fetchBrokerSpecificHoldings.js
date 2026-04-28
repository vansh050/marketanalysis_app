// src/FunctionCall/fetchBrokerSpecificHoldings.js (or add to same file)
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import server from '../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../utils/SecurityTokenManager';

const checkValidApiAnSecret = details => {
  if (!details) return null;
  try {
    const bytesKey = CryptoJS.AES.decrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    } else {
      throw new Error('Decryption failed or invalid key.');
    }
  } catch (error) {
    console.error('Error during decryption:', error.message);
    return null;
  }
};

const stripBearer = token => {
  return token ? token.replace(/^Bearer\s+/i, '') : token;
};

export const fetchBrokerSpecificHoldings = async (
  broker,
  clientCode,
  apiKey,
  jwtToken,
  secretKey,
  sid,
  viewToken,
  serverId,
  configData,
) => {
  // Early return if broker is missing
  if (!broker) {
    return null;
  }

  let data, url;
  const angelApi = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  switch (broker) {
    case 'IIFL Securities':
      // IIFL backend endpoints are currently unavailable (404)
      console.warn('[fetchSpecificHoldings] IIFL Securities integration is temporarily unavailable');
      return null;

    case 'ICICI Direct':
      if (!apiKey || !jwtToken || !secretKey) return null;
      data = JSON.stringify({
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        secretKey: checkValidApiAnSecret(secretKey),
        exchange: 'NSE',
      });
      url = `${server.ccxtServer.baseUrl}icici/holdings`;
      break;

    case 'Upstox':
      if (!apiKey || !jwtToken || !secretKey) return null;
      data = JSON.stringify({
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        apiSecret: checkValidApiAnSecret(secretKey),
      });
      url = `${server.ccxtServer.baseUrl}upstox/holdings`;
      break;

    case 'Angel One':
      if (!jwtToken) return null;
      data = JSON.stringify({
        apiKey: angelApi,
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}angelone/holdings`;
      break;

    case 'Zerodha':
      if (!jwtToken) return null;
      data = JSON.stringify({
        apiKey: configData?.config?.REACT_APP_ZERODHA_API_KEY,
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}zerodha/holdings`;
      break;

    case 'Hdfc Securities':
      if (!apiKey || !jwtToken) return null;
      data = JSON.stringify({
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}hdfc/holdings`;
      break;

    case 'Kotak':
      // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
      if (!jwtToken || !apiKey || !sid) return null;
      data = JSON.stringify({
        consumerKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        viewToken,
        sid,
        serverId: serverId || '',
      });
      url = `${server.ccxtServer.baseUrl}kotak/holdings`;
      break;

    case 'Dhan':
      if (!clientCode || !jwtToken) return null;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}dhan/holdings`;
      break;

    case 'AliceBlue':
      if (!clientCode || !jwtToken) return null;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}aliceblue/holdings`;
      break;

    case 'Fyers':
      if (!jwtToken) return null;
      data = JSON.stringify({
        clientId: clientCode,
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}fyers/holdings`;
      break;

    case 'Groww':
      if (!jwtToken) return null;
      data = JSON.stringify({
        accessToken: jwtToken,
      });
      url = `${server.ccxtServer.baseUrl}groww/holdings`;
      break;

    case 'Motilal Oswal':
      if (!jwtToken) return null;
      data = JSON.stringify({
        apiKey: checkValidApiAnSecret(apiKey),
        clientCode: clientCode,
        accessToken: stripBearer(jwtToken),
      });
      url = `${server.ccxtServer.baseUrl}motilal-oswal/holdings`;
      break;

    default:
      console.log('[fetchBrokerSpecificHoldings] Unrecognized broker:', broker);
      return null;
  }

  try {
    const response = await axios.post(url, data, {
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
    return null;
  }
};
