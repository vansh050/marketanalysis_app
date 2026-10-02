import React, {useState, useEffect, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import moment from 'moment';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {resolveImageUrl} from '../../utils/resolveImageUrl';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import {
  getSubscriptionStatus,
  ACCEPTABLE_DATE_FORMATS,
} from '../../utils/subscriptionStatus';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  getSubscribedPlanDestination,
  isBespokePlan,
} from '../../utils/subscribedPlanNavigation';
import {useComponent} from '../../design/useDesign';

import {designColor} from '../../design/literalTokens';

// getSubscriptionStatus + ACCEPTABLE_DATE_FORMATS now come from
// src/utils/subscriptionStatus.js — single source of truth shared with
// MPPerformanceScreen and BespokePerformanceScreen.

const MySubscriptionsScreen = () => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradient1 = config?.gradient1 || designColor('002651');
  const gradient2 = config?.gradient2 || designColor('0076fb');
  const mainColor = config?.mainColor || designColor('0056b7');
  const cardElevation = config?.cardElevation ?? 3;
  const cardBorderWidth = config?.CardborderWidth ?? 0;
  const cardVerticalMargin = config?.cardverticalmargin ?? 12;
  const paymentModalConfig = config?.paymentModal;
  const activeColor = paymentModalConfig?.stepCompletedColor || designColor('29a400');

  const navigation = useNavigation();
  const Presentation = useComponent('screens.MySubscriptionsScreen');
  const userEmail = getAccountEmail();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allPlans, setAllPlans] = useState([]);
  const [subscriptionData, setSubscriptionData] = useState(null);

  const fetchAllPlans = async () => {
    try {
      const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain();
      const headers = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };
      // Fetch both MP and Bespoke plans in parallel (matching web app)
      const [mpResponse, bespokeResponse] = await Promise.allSettled([
        axios.get(
          `${server.server.baseUrl}api/admin/plan/${advisorTag}/model portfolio/${userEmail}`,
          {headers},
        ),
        axios.get(
          `${server.server.baseUrl}api/admin/plan/${advisorTag}/bespoke/${userEmail}`,
          {headers},
        ),
      ]);
      const mpPlans = mpResponse.status === 'fulfilled' ? (mpResponse.value.data.data || []) : [];
      const bespokePlans = bespokeResponse.status === 'fulfilled' ? (bespokeResponse.value.data.data || []) : [];
      setAllPlans([...mpPlans, ...bespokePlans]);
    } catch (error) {
      console.log('Error fetching plans:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      setSubscriptionData(response.data.data);
    } catch (error) {
      console.log('Error fetching subscriptions:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAllPlans(), fetchSubscriptionData()]);
    setLoading(false);
  };

  useEffect(() => {
    if (userEmail) {
      loadData();
    }
  }, [userEmail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAllPlans(), fetchSubscriptionData()]);
    setRefreshing(false);
  }, [userEmail]);

  // Filter plans with active subscriptions — single source of truth is
  // `getSubscriptionStatus` (which now consults clientData.groups +
  // subscriptions, matching web's IPOCard.hasActiveSubscription). The
  // previous `plan.subscription` shortcut was wrong: the backend
  // attaches that field with a default expiry on EVERY plan in the
  // catalog (the plan's own validity, not the user's subscription
  // window), so the filter accepted every plan and the screen showed
  // 6 MPs all "Active". 2026-06-09 user report.
  const subscribedPlans = allPlans.filter(plan => {
    const subStatus = getSubscriptionStatus(plan?.name, subscriptionData);
    return subStatus.status === 'active' || subStatus.status === 'renew';
  });

  // Bifurcate subscriptions by type
  const [activeSubTab, setActiveSubTab] = useState('mp');
  const mpSubscribed = subscribedPlans.filter(p => !isBespokePlan(p));
  const bespokeSubscribed = subscribedPlans.filter(isBespokePlan);
  const displayedPlans = activeSubTab === 'mp' ? mpSubscribed : bespokeSubscribed;

  const handlePlanPress = plan => {
    const {screen, params} = getSubscribedPlanDestination(plan);
    navigation.navigate(screen, params);
  };

  const planCards = displayedPlans.map(plan => {
    const subStatus = getSubscriptionStatus(plan?.name, subscriptionData);
    const startRaw = subStatus.subscription?.startDate || subStatus.subscription?.start_date;
    return {
      id: plan?._id,
      plan,
      name: plan?.name,
      imageSource: plan?.image
        ? {uri: resolveImageUrl(plan.image, server.server.baseUrl)}
        : null,
      expiry: subStatus.expiry
        ? moment(subStatus.expiry, ACCEPTABLE_DATE_FORMATS).format('DD MMM YYYY')
        : 'Never',
      started: startRaw
        ? moment(startRaw, ACCEPTABLE_DATE_FORMATS).format('DD MMM YYYY')
        : null,
      isRenew: subStatus.status === 'renew',
      daysLeft: subStatus.daysLeft,
    };
  });

  return (
    <Presentation
      viewModel={{
        gradient1,
        gradient2,
        mainColor,
        activeColor,
        cardElevation,
        cardBorderWidth,
        cardVerticalMargin,
        bespokePlanLabel: config?.bespokePlanLabel || 'Bespoke Plans',
        activeSubTab,
        mpCount: mpSubscribed.length,
        bespokeCount: bespokeSubscribed.length,
        loading,
        refreshing,
        planCards,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        onOpenPlan: handlePlanPress,
        onTabChange: setActiveSubTab,
        onBrowsePlans: () => navigation.navigate('Model Portfolio'),
        onRefresh,
      }}
    />
  );
};

export default MySubscriptionsScreen;
