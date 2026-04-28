import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Gauge, TrendingUp } from 'lucide-react-native';
import { Item } from 'react-native-paper/lib/typescript/components/Drawer/Drawer';
import moment from 'moment';
import ConsentPopup from './ConsentPopUp';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../../screens/TradeContext';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const Alpha100 = require('../../assets/alpha-100.png');

const ACCEPTABLE_DATE_FORMATS = [
  "D MMM YYYY, HH:mm:ss",
  "YYYY-MM-DDTHH:mm:ss.SSSZ",
];

const normalizeGroupName = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/\s+/g, "_")
    .trim();
};

const MPCard = ({
  modelName,
  data: ele,
  image,
  openModal,
  description,
  handleCardClick,
  handleSubscribe,
  isSubscribed,
  subscriptionData,
  setSelectedCard
}) => {
  // console.log("ele===",ele);
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const [globalConsent, setGlobalConsent] = useState(false);
  const [isConsentPopupOpen, setIsConsentPopupOpen] = useState(false); // initially open

  // Get dynamic gradient colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0076fb';
  const mainColor = config?.mainColor || 'rgba(0, 86, 183, 1)';
  const paymentModalConfig = config?.paymentModal;
  const { configData } = useTrade();
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  const handleConsentAccept = () => {
    setGlobalConsent(true);
    setIsConsentPopupOpen(false);
    // TODO: load the chart or perform any action after consent
    console.log('User accepted consent');
  };


  const handleConsentOpen = () => {
    setIsConsentPopupOpen(true);
    // TODO: load the chart or perform any action after consent
    console.log('User accepted consent');
  };

  // console.log('item of Reblance----', ele);
  // Helper function to calculate months label
  const calculateMonths = (duration) => duration;

  // Get available pricing options
  const getPricingOptions = () => {
    if (!ele) return [];

    // If there is a single amount (legacy)
    if (ele?.amount) {
      return [
        {
          label: `${calculateMonths(ele.duration)} months`,
          value: ele.amount,
          period: 'onetime',
        },
      ];
    }

    const options = [];

    // Handle onetime options
    if (ele?.planType === "onetime" && Array.isArray(ele.onetimeOptions)) {
      ele.onetimeOptions.forEach((opt, idx) => {
        if (opt.amountWithoutGst > 0) {
          options.push({
            period: `onetime-${idx}`,
            label: opt.label || `${opt.duration} days`,
            value: opt.amountWithoutGst,
          });
        }
      });
    }

    const isValidPrice = (price) => {
      if (price === undefined || price === null) return false;
      const normalizedPrice = Number(price);
      return !isNaN(normalizedPrice) && normalizedPrice > 0;
    };

    // Recurring options
    if (isValidPrice(ele?.pricingWithoutGst?.monthly)) {
      options.push({ period: "monthly", label: "Monthly", value: ele.pricingWithoutGst.monthly });
    }
    if (isValidPrice(ele?.pricingWithoutGst?.quarterly)) {
      options.push({ period: "quarterly", label: "Quarterly", value: ele.pricingWithoutGst.quarterly });
    }
    if (isValidPrice(ele?.pricingWithoutGst?.["half-yearly"])) {
      options.push({ period: "half-yearly", label: "6 Months", value: ele.pricingWithoutGst["half-yearly"] });
    }
    if (isValidPrice(ele?.pricing?.yearly)) {
      options.push({ period: "yearly", label: "Yearly", value: ele.pricing.yearly });
    }

    return options;
  };


  const pricingOptions = getPricingOptions();

  // Set selected pricing
  const [selectedPricing, setSelectedPricing] = useState(
    pricingOptions.length > 0 ? pricingOptions[0].period : null
  );

  // Update selectedPricing if pricingOptions change dynamically
  useEffect(() => {
    if (pricingOptions.length > 0 && !pricingOptions.find(opt => opt.period === selectedPricing)) {
      setSelectedPricing(pricingOptions[0].period);
    }
  }, [pricingOptions]);

  // Current price calculation
  const getCurrentPrice = () => {
    if (!ele) return 0;

    // Handle onetime plans
    if (ele?.planType === "onetime" && Array.isArray(ele?.onetimeOptions)) {
      const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
      return Number(selectedOption?.value) || Number(ele.onetimeOptions[0]?.amountWithoutGst) || 0;
    }

    // Handle legacy amount
    if (ele?.amount) {
      return Number(ele.amount) || 0;
    }

    // Handle recurring plans
    const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
    return Number(selectedOption?.value) || 0;
  };




  // Determine subscription status using backend-attached subscription field first,
  // then falling back to subscriptionData from user profile
  const getSubscriptionStatus = () => {
    // Primary: use the subscription field the backend attaches per-plan
    if (ele?.subscription) {
      const sub = ele.subscription;
      if (sub.status === "deleted") return "none";
      if (sub.expiry === null) return "active";
      if (sub.expiry) {
        const expiryDate = moment(sub.expiry, ACCEPTABLE_DATE_FORMATS);
        if (expiryDate.isValid()) {
          const daysLeft = expiryDate.diff(moment(), "days");
          if (daysLeft < 0) return "expired";
          if (daysLeft <= 7) return "renew";
          return "active";
        }
      }
    }

    // Fallback: match against subscriptionData from user profile
    const subscriptions = subscriptionData?.subscriptions;
    if (!subscriptions || subscriptions.length === 0) return "none";

    const normalizedPlan = normalizeGroupName(ele?.name);
    const matchingPlanSubs = subscriptions.filter((sub) => {
      const normalizedSubPlan = normalizeGroupName(sub?.plan);
      return normalizedSubPlan === normalizedPlan ||
        normalizedSubPlan.includes(normalizedPlan) ||
        normalizedPlan.includes(normalizedSubPlan);
    });
    if (matchingPlanSubs.length === 0) return "none";

    const activeSubscriptions = matchingPlanSubs.filter(
      (sub) => sub?.status !== "deleted"
    );
    if (activeSubscriptions.length === 0) return "none";

    const neverExpiringSubscriptions = activeSubscriptions.filter(
      (sub) => sub.expiry === null
    );
    if (neverExpiringSubscriptions.length > 0) return "active";

    const validSubscriptions = activeSubscriptions.filter((sub) =>
      sub.expiry
        ? moment(sub.expiry, ACCEPTABLE_DATE_FORMATS, true).isValid()
        : false
    );
    if (validSubscriptions.length === 0) return "none";

    const latestSub = validSubscriptions.sort(
      (a, b) =>
        moment(b.expiry, ACCEPTABLE_DATE_FORMATS) -
        moment(a.expiry, ACCEPTABLE_DATE_FORMATS)
    )[0];

    const expiryDate = moment(latestSub?.expiry, ACCEPTABLE_DATE_FORMATS);
    const daysLeft = expiryDate.diff(moment(), "days");

    if (daysLeft < 0) return "expired";
    if (daysLeft <= 7) return "renew";
    return "active";
  };

  const status = getSubscriptionStatus();
  // console.log("status----", status, ele.name);
  const currentPrice = getCurrentPrice();
  // console.log('Here current price---', typeof getCurrentPrice());
  const getOriginalPrice = () => {
    if (!currentPrice || !ele?.discountPercentage) return currentPrice || 0;
    const discountRate = ele.discountPercentage / 100;
    return Math.round(currentPrice / (1 - discountRate));
  };

  const originalPrice = getOriginalPrice();
  const discount = ele?.discountPercentage || 0;
  const InvestNow = () => {
    // setSelectedCard(ele);
    handleSubscribe();
  };





  return (
    <View style={styles.container}>
      <View activeOpacity={0.9}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cardContainer,
            {
              borderBottomLeftRadius: isExpanded ? 0 : 8,
              borderBottomRightRadius: isExpanded ? 0 : 8
            }
          ]}
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image
                source={image ? { uri: image.toString() } : Alpha100}
                style={styles.logo}
              />
            </View>
            <Text style={styles.portfolioTitle}>{modelName || 'ZC Leaders Portfolio'}
            </Text>
          </View>

          {/* Price Section */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
            <View style={styles.priceSection}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.currentPrice}>₹ {currentPrice ? (configGst && configGstWithText ? withGst(currentPrice)?.toFixed(2) : currentPrice?.toFixed(2)) : 0}</Text>
                {discount > 0 && (
                  <Text style={styles.originalPrice}>₹ {originalPrice?.toFixed(2)}</Text>
                )}
              </View>
              {configGst && (
                <Text style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.8)',
                  fontFamily: 'Poppins-Regular',
                  marginTop: -2,
                }}>
                  {configGstWithText ? 'including GST' : '+ GST'}
                </Text>
              )}
            </View>
            {discount > 0 && (
              <LinearGradient
                colors={[paymentModalConfig?.stepCompletedColor || '#58a100', paymentModalConfig?.stepCompletedColor || '#1f7d00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveTag}
              >
                <Text style={styles.saveTagText}>Save {discount}%</Text>
              </LinearGradient>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', }}>
            {pricingOptions.map(option => {
              const isSelected = option.period === selectedPricing;
              return (
                <TouchableOpacity
                  key={option.period}
                  onPress={() => setSelectedPricing(option.period)}
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: isSelected ? '#rgba(255, 255, 255, 0.3)' : 'transparent',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.6)',
                    marginRight: 8,
                    marginBottom: 8,
                    shadowColor: isSelected ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isSelected ? 0.2 : 0,
                    shadowRadius: isSelected ? 2 : 0,
                    elevation: isSelected ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? '#fff' : '#fff',
                      fontSize: 10,
                      marginTop: 2,
                      fontFamily: 'Poppins-Medium',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>



              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignContent: 'center', alignItems: 'center', alignSelf: 'flex-start', }}>
                <Text style={styles.statLabel}>Min. Investment</Text>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>₹</Text>
                </View>
              </View>

              <Text style={styles.statValue}>
                {ele?.minInvestment != null ? `₹ ${ele.minInvestment.toFixed(2)}` : "-"}
              </Text>

            </View>

            <View style={[styles.statDivider]} />

            <View style={styles.statItem}>

              <View style={{ flexDirection: 'row', gap: 12, alignContent: 'center', alignItems: 'center', alignSelf: 'flex-start', }}>
                <Text style={styles.statLabel}>Volatility</Text>
                <View style={styles.statIconContainer}>
                  <Gauge style={{ alignContent: 'center', alignItems: 'center', alignSelf: 'center' }} size={11} color={mainColor} />
                </View>
              </View>


              <Text
                style={[
                  styles.volatilityText, // base text style
                  !globalConsent && styles.blurText, // apply blur effect if no consent
                  (!globalConsent)
                    ? styles.textGray // gray out when no consent or loading
                    : ele?.volatility
                      ? ele.volatility > 0.15
                        ? styles.textRed
                        : ele.volatility > 0.1
                          ? styles.textYellow
                          : styles.textGreen
                      : ele?.volatility === "High"
                        ? styles.textRed
                        : ele?.volatility === "Medium"
                          ? styles.textYellow
                          : ele?.volatility === "Low"
                            ? styles.textGreen
                            : styles.textGray,
                ]}
              >
                {ele?.volatility ?? "--"}
              </Text>

            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>


              <View style={{ flexDirection: 'row', alignContent: 'center', alignItems: 'center', alignSelf: 'flex-start', gap: 12, }}>
                <Text style={styles.statLabel}>CAGR</Text>
                <View style={styles.statIconContainer}>
                  <TrendingUp size={11} color="rgba(41, 164, 0, 1)" />
                </View>
              </View>
              <TouchableOpacity
                onPress={handleConsentOpen} // opens consent popup if needed
                disabled={globalConsent} // optional: disable press if consent is already given
              >
                <Text style={[styles.cagrValue, {color: mainColor}]}>
                  {!globalConsent
                    ? "View"
                    : false
                      ? "Loading..."
                      : ele?.performance_data?.returns?.cagr
                        ? `${ele?.performance_data?.returns?.cagr.toFixed(2)}%`
                        : "New Portfolio"}
                </Text>
              </TouchableOpacity>


            </View>

          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity onPress={handleCardClick} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>View More</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={InvestNow} style={[styles.subscribeButton, { backgroundColor: status === 'active' ? (paymentModalConfig?.stepCompletedColor || '#29A400') : status === 'renew' ? '#E8976B' : '#fff' }]}>
              <Text style={[styles.subscribeText, { color: (status === 'active' || status === 'renew') ? '#fff' : mainColor }]}>
                {status === 'active'
                  ? 'Subscribed'
                  : status === 'renew'
                  ? 'Renew Now'
                  : status === 'expired'
                  ? 'Resubscribe'
                  : 'Subscribe'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Expanded Section */}
      {isExpanded && (
        <Animated.View style={[styles.animatedSection, { height: animatedHeight }]}>
          <View style={styles.expandedContent}>
            <Text style={[styles.descriptionText, {color: mainColor}]}>
              <Text style={[styles.overviewLabel, {color: mainColor}]}>• Overview : </Text>
              {description || '-'}
            </Text>
          </View>
        </Animated.View>
      )}
      <ConsentPopup
        isConsentPopupOpen={isConsentPopupOpen}
        setIsConsentPopupOpen={setIsConsentPopupOpen}
        handleConsentAccept={handleConsentAccept}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 8, marginVertical: 8, elevation: 8 },
  cardContainer: {
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    width: screenWidth - 30,
    maxWidth: screenWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 0,
  },
  saveTag: {
    position: 'absolute',
    right: -10,
    top: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20
  },
  saveTagText: { color: '#fff', fontSize: 8, fontFamily: 'Poppins-SemiBold', alignContent: 'center', alignItems: 'center', alignSelf: 'center' },
  headerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 0,
    marginRight: 12
  },
  logo: { width: 32, height: 32, borderRadius: 8 },
  portfolioTitle: { color: '#fff', fontSize: 18, fontFamily: 'Poppins-SemiBold', flex: 1 },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currentPrice: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold' },
  originalPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Poppins-Regular', textDecorationLine: 'line-through' },
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 0, marginBottom: 20, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'flex-start', paddingVertical: 5, paddingHorizontal: 5, marginRight: 5 },
  statIconContainer: { width: 14, height: 14, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, alignContent: 'center', alignSelf: 'center', marginLeft: 5, },
  statIcon: { color: '#000000ff', fontSize: 9, fontFamily: 'Poppins-Bold', },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'Poppins-Medium', textAlign: 'center', marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 12, fontFamily: 'Poppins-SemiBold', textAlign: 'flex-start', alignContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'flex-start' },
  volatilityValue: { color: '#22c55e', fontSize: 12, fontFamily: 'Poppins-SemiBold', textAlign: 'center', alignSelf: 'flex-start' },
  cagrValue: { fontSize: 12, fontFamily: 'Poppins-SemiBold', textAlign: 'flex-start', alignContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'flex-start' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  actionContainer: { flexDirection: 'row', gap: 12 },
  viewMoreButton: { flex: 1, backgroundColor: 'rgba(232, 232, 232, 0.58)', borderRadius: 3, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  viewMoreText: { color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium' },
  subscribeButton: { flex: 1, backgroundColor: '#fff', borderRadius: 3, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  subscribeText: { fontSize: 12, fontFamily: 'Poppins-SemiBold' },
  animatedSection: { backgroundColor: '#ECF3FE', elevation: 4, paddingHorizontal: 20, paddingVertical: 20, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginHorizontal: 16, borderWidth: 1, borderTopWidth: 0, borderColor: '#F3F4F6' },
  expandedContent: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  descriptionText: { fontFamily: 'Poppins-Regular', fontSize: 13, lineHeight: 18, textAlign: 'left' },
  overviewLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  volatilityText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  blurText: {
    opacity: 0.5, // simple blur effect
  },
  textGray: {
    color: '#9CA3AF', // gray-400
  },
  textRed: {
    color: '#DC2626', // red-600
  },
  textYellow: {
    color: '#F59E0B', // yellow-500
  },
  textGreen: {
    color: '#16A34A', // green-600
  },
});

export default MPCard;
