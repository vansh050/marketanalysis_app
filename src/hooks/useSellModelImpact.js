// SELL review (warn mode) state for a review modal. Fetches notices once per
// open (re-fetched only when SELL quantities change for a reason other than
// the customer's own choice) and applies choices to the review rows. Mirrors
// the web ReviewTradeModel wiring. Never blocks; fails open to no notices.
import {useCallback, useEffect, useRef, useState} from 'react';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getCustomerAuthHeaders} from '../utils/customerAuthHeaders';
import {resolveAdvisorSubdomain} from '../utils/brokerConnectionVerification';
import {
  applySellChoice,
  canonicalSymbol,
  fetchSellImpactNotices,
  reserveSellHolds,
  sellSignature,
} from '../utils/sellModelImpact';

// Tenant header = REACT_APP_HEADER_NAME resolution, never the build variant
// (see CLAUDE.md "mobile tenant header").
export const sellImpactHeaders = async configData => {
  const customerAuthHeaders = await getCustomerAuthHeaders();
  if (!customerAuthHeaders) return null;
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': resolveAdvisorSubdomain(configData),
    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
    ...customerAuthHeaders,
  };
};

export default function useSellModelImpact({visible, stockDetails, setStockDetails, broker, configData}) {
  const [notices, setNotices] = useState([]);
  const [choices, setChoices] = useState({});
  const fetchedSig = useRef('');
  const ownSig = useRef('');
  const baseRows = useRef({});

  useEffect(() => {
    if (!visible) {
      setNotices([]);
      setChoices({});
      fetchedSig.current = '';
      ownSig.current = '';
      baseRows.current = {};
      return undefined;
    }
    const signature = sellSignature(stockDetails);
    if (!signature || signature === fetchedSig.current || signature === ownSig.current) {
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const headers = await sellImpactHeaders(configData);
      if (!headers || cancelled) return;
      const next = await fetchSellImpactNotices({
        baseUrl: server.server.baseUrl,
        broker,
        rows: stockDetails,
        headers,
      });
      if (cancelled) return;
      fetchedSig.current = signature;
      baseRows.current = {};
      setChoices({});
      setNotices(next);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, stockDetails, broker, configData]);

  const choose = useCallback(
    (notice, choice, modelName) => {
      const key = canonicalSymbol(notice.symbol);
      if (!baseRows.current[key]) {
        // Snapshot at the first choice (after any closure clamp) so switching
        // choices never loses or restores quantity.
        baseRows.current[key] = (stockDetails || []).map(row => ({...row}));
      }
      const next = applySellChoice(stockDetails, baseRows.current[key], notice, choice, modelName);
      ownSig.current = sellSignature(next);
      setChoices(prev => ({...prev, [key]: {choice, modelName}}));
      setStockDetails(next);
    },
    [stockDetails, setStockDetails],
  );

  return {notices, choices, choose};
}

// Publisher (Kite) flows: write the SELL hold right before the window opens.
export const reserveSellHoldsForPublisher = async ({rows, broker, configData, requestId}) => {
  const headers = await sellImpactHeaders(configData);
  if (!headers) return null;
  return reserveSellHolds({baseUrl: server.server.baseUrl, broker, rows, headers, requestId});
};
