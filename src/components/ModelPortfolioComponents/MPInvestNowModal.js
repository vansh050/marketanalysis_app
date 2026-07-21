/**
 * MPInvestNowModal — CONTAINER (design-system Phase I, 2026-05-02)
 *
 * ALL payment gateway integration (Razorpay, Cashfree, PayU, Apple IAP,
 * Google Play), ALL payment state/callbacks, ALL API calls (axios),
 * Digio e-signature flow, subscription creation, coupon validation, and
 * investment amount calculation live here.
 *
 * Presentation is delegated to designs/<variant>/screens/MPInvestNowModal.js
 * via useComponent('screens.MPInvestNowModal'). The presentation NEVER
 * touches payment SDKs, payment callbacks, or payment state.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Container/Presentation Split.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  AppState,
} from 'react-native';
import {
  User,
  CreditCard,
  Settings,
} from 'lucide-react-native';
import * as RNIap from 'react-native-iap';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import uuid from 'react-native-uuid';
import RazorpayCheckout from 'react-native-razorpay';
import APP_VARIANTS from '../../utils/Config';
import RNFS from 'react-native-fs';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';
import FormatDateTime, { FormatDate } from '../../utils/formatDateTime';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import {
  CFDropCheckoutPayment,
  CFEnvironment,
  CFPaymentComponentBuilder,
  CFPaymentModes,
  CFSession,
  CFThemeBuilder,
  CFSubscriptionCheckoutPayment,
  CFSubscriptionSession,
} from 'cashfree-pg-api-contract';
import {
  getCashfreeEnvironment,
  isInstallSourceError,
  friendlyPaymentError,
  describeCashfreeDecline,
} from '../../utils/cashfreeEnv';
import {
  CashFreeOneTimePayment,
  CashFreeRecurringPayment,
} from '../../FunctionCall/services/CashFreeOneTimePayment';
import {
  createPayUOrder,
  registerPayUSI,
  verifyPayUPayment,
  PayUOneTimePayment,
  PayUSIPayment,
} from '../../FunctionCall/services/PayUService';
import {
  checkCashfreePaymentStatus,
  checkSubscriptionStatus,
  pollPaymentStatus,
  pollDigioStatus,
  PaymentStatus,
  DigioStatus,
} from '../../FunctionCall/services/PaymentStatusService';
import {
  savePendingPayment,
  clearPendingPayment,
  checkAndRecoverPendingPayment,
  createPendingPaymentData,
  PaymentType,
  savePendingDigio,
  clearPendingDigio,
  getPendingDigio,
  updatePendingPayment,
} from '../../FunctionCall/services/PendingPaymentManager';
import {logPayment} from '../../utils/Logging';
import {
  Digio,
  DigioConfig,
  GatewayEvent,
  ServiceMode,
  Environment,
} from '@digiotech/react-native';
import moment from 'moment';
import { encode as btoa } from 'base-64';
import { addISTOffset } from '../../utils/dateUtils';
import { useComponent } from '../../design/useDesign';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const MPInvestNowModal = ({
  visible,
  onClose,
  userEmail,
  broker,
  latestRebalance,
  strategyDetails,
  handleCardClick,
  selectedCard,
  plandata,
  plans,
  getStrategyDetails,
  setPaymentSuccess,
  setShowPaymentFail,
  getAllStrategy,
  specificPlan,
  setPaymentModal,
  specificPlanDetails,
  fileName,
  userDetails,
  isSubscribed,
  setOneTimeAmount,
  selectedPlanType,
  onetimeamount,
  oneTimeDurationPlan,
  setOneTimeDurationPlan,
  appVariant = 'magnus',
  setSelectedPlanType,
  getAllBespoke
}) => {
  const Presentation = useComponent('screens.MPInvestNowModal');

  const { configData } = useTrade();

  // Brand colors via useTokens — variant supplies the fallback, backend
  // config.gradient1 / gradient2 still override through legacy branding.
  const config = useConfig();
  const tokens = useTokens();
  const gradient1 = tokens.colors.brand.gradientStart;
  const gradient2 = tokens.colors.brand.gradientEnd;
  const mainColor = gradient2;
  const stepCompletedColor = config?.paymentModal?.stepCompletedColor || '#29A400';

  // API configuration from your Postman
  const PDF_API_CONFIG = {
    url: `${server.ccxtServer.baseUrl}misc/pdf/s3/digio/download`,
    headers: {
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    },
  };

  const [adminpaymentPlatform, setadminpaymentPlatform] = useState(config?.paymentPlatform || 'cashfree');

  const getpaymentPlatform = () => {
    if (specificPlan) {
      axios
        .get(`${server.server.baseUrl}api/adminControl/get-payment-platform`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        })
        .then(res => {
          if (res?.data?.paymentPlatform) {
            setadminpaymentPlatform(res.data.paymentPlatform);
          }
        })
        .catch(() => {
          setadminpaymentPlatform(config?.paymentPlatform || 'cashfree');
        });
    }
  };

  const cashfree =
    String(adminpaymentPlatform).trim().toLowerCase() === 'cashfree';
  const payu =
    String(adminpaymentPlatform).trim().toLowerCase() === 'payu';


  // PayU WebView state
  const [showPayUWebView, setShowPayUWebView] = useState(false);
  const [payuFormData, setPayuFormData] = useState(null);
  const [payuIsSI, setPayuIsSI] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const handledOrderIdsRef = { current: new Set() };
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const { getPlanList } = useTrade();
  const [currentStep, setCurrentStep] = useState(0);
  const [planDetails, setPlanDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [invetAmount, setInvestAmount] = useState('');
  const [appliedCouponId, setAppliedCouponId] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [name, setName] = useState(userDetails?.name || '');
  const [mobileNumber, setMobileNumber] = useState(
    userDetails?.phone_number || '',
  );
  const [panNumber, setPanNumber] = useState(
    userDetails?.panNumber || '',
  );
  // Optional GSTIN capture for the invoice (web parity C3a — collapsed
  // opt-in). GST pricing/labels already handled via GstConfigService;
  // this is only the customer's own GST number for input-tax-credit.
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState('');
  const [open, setOpen] = useState(false);

  const [consentChecked, setConsentChecked] = useState(false);
  const [panError, setPanError] = useState('');

  // Telegram ID validation function
  const validateTelegramId = id => {
    return id && id.length >= 5 && /^\d+$/.test(id);
  };

  const [digioSuccessModal, setDigioSuccessModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInputValue, setTelegramInputValue] = useState('');

  // Payment status polling state
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [paymentPollingMessage, setPaymentPollingMessage] = useState('');
  const [pendingRecoveryData, setPendingRecoveryData] = useState(null);
  const appStateRef = useRef(AppState.currentState);
  const pollingShouldStopRef = useRef(false);
  const digioPollingShouldStopRef = useRef(false);

  // Save Telegram ID function
  const saveTelegramId = async (id) => {
    try {
      const response = await axios.put(
        `${server.server.baseUrl}api/user/update-profile`,
        {
          email: userEmail,
          telegram_id: id,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        }
      );

      if (response.data) {
        setTelegramId(id);
      }
    } catch (error) {
      console.error('Error saving Telegram ID:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save Telegram ID',
        text2: 'Please try again later',
      });
    }
  };

  const handlePaymentSuccessWithTelegram = () => {
    // Check if Digio should be triggered after payment
    const shouldTriggerDigioAfterPayment =
      isDigioEnabled &&
      digioCheck === 'afterPayment' &&
      advisorSpecificUserDetails?.digio_verification !== true;

    if (shouldTriggerDigioAfterPayment) {
      // Trigger Digio after successful payment
      console.log('Triggering Digio after payment success');
      openDigioModal();
      return;
    }

    // If user doesn't have a telegram ID, show the collection modal
    if (!telegramId && !userDetails?.telegram_id) {
      setShowTelegramModal(true);
    } else {
      // If they already have one, just close the modal
      setPaymentSuccess(true);
    }
  };
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const [birthDate, setBirthDate] = useState(
    userDetails?.DateofBirth ? new Date(userDetails.DateofBirth) : new Date(),
  );

  const [telegramId, setTelegramId] = useState(
    userDetails?.telegram_id || '',
  );
  const [prevDOB, setPrevDOB] = useState(
    userDetails?.DateofBirth || '',
  );

  const isIOS = Platform.OS === 'ios';
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  // Get app variant configuration - use dynamic config colors (gradient2) from API
  const staticVariant = APP_VARIANTS[appVariant] || APP_VARIANTS.arfs;
  const currentAppVariant = {
    ...staticVariant,
    paymentModal: {
      headerBg: gradient2,
      stepActiveColor: gradient2,
      buttonPrimaryBg: gradient2,
      buttonSecondaryBg: gradient2,
      accentColor: gradient2,
      progressBarColor: gradient2,
      linkColor: gradient2,
      stepCompletedColor: stepCompletedColor,
      checkboxActiveColor: stepCompletedColor,
    },
  };
  const whiteLabelText =
    configData?.config?.REACT_APP_WHITE_LABEL_TEXT || 'arfs';

  const steps = [
    {
      id: 0,
      title: 'Personal Info',
      description: 'Name, email & phone',
      icon: User,
    },
    {
      id: 1,
      title: 'Investment',
      description: 'Amount & KYC details',
      icon: Settings,
    },
    {
      id: 2,
      title: 'Plan',
      description: 'Choose subscription',
      icon: CreditCard,
    },
  ];

  const razorPayKey = configData?.config?.REACT_APP_RAZORPAY_LIVE_API_KEY;
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  const advisorName = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  const clientId = userDetails?.clientId || uuid.v4().slice(0, 7);
  const userId = userDetails && userDetails?._id;

  const formattedName = specificPlanDetails?.name
    ? specificPlanDetails.name.includes(' ')
      ? specificPlanDetails.name.toLowerCase().replace(/\s+/g, '_')
      : specificPlanDetails.name.toLowerCase()
    : '';

  const [advisorSpecificUserDetails, setAdvisorSpecificUserDetails] =
    useState();
  const getAdvisorSpecificUserDeatils = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userDetails?.email}`,
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
      const user = response.data.User;

      setAdvisorSpecificUserDetails(user);

      return user;
    } catch (error) {
      console.error('Error fetching user details:', error.message);
    }
  };

  useEffect(() => {
    getAdvisorSpecificUserDeatils();
  }, [userDetails]);

  useEffect(() => {
    if (specificPlan) {
      getSpecificPlan();
    }
  }, [specificPlan]);

  // AppState listener for payment recovery
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      // When app comes to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[MPInvestNowModal] App came to foreground, checking pending payments...');
        await checkPendingPaymentRecovery();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Also check on initial mount
    checkPendingPaymentRecovery();

    return () => {
      subscription?.remove();
      // Stop any ongoing polling when component unmounts
      pollingShouldStopRef.current = true;
    };
  }, [configData, visible]);

  // Check and recover pending payment
  const checkPendingPaymentRecovery = async () => {
    if (!configData || !visible) return;

    try {
      // First check for pending Digio signature (independent of payment)
      const pendingDigio = await getPendingDigio();
      if (pendingDigio) {
        console.log('[MPInvestNowModal] Found pending Digio signature:', pendingDigio.documentId);

        // Check Digio status from backend
        const subscriptionStatus = await checkSubscriptionStatus(
          pendingDigio.userEmail || userEmail,
          pendingDigio.planId || specificPlan?._id,
          configData,
        );

        if (subscriptionStatus.digioStatus === DigioStatus.COMPLETED) {
          // Already completed via webhook, clear pending
          await clearPendingDigio();
          console.log('[MPInvestNowModal] Digio already completed, cleared pending');
        } else if (subscriptionStatus.digioStatus === DigioStatus.FAILED) {
          // Failed, offer to retry
          Alert.alert(
            'Signature Failed',
            subscriptionStatus.subscription?.digio_failure_reason || 'E-signature failed. Would you like to try again?',
            [
              { text: 'Later', style: 'cancel', onPress: () => clearPendingDigio() },
              { text: 'Retry', onPress: () => openDigioModal() },
            ],
          );
        } else if (subscriptionStatus.digioStatus === DigioStatus.PENDING) {
          // Still pending, offer to complete
          Alert.alert(
            'Complete Signature',
            'You have a pending e-signature. Would you like to complete it now?',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Complete Now', onPress: () => openDigioModal() },
            ],
          );
        }
      }

      // Then check for pending payment
      const result = await checkAndRecoverPendingPayment(configData);

      if (result.hasPending && result.needsAction) {
        console.log('[MPInvestNowModal] Pending payment recovery action:', result.needsAction);

        switch (result.needsAction.action) {
          case 'COMPLETE_SUBSCRIPTION':
            // Auto-complete subscription if payment was successful
            setPendingRecoveryData(result);
            await handlePendingPaymentCompletion(result);
            break;

          case 'COMPLETE_DIGIO':
          case 'RETRY_DIGIO':
            // Show message and optionally trigger Digio
            Alert.alert(
              'Signature Required',
              result.needsAction.message,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Complete Now',
                  onPress: () => {
                    // Trigger Digio flow
                    openDigioModal();
                  },
                },
              ],
            );
            break;

          case 'PAYMENT_FAILED':
            // Reason-aware title + message (PendingPaymentManager →
            // describeStoredPaymentFailure). Falls back to the old generic
            // title only if the recovery result predates that change.
            Alert.alert(
              result.needsAction.title || 'Payment Failed',
              result.needsAction.message,
              [{ text: 'OK' }],
            );
            break;

          case 'NONE':
            // Everything is complete
            if (result.needsAction.isComplete) {
              console.log('[MPInvestNowModal] Pending payment already complete');
            }
            break;

          default:
            console.log('[MPInvestNowModal] Unhandled recovery action:', result.needsAction.action);
        }
      }
    } catch (error) {
      console.error('[MPInvestNowModal] Error checking pending payment:', error);
    }
  };

  // Handle completion of pending payment that succeeded
  const handlePendingPaymentCompletion = async (recoveryResult) => {
    const { pendingPayment, status } = recoveryResult;

    try {
      setLoading(true);
      setPaymentPollingMessage('Completing your subscription...');

      // Complete the subscription using CashFreeOneTimePayment
      if (pendingPayment.paymentType === PaymentType.ONE_TIME) {
        await CashFreeOneTimePayment({
          paymentDetails: pendingPayment.orderId,
          email: pendingPayment.userEmail,
          name: pendingPayment.userDetails?.name || name,
          panNumber: pendingPayment.userDetails?.pan || panNumber,
          mobileNumber: pendingPayment.userDetails?.phone || mobileNumber,
          countryCode: pendingPayment.userDetails?.countryCode || countryCode,
          formattedName,
          specificPlan: pendingPayment.planDetails || specificPlan,
          whiteLabelText,
          telegramId,
          advisorTag,
          birthDate,
          invetAmount,
          planDetails,
          configData,
          panCategory: '',
        });

        // Clear pending payment and show success
        await clearPendingPayment();
        setLoading(false);
        setPaymentPollingMessage('');
        handlePaymentSuccessWithTelegram();

        await logPayment('PENDING_PAYMENT_RECOVERED_SUCCESS', {
          orderId: pendingPayment.orderId,
          userEmail: pendingPayment.userEmail,
        }, configData);
      }
    } catch (error) {
      console.error('[MPInvestNowModal] Error completing pending payment:', error);
      setLoading(false);
      setPaymentPollingMessage('');
      Alert.alert(
        'Recovery Error',
        'Could not complete your subscription. Please contact support.',
      );
    }
  };

  // Background polling for Digio status while modal is open
  const startDigioBackgroundPolling = async (documentId) => {
    // Wait 15 seconds before starting polling (give WebView time to respond)
    await new Promise(resolve => setTimeout(resolve, 15000));

    if (digioPollingShouldStopRef.current) {
      console.log('[Digio Polling] Stopped before starting');
      return;
    }

    console.log('[Digio Polling] Starting background polling for document:', documentId);

    // Poll for up to 5 minutes
    const pollResult = await pollDigioStatus(
      userEmail,
      specificPlan?._id,
      configData,
      {
        maxAttempts: 60, // 5 minutes at 5-second intervals
        intervalMs: 5000,
        shouldStop: () => digioPollingShouldStopRef.current,
        onStatusUpdate: (update) => {
          console.log('[Digio Polling] Status update:', update.digioStatus, 'attempt:', update.attempt);
        },
      },
    );

    // If polling was stopped (by WebView callback or modal close), do nothing
    if (pollResult.stopped) {
      console.log('[Digio Polling] Stopped by callback or modal close');
      return;
    }

    // Handle poll result
    if (pollResult.digioStatus === DigioStatus.COMPLETED) {
      console.log('[Digio Polling] Signature completed via webhook!');
      digioPollingShouldStopRef.current = true;

      // Clear pending Digio
      await clearPendingDigio();

      // Close Digio modal and trigger success flow
      setDigioModalOpen(false);

      // Update user verification status (same as handleDigioSuccess does)
      try {
        await fetch(
          `${server.server.baseUrl}api/digio/update-user`,
          {
            method: 'POST',
            body: JSON.stringify({
              email: userEmail,
              digio_verification: true,
            }),
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
        // Update local state so the same session won't re-ask for Digio
        setAdvisorSpecificUserDetails(prev => ({
          ...prev,
          digio_verification: true,
        }));
      } catch (err) {
        console.error('[Digio Polling] Error updating user:', err);
      }

      // Show success modal
      setDigioSuccessModal(true);

      await logPayment('DIGIO_COMPLETED_VIA_POLLING', {
        documentId,
        userEmail,
      }, configData);
    } else if (pollResult.digioStatus === DigioStatus.FAILED) {
      console.log('[Digio Polling] Signature failed via webhook');
      digioPollingShouldStopRef.current = true;

      // Close modal and show failure
      setDigioModalOpen(false);
      setDigioUnsuccessModal(true);
    }
    // If still pending after 5 minutes, let the user continue in WebView
  };

  // Validation functions
  const validatePan = pan => {
    if (!pan || pan.length !== 10) return false;
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  };

  const validateGst = gstin => {
    if (!gstin) return true; // optional
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
      gstin.toUpperCase(),
    );
  };

  const handleGstChange = value => {
    const v = (value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15);
    setGstNumber(v);
    setGstError(v && !validateGst(v) ? 'Invalid GST format. e.g. 29ABCDE1234F1Z5' : '');
  };

  const handlePanChange = value => {
    const sanitizedValue = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    setPanNumber(sanitizedValue);

    if (sanitizedValue.length > 0) {
      const isValid = validatePan(sanitizedValue);
      setPanError(isValid ? '' : 'Invalid PAN format. It should be AAAAA1234A');
    } else {
      setPanError('');
    }
  };
  const [subscriptionData, setSubscriptionData] = useState([]);

  const getAllSubscriptionData = () => {
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    axios
      .request(config)
      .then(response => {
        setSubscriptionData(response.data.data);
      })
      .catch(error => {
        console.log(error);
      });
  };

  const toggleCouponSection = () => {
    const toValue = showCoupon ? 0 : 100;

    Animated.timing(animatedHeight, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    setShowCoupon(!showCoupon);
  };

  const isStepValid = stepId => {
    switch (stepId) {
      case 0:
        return name && userEmail && mobileNumber;
      case 1:
        return (
          panNumber &&
          birthDate &&
          !panError &&
          (specificPlan?.type !== 'model portfolio' ||
            invetAmount >= specificPlan?.minInvestment)
        );
      case 2:
        return (
          consentChecked &&
          (specificPlan?.frequency?.length === 0 || selectedCard !== null)
        );
      case 3:
        return true;
      default:
        return false;
    }
  };

  // Refs mirroring the latest config-loading/kycBlockingEnabled state, kept in
  // sync via the effect below. Needed because `resolveKycBlockingEnabled` is an
  // async function that may await across several ticks (polling for a slow
  // config load) — a plain closed-over `config` value is frozen at call time
  // and would never observe the load actually finishing, so the wait would
  // just spin uselessly for the full timeout. Refs mutate in place and are
  // always read fresh. Mirrors web's resolveKycBlockingEnabled hardening
  // (prod-alphaquark-github PricingPage.js) and markup_app's parallel fix.
  const configLoadingRef = useRef(config?.configLoading);
  const kycBlockingEnabledRef = useRef(config?.kycBlockingEnabled === true);
  useEffect(() => {
    configLoadingRef.current = config?.configLoading;
    kycBlockingEnabledRef.current = config?.kycBlockingEnabled === true;
  }, [config?.configLoading, config?.kycBlockingEnabled]);

  // Waits out a still-in-flight config load (up to 6s, matching the provider's
  // own frontend-config fetch timeout) before trusting `kycBlockingEnabled`.
  // Without this, a user who reaches step 1 before ConfigContext's initial
  // fetch resolves would read the pre-fetch default (false) and silently skip
  // the gate. If config is still loading after the wait, treat the gate as OFF
  // (not a verification failure — most advisors default off anyway, so
  // "unknown" reasonably means "assume default").
  const resolveKycBlockingEnabled = async () => {
    if (!configLoadingRef.current) return kycBlockingEnabledRef.current === true;
    const start = Date.now();
    while (configLoadingRef.current && Date.now() - start < 6000) {
      await new Promise(r => setTimeout(r, 150));
    }
    return kycBlockingEnabledRef.current === true;
  };

  // Checkout-time blocking KYC gate — verify PAN+DoB against the KRA BEFORE
  // moving past the KYC step to payment/Digio. Gated by `kycBlockingEnabled`
  // (default OFF). Final policy (product decision 2026-07-16): ONLY a
  // `verified` outcome allows the user through. Every other classification
  // BLOCKS — `mismatch`, `not_found`, `service_error`, `unavailable` (incl.
  // a genuine KRA/CVL outage or missing CVL creds), and a genuine call
  // failure (network/timeout/malformed response — no verification signal at
  // all). See the per-outcome comments below for the rationale on each.
  // Mirrors web PricingPage.runKycBlockingGate.
  const runKycBlockingGate = async () => {
    const gateOn = await resolveKycBlockingEnabled();
    if (!gateOn) return true;

    const pan = (panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setPanError('Please enter a valid PAN (format ABCDE1234F) to continue.');
      return false;
    }
    // birthDate is a Date object in this modal; the KRA expects a date string.
    const dobStr =
      birthDate instanceof Date
        ? `${birthDate.getFullYear()}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`
        : String(birthDate || '').trim();
    if (!dobStr) {
      Toast.show({
        type: 'error',
        text1: 'Date of birth required',
        text2: 'Please enter your date of birth to verify your PAN with the KRA.',
      });
      return false;
    }

    try {
      Toast.show({
        type: 'info',
        text1: 'Verifying PAN…',
        text2: 'Checking your PAN and date of birth with the KRA.',
      });
      const advisor = configData?.config?.REACT_APP_HEADER_NAME;
      const res = await axios.post(
        `${server.ccxtServer.baseUrl}misc/kyc/kra/verify-pan/${advisor}/${encodeURIComponent(
          userEmail || '',
        )}`,
        { panNo: pan, dob: dobStr, mobile: mobileNumber || '' },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 15000,
        },
      );
      if (res?.data?.kycOutcome === 'mismatch') {
        Alert.alert(
          'PAN verification failed',
          res?.data?.message ||
            "We couldn't verify this PAN with the date of birth entered. Please check and enter the correct PAN and date of birth to continue.",
        );
        return false;
      }
      if (res?.data?.kycOutcome === 'not_found') {
        // BLOCK (product decision 2026-07-16): the KRA has no record of this
        // PAN at all — most likely a fake/random PAN (the exact case that
        // motivated this gate). Standing trade-off, made deliberately: this
        // also blocks a genuine customer who simply hasn't completed KRA-KYC
        // yet. Accepted for now; revisit once CVL PAN Inquiry is live and we
        // have real-world false-positive data on this advisor's traffic.
        // NOTE: "prod" (this app's default/AlphaQuark advisor) has no CVL
        // credentials configured at all, so its verify-pan calls never reach
        // a real not_found/mismatch — they always resolve unavailable, which
        // fails open below. This gate is effectively a no-op for that
        // advisor until CVL access exists; known limitation, not a bug.
        Alert.alert(
          'PAN not found',
          "We couldn't find this PAN registered with any KYC Registration Agency. Please check the PAN and try again, or contact support if you believe this is an error.",
        );
        return false;
      }
      if (res?.data?.kycOutcome === 'service_error') {
        // BLOCK + surface (product decision 2026-07-16): the KRA/CVL returned a
        // DEFINITE config/access error (e.g. CVL WEBERR-001 "Access Privilege
        // Not Set", WEBERR-029 "Invalid IP Address"). The advisor's verification
        // path is MISCONFIGURED — the customer's PAN may be valid but we can't
        // confirm it. Unlike a transient outage (fails open below), a config
        // error is persistent and must not silently pass customers, so we halt
        // and show it's a verification-SERVICE problem (not their PAN). The raw
        // WEBERR is in the response + ccxt logs for the advisor to act on.
        Alert.alert(
          'Verification unavailable',
          'PAN verification is currently unavailable due to a verification-service configuration issue on our side. Please contact support so we can enable this for you — we can\'t complete your subscription until it\'s resolved.',
        );
        return false;
      }
      if (res?.data?.kycOutcome === 'unavailable') {
        // BLOCK (product decision 2026-07-16, revised — supersedes the
        // "transient outages allow" call made earlier the same day): a
        // GENUINE KRA/CVL outage/timeout, or no CVL creds configured at all,
        // still means we have NO positive verification signal for this PAN.
        // Letting the customer through on "CVL hasn't given a pass" is
        // exactly the gap that motivated this gate. Retryable, so the
        // message invites a retry rather than pointing at support.
        Alert.alert(
          'Unable to verify PAN',
          "We're unable to verify your PAN right now. Please try again in a moment — if this keeps happening, contact support.",
        );
        return false;
      }
      // verified → allow. Every other outcome is handled above; this is the
      // only path that actually confirms the PAN with a KRA.
      return true;
    } catch (e) {
      // Fail-CLOSED (product decision 2026-07-16): a network/exception failure
      // means we have NO verification signal — proceeding would let "skipped"
      // read as "passed", defeating a SEBI KYC gate. Block; the user can retry.
      console.error('[MPInvestNow] KYC gate error (blocking, no verification signal):', e?.message);
      Alert.alert(
        'Unable to verify PAN',
        "We're unable to verify your PAN right now. Please try again in a moment — if this keeps happening, contact support.",
      );
      return false;
    }
  };

  const completeStep = async stepId => {
    if (isStepTransitioning) return;
    setIsStepTransitioning(true);

    // Blocking KYC gate (SEBI onboarding): must pass before leaving the
    // PAN/DoB step (step 1) toward consent/payment/Digio.
    if (stepId === 1) {
      const kycOk = await runKycBlockingGate();
      if (!kycOk) {
        setIsStepTransitioning(false);
        return;
      }
    }

    // Smooth transition animation
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentStep(stepId + 1);
    await new Promise(resolve => setTimeout(resolve, 200));
    setIsStepTransitioning(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };

  // Payment functions

  const IOS_PRODUCT_IDS = {
    growth: 'com.ali.magnus.growth_plan',
    prime: 'com.ali.magnus.prime_plan',
    advanced: 'com.ali.magnus.advanced_plan',
    priorRecommendationPlan: 'com.ali.mangus.priorRecommendationPlan',
    ipoEdgeSmeMainboard: 'com.ali.mangus.ipoEdgeSmeMainboard',
    ipoEdge: 'com.ali.mangus.ipoEdge',
  };

  const [amount, setAmount] = useState('');
  const tick = require('../../assets/checked.png');
  const isContinueEnabled = amount >= 70000;
  const [openCouponModal, setOpenCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  const getSpecificPlan = () => {
    if (specificPlan) {
      axios
        .get(
          `${server.server.baseUrl}api/admin/plan/detail/specific/${specificPlan._id}/${userEmail}`,
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
        )
        .then(res => {
          setPlanDetails(res.data.data);
        })
        .catch(err => console.log(err));
    }
  };

  const [loadingmp, setLoadingmp] = useState(false);
  useEffect(() => {
    if (specificPlan) {
      getSpecificPlan();
    }
  }, [specificPlan]);

  useEffect(() => {
    getpaymentPlatform();
    getAllSubscriptionData();
  }, [specificPlan]);

  // Sync DOB and PAN when userDetails changes
  useEffect(() => {
    if (userDetails) {
      setBirthDate(userDetails.DateofBirth || '');
      setPrevDOB(userDetails.DateofBirth || '');
      setPanNumber(userDetails.panNumber || '');
    }
  }, [userDetails]);

  const [isPostPaymentProcessing, setIsPostPaymentProcessing] = useState(false);

  const [refresh, setRefresh] = useState(false);

  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;

  const [inputValue, setInputValue] = useState('');

  const [currentPaymentId, setCurrentPaymentId] = useState(null);
  const lastErrorKeyRef = useRef(null);
  // Digio configuration
  const digioCheck = String(
    configData?.digioCheck ||
    configData?.config?.REACT_APP_DIGIO_CHECK ||
    configData?.config?.digioCheck ||
    Config.REACT_APP_DIGIO_CHECK ||
    'beforePayment'
  );

  // AlphaB2B does not offer Digio e-signing. Keep it off unless a future
  // build explicitly opts in through its native build environment.
  const isDigioEnabled = Config.REACT_APP_DIGIO_ENABLED === 'true' &&
    configData?.digioEnabled !== false &&
    configData?.config?.REACT_APP_DIGIO_ENABLED !== 'false';

  const getInitialAuthMethod = () => {
    const aadhaarEnabled = configData?.aadhaarBasedAuthentication === true ||
      configData?.config?.REACT_APP_AADHAAR_BASED_AUTHENTICATION === 'true';
    const otpEnabled = configData?.otpBasedAuthentication === true ||
      configData?.config?.REACT_APP_OTP_BASED_AUTHENTICATION === 'true';

    if (aadhaarEnabled) {
      return 'aadhaar';
    }
    if (otpEnabled) {
      return 'otp';
    }
    return 'aadhaar';
  };

  const [authMethod, setAuthMethod] = useState(getInitialAuthMethod());

  // DIGIO Start

  const [digioModalOpen, setDigioModalOpen] = useState(false);
  const [digioUnsucessModal, setDigioUnsuccessModal] = useState(false);
  const [storeDigioData, setStoreDigioData] = useState('');

  let documentId = storeDigioData?.id;
  let tokenId = storeDigioData?.access_token?.id;
  let identifier = mobileNumber;
  const digioInstance = useRef(null);
  useEffect(() => {
    let gatewayEventListener;
    if (digioModalOpen && documentId && identifier && tokenId) {
      gatewayEventListener = digioInstance.current?.addGatewayEventListener?.(
        event => {
          console.log('Digio Gateway Event:', event);
        },
      );
    }

    return () => {
      if (gatewayEventListener) {
        gatewayEventListener.remove();
      }
    };
  }, [digioModalOpen, documentId, identifier, tokenId]);

  const [razorpayLoader, setRazorpayLoader] = useState(false);
  const handleDigioSuccess = async () => {
    // Stop background polling since WebView callback was received
    digioPollingShouldStopRef.current = true;
    console.log('Handle success hit final-------------------------1111111');
    try {
      setRazorpayLoader(true);
      if (storeDigioData?.id) {
        let config = {
          method: 'get',
          url: `${server.ccxtServer.baseUrl}misc/digio/doc-detail/${storeDigioData?.id}/${advisorTag}`,
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        };

        await axios
          .request(config)
          .then(async response => {
            console.log('here i am', JSON.stringify(response.data));
            if (response?.data?.result?.agreement_status === 'completed') {
              // Mark Digio as done FIRST
              try {
                await fetch(
                  `${server.server.baseUrl}api/digio/update-user`,
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      email: userEmail,
                      digio_verification: true,
                    }),
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Advisor-Subdomain':
                        configData?.config?.REACT_APP_HEADER_NAME,
                      'aq-encrypted-key': generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET,
                      ),
                    },
                  },
                );
                console.log('[Digio] digio_verification set to true on backend');

                // Update local state so the same session won't re-ask for Digio
                setAdvisorSpecificUserDetails(prev => ({
                  ...prev,
                  digio_verification: true,
                }));
              } catch (err) {
                console.error('[Digio] Failed to update digio_verification:', err);
              }

              // Show the success modal IMMEDIATELY after verification +
              // digio-mark, BEFORE the signed-doc download. The download is
              // best-effort but was previously `await`ed here, leaving the
              // plan-selection sheet visible for the download's full duration
              // (user-reported "flash back to the plans screen after Digio
              // confirm", 2026-06-12). Showing the success modal first closes
              // that gap; the download runs in the background below.
              setDigioSuccessModal(true);
              setLoading(false);
              console.log('this get true----');

              // Clear pending Digio on successful completion
              await clearPendingDigio();
              console.log('[Digio] Cleared pending Digio after successful signature');

              // Download signed doc — fire-and-forget (best-effort, MUST NOT
              // delay the success modal). Errors are swallowed/logged.
              axios
                .get(
                  `${server.ccxtServer.baseUrl}misc/digio/download/signed-doc/${storeDigioData?.id}/${advisorTag}`,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Advisor-Subdomain':
                        configData?.config?.REACT_APP_HEADER_NAME,
                      'aq-encrypted-key': generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET,
                      ),
                    },
                    responseType: 'blob',
                  },
                )
                .then(() => console.log('[Digio] Signed doc downloaded successfully'))
                .catch(error =>
                  console.error('[Digio] Error downloading signed PDF (non-blocking):', error),
                );
            } else {
              setDigioUnsuccessModal(true);
              setRazorpayLoader(false);
              setLoading(false);
            }
          })
          .catch(error => {
            console.log(error);
            setDigioUnsuccessModal(true);
            setRazorpayLoader(false);
            setLoading(false);
          });
      }
    } catch (error) {
      console.error('Error in verification completion handler:', error);
      setDigioUnsuccessModal(true);
      setRazorpayLoader(false);
    }
  };

  const [authUrl, setAuthUrl] = useState('');

  const fetchPdfBuffer = async (pdfUrl, headers) => {
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers,
    });
    return response.data; // ArrayBuffer
  };

  const savePdfLocally = async (pdfBuffer, fileName = 'digio.pdf') => {
    const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    let binary = '';
    const bytes = new Uint8Array(pdfBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = global.btoa
      ? global.btoa(binary)
      : require('base-64').encode(binary);

    await RNFS.writeFile(path, base64, 'base64');
    return 'file://' + path;
  };

  const openDigioModal = async () => {
    try {
      setLoading(true);

      const pdfBuffer = await fetchPdfBuffer(
        `${server.ccxtServer.baseUrl}misc/pdf/s3/digio/download`,
        {
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      );

      // Save locally and get file URI
      const fileUri = await savePdfLocally(pdfBuffer, 'digio.pdf');
      console.log('Local PDF for upload:', fileUri);

      // Prepare and upload using FormData
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'application/pdf',
        name: 'digio.pdf',
      });

      console.log('formDta>>>>>', formData);
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}misc/digio/upload/pdf/${mobileNumber}/${advisorTag}/${authMethod}?user_email=${userEmail}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      console.log('Upload response:', response);

      const url =
        response?.data?.result?.signing_parties?.[0]?.authentication_url;
      if (url) {
        setAuthUrl(url);
      }
      setStoreDigioData(response?.data?.result);

      // Save Digio document ID for recovery if app closes during signing
      const digioDocumentId = response?.data?.result?.id;
      if (digioDocumentId) {
        await savePendingDigio({
          documentId: digioDocumentId,
          authUrl: url,
          userEmail,
          planId: specificPlan?._id,
          mobileNumber,
          advisorTag,
        });
        console.log('[Digio] Saved pending Digio for recovery:', digioDocumentId);

        // Also update pending payment if exists
        await updatePendingPayment({
          digioDocumentId,
          digioRequired: true,
        });

        // Start background polling for Digio status via webhook
        digioPollingShouldStopRef.current = false;
        startDigioBackgroundPolling(digioDocumentId);
      }

      setDigioModalOpen(true);
      setLoading(false);
    } catch (err) {
      console.log('error ---', err, err.response, err.message);
      setLoading(false);
    }
  };

  console.log('authUrl>>>>>>', authUrl);

  const handlePaymentComplete = async (status, subscriptionId) => {
    if (status === 'ACTIVE') {
      handlePaymentSuccessWithTelegram();

      try {
        // Get stored user data using AsyncStorage
        const userInfoString = await AsyncStorage.getItem('userInfo');
        const specificPlanString = await AsyncStorage.getItem('specificPlan');
        const singleStrategyString = await AsyncStorage.getItem(
          'singleStrategyDetails',
        );

        const userInfo = userInfoString ? JSON.parse(userInfoString) : null;
        const pendingSpecificDetails = specificPlanString
          ? JSON.parse(specificPlanString)
          : null;
        const singleStrategyDetails = singleStrategyString
          ? JSON.parse(singleStrategyString)
          : null;

        // Process successful payment
        if (userInfo && pendingSpecificDetails) {
          await CashFreeRecurringPayment({
            paymentDetails: subscriptionId,
            email: userInfo.email,
            name: userInfo.name,
            panNumber: userInfo.panNumber,
            mobileNumber: userInfo.mobileNumber,
            countryCode: userInfo.countryCode,
            formattedName: userInfo.formattedName,
            specificPlan: pendingSpecificDetails,
            whiteLabelText,
            telegramId: userInfo?.telegramId,
            advisorTag,
            birthDate: userInfo?.birthDate,
            invetAmount: userInfo?.invetAmount,
            singleStrategyDetails: singleStrategyDetails,
            configData,
            panCategory: '',
          });

          // Clear pending payment after successful recurring payment completion
          await clearPendingPayment();
        }
      } catch (error) {
        console.error('Error retrieving payment session data:', error);
        setPaymentSuccess(false);
        setShowPaymentFail(true);
        setLoadingmp(false);
        onClose();
      }
    } else {
      setPaymentSuccess(false);
      setShowPaymentFail(true);
      setLoadingmp(false);
      onClose();
    }
  };

  const onErrorCountRef = useRef(0);

  // == Cashfree Payment Initiation ==
  const initiateCashfreePayment = async (plandata, onetimeamount) => {
    console.log('Here pay 3', {
      amount: onetimeamount,
      plan_id: plandata?._id,
      customerId: `A-${mobileNumber}`,
      user_email: userEmail,
      mobileNumber: mobileNumber,
      advisor: advisorTag,
      name: name,
      panNumber: panNumber,
      birthDate: birthDate,
      telegramId: telegramId,
      capital: invetAmount,
      countryCode: countryCode,
      duration: oneTimeDurationPlan,
    });
    try {
      setLoading(true);
      console.log({
        amount: onetimeamount,
        plan_id: plandata?._id,
        customerId: `A-${mobileNumber}`,
        user_email: userEmail,
        mobileNumber: mobileNumber,
        advisor: advisorTag,
        name: name,
        panNumber: panNumber,
        birthDate: birthDate,
        telegramId: telegramId,
        capital: invetAmount,
        countryCode: countryCode,
        duration: oneTimeDurationPlan,
      });

      const response = await axios.post(
        `${server.server.baseUrl}api/cashfree`,
        {
          amount: onetimeamount,
          plan_id: plandata?._id,
          customerId: `A-${mobileNumber}`,
          user_email: userEmail,
          mobileNumber: mobileNumber,
          advisor: advisorTag,
          name: name,
          panNumber: panNumber,
          gstNumber: gstNumber || undefined,
          birthDate: birthDate,
          telegramId: telegramId,
          capital: invetAmount,
          countryCode: countryCode,
          duration: oneTimeDurationPlan,
        },
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
      // Backend guard refusals (e.g. the CVL pre-payment KYC gate in
      // aq_backend Routes/CashFree/CashFree.js) come back as HTTP 200 with
      // `{status: false, message}` via _RS.apiNew — an axios "success" — so
      // they never reach the catch below. Without this check the refusal
      // fell through to the generic "Missing payment session data" throw
      // and the tap looked like a dead button (markup tester, 2026-07-16).
      if (response?.data?.status === false) {
        console.error('[OneTime] Order create refused:', response?.data?.message);
        logPayment('CASHFREE_ONETIME_CREATE_REFUSED', {
          message: response?.data?.message,
          userEmail,
          mobileNumber,
          advisor: advisorTag,
          planId: plandata?._id,
        }, configData);
        Alert.alert(
          'Payment could not be started',
          response?.data?.message || 'Please try again in a moment.',
        );
        setLoading(false);
        return;
      }

      const paymentId = response?.data?.subscription?.cashfree_order_id;
      const paymentSessionId = response?.data?.data?.payment_session_id;
      const subscriptionId = response?.data?.subscription?.id;
      if (!paymentId || !paymentSessionId) {
        throw new Error('Missing payment session data from server');
      }

      setCurrentPaymentId(paymentId);

      // Remote diagnostics: record the attempt + the resolved Cashfree env to
      // the backend payment log (api/log-payment → Logs/payments/<IST-date>.log
      // on tidi) so a RELEASE / Play-Store build's payment failures are visible
      // server-side WITHOUT adb logcat. cfEnvLabel is also referenced by the
      // onError / sdkError / poll-FAILED logs below to spot a SANDBOX-SDK vs
      // PRODUCTION-order mismatch. See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 4c.
      const cfEnvLabel = String(
        Config.REACT_APP_CASHFREE_ENV || Config.REACT_APP_ENV || 'unknown',
      );
      logPayment('CASHFREE_ONETIME_START', {
        orderId: paymentId,
        amount: onetimeamount,
        cashfreeEnv: cfEnvLabel,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        userEmail,
        mobileNumber,
        advisor: advisorTag,
        planId: plandata?._id,
      }, configData);

      // Save pending payment for recovery in case app closes during payment
      const pendingPaymentData = createPendingPaymentData({
        orderId: paymentId,
        subscriptionId,
        userEmail,
        planId: plandata?._id,
        paymentType: PaymentType.ONE_TIME,
        amount: onetimeamount,
        planDetails: plandata,
        userDetails: {
          name,
          email: userEmail,
          pan: panNumber,
          phone: mobileNumber,
          countryCode,
        },
        digioRequired: isDigioEnabled,
      });
      await savePendingPayment(pendingPaymentData);
      console.log('[OneTime] Saved pending payment for recovery:', paymentId);

      // Set Cashfree CALLBACK specifically for this payment
      const handledOrderIds = new Set();
      let lastErrorKey = null;

      CFPaymentGatewayService.setCallback({
        onVerify: async orderId => {
          if (handledOrderIds?.has(orderId)) return;
          handledOrderIds?.add(orderId);
          // Clear timeout on successful verification
          if (handledOrderIds.timeout) {
            clearTimeout(handledOrderIds.timeout);
          }
          pollingShouldStopRef.current = true;
          console.log('[OneTime] Payment verified for orderId:', orderId);
          // Clear pending payment on successful callback
          await clearPendingPayment();
          handlePaymentSuccessWithTelegram();
          setShowPaymentFail(false);
          setLoading(false);
          handlePaymentVerification(orderId);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        },
        onError: async (error, orderId) => {
          const errorKey =
            orderId + '-' + (error?.code || '') + '-' + (error?.message || '');

          if (lastErrorKey === errorKey) return;
          lastErrorKey = errorKey;

          // Clear timeout on error
          if (handledOrderIds?.timeout) {
            clearTimeout(handledOrderIds.timeout);
          }
          pollingShouldStopRef.current = true;

          console.error('[OneTime] Payment Error:', error, 'Order:', orderId);

          // Push the SDK error to the backend log so release-build GPay/UPI
          // failures are diagnosable server-side (Logs/payments/<date>.log).
          logPayment('CASHFREE_ONETIME_ERROR', {
            orderId,
            paymentId,
            code: error?.code,
            type: error?.type,
            status: error?.status,
            message: error?.message,
            isInstallSourceError: isInstallSourceError(error),
            cashfreeEnv: cfEnvLabel,
            platform: Platform.OS,
            osVersion: String(Platform.Version),
            userEmail,
            mobileNumber,
            advisor: advisorTag,
          }, configData);

          // Check if this is a user cancellation or actual failure
          const isCancellation = error?.code === 'CANCELLED' ||
            error?.code === 'USER_CANCELLED' ||
            error?.message?.includes('cancelled');

          if (isCancellation) {
            // User cancelled - clear pending payment
            await clearPendingPayment();
          }
          // For other errors, keep pending payment for recovery

          setShowPaymentFail(true);
          setLoading(false);
          setPaymentSuccess(false);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        },
      });

      CFPaymentGatewayService.setEventSubscriber({
        onReceivedEvent: (eventName, map) => {
          console.log('[OneTime] Event received:', eventName, map);
        },
      });

      // Single source of truth for env selection (utils/cashfreeEnv.js):
      // honours REACT_APP_CASHFREE_ENV override, SANDBOX in Metro debug,
      // else REACT_APP_ENV. Keeps MP in lockstep with CoursePurchaseSheet /
      // BuyWebinarTicketSheet so the install-source rule is applied uniformly.
      const cfEnvironment = getCashfreeEnvironment();

      const session = new CFSession(
        paymentSessionId,
        paymentId,
        cfEnvironment,
      );

      const paymentModes = new CFPaymentComponentBuilder()
        .add(CFPaymentModes.CARD)
        .add(CFPaymentModes.UPI)
        .add(CFPaymentModes.NB)
        .add(CFPaymentModes.WALLET)
        .add(CFPaymentModes.PAY_LATER)
        .build();

      const theme = new CFThemeBuilder()
        .setNavigationBarBackgroundColor('#94ee95')
        .setNavigationBarTextColor('#FFFFFF')
        .setButtonBackgroundColor('#FFC107')
        .setButtonTextColor('#FFFFFF')
        .setPrimaryTextColor('#212121')
        .setSecondaryTextColor('#757575')
        .build();

      const dropPayment = new CFDropCheckoutPayment(
        session,
        paymentModes,
        theme,
      );

      // Start background polling for payment status after SDK initialization
      pollingShouldStopRef.current = false;
      const startBackgroundPolling = async () => {
        // Wait 30 seconds before starting polling (give SDK time to work)
        await new Promise(resolve => setTimeout(resolve, 30000));

        if (pollingShouldStopRef.current) return;

        console.log('[OneTime] Starting background payment status polling...');
        setPaymentPollingMessage('Checking payment status...');

        const pollResult = await pollPaymentStatus(paymentId, configData, {
          maxAttempts: 54,
          intervalMs: 5000,
          shouldStop: () => pollingShouldStopRef.current,
          onStatusUpdate: (update) => {
            if (update.attempt % 6 === 0) {
              setPaymentPollingMessage(`Verifying payment... (${Math.round(update.attempt * 5 / 60)} min)`);
            }
          },
        });

        // If polling was stopped by callback, do nothing
        if (pollResult.stopped) {
          console.log('[OneTime] Polling stopped by callback');
          return;
        }

        // Handle poll result
        if (pollResult.status === PaymentStatus.SUCCESS) {
          console.log('[OneTime] Payment confirmed via polling');
          pollingShouldStopRef.current = true;
          await clearPendingPayment();
          setPaymentPollingMessage('');
          handlePaymentSuccessWithTelegram();
          setShowPaymentFail(false);
          setLoading(false);
          handlePaymentVerification(paymentId);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        } else if (pollResult.status === PaymentStatus.FAILED) {
          console.log('[OneTime] Payment failed via polling');
          pollingShouldStopRef.current = true;
          logPayment('CASHFREE_ONETIME_POLL_FAILED', {
            orderId: paymentId,
            cashfreeEnv: cfEnvLabel,
            platform: Platform.OS,
            userEmail,
            mobileNumber,
            advisor: advisorTag,
          }, configData);
          await clearPendingPayment();
          setPaymentPollingMessage('');
          setShowPaymentFail(true);
          setLoading(false);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        } else {
          // Still pending after max attempts
          console.log('[OneTime] Payment still pending after polling');
          setPaymentPollingMessage('');
          setLoading(false);
          Alert.alert(
            'Payment Processing',
            'Your payment is still being processed. We will verify it shortly. Please check your subscription status.',
            [{ text: 'OK' }],
          );
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        }
      };

      try {
        console.log('[OneTime] Initiating Cashfree payment with environment:', cfEnvironment);
        CFPaymentGatewayService.doPayment(dropPayment);

        // Start polling in background after initiating payment
        startBackgroundPolling();
      } catch (sdkError) {
        // doPayment throws synchronously when CashFree's native AAR blocks the
        // build (PRODUCTION install-source check fails on sideloaded APKs —
        // adb install / manual tap via com.google.android.packageinstaller).
        // Stop the background poll (no order was ever opened) and show the
        // actionable "install from Play Store" message instead of leaving the
        // spinner running for the full ~5-min poll. See utils/cashfreeEnv.js.
        pollingShouldStopRef.current = true;
        console.error('[OneTime] SDK doPayment error:', sdkError);
        logPayment('CASHFREE_ONETIME_SDK_ERROR', {
          orderId: paymentId,
          message: sdkError?.message,
          code: sdkError?.code,
          isInstallSourceError: isInstallSourceError(sdkError),
          cashfreeEnv: cfEnvLabel,
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          userEmail,
          mobileNumber,
          advisor: advisorTag,
        }, configData);
        setPaymentPollingMessage('');
        setLoading(false);
        setShowPaymentFail(true);
        CFPaymentGatewayService.removeCallback();
        CFPaymentGatewayService.removeEventSubscriber();
        // Actionable bank-decline / retry guidance (was: only the
        // install-source case got a message; every other decline showed
        // just the generic fail UI, so customers re-tried the same method
        // blindly). describeCashfreeDecline handles install-source +
        // cancel + generic-decline.
        const _d = describeCashfreeDecline(sdkError);
        Alert.alert(_d.title, _d.message);
      }
    } catch (err) {
      setLoading(false);
      setShowPaymentFail(true);
      console.error(
        '[OneTime] Payment initialization failed:',
        err.response?.data || err.message,
      );
      // Surface the failure — a silent catch here made the "Complete
      // Investment" tap look like a dead button (markup tester, 2026-07-16).
      Alert.alert(
        'Payment could not be started',
        err?.response?.data?.message ||
          "We couldn't start the payment. Please try again — if this keeps happening, contact support.",
      );
    }
  };

  // == Deduplicated Payment Verification Handler ==
  const handlePaymentVerification = async orderID => {
    console.log('this hit00000000', orderID);
    try {
      const verificationResponse = await axios.get(
        `${server.server.baseUrl}api/cashfree`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          params: { orderId: orderID },
        },
      );
      const checkPaymentStatus = verificationResponse?.data?.data[0];
      const res = verificationResponse.data?.data[0];
      console.log('Here pay1');
      if (res?.payment_status === 'SUCCESS') {
        let telegramId = '';
        console.log('this hitting-----');
        await CashFreeOneTimePayment({
          paymentDetails: res?.order_id,
          email: userEmail,
          name,
          panNumber,

          mobileNumber,
          countryCode,
          formattedName,
          specificPlan,
          whiteLabelText,
          telegramId,
          advisorTag,
          birthDate,
          invetAmount,
          planDetails,
          configData,
          panCategory: '',
        });
        // Clear pending payment on successful completion
        await clearPendingPayment();
        setLoading(false);
        handlePaymentSuccessWithTelegram();
      } else {
        setLoading(false);
        setShowPaymentFail(true);
      }
    } catch (error) {
      console.error('Verification error:', error, error.data, error.message);
      setShowPaymentFail(true);
    }
  };

  //CF END
  const initiateCashfreeRecurringPayment = async (
    strategyDetails,
    selectedCard,
  ) => {
    try {
      setLoadingmp(true);

      const response = await axios.post(
        `${server.server.baseUrl}api/cashfree/subscription/create/payment`,
        {
          plan_id: strategyDetails?._id,
          user_email: userEmail,
          mobileNumber: mobileNumber,
          name: name,
          appliedCouponId,
          panNumber: panNumber,
          gstNumber: gstNumber || undefined,
          countryCode: countryCode,
          selectedCard: selectedCard,
          redirectSpecificLocation: `${configData?.config?.REACT_APP_WEBSITE_URL}/pricing`,
          advisor: advisorTag,
          birthDate: birthDate,
          telegramId: telegramId,
          capital: invetAmount,
          couponId: appliedCouponId,
        },
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
      setLoadingmp(false);

      // Pass the subscription_session_id RAW — do NOT strip anything.
      // A previous build stripped a trailing "payment" token
      // (.replace(/(payment){1,2}$/, '')), but that suffix is PART of the
      // ID Cashfree issues: the working web (PricingPage.js
      // initiateCashfreeRecurringPayment) passes it untouched to
      // cashfree.subscriptionsCheckout. The strip corrupted the session →
      // Cashfree's hosted checkout rendered its raw error page
      // ("payload: <no value> / errorMessage: no referrer…") instead of
      // the payment UI (alphanomy, 2026-06-12).
      const subsSessionId = response?.data?.data?.subscription_session_id;
      const orderId = response?.data?.data?.order_id;
      const redirectTarget = '_self';
      console.log('response of CF---', response);
      const userInfo = {
        email: userEmail,
        name,
        panNumber,
        mobileNumber,
        countryCode,
        formattedName,
        telegramId,
        birthDate,
        invetAmount,
      };
      await AsyncStorage.multiSet([
        ['specificPlan', JSON.stringify(specificPlan ?? null)],
        ['userInfo', JSON.stringify(userInfo ?? null)],
      ]);
      if (strategyDetails && strategyDetails.type !== 'bespoke') {
        await AsyncStorage.setItem(
          'singleStrategyDetails',
          JSON.stringify(strategyDetails),
        );
      }

      // Save pending payment for recovery
      const pendingPaymentData = createPendingPaymentData({
        orderId: orderId,
        subscriptionId: response?.data?.data?.subscription_id,
        userEmail,
        planId: strategyDetails?._id,
        paymentType: PaymentType.RECURRING,
        amount: strategyDetails?.amount,
        planDetails: strategyDetails,
        userDetails: userInfo,
        digioRequired: isDigioEnabled,
      });
      await savePendingPayment(pendingPaymentData);
      console.log('[CF Recurring] Saved pending payment for recovery:', orderId);

      // Reset polling flag
      pollingShouldStopRef.current = false;

      CFPaymentGatewayService.setCallback({
        onVerify: async subscriptionId => {
          console.log('[CF Recurring] Subscription verified:', subscriptionId);
          pollingShouldStopRef.current = true;
          await clearPendingPayment();
          handlePaymentSuccessWithTelegram();
          handlePaymentComplete('ACTIVE', subscriptionId);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        },
        onError: async (error, subscriptionId) => {
          console.error('[CF Recurring] Payment error:', error);
          logPayment('CASHFREE_RECURRING_ERROR', {
            subscriptionId,
            orderId,
            code: error?.code,
            type: error?.type,
            message: error?.message,
            isInstallSourceError: isInstallSourceError(error),
            cashfreeEnv: String(
              Config.REACT_APP_CASHFREE_ENV || Config.REACT_APP_ENV || 'unknown',
            ),
            platform: Platform.OS,
            osVersion: String(Platform.Version),
            userEmail,
            mobileNumber,
            advisor: advisorTag,
          }, configData);
          pollingShouldStopRef.current = true;

          const isCancellation = error?.code === 'CANCELLED' ||
            error?.code === 'USER_CANCELLED' ||
            error?.message?.includes('cancelled');

          if (isCancellation) {
            await clearPendingPayment();
          }

          setPaymentSuccess(false);
          handlePaymentComplete('FAIL', subscriptionId);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        },
      });

      CFPaymentGatewayService.setEventSubscriber({
        onReceivedEvent: (eventName, map) => {
          console.log('[CF Recurring] Event:', eventName, map);
        },
      });

      const subscriptionId = response?.data?.data?.subscription_id;
      console.log('End of this--', subsSessionId, orderId);
      const session = new CFSubscriptionSession(
        subsSessionId,
        subscriptionId,
        getCashfreeEnvironment(),
      );

      CFPaymentGatewayService.doSubscriptionPayment(session);
    } catch (err) {
      // doSubscriptionPayment throws synchronously on the same native
      // install-source block as the one-time path. Surface the actionable
      // Play-Store message rather than a generic "Failed to initialize".
      setLoadingmp(false);
      const _d = describeCashfreeDecline(err);
      Alert.alert(_d.title, _d.message);
      console.error('[CF Recurring] Payment failed to initialize:', err?.message, err.response);
    }
  };

  // ============================================================================
  // PAYU PAYMENT FUNCTIONS
  // ============================================================================

  const initiatePayUPayment = async (plandata, amount) => {
    console.log('[PayU] Initiating one-time payment:', {
      amount,
      plan_id: plandata?._id,
      user_email: userEmail,
      name,
      phone: mobileNumber,
    });

    try {
      setLoading(true);

      const response = await createPayUOrder({
        amount,
        user_email: userEmail,
        name,
        phone: mobileNumber,
        plan_id: plandata?._id,
        duration: oneTimeDurationPlan || 30,
        couponId: appliedCouponId,
        productinfo: plandata?.name || 'Subscription',
        countryCode,
        panNumber,
        birthDate,
        telegramId,
        capital: invetAmount,
        configData,
      });

      console.log('[PayU] Order created:', response);

      // Backend guard refusals (e.g. the CVL pre-payment KYC gate in
      // aq_backend Routes/PayU/PayU.js) come back as HTTP 200 with
      // `{status: false, message}` via _RS.apiNew (no `success`/`error`
      // fields), so the generic throw below would discard the
      // customer-relevant message. Surface it directly.
      if (response?.status === false) {
        console.error('[PayU] Order create refused:', response?.message);
        Alert.alert(
          'Payment could not be started',
          response?.message || 'Please try again in a moment.',
        );
        setLoading(false);
        return;
      }

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create PayU order');
      }

      // Save pending payment for recovery
      const pendingPaymentData = createPendingPaymentData({
        orderId: response.data.txnid,
        userEmail,
        planId: plandata?._id,
        paymentType: PaymentType.ONE_TIME,
        amount,
        planDetails: plandata,
        userDetails: {
          name,
          email: userEmail,
          pan: panNumber,
          phone: mobileNumber,
          countryCode,
        },
        digioRequired: isDigioEnabled,
        gateway: 'payu',
      });
      await savePendingPayment(pendingPaymentData);
      console.log('[PayU] Saved pending payment for recovery:', response.data.txnid);

      // Set form data and open WebView
      setPayuFormData(response);
      setPayuIsSI(false);
      setShowPayUWebView(true);
      setLoading(false);

    } catch (error) {
      console.error('[PayU] Payment initiation error:', error);
      setLoading(false);
      Alert.alert(
        'Payment Error',
        error?.message || 'Failed to initialize payment. Please try again.',
      );
    }
  };

  const initiatePayUSIPayment = async (plandata, frequency) => {
    console.log('[PayU SI] Initiating recurring payment:', {
      frequency,
      plan_id: plandata?._id,
      user_email: userEmail,
      name,
      phone: mobileNumber,
    });

    try {
      setLoadingmp(true);

      const amount = plandata?.pricing?.[frequency] || 0;

      const response = await registerPayUSI({
        amount,
        user_email: userEmail,
        name,
        phone: mobileNumber,
        plan_id: plandata?._id,
        frequency,
        duration: 12,
        productinfo: plandata?.name || 'Subscription',
        countryCode,
        panNumber,
        birthDate,
        telegramId,
        capital: invetAmount,
        couponId: appliedCouponId,
        configData,
      });

      console.log('[PayU SI] SI registration response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to register PayU SI');
      }

      // Save pending payment for recovery
      const pendingPaymentData = createPendingPaymentData({
        orderId: response.data.txnid,
        subscriptionId: response.data.udf2,
        userEmail,
        planId: plandata?._id,
        paymentType: PaymentType.RECURRING,
        amount,
        planDetails: plandata,
        userDetails: {
          name,
          email: userEmail,
          pan: panNumber,
          phone: mobileNumber,
          countryCode,
        },
        digioRequired: isDigioEnabled,
        gateway: 'payu',
        frequency,
      });
      await savePendingPayment(pendingPaymentData);
      console.log('[PayU SI] Saved pending payment for recovery:', response.data.txnid);

      // Set form data and open WebView
      setPayuFormData(response);
      setPayuIsSI(true);
      setShowPayUWebView(true);
      setLoadingmp(false);

    } catch (error) {
      console.error('[PayU SI] SI initiation error:', error);
      setLoadingmp(false);
      Alert.alert(
        'Payment Error',
        error?.message || 'Failed to initialize recurring payment. Please try again.',
      );
    }
  };

  const handlePayUSuccess = async (txnid, callbackDetails) => {
    console.log('[PayU] Payment success callback:', { txnid, callbackDetails });

    try {
      setLoading(true);
      setShowPayUWebView(false);

      const verifyResult = await verifyPayUPayment(txnid, configData);
      console.log('[PayU] Verification result:', verifyResult);

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Payment verification failed');
      }

      const paymentStatus = verifyResult.transaction?.status?.toLowerCase();
      if (paymentStatus !== 'success' && paymentStatus !== 'captured') {
        throw new Error(`Payment status: ${paymentStatus}. Please contact support.`);
      }

      if (payuIsSI) {
        await PayUSIPayment({
          paymentDetails: txnid,
          email: userEmail,
          name,
          panNumber,
          mobileNumber,
          countryCode,
          specificPlan: plandata,
          telegramId,
          birthDate,
          invetAmount,
          singleStrategyDetails: strategyDetails,
          selectedCard,
          panCategory: userDetails?.panCategory,
          couponId: appliedCouponId,
          configData,
        });
      } else {
        await PayUOneTimePayment({
          paymentDetails: txnid,
          email: userEmail,
          name,
          panNumber,
          mobileNumber,
          countryCode,
          specificPlan: plandata,
          telegramId,
          birthDate,
          invetAmount,
          singleStrategyDetails: strategyDetails,
          oneTimeDurationPlan,
          onetimeamount,
          panCategory: userDetails?.panCategory,
          couponId: appliedCouponId,
          configData,
        });
      }

      await clearPendingPayment();

      await logPayment('PAYMENT_SUCCESS', {
        amount: payuIsSI ? plandata?.pricing?.[selectedCard] : onetimeamount,
        clientName: name,
        email: userEmail,
        plan: plandata?.name,
        phoneNumber: mobileNumber,
        panNumber,
        countryCode: countryCode || '+91',
        gateway: 'payu',
        paymentType: payuIsSI ? 'recurring' : 'onetime',
      });

      setLoading(false);

      handlePaymentSuccessWithTelegram();

    } catch (error) {
      console.error('[PayU] Payment completion error:', error);
      setLoading(false);
      setShowPaymentFail(true);
      setPaymentSuccess(false);
      Alert.alert(
        'Payment Error',
        error?.message || 'Payment verification failed. Please contact support.',
      );
    }
  };

  const handlePayUFailure = async (error) => {
    console.log('[PayU] Payment failure:', error);

    setShowPayUWebView(false);
    setLoading(false);
    setLoadingmp(false);

    await clearPendingPayment();

    setShowPaymentFail(true);
    setPaymentSuccess(false);

    await logPayment('PAYMENT_FAILED', {
      error: error || 'Payment cancelled or failed',
      clientName: name,
      email: userEmail,
      plan: plandata?.name,
      gateway: 'payu',
    });

    const _d = describeCashfreeDecline(
      typeof error === 'string' ? {message: error} : error,
    );
    Toast.show({
      type: 'error',
      text1: _d.title,
      text2: _d.message,
      visibilityTime: 6000,
    });
  };

  // END PAYU PAYMENT FUNCTIONS

  const handlePaymentType = async () => {
    if (payu) {
      if (selectedPlanType === 'recurring') {
        initiatePayUSIPayment(plandata, selectedCard);
      } else {
        initiatePayUPayment(plandata, onetimeamount);
      }
    } else if (cashfree) {
      if (selectedPlanType === 'recurring') {
        initiateCashfreeRecurringPayment(plandata, selectedCard, inputValue);
      } else {
        console.log('this');
        initiateCashfreePayment(plandata, onetimeamount);
      }
    } else {
      handlePayment();
    }
  };

  const updateLeadUser = async () => {
    const date = new Date().toISOString();
    const planName = specificPlan?.name;

    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/all-users/lead_user`,
        {
          name: name,
          email: userEmail,
          planName,
          pan: panNumber,
          date,
          phone: String(mobileNumber),
          dateOfBirth: birthDate,
          telegram: telegramId,
        },
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

      if (response.data.success) {
        return response.data;
      } else {
        console.warn('Update failed:', response.data.message);
        return null;
      }
    } catch (error) {
      console.error('Error updating lead user:', error.message);
      return null;
    }
  };

  // Authoritative Digio-completion check — mirrors the web app
  // (prod-alphaquark-github PricingPage.js handleOk → checkUserDigioVerification
  // / checkPlanDigioStatus). The app previously trusted the locally-cached
  // advisorSpecificUserDetails.digio_verification flag, which is fetched ONCE
  // on mount via getUser and is (a) undefined during the fetch race, and
  // (b) blind to the per-plan / 10-day-validity / MITC re-sign policies the
  // backend enforces. Result: already-signed users (e.g. pratik@alphaquark.in,
  // 2026-06-18) were re-prompted for Digio in the app even though web correctly
  // SKIPPED — and because they'd already signed, Digio short-circuited after
  // the first OTP ("signature done", no agreement view, no Aadhaar OTP).
  // GET check-digio-status/{email}/{planId} encodes all three policies
  // server-side; needsDigio === false  =>  skip Digio. The planId is appended
  // when available so the per_plan "active subscription for this plan" rule
  // is honoured. See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § Digio skip check.
  const isDigioAlreadyCompleted = async planId => {
    if (!userEmail) return false;
    try {
      const url = planId
        ? `${server.server.baseUrl}api/digio/check-digio-status/${userEmail}/${planId}`
        : `${server.server.baseUrl}api/digio/check-digio-status/${userEmail}`;
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });
      return response?.data?.needsDigio === false;
    } catch (err) {
      // Fallback to the cached flag (old behaviour) so a transient status-API
      // outage doesn't force a genuinely-verified user back through Digio.
      console.error(
        '[Digio] check-digio-status failed, falling back to cached flag:',
        err?.message,
      );
      return advisorSpecificUserDetails?.digio_verification === true;
    }
  };

  const handleDigioPayment = async () => {
    await updateLeadUser();

    if (!isDigioEnabled) {
      console.log('Digio is disabled for this advisor, proceeding to payment');
      handlePaymentType();
      return;
    }

    // Authoritative server-side check (matches web). Replaces the stale cached
    // advisorSpecificUserDetails?.digio_verification guard that re-prompted
    // already-signed users.
    const alreadyCompleted = await isDigioAlreadyCompleted(specificPlan?._id);
    if (alreadyCompleted) {
      console.log('[Digio] Already completed (server check) — skipping Digio');
      handlePaymentType();
      return;
    }

    if (digioCheck === 'beforePayment') {
      openDigioModal();
    } else if (digioCheck === 'afterPayment') {
      handlePaymentType();
    } else {
      handlePaymentType();
    }
  };

  const handlePayment = async () => {
    setLoadingmp(true);
    const sip_amount = invetAmount;

    const formatUserData = () => {
      let formattedCountryCode = null;
      if (countryCode) {
        formattedCountryCode =
          typeof countryCode === 'number'
            ? countryCode
            : parseInt(countryCode.toString().replace('+', ''));
      }

      return {
        email: userEmail,
        phoneNumber: mobileNumber ? parseInt(mobileNumber) : null,
        countryCode: formattedCountryCode,
        telegramId: '',
        userName: name || '',
        profileCompletion: 75,
        advisorName: advisorName,
      };
    };

    try {
      if (isIOS) {
        if (selectedPlanType === 'recurring') {
          await handleIOSSubscription(selectedCard, sip_amount);
        } else {
          await handleIOSOneTimePurchase(onetimeamount);
        }
      } else {
        if (selectedPlanType === 'recurring') {
          await subscribeToPlan(selectedCard, sip_amount);
        } else {
          await handleSinglePayment(onetimeamount);
        }
      }

      let config = {
        method: 'put',
        url: `${server.server.baseUrl}api/user/update/user-details`,
        data: JSON.stringify(formatUserData()),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      await axios.request(config);
      getPlanList();
    } catch (error) {
      console.error('Payment error:', error);
      setLoadingmp(false);
    }
  };

  const getIOSProductId = planName => {
    const planMapping = {
      growth: 'growth',
      prime: 'prime',
      priorRecommendationPlan: 'priorRecommendationPlan',
      advanced: 'advanced',
      ipoEdgeSmeMainboard: 'ipoEdgeSmeMainboard',
      ipoEdge: 'ipoEdge',
    };

    const productKey = planMapping[planName?.toLowerCase()] || 'stockOption';
    const productId = IOS_PRODUCT_IDS[productKey];
    return productId;
  };

  useEffect(() => {
    const initializeIAP = async () => {
      if (!isIOS) return;

      try {
        console.log('Initializing iOS IAP for sandbox testing...');
        const result = await RNIap.initConnection();
        console.log('IAP Connection result:', result);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const productIds = Object.values(IOS_PRODUCT_IDS);
        console.log('Testing product IDs:', productIds);

        const products = await RNIap.getProducts({
          skus: productIds,
        });

        console.log('Available products:', products.length);
        products.forEach(product => {
          console.log(
            `- ${product.productId}: ${product.title} (${product.localizedPrice})`,
          );
        });

        if (products.length === 0) {
          console.warn(
            'No products found - this might be normal for first-time sandbox testing',
          );
        }
      } catch (error) {
        console.error('IAP initialization failed:', error);

        if (error.code === 'E_IAP_NOT_AVAILABLE') {
          console.log(
            'IAP not available - ensure you are on a physical device',
          );
        }
      }
    };

    if (visible) {
      initializeIAP();
    }

    return () => {
      if (isIOS) {
        RNIap.endConnection().catch(console.error);
      }
    };
  }, [visible]);

  const handleIOSSubscription = async (frequency, amount) => {
    try {
      await RNIap.initConnection();

      const products = await RNIap.getSubscriptions({
        skus: [`${formattedName}_${frequency}`],
      });

      if (products.length === 0) {
        throw new Error('No subscription products available');
      }

      await RNIap.requestSubscription({
        sku: products[0].productId,
      });

      const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
        async purchase => {
          console.log('iOS Subscription purchase:', purchase);
          await completeIOSSubscription(purchase, frequency, amount);
        },
      );

      const purchaseErrorSubscription = RNIap.purchaseErrorListener(error => {
        console.error('iOS Subscription error:', error);
        setLoadingmp(false);
        Alert.alert('Purchase Failed', error.message);
      });

      setTimeout(() => {
        purchaseUpdateSubscription?.remove();
        purchaseErrorSubscription?.remove();
      }, 300000);
    } catch (error) {
      console.error('iOS subscription error:', error);
      setLoadingmp(false);
      Alert.alert('Error', 'Could not initialize iOS subscription');
    }
  };

  const completeIOSSubscription = async (purchase, frequency, amount) => {
    try {
      await RNIap.finishTransaction({ purchase, isConsumable: false });

      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription/complete-payment`,
        {
          receipt: purchase.transactionReceipt,
          transactionId: purchase.transactionId,
          productId: purchase.productId,
          plan_id: planDetails._id,
          frequency,
          user_email: userEmail,
          amount,
          advisor: advisorTag,
          name: name,
          birthDate: birthDate,
          capital: invetAmount,
        },
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

      console.log('iOS Subscription completed:', response.data);
      await handlePostPaymentSuccess(response.data, 'subscription');
    } catch (error) {
      console.error('Error completing iOS subscription:', error);
      setLoadingmp(false);
    }
  };

  const handleIOSOneTimePurchase = async amount => {
    try {
      setLoading(true);

      const connectionResult = await RNIap.initConnection();

      const productId = getIOSProductId(specificPlan?.name);

      if (!productId) {
        throw new Error(`No product ID found for plan: ${specificPlan?.name}`);
      }

      const products = await Promise.race([
        RNIap.getProducts({ skus: [productId] }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Product fetch timeout')), 15000),
        ),
      ]);

      if (products.length === 0) {
        throw new Error(`Product not available: ${productId}`);
      }

      const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
        async purchase => {
          const subscriptionResponse = await axios.post(
            `${server.server.baseUrl}api/admin/subscription/one-time-payment/subscription`,
            {
              plan_id: specificPlan?._id,
              user_email: userEmail,
              name: name,
              countryCode: userDetails?.countryCode || '+91',
              panNumber: userDetails?.panNumber,
              mobileNumber: userDetails?.mobileNumber,
              amount: amount,
              advisor: specificPlan?.advisor_email,
              birthDate: userDetails?.birthDate,
              telegramId: userDetails?.telegramId,
              capital: invetAmount,
              duration: oneTimeDurationPlan,

              is_apple_iap: true,
              iap_product_id: purchase?.productId,
              iap_transaction_receipt: purchase?.transactionReceipt,
              iap_transaction_id: purchase?.transactionId,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain':
                  configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            },
          );

          try {
            await completeIOSPurchase(purchase, amount);
          } catch (error) {
            console.error('Error completing purchase:', error);
            setLoading(false);
            Alert.alert('Error', 'Purchase validation failed');
          }
        },
      );

      const purchaseErrorSubscription = RNIap.purchaseErrorListener(error => {
        console.error('Purchase error:', error);
        setLoading(false);

        if (error.code === 'E_USER_CANCELLED') {
          Alert.alert('Purchase Cancelled', 'You cancelled the purchase.');
        } else {
          Alert.alert('Purchase Failed', `Error: ${error.message}`);
        }
      });

      await RNIap.requestPurchase({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      setTimeout(() => {
        purchaseUpdateSubscription?.remove();
        purchaseErrorSubscription?.remove();
      }, 300000);
    } catch (error) {
      console.error('Purchase initialization failed:', error);
      setLoading(false);
      Alert.alert('Error', `Purchase failed: ${error.message}`);
    }
  };

  const completeIOSPurchase = async (purchase, amount) => {
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/apple-iap/ios-purchase/validate`,
        {
          receipt: purchase.transactionReceipt,
          transactionId: purchase.transactionId,
          productId: purchase.productId,
          user_email: userEmail,
          plan_id: specificPlan?._id,
          amount,
          duration: oneTimeDurationPlan,
          advisor_email: specificPlan?.advisor_email,
          is_sandbox: true,
          name: name,
          capital: invetAmount,
        },
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

      console.log('Backend validation successful');

      await RNIap.finishTransaction({
        purchase,
        isConsumable: false,
      });

      console.log('Transaction finished');
      await handlePostPaymentSuccess(response.data, 'onetime');
    } catch (error) {
      console.error('Purchase completion failed:', error);
      setLoadingmp(false);
      Alert.alert(
        'Purchase Validation Failed',
        `Your purchase could not be validated. Transaction ID: ${purchase.transactionId}. Please contact support.`,
      );
    }
  };

  const handlePostPaymentSuccess = async (responseData, paymentType) => {
    try {
      setLoadingmp(false);
      setPaymentModal(false);

      setTimeout(() => {
        handlePaymentSuccessWithTelegram();
      }, 1000);
    } catch (error) {
      console.error('Post-payment success error:', error);
      setLoadingmp(false);
    }
  };

  const addDaysToDate = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString();
  };

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
      bottomOffset: 80,

      text1Style: {
        color: 'black',
        fontSize: 12,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium',
      },

      text2Style: {
        color: 'black',
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
      },
    });
  };

  function calculateNewExpiryDate(currentExpiry, plan) {
    const newExpiry = new Date(currentExpiry);

    if (plan.frequency) {
      switch (plan.frequency) {
        case 'monthly':
          newExpiry.setMonth(newExpiry.getMonth() + 1);
          break;
        case 'quarterly':
          newExpiry.setMonth(newExpiry.getMonth() + 3);
          break;
        case 'yearly':
          newExpiry.setFullYear(newExpiry.getFullYear() + 1);
          break;
        default:
          newExpiry.setMonth(newExpiry.getMonth() + 1);
      }
    } else {
      newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30));
    }

    return newExpiry;
  }

  async function subscribeToPlan(frequency, sip_amount) {
    console.log('Data OF Subs:', frequency, sip_amount, planDetails, userEmail);
    try {
      setLoading(true);
      console.log('API Payload:', {
        plan_id: planDetails?._id,
        frequency,
        user_email: userEmail,
        sip_amount,
        advisor: advisorTag,
        name,
        birthDate,
        capital: invetAmount,
      });

      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription`,
        {
          plan_id: planDetails._id,
          frequency,
          user_email: userEmail,
          sip_amount,
          appliedCouponId,
          advisor: advisorTag,
          name: name,
          panNumber: panNumber,
          telegramId: telegramId,
          birthDate: birthDate,
          capital: invetAmount,
          mobileNumber: mobileNumber,
          countryCode: countryCode,
          couponId: appliedCouponId,
        },
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

      console.log('responseee:', response.data);

      // Backend guard refusals (e.g. the CVL pre-payment KYC gate added to
      // aq_backend SubscriptionRouter POST / on 2026-07-16) come back as
      // HTTP 200 with `{status: false, message}` via _RS.apiNew. Without
      // this check, `response.data.data` is undefined, the property read
      // below throws, and the catch shows only a GENERIC error — discarding
      // the customer-relevant gate message.
      if (response?.data?.status === false) {
        console.error('[Recurring] Subscription create refused:', response?.data?.message);
        Alert.alert(
          'Payment could not be started',
          response?.data?.message || 'Please try again in a moment.',
        );
        setLoading(false);
        setLoadingmp(false);
        return;
      }

      const subscriptionData = response.data.data;
      console.log('Subs data res:', subscriptionData);

      if (subscriptionData.razorpay_subscription_id) {
        let finalAmount = subscriptionData.amount;
        let razorpayPlanId = subscriptionData.razorpay_plan_id;
        if (
          appliedCouponId &&
          subscriptionData?.plan_id?.offer_plans_details?.length > 0
        ) {
          const matchedOffer =
            subscriptionData?.plan_id?.offer_plans_details.find(
              offer => offer.couponId === appliedCouponId,
            );

          if (matchedOffer) {
            console.log('offer matched----', matchedOffer);
            if (matchedOffer.offer_razorpay_plan_ids?.[frequency]) {
              razorpayPlanId = matchedOffer.offer_razorpay_plan_ids[frequency];
            }
            if (matchedOffer.pricing?.[frequency]) {
              finalAmount = matchedOffer.pricing[frequency];
              console.log('final amount---', finalAmount);
            }
          }
        }
        console.log("here razorpay ----", razorpayPlanId,);
        const options = {
          key: razorPayKey,
          subscription_id: subscriptionData?.razorpay_subscription_id,
          name: subscriptionData?.plan_id?.name,
          description: subscriptionData?.plan_id?.description
            ? subscriptionData?.plan_id?.description.slice(0, 200)
            : "",
          amount: finalAmount * 100,
          currency: 'INR',

          prefill: {
            name: '',
            email: userEmail,
          },
          theme: {
            color: '#F37254',
          },
        };

        try {
          const razorpayResponse = await RazorpayCheckout.open(options);
          const paymentResponse = {
            razorpay_payment_id: razorpayResponse?.razorpay_payment_id,
            razorpay_subscription_id: razorpayResponse?.razorpay_subscription_id,
            razorpay_signature: razorpayResponse?.razorpay_signature,
          };
          console.log('Payment Response:', paymentResponse);
          console.log('Razorpay Response:', razorpayResponse);
          if (userId) {
            await completeSubscription(paymentResponse);
          }
        } catch (paymentError) {
          console.log('Payment Error:-------------', paymentError);
          if (paymentError.code === 0) {
            setLoadingmp(false);
            setLoading(false);
            Alert.alert(
              'Payment Cancelled',
              'The payment was cancelled. Please try again.',
            );
          } else {
            Alert.alert(
              'Payment Failed',
              'The payment could not be processed. Please try again.',
            );
          }
        }
      } else {
        setLoadingmp(false);
        Alert.alert('Error', 'Could not initialize payment. Please try again.');
      }
    } catch (error) {
      console.error('Error subscribing to plan:', error.response);
      Alert.alert('Error', 'Could not initialize payment. Please try again.');
      setLoadingmp(false);
      setLoading(false);
    }
  }

  const logPaymentLocal = async (type, data) => {
    try {
      await axios.post(
        `${server.server.baseUrl}api/log-payment`,
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
        {
          type,
          data,
        },
      );
    } catch (error) {
      // console.error("Failed to log payment:", error);
    }
  };

  const getDurationInDays = frequency => {
    switch (frequency) {
      case 'monthly':
        return '30';
      case 'quarterly':
        return '90';
      case 'half-yearly':
        return '180';
      case 'yearly':
        return '365';
      default:
        return '30';
    }
  };

  async function completeSubscription(paymentDetails) {
    console.log('Complete Subs Started', paymentDetails);
    try {
      setLoadingmp(true);
      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription/complete-payment`,
        paymentDetails,
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

      const data = response.data;
      console.log('specific Plan here i get----', specificPlan);
      setIsPostPaymentProcessing(false);
      await logPaymentLocal('SUBSCRIPTION_PAYMENT_SUCCESS', {
        subscriptionId: data.subscription.razorpay_subscription_id,
        amount: specificPlan?.amount,
        clientName: name,
        email: userEmail,
        plan: formattedName,
        planType: specificPlan?.frequency,
        duration:
          specificPlan?.frequency === 'monthly'
            ? '30'
            : specificPlan?.frequency === 'quarterly'
              ? '90'
              : '365',
      });
      console.log('Payment Success');

      setRefresh(prev => !prev);

      const newSubscription = {
        startDate: addISTOffset(new Date()),
        plan: formattedName || '',
        capital: invetAmount || 0,
        charges: data?.subscription?.amount || 0,
        invoice: data?.subscription?.razorpay_subscription_id || '',
        expiry: addISTOffset(data?.subscription?.end_date),
        paymentType: "recurring",
        couponId: appliedCouponId,
      };
      const clientId = userDetails?.clientId || uuid.v4().slice(0, 7);
      const newClientData = {
        clientId: clientId,
        clientName: name || '',
        email: data?.subscription?.user_email?.toLowerCase() || '',
        phone: mobileNumber || '',
        groups: [`All Client`, formattedName],
        location: data.location || '',
        telegram: telegramId || '',
        pan: panNumber || '',
        creationDate: FormatDateTime(new Date()),
        comments: data.comments || '',
        advisorName: advisorTag,
        subscriptions: [
          {
            ...newSubscription,
          },
        ],
      };

      try {
        const response = await fetch(
          `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },

            body: JSON.stringify({
              userId: specificPlanDetails?.adminId,
              DateofBirth: birthDate || '',
              advisorName: advisorTag,
              clientData: newClientData,
              modelPfId: strategyDetails?._id,
            }),
          },
        );
        const result = await response.json();
        console.log('Response for payment :', result);

        await logPaymentLocal('SUBSCRIPTION_CLIENT_ADDED', {
          clientId: newClientData.clientId,
          clientName: newClientData.clientName,
          plan: formattedName,
          subscriptionId: newSubscription.subId,
          subscriptionDetails: {
            startDate: newSubscription.startDate,
            expiry: newSubscription.expiry,
            amount: newSubscription.charges,
          },
        });
      } catch (error) {
        console.error('Error adding client:', error);
        await logPaymentLocal('SUBSCRIPTION_CLIENT_ADD_ERROR', {
          error: error.message,
          clientName: data.subscription.name,
          email: data.subscription.user_email,
        });
      }
      getPlanList();
      getStrategyDetails();
      getAllBespoke();
      getAllSubscriptionData();
      setTimeout(() => {
        console.log('this hit 2--');
        setPaymentSuccess(true);
      }, 1000);
    } catch (error) {
      setLoadingmp(false);
      console.error('Error completing subscription:', error);
      await logPaymentLocal('SUBSCRIPTION_PAYMENT_FAILURE', {
        error: error.message,
        clientName: name,
        email: userEmail,
        amount: specificPlan?.amount,
        plan: formattedName,
        planType: specificPlan?.frequency,
      });
    }
  }

  console.log("Mobile Number---", mobileNumber);
  async function handleSinglePayment(amount) {
    console.log('cog:', amount, planDetails?._id, userEmail);
    try {
      setLoading(true);
      console.log('Payment Payload:', {
        plan_id: planDetails?._id,
        user_email: userEmail,
        amount,
        appliedCouponId,
        advisor: advisorTag,
        name: name,
        panNumber: panNumber,
        mobileNumber: mobileNumber,
        birthDate: birthDate,
        capital: invetAmount,
        telegramId: telegramId,
        countryCode: countryCode,
        duration: oneTimeDurationPlan,
        couponId: appliedCouponId,
      });

      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription/one-time-payment/subscription`,
        {
          plan_id: planDetails?._id,
          user_email: userEmail,
          amount,
          advisor: advisorTag,
          name: name,
          panNumber: panNumber,
          mobileNumber: mobileNumber,
          birthDate: birthDate,
          capital: invetAmount,
          telegramId: telegramId,
          countryCode: countryCode,
          duration: oneTimeDurationPlan,
          couponId: appliedCouponId,
        },
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

      // Backend guard refusals (e.g. the CVL pre-payment KYC gate added to
      // aq_backend SubscriptionRouter POST /one-time-payment/subscription on
      // 2026-07-16) come back as HTTP 200 with `{status: false, message}` via
      // _RS.apiNew. Without this check, `response.data.data` is undefined,
      // the property read below throws, and the catch shows only a GENERIC
      // error — discarding the customer-relevant gate message.
      if (response?.data?.status === false) {
        console.error('[OneTime Razorpay] Order create refused:', response?.data?.message);
        Alert.alert(
          'Payment could not be started',
          response?.data?.message || 'Please try again in a moment.',
        );
        setLoading(false);
        setLoadingmp(false);
        return;
      }

      const paymentData = response.data.data;

      if (paymentData.razorpay_order_id) {
        const options = {
          key: razorPayKey,
          order_id: paymentData.razorpay_order_id,
          name: paymentData.plan_id.name,
          description: paymentData?.plan_id?.description
            ? paymentData.plan_id.description.slice(0, 200)
            : "",
          amount: onetimeamount,
          currency: 'INR',
          prefill: {
            email: userEmail,
            contact: '',
            name: '',
          },
          theme: { color: '#F37254' },
        };

        try {
          console.log('Options:', options);
          const razorpayResponse = await RazorpayCheckout.open(options);
          console.log('Payment Success:', razorpayResponse);

          const paymentResponse = {
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
          };
          console.log('Payment res:', paymentResponse);
          if (userId) {
            console.log('User ID', userId);
            await completeSinglePayment(paymentResponse);
          }
        } catch (paymentError) {
          console.log('Payment Error::::;', paymentError);
          if (paymentError.code === 0) {
            setLoading(false);
            setLoadingmp(false);
            setShowPaymentFail(true);
          } else {
            setLoading(false);
            setShowPaymentFail(true);
            setLoadingmp(false);
            Alert.alert(
              'Payment Failed',
              'The payment could not be processed. Please try again.',
            );
          }
        }
      } else {
        setLoading(false);
        setLoadingmp(false);
        console.error('Error fetching one-time payment data');
        Alert.alert('Error', 'Could not initialize payment. Please try again.');
      }
    } catch (error) {
      setLoading(false);
      setLoadingmp(false);
      console.error('Error initiating one-time payment:', error, error.response);
      Alert.alert(
        'Error',
        'Could not start payment process. Please try again.',
      );
    } finally {
      setLoadingmp(false);
    }
  }

  async function completeSinglePayment(paymentDetails) {
    console.log('Processing Payment:', paymentDetails, specificPlan?._id);
    try {
      const existingPayment = await axios.post(
        `${server.server.baseUrl}api/subscription-check/check-payment-status`,
        {
          ...paymentDetails,
          user_email: userEmail,
          advisor_email: specificPlan?.advisor_email,
          plan_id: specificPlan?._id,
          amount: specificPlan?.amount,
          duration: oneTimeDurationPlan,
          end_date:
            expiryDate ||
            new Date(
              new Date().setDate(
                new Date().getDate() + (oneTimeDurationPlan || 30),
              ),
            ),
          newExpiryDate: expiryDate,
        },
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

      if (existingPayment.data.orderExists) {
        throw new Error('This payment has already been processed');
      }
      let expiryDate;
      let isSubscriptionExtension = false;

      const existingSubscription = await axios.get(
        `${server.server.baseUrl}api/subscription-check/user/${userEmail}/plan/${specificPlan?._id}`,
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
      if (existingSubscription.data.subscription) {
        isSubscriptionExtension = true;
        expiryDate = calculateNewExpiryDate(
          existingSubscription.data.subscription.end_date,
          specificPlan,
        );
      }

      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription/one-time-payment/subscription/complete-one-time-payment`,
        {
          ...paymentDetails,
          user_email: userEmail,
          advisor_email: specificPlan?.advisor_email,
          plan_id: specificPlan?._id,
          amount: onetimeamount,
          duration: oneTimeDurationPlan,
          end_date: addISTOffset(
            expiryDate ||
            new Date(
              new Date().setDate(
                new Date().getDate() + (oneTimeDurationPlan || 30),
              ),
            )),
          newExpiryDate: addISTOffset(expiryDate),
        },
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

      const data = response.data;
      console.log('response 4:', data);
      setIsPostPaymentProcessing(false);
      await logPaymentLocal('PAYMENT_SUCCESS', {
        orderId: data.subscription.razorpay_order_id,
        amount: specificPlan?.amount,
        clientName: name,
        email: userEmail,
        plan: formattedName,
      });
      setPaymentModal(false);

      setTimeout(() => {
        console.log('this hit 3--');
        setPaymentSuccess(true);
      }, 1000);

      if (strategyDetails) {
        let data2 = JSON.stringify({
          userEmail: userEmail,
          model: strategyDetails?.model_name,
          advisor: configData?.config?.REACT_APP_HEADER_NAME,
          model_id: latestRebalance.model_Id,
          userBroker: broker ? broker : '',
          subscriptionAmountRaw: [
            {
              amount: invetAmount,
              dateTime: new Date().toISOString(),
            },
          ],
        });

        let config2 = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
          data: data2,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        };

        axios
          .request(config2)
          .then(response => {
            console.log('response 5:', response);
            getStrategyDetails();
            getPlanList();
          })
          .catch(error => {
            console.log('error 5', error);
          });
      }

      const newSubscription = {
        startDate: new Date(),
        plan: formattedName || '',
        capital: invetAmount || 0,
        charges: data?.subscription?.amount || 0,
        invoice: paymentDetails?.razorpay_order_id || '',
        expiry: addISTOffset(data?.subscription?.end_date),
        couponId: appliedCouponId,
        paymentType: "one-time",
      };

      const clientResponse = await handleClientUpdate(
        isSubscriptionExtension,
        newSubscription,
        specificPlan?.adminId,
        data.subscription,
      );

      console.log('client response i get-----', clientResponse);

      let data2 = JSON.stringify({
        userEmail: userEmail,
        model: strategyDetails?.model_name,
        advisor: configData?.config?.REACT_APP_HEADER_NAME,
        model_id: latestRebalance?.model_Id,
        userBroker: broker ? broker : '',
        subscriptionAmountRaw: [
          {
            amount: invetAmount,
            dateTime: new Date().toISOString(),
          },
        ],
      });

      let config2 = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
        data: data2,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      axios
        .request(config2)
        .then(response => {
          getStrategyDetails();
          getPlanList();
        })
        .catch(error => {
          console.log('error i get insdie 1', error);
        });

      showToast('Payment Successful', 'success', '');
      getStrategyDetails();
      getAllBespoke();
      getPlanList();
      setPaymentModal(false);

      setTimeout(() => {
        console.log('this hit 4--');
        setPaymentSuccess(true);
      }, 1000);
    } catch (error) {
      console.error('Error completing payment:------------1', error);
      console.error('Error completing payment:------------2', error.response);
      await logPaymentLocal('PAYMENT_FAILURE', {
        error: error.message,
        clientName: name,
        email: userEmail,
        amount: specificPlan?.amount,
      });

      throw error;
    }
  }

  async function handleClientUpdate(
    isExtension,
    newSubscription,
    adminId,
    subscriptionData,
  ) {
    const clientData = {
      clientName: name || '',
      email: subscriptionData?.user_email || '',
      phone: mobileNumber || '',
      groups: [`All Client`, formattedName],
      location: '',
      telegram: telegramId || "",
      pan: panNumber || '',
      creationDate: new Date(),
      subscriptions: [newSubscription],
    };

    console.log('Client Data Prepared:', clientData);

    try {
      console.log('Sending request to check client existence...');
      const checkClientResponse = await fetch(
        `${server.ccxtServer.baseUrl}api/add-subscriptions/check-client`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: adminId,
            email: clientData.email,
          }),
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

      console.log(
        'Check client response status:----',
        checkClientResponse.status,
      );
      const checkClientResult = await checkClientResponse.json();
      console.log('Check client result:', checkClientResult);

      await logPaymentLocal('CLIENT_ADDED', {
        clientName: name,
        plan: formattedName,
        subscriptionDetails: newSubscription,
      });

      const requestBody = {
        userId: checkClientResult.clientExists
          ? adminId
          : specificPlan?.adminId,
        DateofBirth: birthDate,
        advisorName: advisorTag,
        clientData: clientData,
        modelPfId: strategyDetails?._id,
      };

      const endpoint = `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`;

      console.log('Sending client data to:', endpoint);
      console.log('Request body (full):', JSON.stringify(requestBody, null, 2));

      const addClientResponse = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });

      console.log('Add client response status:', addClientResponse.status);
      const addClientResult = await addClientResponse.json();
      console.log('Client added response:', addClientResult);
      getPlanList();

      return addClientResult;
    } catch (error) {
      console.error('Error updating client data:-------', error);
      await logPaymentLocal('CLIENT_ADD_FAILURE', {
        error: error.message,
        clientName: name,
        email: subscriptionData?.user_email,
      });
      throw error;
    }
  }

  async function applyCoupon({ couponCode, planId, amount }) {
    console.log('data e need--------------', couponCode, planId, amount);
    if (!couponCode) throw new Error('Coupon code is required');

    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/offers/coupon-check`,
        {
          params: { couponCode, planId, amount },
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

      if (!response.data.success) {
        throw new Error(response.data.message || 'Coupon invalid');
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  const getSelectedAmount = () => {
    if (!selectedCard) return 0;
    if (selectedCard?.startsWith('onetime')) {
      const selectedOption = specificPlan.onetimeOptions.find(
        (opt, idx) => `onetime-${opt.id || idx}` === selectedCard,
      );

      return selectedOption?.amount || 0;
    }

    if (specificPlan?.pricing?.[selectedCard]) {
      return specificPlan.pricing[selectedCard];
    }

    return 0;
  };
  const handleApplyCoupon = async () => {
    setIsApplyingCoupon(true);
    setCouponMessage('');
    console.log('handle hit----', couponCode, specificPlan, selectedCard);
    try {
      const data = await applyCoupon({
        couponCode,
        planId: specificPlan._id,
        amount: selectedCard ? getSelectedAmount() : 0,
      });

      setAppliedCoupon(data);
      setAppliedCouponId(data?.couponId);
      setCouponMessage('Coupon applied successfully!');
      console.log('data==', data);
    } catch (err) {
      setAppliedCoupon(null);
      setAppliedCouponId(null);
      console.log('messa---', err?.response);
      setCouponMessage(
        `${err?.response?.data?.message || 'Failed to apply coupon'}`,
      );
    }

    setIsApplyingCoupon(false);
  };

  let price = '';
  let oldPrice = '';
  let saveText = '';
  let total = '';
  let durationText = '';

  // Common variables
  const gstText = gstLabel(configGst, configGstWithText);
  const hasDiscount = specificPlan?.discountPercentage > 0;

  const displayAmount = (base) => {
    const amt = Number(base || 0);
    return configGst && configGstWithText ? withGst(amt) : amt;
  };
  const paymentAmount = (base) => {
    const amt = Number(base || 0);
    return configGst ? withGst(amt) : amt;
  };

  if (selectedPlanType === 'recurring' && selectedCard) {
    console.log('selected Card here------', selectedCard);
    durationText =
      selectedCard?.charAt(0)?.toUpperCase() + selectedCard?.slice(1);
    const offerDetails = appliedCoupon
      ? specificPlan?.offer_plans_details?.find(
          (detail) => detail.couponId?.toString() === appliedCouponId?.toString(),
        )
      : specificPlan?.offer_plans_details?.[0];

    if (appliedCoupon && offerDetails) {
      const originalRecurringAmount =
        specificPlan?.pricingWithoutGst?.[selectedCard];
      const discountedRecurringAmount = Math?.round(
        offerDetails?.pricingWithoutGst?.[selectedCard],
      );
      oldPrice = `₹${originalRecurringAmount}`;
      price = `₹${displayAmount(discountedRecurringAmount)}${gstText}`;
      saveText = 'Coupon Applied';
      total = price;
      setOneTimeAmount(paymentAmount(discountedRecurringAmount));
    } else if (hasDiscount) {
      const discountedAmount = specificPlan.pricingWithoutGst?.[selectedCard];
      const mrp = Math.round(
        discountedAmount * (100 / (100 - specificPlan.discountPercentage)),
      );
      oldPrice = `₹${mrp}`;
      price = `₹${displayAmount(discountedAmount)}${gstText}`;
      saveText = `${specificPlan.discountPercentage}% OFF`;
      total = price;
      setOneTimeAmount(paymentAmount(discountedAmount));
    } else {
      const recurringAmount = specificPlan.pricingWithoutGst?.[selectedCard];
      oldPrice = '';
      price = `₹${displayAmount(recurringAmount)}${gstText}`;
      saveText = '';
      total = price;
      setOneTimeAmount(paymentAmount(recurringAmount));
    }
  } else {
    const selectedOnetimeOption = specificPlan.onetimeOptions.find(
      (opt, idx) => `onetime-${opt.id || idx}` === selectedCard,
    );

    const originalAmount = Number(
      selectedOnetimeOption?.amountWithoutGst ||
      specificPlan?.onetimeOptions?.[0]?.amountWithoutGst ||
      0,
    );
    const durationInDays =
      selectedOnetimeOption?.duration ||
      specificPlan?.onetimeOptions?.[0]?.duration;

    if (durationInDays) {
      durationText = `${durationInDays} Days`;
    } else {
      durationText = 'One-Time Payment';
    }

    if (appliedCoupon) {
      if (appliedCoupon?.discountType === 'percentage') {
        const discounted = Math.round(
          originalAmount -
          (originalAmount * appliedCoupon?.discountValue) / 100,
        );
        oldPrice = `₹${displayAmount(originalAmount)}${gstText}`;
        price = `₹${displayAmount(discounted)}${gstText}`;
        saveText = `Coupon ${appliedCoupon?.discountValue}% Off`;
        total = price;
        setOneTimeAmount(paymentAmount(discounted));
      } else {
        const discounted = Math.round(
          originalAmount - appliedCoupon?.discountValue,
        );
        oldPrice = `₹${displayAmount(originalAmount)}${gstText}`;
        price = `₹${displayAmount(discounted)}${gstText}`;
        saveText = `Coupon ₹${appliedCoupon?.discountValue} Off`;
        total = price;
        setOneTimeAmount(paymentAmount(discounted));
      }
    } else if (hasDiscount) {
      const mrp = Math.round(
        originalAmount * (1 + specificPlan.discountPercentage / 100),
      );
      oldPrice = `₹${displayAmount(mrp)}${gstText}`;
      price = `₹${displayAmount(originalAmount)}${gstText}`;
      saveText = `${specificPlan.discountPercentage}% OFF`;
      total = price;
      setOneTimeAmount(paymentAmount(originalAmount));
    } else {
      oldPrice = '';
      price = `₹${displayAmount(originalAmount)}${gstText}`;
      saveText = '';
      total = price;
      setOneTimeAmount(paymentAmount(originalAmount));
    }
  }

  const isDisabled =
    ((specificPlan?.frequency?.length > 0 ||
      specificPlan?.onetimeOptions?.length > 0) &&
      !selectedCard) ||
    (specificPlan?.type !== 'bespoke' &&
      !(invetAmount >= specificPlan?.minInvestment));

  // Compute plan type label for presentation
  const planTypeLabel = (planDetails?.type || specificPlan?.type)
    ? (planDetails?.type || specificPlan?.type).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : '';

  // ============================================================================
  // BUILD viewModel + actions
  // ============================================================================
  const viewModel = {
    visible,
    loading,
    loadingmp,
    isStepTransitioning,

    currentStep,
    steps,
    isStepValid,

    gradient1,
    gradient2,
    mainColor,
    stepCompletedColor,
    currentAppVariant,

    planDetails,
    specificPlan,
    planName: planDetails?.name || specificPlan?.name || '',
    planType: planTypeLabel,

    name,
    userEmail,
    mobileNumber,
    telegramId,

    invetAmount,
    panNumber,
    panError,
    isPanValid: panNumber && validatePan(panNumber),
    gstNumber,
    gstError,
    birthDate,
    userDetails,
    isModelPortfolio: specificPlan?.type === 'model portfolio',
    minInvestment: specificPlan?.minInvestment || 0,

    selectedCard,
    selectedPlanType,
    consentChecked,
    showDisclaimer,
    onetimeamount,

    couponCode,
    isApplyingCoupon,
    couponMessage,
    appliedCoupon,

    configGst,
    gstText,
    displayAmount,

    digioModalOpen,
    digioSuccessModal,
    showTelegramModal,
    showPayUWebView,

    authUrl,
    payuFormData,
    payuIsSI,
    whiteLabelText,
    telegramInputValue,
    validateTelegramId,

    // Extra for recurring section coupon logic
    adminpaymentPlatform,
  };

  const actions = {
    onClose,
    onBack: handleBack,
    onStepPress: (index) => setCurrentStep(index),
    onCompleteStep: completeStep,

    onNameChange: setName,
    onMobileNumberChange: setMobileNumber,
    onTelegramIdChange: setTelegramId,

    onInvestAmountChange: setInvestAmount,
    onPanChange: handlePanChange,
    onBirthDateChange: setBirthDate,

    onCardClick: handleCardClick,
    onSetSelectedPlanType: setSelectedPlanType,
    onSetOneTimeAmount: (amt) => setOneTimeAmount(paymentAmount(amt)),
    onSetOneTimeDurationPlan: setOneTimeDurationPlan,
    onConsentToggle: () => setConsentChecked(!consentChecked),
    onShowDisclaimer: () => setShowDisclaimer(true),
    onHideDisclaimer: () => setShowDisclaimer(false),
    onApplyCoupon: handleApplyCoupon,
    onCouponCodeChange: setCouponCode,
    onGstChange: handleGstChange,

    onDigioPayment: handleDigioPayment,

    onDigioModalClose: () => {
      digioPollingShouldStopRef.current = true;
      setDigioModalOpen(false);
    },
    onDigioVerificationComplete: handleDigioSuccess,
    onDigioSuccess: (docId) => {
      console.log('Document signed successfully:', docId);
    },
    onDigioError: (error) => {
      console.error('Digio verification failed:', error);
      digioPollingShouldStopRef.current = true;
      setDigioUnsuccessModal(true);
      setDigioModalOpen(false);
    },
    onDigioSuccessModalClose: () => setDigioSuccessModal(false),
    onDigioSuccessPayment: () => {
      setDigioSuccessModal(false);
      handlePaymentType();
    },
    onTelegramModalClose: () => {
      setShowTelegramModal(false);
      setPaymentSuccess(true);
    },
    onTelegramModalSave: async (id) => {
      await saveTelegramId(id);
      setShowTelegramModal(false);
      setPaymentSuccess(true);
    },
    onTelegramInputChange: setTelegramInputValue,
    onPayUClose: () => {
      setShowPayUWebView(false);
      setPayuFormData(null);
    },
    onPayUSuccess: handlePayUSuccess,
    onPayUFailure: handlePayUFailure,
  };

  return <Presentation viewModel={viewModel} actions={actions} />;
};

export default MPInvestNowModal;
