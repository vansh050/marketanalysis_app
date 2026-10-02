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
import { withGst, recBase } from '../../utils/gstHelpers';
import { useComponent } from '../../design/useDesign';
import useTokens from '../../theme/useTokens';
import {
  getAdvisorContentProfile,
  getAdvisorPlanSummary,
} from '../../utils/advisorContentProfile';
import { designColor } from '../../design/literalTokens';
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
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
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
  const advisorContent = getAdvisorContentProfile();
  const colorMap = tokens?.colors?.mpCardColorMap;
  const cycle = tokens?.colors?.mpCardColorCycle;
  let cardColor = null;
  // RA request (2026-08-13): when the tenant pins a FIXED plan-card ordering
  // (whitelabel/content.js MONEYMAN_PLAN_ORDERING === 'fixed'), the card color
  // cycles strictly by list position (green → purple → blue) so a re-ordered
  // or new plan can never break the sequence. Other tenants keep the legacy
  // name-map-first behavior.
  if (
    advisorContent.planOrdering === 'fixed' &&
    Array.isArray(cycle) &&
    cycle.length > 0
  ) {
    cardColor = cycle[index % cycle.length];
  }
  if (!cardColor && colorMap && typeof modelName === 'string') {
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

  useEffect(() => {
    setImageLoadFailed(false);
  }, [image]);

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

    // All recurring frequencies resolve through the same GST-aware base
    // helper. recBase prefers pricingWithoutGst, and for legacy plans that
    // only carry `pricing` (which is GST-INCLUSIVE when GST is on) it divides
    // back out to the display base — the inline version this replaced fell
    // back to a raw pricing.yearly, so appending the "+ GST" label
    // double-counted GST on those plans.
    [
      ['monthly', 'Monthly'],
      ['quarterly', 'Quarterly'],
      ['half-yearly', '6 Months'],
      ['yearly', 'Yearly'],
    ].forEach(([period, label]) => {
      const basePrice = recBase(ele, period, configGst);
      if (isValidPrice(basePrice)) options.push({period, label, value: basePrice});
    });

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

    // Both inputs are server-filtered from the same active Subscription
    // contract. The catalog endpoint returns `subscription` per plan while
    // subscribed-strategies returns the accessible portfolios. Accept either
    // exact-plan signal so a temporary portfolio hydration/name mismatch does
    // not render "Subscribe" for an already active plan.
    const normalizedPlan = normalizeGroupName(ele?.name);
    const active = (modelPortfolioStrategyfinal || []).some(portfolio =>
      normalizeGroupName(portfolio?.model_name) === normalizedPlan,
    );
    return active || Boolean(isSubscribed) ? 'active' : 'none';
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
    if (!globalConsent) return { color: designColor('9ca3af') };
    if (ele?.volatility) {
      if (typeof ele.volatility === 'number') {
        if (ele.volatility > 0.15) return { color: designColor('dc2626') };
        if (ele.volatility > 0.1) return { color: designColor('f59e0b') };
        return { color: designColor('16a34a') };
      }
      if (ele.volatility === 'High') return { color: designColor('dc2626') };
      if (ele.volatility === 'Medium') return { color: designColor('f59e0b') };
      if (ele.volatility === 'Low') return { color: designColor('16a34a') };
    }
    return { color: designColor('9ca3af') };
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
    const completedColor = paymentModalConfig?.stepCompletedColor || designColor('29a400');
    if (status === 'active') {
      return { label: 'Subscribed', bgColor: completedColor, textColor: designColor('fff') };
    }
    if (status === 'renew') {
      return { label: 'Renew Now', bgColor: designColor('e8976b'), textColor: designColor('fff') };
    }
    if (status === 'expired') {
      return { label: 'Resubscribe', bgColor: designColor('fff'), textColor: mainColor };
    }
    if (status === 'checking') {
      return { label: 'Checking status…', bgColor: designColor('fff'), textColor: mainColor, disabled: true };
    }
    return { label: 'Subscribe', bgColor: designColor('fff'), textColor: mainColor };
  };

  const buttonProps = getButtonProps();

  // Soft tint for the expanded overview section background. Only produced
  // when the tenant opts into card-colour accents AND mainColor is a 6-digit
  // hex; otherwise the presentation falls back to its neutral default.
  const softColor =
    advisorContent.cardAccentFromCardColor && /^#[0-9A-Fa-f]{6}$/.test(mainColor)
      ? `${mainColor}14`
      : undefined;

  return (
    <Presentation
      viewModel={{
        modelName,
        imageUri: imageLoadFailed ? null : image || null,
        fallbackImage: Alpha100,
        description,
        cardSummary:
          advisorContent.planCards.length > 0
            ? getAdvisorPlanSummary(modelName, description)
            : '',
        gradient1,
        gradient2,
        mainColor,
        stepCompletedColor:
          advisorContent.cardAccentFromCardColor
            ? mainColor
            : paymentModalConfig?.stepCompletedColor || designColor('58a100'),
        softColor,
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
        onImageError: () => setImageLoadFailed(true),
      }}
      slots={{
        // Mount the consent Modal only while it is open. MPCards render
        // inside virtualized lists (Home horizontal catalogue = 3 cards × an
        // always-mounted Modal); an always-mounted Modal inside a recycled
        // list cell crashes Fabric with "The specified child already has a
        // parent" (2026-08-13). Conditional mount keeps the same UX.
        ConsentPopupSlot: isConsentPopupOpen ? (
          <ConsentPopup
            isConsentPopupOpen={isConsentPopupOpen}
            setIsConsentPopupOpen={setIsConsentPopupOpen}
            handleConsentAccept={handleConsentAccept}
          />
        ) : null,
      }}
    />
  );
};

export default MPCard;
