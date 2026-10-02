/**
 * Server-authoritative derivative basket entry gate.
 *
 * See docs/BASKETS_ARCHITECTURE.md: every mobile entry surface consumes the
 * same decision that the ccxt execution boundary enforces. Exit legs bypass it.
 */
import axios from 'axios';
import Config from 'react-native-config';

import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';

const headers = configData => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(configData),
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

export const authorizeBasketEntry = async ({
  userEmail,
  basketId,
  trades = [],
  route = 'mobile_basket_ui',
  configData,
}) => {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}orders/basket-entry/authorize`,
    {
      user_email: userEmail,
      basketId,
      route,
      trades: trades.map(trade => ({
        purpose: trade.purpose,
        isClosure: trade.isClosure,
        closurestatus: trade.closurestatus,
      })),
    },
    {headers: headers(configData), timeout: 5000},
  );
  return {...response.data, checkedAt: Date.now()};
};

export const basketEntryGateMessage = decision => {
  switch (decision?.code) {
    case 'ADVICE_OUT_OF_RANGE':
      return 'Current price is outside the recommended range';
    case 'PRICE_STALE':
      return 'Stale market price — entry is unavailable until the quote refreshes';
    case 'PRICE_UNAVAILABLE':
      return 'LTP unavailable — basket value and entry are unavailable';
    case 'ENTRY_BLOCKED':
      return decision?.message || 'Entry gate condition not satisfied';
    default:
      return decision?.message || 'Checking entry range...';
  }
};

export const requiresOutOfRangeConfirmation = decision =>
  decision?.code === 'ADVICE_OUT_OF_RANGE' &&
  decision?.requires_confirmation === true;
