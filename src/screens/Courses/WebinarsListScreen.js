import React, {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';

import {useConfig} from '../../context/ConfigContext';
import liveKitService from '../../FunctionCall/services/LiveKitService';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

export default function WebinarsListScreen() {
  const navigation = useNavigation();
  const config = useConfig();
  const Presentation = useComponent('screens.WebinarsListScreen');
  const [data, setData] = useState({upcoming: [], live: [], replay: []});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({pullToRefresh = false} = {}) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await liveKitService.listPublicWebinars();
      setData(response || {upcoming: [], live: [], replay: []});
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load webinars');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Presentation
      viewModel={{
        enabled: config?.webinarsEnabled !== false,
        accent: config?.mainColor || config?.themeColor || designColor('b45309'),
        data,
        loading,
        refreshing,
        error,
      }}
      actions={{
        onRefresh: () => load({pullToRefresh: true}),
        onOpenWebinar: lessonId => navigation.navigate('WebinarDetail', {lessonId}),
      }}
    />
  );
}
