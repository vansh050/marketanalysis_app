import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {
  XIcon,
  Clock,
  Flame,
  Info,
  ChevronDown,
  ChevronUp,
  SquareArrowOutUpRight,
  ChevronsUpDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {SvgUri} from 'react-native-svg';
import LinePattern from '../../assets/Vector.svg';
import Icon from 'react-native-vector-icons/AntDesign';
const Alpha100 = require('../../assets/alpha-100.png');
import Icon1 from 'react-native-vector-icons/Feather';
const { width: ScreenWidth } = Dimensions.get('window');
import moment from 'moment';
import { useConfig } from '../../context/ConfigContext';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';

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

const MPCardBespoke = ({
  modelName,
  image,
  overview,
  minInvestment,
  description,
  handleCardClick,
  handleSubscribe,
  retentionRate,
  setSelectedCard,
  isSubscribed,
  data,
  subscriptionData,
  openModal,
  star,
  price,
}) => {
  console.log("Data here i get---", data);
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0)); // Initial height is 0
  const navigation = useNavigation();

  // Get dynamic colors from config
  const config = useConfig();
  const mainColor = config?.mainColor || '#2053DB';
  const gradient1 = config?.gradient1 || '#3B82F6';
  const gradient2 = config?.gradient2 || '#1E3A8A';
  const stepCompletedColor = config?.paymentModal?.stepCompletedColor || '#29A400';
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  const animatedHeight = useRef(new Animated.Value(0)).current; // Initialize with height 0

  const toggleExpand = () => {
    if (isExpanded) {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
        isInteraction: false,
      }).start(() => setIsExpanded(false));
    } else {
      Animated.timing(animatedHeight, {
        toValue: 180, // Adjust this value based on content height
        duration: 300,
        isInteraction: false,
        useNativeDriver: false,
      }).start();
      setIsExpanded(true);
    }
  };
  const InvestNow = item => {
    handleSubscribe();
  };

  // Helper to map frequency key to duration label
  const frequencyLabels = {
    monthly: '1 Month',
    quarterly: '3 Months',
    'half-yearly': '6 Months',
    yearly: '12 Months',
  };

  let displayPrice = null;
  let displayDuration = null;

  if (data.frequency && data.frequency.length > 0) {
    // Take first frequency key
    const freq = data.frequency[0];
    const freqPrice = data.pricing && data.pricing[freq];
    displayPrice =
      freqPrice && Number(freqPrice) > 0 ? Number(freqPrice) : null;
    displayDuration = frequencyLabels[freq] || freq;
  } else if (data.onetimeOptions && data.onetimeOptions.length > 0) {
    displayPrice = data.onetimeOptions[0].amount;
    displayDuration = `${data.onetimeOptions[0].duration} Days`;
  }



  const calculateMonths = (duration) => duration;

  // Get available pricing options
  const getPricingOptions = () => {
    if (!data) return [];

    // If there is a single amount (legacy)
    if (data?.amount) {
      return [
        {
          label: `${calculateMonths(data.duration)} months`,
          value: data.amount,
          period: 'onetime',
        },
      ];
    }

    const options = [];

    // Handle onetime options
    if (data?.planType === "onetime" && Array.isArray(data.onetimeOptions)) {
      data.onetimeOptions.forEach((opt, idx) => {
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
    if (isValidPrice(data?.pricingWithoutGst?.monthly)) {
      options.push({ period: "monthly", label: "Monthly", value: data.pricingWithoutGst.monthly });
    }
    if (isValidPrice(data?.pricingWithoutGst?.quarterly)) {
      options.push({ period: "quarterly", label: "Quarterly", value: data.pricingWithoutGst.quarterly });
    }
    if (isValidPrice(data?.pricingWithoutGst?.["half-yearly"])) {
      options.push({ period: "half-yearly", label: "6 Months", value: data.pricingWithoutGst["half-yearly"] });
    }
    if (isValidPrice(data?.pricing?.yearly)) {
      options.push({ period: "yearly", label: "Yearly", value: data.pricing.yearly });
    }

    return options;
  };


  const pricingOptions = getPricingOptions();

  // Set selected pricing
  const [selectedPricing, setSelectedPricing] = useState(
    pricingOptions.length > 0 ? pricingOptions[0].period : null
  );

  const getCurrentPrice = () => {
    if (!data) return 0;

    // Handle onetime plans
    if (data?.planType === "onetime" && Array.isArray(data?.onetimeOptions)) {
      const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
      return Number(selectedOption?.value) || Number(data.onetimeOptions[0]?.amountWithoutGst) || 0;
    }

    // Handle legacy amount
    if (data?.amount) {
      return Number(data.amount) || 0;
    }

    // Handle recurring plans
    const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
    return Number(selectedOption?.value) || 0;
  };



  const currentPrice = getCurrentPrice();
  // console.log('Here current price---', typeof getCurrentPrice());
  const getOriginalPrice = () => {
    if (!currentPrice || !data?.discountPercentage) return currentPrice || 0;
    const discountRate = data.discountPercentage / 100;
    return Math.round(currentPrice / (1 - discountRate));
  };

  const originalPrice = getOriginalPrice();
  const discount = data?.discountPercentage || 0;
  // Update selectedPricing if pricingOptions change dynamically




    // Determine subscription status using backend-attached subscription field first,
    // then falling back to subscriptionData from user profile
    const getSubscriptionStatus = () => {
      // Primary: use the subscription field the backend attaches per-plan
      if (data?.subscription) {
        const sub = data.subscription;
        if (sub.status === 'deleted') return 'none';
        if (sub.expiry === null) return 'active';
        if (sub.expiry) {
          const expiryDate = moment(sub.expiry, ACCEPTABLE_DATE_FORMATS);
          if (expiryDate.isValid()) {
            const daysLeft = expiryDate.diff(moment(), 'days');
            if (daysLeft < 0) return 'expired';
            if (daysLeft <= 7) return 'renew';
            return 'active';
          }
        }
      }

      // Fallback: match against subscriptionData from user profile
      const subscriptions = subscriptionData?.subscriptions;
      if (!subscriptions || subscriptions.length === 0) return 'none';

      const normalizedPlan = normalizeGroupName(modelName);
      const matchingPlanSubs = subscriptions.filter(sub => {
        const nSub = normalizeGroupName(sub?.plan);
        return nSub === normalizedPlan ||
          nSub.includes(normalizedPlan) ||
          normalizedPlan.includes(nSub);
      });
      if (matchingPlanSubs.length === 0) return 'none';

      const activeSubscriptions = matchingPlanSubs.filter(
        sub => sub?.status !== 'deleted',
      );
      if (activeSubscriptions.length === 0) return 'none';

      const neverExpiringSubscriptions = activeSubscriptions.filter(
        sub => sub.expiry === null,
      );
      if (neverExpiringSubscriptions.length > 0) return 'active';

      const validSubscriptions = activeSubscriptions.filter(sub =>
        sub.expiry
          ? moment(sub.expiry, ACCEPTABLE_DATE_FORMATS, true).isValid()
          : false,
      );
      if (validSubscriptions.length === 0) return 'none';

      const latestSub = validSubscriptions.sort(
        (a, b) =>
          moment(b.expiry, ACCEPTABLE_DATE_FORMATS) -
          moment(a.expiry, ACCEPTABLE_DATE_FORMATS),
      )[0];

      const expiryDate = moment(latestSub?.expiry, ACCEPTABLE_DATE_FORMATS);
      const daysLeft = expiryDate.diff(moment(), 'days');

      if (daysLeft < 0) return 'expired';
      if (daysLeft <= 7) return 'renew';
      return 'active';
    };
    const status = getSubscriptionStatus();
    const isActive = status === 'active' || status === 'renew';


  useEffect(() => {
    if (pricingOptions.length > 0 && !pricingOptions.find(opt => opt.period === selectedPricing)) {
      setSelectedPricing(pricingOptions[0].period);
    }
  }, [pricingOptions]);
  return (
    <View>
      <LinearGradient
        colors={['#fff', '#fff', '#fff']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.cardContainer, { borderRadius: isExpanded ? 0.5 : 4,flex:1, }]}>
        <View
          style={{
            position: 'absolute',
            top: -110,
            left: 0,
            right: 16,
            bottom: 0, // Ensure it's behind other elements
            // Cover the entire card height
            pointerEvents: 'none',
          }}>
          <LinePattern />
        </View>
 {discount > 0 && (
    <LinearGradient
      colors={[stepCompletedColor, stepCompletedColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        position: 'absolute',
        top: 12,
        left: 0,
        paddingVertical: 4,
        paddingHorizontal: 12,

        borderTopRightRadius:12,
        borderBottomRightRadius:12,
        zIndex: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: '#fff',
          fontFamily: 'Poppins-Medium',
        }}
      >
        Save {discount}%
      </Text>
    </LinearGradient>
  )}


  {isActive && (
 <View style={styles.subscribedBadge}>
    <Text style={styles.subscribedText}>Subscribed</Text>
  </View>
)}

        {/* Content of the card */}
        <View style={styles.topSection}>
          <View style={[styles.textContainer,{position:"relative"}]}>
            

            <Text style={styles.title}>{modelName}</Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flexDirection: 'column' }}></View>
            </View>
          </View>
          <View
            style={{
              alignItems: 'flex-end',
              marginTop: 6,
              marginLeft: 20,
            }}
          >
            <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
              {/* 💰 Current + Original Price Section */}
              <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                 {discount > 0 && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#9CA3AF',
                      fontFamily: 'Poppins-Regular',
                      textDecorationLine: 'line-through',
                    }}
                  >
                    ₹ {originalPrice ? originalPrice.toFixed(2) : '-'}
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 14,
                    color: '#1F2937',
                    fontFamily: 'Poppins-SemiBold',
                  }}
                >
                  ₹ {currentPrice ? (configGst && configGstWithText ? withGst(currentPrice)?.toFixed(2) : currentPrice?.toFixed(2)) : displayPrice || '-'}
                </Text>
                {configGst && (
                  <Text
                    style={{
                      fontSize: 10,
                      color: '#6B7280',
                      fontFamily: 'Poppins-Regular',
                      marginTop: -2,
                    }}
                  >
                    {configGstWithText ? 'including GST' : '+ GST'}
                  </Text>
                )}


              </View>

              {/* 🎁 Save Tag */}

            </View>

            {/* ⏳ Validity Text */}
            <Text
  style={{
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  }}
>
  Validity:{' '}
  {(() => {
    const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
    if (!selectedOption) return '-';

    // Handle recurring plans
    if (selectedOption.label.toLowerCase().includes('month')) {
      return selectedOption.label;
    }

    // Handle one-time options (days or custom label)
    if (data?.planType === 'onetime' && Array.isArray(data?.onetimeOptions)) {
      const selectedOnetime = data.onetimeOptions.find(
        (opt, idx) => `onetime-${idx}` === selectedPricing
      );
      return selectedOnetime ? `${selectedOnetime.duration} Days` : selectedOption.label;
    }

    return selectedOption.label;
  })()}
</Text>

          </View>

        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap',    paddingHorizontal: 20, }}>
          {pricingOptions.map(option => {
            const isSelected = option.period === selectedPricing;
            return (
              <TouchableOpacity
                key={option.period}
                onPress={() => setSelectedPricing(option.period)}
                style={{
                  paddingVertical: 2,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: isSelected ? `${mainColor}15` : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isSelected ? mainColor : '#E5E7EB',
                  marginRight: 8,
                  marginBottom: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: isSelected ? 2 : 0 },
                  shadowOpacity: isSelected ? 0.1 : 0,
                  shadowRadius: isSelected ? 3 : 0,
                  elevation: isSelected ? 2 : 0,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? mainColor : '#374151',
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleCardClick}
            style={styles.performanceButton}>
            <Text style={styles.buttonText}>View More</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={InvestNow} style={[styles.investButton, { backgroundColor: status === 'renew' ? '#E8976B' : mainColor }]}>
            {(status === 'renew' || status === 'expired') && <ArrowRight size={10} color={'white'} />}
            <Text style={styles.investButtonText}>
              {status === 'active'
                ? 'Subscribed'
                : status === 'renew'
                ? 'Renew Now'
                : status === 'expired'
                ? 'Resubscribe'
                : 'Subscribe Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* {isExpanded && (
                <Animated.View style={[styles.animatedSection, { height: animatedHeight }]}>
                    <View style={{ alignContent: 'center', justifyContent: 'center', alignSelf: 'center' }}>
                        {description ? (
                            <Text style={styles.descriptionTextmain}>{description}</Text>
                        ) : (
                            <>
                                <Text style={styles.descriptionText}>-</Text>
                            </>
                        )}
                    </View>
                </Animated.View>
            )} */}
    </View>
  );
};

const styles = StyleSheet.create({
cardContainer: {
  backgroundColor: '#FFFFFF',
  marginTop: 10,
  borderWidth: 1,
  borderColor: '#ECF3FE',
  marginRight: 10,
  width: ScreenWidth - 35,
  marginBottom: 10,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 1,
  position: 'relative', // important for absolute children
  paddingBottom: 60,    // to prevent overlap
},

    subscribedBadge: {
    position: 'absolute',
    top: -10,
    right: 8,
    backgroundColor: '#FACC15', // nice yellow
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  subscribedText: {
    fontSize: 10,
    fontFamily:'Satoshi-Bold',
    color: '#78350f', // dark text
  },
  retentionRate: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#6B7280',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  animatedSection: {
    backgroundColor: '#ECF3FE',
    elevation: 4,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ECF3FE',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',

    borderColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Poppins-SemiBold',
    flex: 1,
  },
  statsSection: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ECF3FE',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
  },
  statText: {
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    marginLeft: 5,
  },
  statValue: {
    color: '#1F2937',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
  },
buttonContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 12,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: '#fff',

  gap: 10,
},

  performanceButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  investButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  buttonText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Satoshi-Bold',
  },
  investButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Satoshi-Medium',
  },
  expandedSection: {
    overflow: 'hidden',
    marginTop: 10,
  },
  descriptionText: {
    color: '#1F2937',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  descriptionTextmain: {
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
  },
});

export default MPCardBespoke;
