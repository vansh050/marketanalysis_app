/**
 * CurrentHoldingsScreen — Step 1 of rebalance flow.
 * Fetches user's current portfolio holdings and lets them verify/edit before rebalancing.
 * Ported from Tidi's CurrentHoldingsPreviewPage.dart.
 *
 * Route params:
 *   portfolio: { modelName, advisor, id, ... }
 *   userEmail: string
 *   broker: string (broker name)
 *   brokerCredentials: { jwtToken, apiKey, secretKey, clientCode, ... }
 */
import React, {useCallback, useEffect, useState} from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {useComponent} from '../../design/useDesign';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const CurrentHoldingsScreen = () => {
  const navigation = useNavigation();
  const Presentation = useComponent('screens.CurrentHoldingsScreen');
  const route = useRoute();
  const { portfolio, userEmail, broker, brokerCredentials } = route.params || {};

  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editableHoldings, setEditableHoldings] = useState([]);

  const modelName = portfolio?.modelName || portfolio?.model_name;

  const fetchHoldings = useCallback(async () => {
    try {
      const resp = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}`,
        { headers: getHeaders(), timeout: 15000 },
      );
      const data = resp.data?.data || resp.data;
      const netPf = data?.user_net_pf_model;

      if (Array.isArray(netPf) && netPf.length > 0) {
        // Get latest snapshot
        const latest = netPf[netPf.length - 1];
        const orderResults = latest?.order_results || latest;
        if (Array.isArray(orderResults)) {
          const parsed = orderResults
            .filter((o) => (o.quantity || 0) > 0)
            .map((o) => ({
              symbol: o.symbol || o.tradingSymbol || '',
              quantity: Number(o.quantity || 0),
              averagePrice: Number(o.averagePrice || o.average_price || 0),
              ltp: Number(o.ltp || o.lastPrice || o.averagePrice || 0),
              exchange: o.exchange || 'NSE',
            }));
          setHoldings(parsed);
          setEditableHoldings(parsed.map((h) => ({ ...h })));
        }
      }
    } catch (e) {
      console.warn('[CurrentHoldings] fetch error:', e.message);
    }
    setLoading(false);
  }, [userEmail, modelName]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const heldSymbols = editMode
    ? new Set(editableHoldings.filter((h) => h.quantity > 0).map((h) => h.symbol))
    : new Set(holdings.filter((h) => h.quantity > 0).map((h) => h.symbol));

  const handleContinue = () => {
    navigation.navigate('RebalanceReview', {
      portfolio,
      userEmail,
      broker,
      brokerCredentials,
      heldSymbols: Array.from(heldSymbols),
    });
  };

  return (
    <Presentation
      viewModel={{loading, holdings, editableHoldings, editMode}}
      actions={{
        onBack: () => navigation.goBack(),
        onToggleEdit: () => setEditMode(value => !value),
        onQuantityChange: (index, value) => {
          setEditableHoldings(current => current.map((holding, itemIndex) =>
            itemIndex === index
              ? {...holding, quantity: parseInt(value, 10) || 0}
              : holding,
          ));
        },
        onContinue: handleContinue,
      }}
    />
  );
};

export default CurrentHoldingsScreen;
