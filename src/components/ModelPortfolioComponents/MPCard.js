/**
 * MPCard — container (Phase I, 2026-05-02)
 *
 * Owns: useConfig, useGstConfig, useNavigation, useTrade (configData),
 * Animated.Value, subscription status computation (normalizeGroupName,
 * moment-based expiry), pricing options computation, consent state,
 * GST display computation.
 *
 * Resolves presentation from `composites.MPCard`.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import ConsentPopup from './ConsentPopUp';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../../screens/TradeContext';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst } from '../../utils/gstHelpers';
import { useComponent } from '../../design/useDesign';
import useTokens from '../../theme/useTokens';
const Alpha100 = require('../../assets/alpha-100.png');

const ACCEPTABLE_DATE_FORMATS = [
  'D MMM YYYY, HH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
];
const screenWidth = Dimensions.get('window').width;

const normalizeGroupName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/%20/g, ' ')
    .replace(/\s+/g, '_')
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
  setSelectedCard,
  index = 0,
  isHorizontal = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigation = useNavigation();
  const [globalConsent, setGlobalConsent] = useState(false);
  const [isConsentPopupOpen, setIsConsentPopupOpen] = useState(false);

  const config = useConfig();
  // Read brand colors through useTokens so the active design variant (default,
  // moneyman_app, …) supplies the fallback when the tenant hasn't set
  // gradient1/gradient2/mainColor on the backend. useTokens still layers
  // config.gradient1 → brand.gradientStart etc., so tenant overrides win.
  //
  // If the active variant provides `mpCardColorMap` (moneyman_app assigns
  // MAMM→green, MFCC→purple, MSRO→blue via case-insensitive substring
  // match on the plan name) the plan-specific color wins. Otherwise fall
  // back to `mpCardColorCycle` by row index. Both fall back to the brand
  // gradient tokens for variants that supply neither.
  const tokens = useTokens();
  const colorMap = tokens?.colors?.mpCardColorMap;
  const cycle = tokens?.colors?.mpCardColorCycle;
  let cardColor = null;
  if (colorMap && typeof modelName === 'string') {
    const upperName = modelName.toUpperCase();
    for (const [key, color] of Object.entries(colorMap)) {
      if (upperName.includes(key.toUpperCase())) { cardColor = color; break; }
    }
  }
  if (!cardColor && Array.isArray(cycle) && cycle.length > 0) {
    cardColor = cycle[index % cycle.length];
  }
  const gradient1 = cardColor || tokens.colors.brand.gradientStart;
  const gradient2 = cardColor || tokens.colors.brand.gradientEnd;
  const mainColor = cardColor || tokens.colors.brand.primary;
  const paymentModalConfig = config?.paymentModal;
  const {
    configData,
    modelPortfolioStrategyfinal,
    modelPortfolioEntitlementsLoaded,
  } = useTrade();
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  const Presentation = useComponent('composites.MPCard');

  const handleConsentAccept = () => {
    setGlobalConsent(true);
    setIsConsentPopupOpen(false);
  };

  const handleConsentOpen = () => {
    setIsConsentPopupOpen(true);
  };

  // Pricing options computation
  const calculateMonths = (duration) => duration;

  const getPricingOptions = () => {
    if (!ele) return [];

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

    if (ele?.planType === 'onetime' && Array.isArray(ele.onetimeOptions)) {
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

    if (isValidPrice(ele?.pricingWithoutGst?.monthly)) {
      options.push({ period: 'monthly', label: 'Monthly', value: ele.pricingWithoutGst.monthly });
    }
    if (isValidPrice(ele?.pricingWithoutGst?.quarterly)) {
      options.push({ period: 'quarterly', label: 'Quarterly', value: ele.pricingWithoutGst.quarterly });
    }
    if (isValidPrice(ele?.pricingWithoutGst?.['half-yearly'])) {
      options.push({ period: 'half-yearly', label: '6 Months', value: ele.pricingWithoutGst['half-yearly'] });
    }
    // Pre-GST base like the other frequencies — ele.pricing.yearly is
    // GST-INCLUSIVE, so reading it here + the "+ GST" label double-counts GST.
    // Fall back to pricing.yearly only for legacy plans without pricingWithoutGst.
    if (isValidPrice(ele?.pricingWithoutGst?.yearly ?? ele?.pricing?.yearly)) {
      options.push({
        period: 'yearly',
        label: 'Yearly',
        value: ele?.pricingWithoutGst?.yearly ?? ele.pricing.yearly,
      });
    }

    return options;
  };

  const pricingOptions = getPricingOptions();

  const [selectedPricing, setSelectedPricing] = useState(
    pricingOptions.length > 0 ? pricingOptions[0].period : null,
  );

  useEffect(() => {
    if (pricingOptions.length > 0 && !pricingOptions.find(opt => opt.period === selectedPricing)) {
      setSelectedPricing(pricingOptions[0].period);
    }
  }, [pricingOptions]);

  // Current price
  const getCurrentPrice = () => {
    if (!ele) return 0;

    if (ele?.planType === 'onetime' && Array.isArray(ele?.onetimeOptions)) {
      const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
      return Number(selectedOption?.value) || Number(ele.onetimeOptions[0]?.amountWithoutGst) || 0;
    }

    if (ele?.amount) {
      return Number(ele.amount) || 0;
    }

    const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
    return Number(selectedOption?.value) || 0;
  };

  // Subscription status
  const getSubscriptionStatus = () => {
    if (!modelPortfolioEntitlementsLoaded) return 'checking';

    // `subscribed-strategies` is server-filtered by paid, active and
    // unexpired Subscription rows. Catalog `subscription` fields and the
    // broad client subscription list are historical metadata and therefore
    // must never independently declare a plan active or expired.
    const normalizedPlan = normalizeGroupName(ele?.name);
    const active = (modelPortfolioStrategyfinal || []).some(portfolio =>
      normalizeGroupName(portfolio?.model_name) === normalizedPlan,
    );
    return active ? 'active' : 'none';
  };

  const status = getSubscriptionStatus();
  const currentPrice = getCurrentPrice();

  const getOriginalPrice = () => {
    if (!currentPrice || !ele?.discountPercentage) return currentPrice || 0;
    const discountRate = ele.discountPercentage / 100;
    return Math.round(currentPrice / (1 - discountRate));
  };

  const originalPrice = getOriginalPrice();
  const discount = ele?.discountPercentage || 0;

  // GST display
  const displayPrice = configGst && configGstWithText ? withGst(currentPrice) : currentPrice;

  let gstText = null;
  if (configGst) {
    gstText = configGstWithText ? 'including GST' : '+ GST';
  }

  // Volatility color
  const getVolatilityColorStyle = () => {
    if (!globalConsent) return { color: '#9CA3AF' };
    if (ele?.volatility) {
      if (typeof ele.volatility === 'number') {
        if (ele.volatility > 0.15) return { color: '#DC2626' };
        if (ele.volatility > 0.1) return { color: '#F59E0B' };
        return { color: '#16A34A' };
      }
      if (ele.volatility === 'High') return { color: '#DC2626' };
      if (ele.volatility === 'Medium') return { color: '#F59E0B' };
      if (ele.volatility === 'Low') return { color: '#16A34A' };
    }
    return { color: '#9CA3AF' };
  };

  // CAGR display
  const getCagrDisplay = () => {
    if (!globalConsent) return 'View';
    if (ele?.performance_data?.returns?.cagr) {
      return `${ele.performance_data.returns.cagr.toFixed(2)}%`;
    }
    return 'New Portfolio';
  };

  // Button styling
  const getButtonProps = () => {
    const completedColor = paymentModalConfig?.stepCompletedColor || '#29A400';
    if (status === 'active') {
      return { label: 'Subscribed', bgColor: completedColor, textColor: '#fff' };
    }
    if (status === 'renew') {
      return { label: 'Renew Now', bgColor: '#E8976B', textColor: '#fff' };
    }
    if (status === 'expired') {
      return { label: 'Resubscribe', bgColor: '#fff', textColor: mainColor };
    }
    if (status === 'checking') {
      return { label: 'Checking status…', bgColor: '#fff', textColor: mainColor, disabled: true };
    }
    return { label: 'Subscribe', bgColor: '#fff', textColor: mainColor };
  };

  const buttonProps = getButtonProps();

  return (
    <Presentation
      viewModel={{
        modelName,
        imageUri: image || null,
        fallbackImage: Alpha100,
        description,
        gradient1,
        gradient2,
        mainColor,
        stepCompletedColor: paymentModalConfig?.stepCompletedColor || '#58a100',
        currentPrice: displayPrice,
        originalPrice,
        discount,
        pricingOptions,
        selectedPricing,
        gstText,
        minInvestment: ele?.minInvestment,
        volatility: ele?.volatility,
        volatilityColorStyle: getVolatilityColorStyle(),
        cagrDisplay: getCagrDisplay(),
        cagrClickable: !globalConsent,
        globalConsent,
        isExpanded,
        status,
        buttonLabel: buttonProps.label,
        buttonBgColor: buttonProps.bgColor,
        buttonTextColor: buttonProps.textColor,
        subscribeDisabled: !!buttonProps.disabled,
        cardWidth: isHorizontal ? screenWidth - 52 : null,
      }}
      actions={{
        onSelectPricing: setSelectedPricing,
        onViewMore: handleCardClick,
        onSubscribe: handleSubscribe,
        onConsentOpen: handleConsentOpen,
      }}
      slots={{
        ConsentPopupSlot: (
          <ConsentPopup
            isConsentPopupOpen={isConsentPopupOpen}
            setIsConsentPopupOpen={setIsConsentPopupOpen}
            handleConsentAccept={handleConsentAccept}
          />
        ),
      }}
    />
  );
};

export default MPCard;
