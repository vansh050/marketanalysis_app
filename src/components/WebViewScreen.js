import React from 'react';
import {useNavigation} from '@react-navigation/native';

import {useComponent} from '../design/useDesign';

const ANGEL_ONE_AUTH_URL =
  'https://smartapi.angelbroking.com/publisher-login?api_key=8PGOS2CW';

const parseQueryString = queryString => {
  const params = {};
  const rawQuery = queryString || '';
  const query = rawQuery.startsWith('?') ? rawQuery.substring(1) : rawQuery;
  const pairs = query ? query.split('&') : [];
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });
  return params;
};

const WebViewScreen = ({route}) => {
  const navigation = useNavigation();
  const Presentation = useComponent('screens.WebViewScreen');
  const pageUrl = route?.params?.url || ANGEL_ONE_AUTH_URL;
  const pageTitle = route?.params?.title || 'Connect Angel One';
  const isLegalPage = route?.params?.pageType === 'legal';

  const onNavigationStateChange = ({url}) => {
    if (!isLegalPage && url?.includes('apisession=')) {
      const sessionToken = parseQueryString(url.split('?')[1]).apisession;
      if (sessionToken) {
        // The broker screen owns the token exchange. This controller only
        // observes the publisher callback so presentation remains stateless.
      }
    }
  };

  return (
    <Presentation
      viewModel={{pageUrl, pageTitle}}
      actions={{onBack: () => navigation.goBack(), onNavigationStateChange}}
    />
  );
};

export default WebViewScreen;
