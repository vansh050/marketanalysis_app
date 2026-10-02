import React, {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {getAccountEmail} from '../../utils/accountEmail';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

const TradePnLScreen = () => {
  const {configData} = useTrade();
  const config = useConfig();
  const navigation = useNavigation();
  const Presentation = useComponent('screens.TradePnLScreen');
  const userEmail = getAccountEmail();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [expandedModel, setExpandedModel] = useState(null);

  const fetchPnL = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/model-portfolio/trade-pnl/${encodeURIComponent(userEmail)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        },
      );
      if (response.data?.success) setData(response.data.data);
    } catch (error) {
      console.log('Trade P&L fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [configData, userEmail]);

  useEffect(() => {
    fetchPnL();
  }, [fetchPnL]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPnL();
    setRefreshing(false);
  }, [fetchPnL]);

  return (
    <Presentation
      viewModel={{
        gradient1: config?.gradient1 || designColor('002651'),
        gradient2: config?.gradient2 || designColor('0056b7'),
        mainColor: config?.mainColor || designColor('0056b7'),
        loading,
        refreshing,
        data,
        expandedModel,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        onOpenPlans: () => navigation.navigate('Plans'),
        onRefresh,
        onToggleModel: modelName => setExpandedModel(current => current === modelName ? null : modelName),
      }}
    />
  );
};

export default TradePnLScreen;
