import React, {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {getAccountEmail} from '../../utils/accountEmail';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

const RecommendationMessagesScreen = () => {
  const navigation = useNavigation();
  const {configData} = useTrade();
  const config = useConfig();
  const userEmail = getAccountEmail();
  const Presentation = useComponent('screens.RecommendationMessagesScreen');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const response = await fetch(
        `${server.ccxtServer.baseUrl}comms/get-aq-message/20?email=${encodeURIComponent(userEmail)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        },
      );
      const json = await response.json();
      setMessages(Array.isArray(json?.result) ? json.result : []);
    } catch (requestError) {
      console.error('Error fetching recommendation messages:', requestError);
      setError('Failed to load messages. Please try again later.');
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [configData, userEmail]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return (
    <Presentation
      viewModel={{
        mainColor: config?.mainColor || designColor('045dff'),
        messages,
        loading,
        refreshing,
        error,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        onRefresh: () => {
          setRefreshing(true);
          fetchMessages();
        },
      }}
    />
  );
};

export default RecommendationMessagesScreen;
