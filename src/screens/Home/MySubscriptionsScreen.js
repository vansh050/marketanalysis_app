import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft, ChevronRight, Crown} from 'lucide-react-native';
import {getAuth} from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import moment from 'moment';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';

const {width: screenWidth} = Dimensions.get('window');
const Alpha100 = require('../../assets/alpha-100.png');

const ACCEPTABLE_DATE_FORMATS = [
  'D MMM YYYY, HH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
];

const normalizeGroupName = name => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/%20/g, ' ')
    .replace(/\s+/g, '_')
    .trim();
};

const getSubscriptionStatus = (planName, subscriptions) => {
  if (!subscriptions || subscriptions.length === 0) return {status: 'none'};

  const normalizedPlan = normalizeGroupName(planName);
  const matchingPlanSubs = subscriptions.filter(
    sub => {
      const nSub = normalizeGroupName(sub?.plan);
      return nSub === normalizedPlan || nSub.includes(normalizedPlan) || normalizedPlan.includes(nSub);
    },
  );
  if (matchingPlanSubs.length === 0) return {status: 'none'};

  const activeSubscriptions = matchingPlanSubs.filter(
    sub => sub?.status !== 'deleted',
  );
  if (activeSubscriptions.length === 0) return {status: 'none'};

  const neverExpiringSubscriptions = activeSubscriptions.filter(
    sub => sub.expiry === null,
  );
  if (neverExpiringSubscriptions.length > 0) {
    return {status: 'active', expiry: null, subscription: neverExpiringSubscriptions[0]};
  }

  const validSubscriptions = activeSubscriptions.filter(sub =>
    sub.expiry
      ? moment(sub.expiry, ACCEPTABLE_DATE_FORMATS, true).isValid()
      : false,
  );
  if (validSubscriptions.length === 0) return {status: 'none'};

  const latestSub = validSubscriptions.sort(
    (a, b) =>
      moment(b.expiry, ACCEPTABLE_DATE_FORMATS) -
      moment(a.expiry, ACCEPTABLE_DATE_FORMATS),
  )[0];

  const expiryDate = moment(latestSub?.expiry, ACCEPTABLE_DATE_FORMATS);
  const today = moment();
  const daysLeft = expiryDate.diff(today, 'days');

  if (daysLeft < 0) return {status: 'expired', expiry: latestSub.expiry, subscription: latestSub};
  if (daysLeft <= 7) return {status: 'renew', expiry: latestSub.expiry, daysLeft, subscription: latestSub};
  return {status: 'active', expiry: latestSub.expiry, daysLeft, subscription: latestSub};
};

const MySubscriptionsScreen = () => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0076fb';
  const mainColor = config?.mainColor || '#0056B7';
  const secondaryColor = config?.secondaryColor || '#E8F0FE';
  const cardElevation = config?.cardElevation ?? 3;
  const cardBorderWidth = config?.CardborderWidth ?? 0;
  const cardVerticalMargin = config?.cardverticalmargin ?? 12;
  const paymentModalConfig = config?.paymentModal;
  const activeColor = paymentModalConfig?.stepCompletedColor || '#29A400';
  const themeColor = config?.themeColor || mainColor;

  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

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

  // Filter plans with active subscriptions
  // Primary: use the subscription field the backend attaches per-plan
  // Fallback: match against subscriptionData from user profile
  const subscribedPlans = allPlans.filter(plan => {
    // Check backend-attached subscription first
    if (plan?.subscription) {
      const sub = plan.subscription;
      if (sub.status === 'deleted') return false;
      if (sub.expiry === null) return true;
      if (sub.expiry) {
        const expiryDate = moment(sub.expiry, ACCEPTABLE_DATE_FORMATS);
        if (expiryDate.isValid()) {
          const daysLeft = expiryDate.diff(moment(), 'days');
          return daysLeft >= 0; // active or renew
        }
      }
    }
    // Fallback to name matching
    const subStatus = getSubscriptionStatus(
      plan?.name,
      subscriptionData?.subscriptions,
    );
    return subStatus.status === 'active' || subStatus.status === 'renew';
  });

  // Bifurcate subscriptions by type
  const [activeSubTab, setActiveSubTab] = useState('mp');
  const mpSubscribed = subscribedPlans.filter(p => p.type !== 'bespoke');
  const bespokeSubscribed = subscribedPlans.filter(p => p.type === 'bespoke');
  const displayedPlans = activeSubTab === 'mp' ? mpSubscribed : bespokeSubscribed;

  const handlePlanPress = plan => {
    navigation.navigate('AfterSubscriptionScreen', {
      fileName: plan?.name,
    });
  };

  const renderSubscriptionCard = ({item: plan}) => {
    const subStatus = getSubscriptionStatus(
      plan?.name,
      subscriptionData?.subscriptions,
    );
    const expiryFormatted = subStatus.expiry
      ? moment(subStatus.expiry, ACCEPTABLE_DATE_FORMATS).format('DD MMM YYYY')
      : 'Never';

    const isRenew = subStatus.status === 'renew';

    return (
      <TouchableOpacity
        onPress={() => handlePlanPress(plan)}
        activeOpacity={0.7}
        style={{marginBottom: cardVerticalMargin}}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[
            styles.card,
            {
              elevation: cardElevation,
              borderWidth: cardBorderWidth,
              borderColor: 'rgba(255,255,255,0.15)',
            },
          ]}>
          <View style={styles.cardContent}>
            <View style={styles.cardImageContainer}>
              <Image
                source={
                  plan?.image
                    ? {uri: `${server.server.baseUrl}${plan.image}`}
                    : Alpha100
                }
                style={styles.cardImage}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {plan?.name}
              </Text>
              <Text style={styles.cardExpiry}>
                Expires: {expiryFormatted}
              </Text>
              {isRenew && (
                <Text style={styles.renewText}>
                  Expires in {subStatus.daysLeft} day{subStatus.daysLeft !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={styles.cardRight}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isRenew
                      ? 'rgba(255, 193, 7, 0.25)'
                      : `${activeColor}30`,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: isRenew ? '#FFD54F' : activeColor,
                    },
                  ]}>
                  {isRenew ? 'Expiring Soon' : 'Active'}
                </Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
      </LinearGradient>

      {/* Subscription Type Tabs */}
      {!loading && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.subTab, activeSubTab === 'mp' && [styles.subTabActive, {backgroundColor: mainColor}]]}
            onPress={() => setActiveSubTab('mp')}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, activeSubTab === 'mp' && styles.subTabTextActive]}>
              Model Portfolios ({mpSubscribed.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, activeSubTab === 'bespoke' && [styles.subTabActive, {backgroundColor: mainColor}]]}
            onPress={() => setActiveSubTab('bespoke')}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, activeSubTab === 'bespoke' && styles.subTabTextActive]}>
              Bespoke Plans ({bespokeSubscribed.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={mainColor} />
        </View>
      ) : displayedPlans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Crown size={48} color={mainColor} />
          <Text style={styles.emptyTitle}>
            {activeSubTab === 'mp' ? 'No Model Portfolio Subscriptions' : 'No Bespoke Subscriptions'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeSubTab === 'mp'
              ? "You haven't subscribed to any model portfolios yet."
              : "You haven't subscribed to any bespoke plans yet."}
          </Text>
          <TouchableOpacity
            style={[styles.browsePlansButton, {backgroundColor: mainColor}]}
            onPress={() => navigation.navigate('Model Portfolio')}>
            <Text style={styles.browsePlansText}>Browse Plans</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedPlans}
          keyExtractor={(item, index) => item?._id || index.toString()}
          renderItem={renderSubscriptionCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={mainColor}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  browsePlansButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  browsePlansText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardImageContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 0,
    marginRight: 12,
  },
  cardImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
  },
  cardExpiry: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  renewText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#FFD54F',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  subTab: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  subTabActive: {
    backgroundColor: '#0056B7',
  },
  subTabText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#555',
  },
  subTabTextActive: {
    color: '#fff',
  },
});

export default MySubscriptionsScreen;
