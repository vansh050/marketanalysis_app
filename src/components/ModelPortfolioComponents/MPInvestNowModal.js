import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  Platform,
  ScrollView,
  FlatList,
  PermissionsAndroid,
  AppState,
} from 'react-native';
import {
  ChevronRight,
  XIcon,
  ChevronDown,
  Check,
  User,
  CreditCard,
  Settings,
  Shield,
  Clock,
  Loader2,
} from 'lucide-react-native';
import * as RNIap from 'react-native-iap';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import uuid from 'react-native-uuid';
import RazorpayCheckout from 'react-native-razorpay';
import DisclaimerModal from './DisclaimerModal';
import APP_VARIANTS from '../../utils/Config';
import RNFS from 'react-native-fs';
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
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
import PayUWebView from '../PayUWebView';
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
import LinearGradient from 'react-native-linear-gradient';
import {
  Digio,
  DigioConfig,
  GatewayEvent,
  ServiceMode,
  Environment,
} from '@digiotech/react-native';
import DigioModal from './DigioModal';
import DigioSuccessModal from './DigioSuccessModal';
import TelegramCollectionModal from './TelegramCollectionModal';
import moment from 'moment';
import DatePickerSection from './DatePickerSection';
import { encode as btoa } from 'base-64';
import { addISTOffset } from '../../utils/dateUtils';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CouponCodeInput = React.memo(
  ({
    couponCode,
    setCouponCode,
    isApplyingCoupon,
    handleApplyCoupon,
    couponMessage,
    appliedCoupon,
    mainColor,
    stepCompletedColor,
  }) => {
    // console.log('This input--');

    const showCouponInput = true;

    const handleChangeCouponCode = useCallback(
      text => {
        setCouponCode(text);
      },
      [setCouponCode],
    );

    if (!showCouponInput) return null;

    return (
      <View style={styles.containerOffer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter Coupon Code"
            value={couponCode}
            onChangeText={handleChangeCouponCode}
            editable={!isApplyingCoupon}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleApplyCoupon}
          />
          <TouchableOpacity
            style={[
              styles.button,
              mainColor && { backgroundColor: mainColor },
              (!couponCode || isApplyingCoupon) && styles.buttonDisabled,
            ]}
            onPress={handleApplyCoupon}
            disabled={!couponCode || isApplyingCoupon}>
            {isApplyingCoupon ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Apply Coupon</Text>
            )}
          </TouchableOpacity>
        </View>

        {couponMessage ? (
          <Text
            style={[
              styles.message,
              appliedCoupon ? [styles.successMessage, {color: stepCompletedColor}] : styles.errorMessage,
            ]}>
            {couponMessage}
          </Text>
        ) : null}
      </View>
    );
  },
);

// Step Progress Component - Web Style
const StepProgressBar = ({ steps, currentStep, currentAppVariant, mainColor }) => {
  const completedSteps = currentStep;
  const progressPercentage = (completedSteps / (steps.length - 1)) * 100;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTitleContainer}>
          <Shield size={16} color={mainColor || '#0056B7'} />
          <Text style={styles.progressTitle}>Progress</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {completedSteps + 1}/3 Complete
          </Text>
        </View>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercentage}%`,
                backgroundColor:
                  currentAppVariant?.paymentModal?.progressBarColor,
              },
            ]}
          />
          <View style={styles.progressBarShine} />
        </View>
      </View>
    </View>
  );
};

// Enhanced Step Card Component
const StepCard = ({
  step,
  isActive,
  isCompleted,
  onPress,
  children,
  currentAppVariant,
  mainColor,
  stepCompletedColor: stepCompletedColorProp,
}) => {
  const getStepIcon = () => {
    const IconComponent = step.icon;
    if (isCompleted) return <Check size={16} color="#fff" />;
    return <IconComponent size={16} color="#fff" />;
  };

  const getStepClasses = () => {
    if (isCompleted) return styles.stepCompleted;
    if (isActive) return styles.stepActive;
    return styles.stepInactive;
  };

  const getCardClasses = () => {
    if (isActive) return styles.stepCardActive;
    if (isCompleted) return styles.stepCardCompleted;
    return styles.stepCardInactive;
  };

  const completedColor = stepCompletedColorProp || currentAppVariant?.paymentModal?.stepCompletedColor || '#29A400';

  return (
    <View style={[styles.stepCard, getCardClasses(), isCompleted && { borderColor: completedColor }, isActive && mainColor && { borderColor: mainColor }]}>
      <TouchableOpacity style={styles.stepHeader} onPress={onPress}>
        <View style={styles.stepHeaderContent}>
          <View
            style={[
              styles.stepIcon,
              isCompleted
                ? {
                  backgroundColor: completedColor,
                }
                : isActive
                  ? {
                    backgroundColor:
                      currentAppVariant?.paymentModal?.stepActiveColor,
                  }
                  : { backgroundColor: '#9ca3af' },
            ]}>
            {getStepIcon()}
          </View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        </View>
        <View style={styles.stepStatus}>
          {isCompleted && (
            <View style={[styles.completedBadge, { backgroundColor: completedColor }]}>
              <Text style={styles.completedText}>✓ Done</Text>
            </View>
          )}
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                { backgroundColor: currentAppVariant?.paymentModal?.accentColor },
              ]}>
              <Text style={styles.activeText}>🔄 In Progress</Text>
            </View>
          )}
          {!isActive && !isCompleted && <Clock size={16} color="#9ca3af" />}
          <ChevronDown
            size={16}
            color="#6b7280"
            style={[styles.chevron, isActive && styles.chevronRotated]}
          />
        </View>
      </TouchableOpacity>
      {isActive && <View style={styles.stepContent}>{children}</View>}
    </View>
  );
};

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
  const { configData } = useTrade();

  // Get dynamic colors from config - use gradient2 as the primary accent color
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0076FB';
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
            // Payment failed, inform user
            Alert.alert(
              'Payment Failed',
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
  // This handles cases where Digio webhook is received but WebView callback doesn't fire
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
  //

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
      // && birthDate;
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

  const completeStep = async stepId => {
    if (isStepTransitioning) return;
    setIsStepTransitioning(true);

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

  //console.log('Speee:',specificPlan);
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
  const [openCouponModal, setOpenCouponModal] = useState(false); // Coupon modal visibility
  const [couponCode, setCouponCode] = useState('');
  //  "rzp_live_BMUkHq76QqWdDR"  "rzp_test_dtjgIYhbGFFwlI" //;

  const getSpecificPlan = () => {
    //   console.log('Specific Model:',specificPlan);
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

  // setLoadingmp(false);
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

  // To track the selected card

  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;

  const [inputValue, setInputValue] = useState('');

  //   console.log('Plan Data:',specificPlan );
  //Payment Start : " "
  const [currentPaymentId, setCurrentPaymentId] = useState(null);
  // Deduplication ref to prevent multiple handling of the same error
  const lastErrorKeyRef = useRef(null);
  // Digio configuration - dynamically configurable per advisor from database
  // Priority: configData.digioCheck > configData.config.REACT_APP_DIGIO_CHECK > Config.REACT_APP_DIGIO_CHECK > 'beforePayment'
  const digioCheck = String(
    configData?.digioCheck ||
    configData?.config?.REACT_APP_DIGIO_CHECK ||
    configData?.config?.digioCheck ||
    Config.REACT_APP_DIGIO_CHECK ||
    'beforePayment'
  );

  // Check if Digio is enabled for this advisor (default: true)
  const isDigioEnabled = configData?.digioEnabled !== false &&
    configData?.config?.REACT_APP_DIGIO_ENABLED !== 'false';

  // Determine authentication method for Digio
  // Priority: Aadhaar takes precedence if enabled, then OTP, default is Aadhaar
  const getInitialAuthMethod = () => {
    const aadhaarEnabled = configData?.aadhaarBasedAuthentication === true ||
      configData?.config?.REACT_APP_AADHAAR_BASED_AUTHENTICATION === 'true';
    const otpEnabled = configData?.otpBasedAuthentication === true ||
      configData?.config?.REACT_APP_OTP_BASED_AUTHENTICATION === 'true';

    // Aadhaar takes precedence if both are enabled or if only aadhaar is enabled
    if (aadhaarEnabled) {
      return 'aadhaar';
    }
    // Use OTP only if aadhaar is not enabled and OTP is enabled
    if (otpEnabled) {
      return 'otp';
    }
    // Default to aadhaar
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
      // openDigio();
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
              // Mark Digio as done FIRST — signing is complete, don't let
              // downstream steps (doc download) prevent the flag from being set.
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

              // Download signed doc (best-effort, doesn't block success flow)
              try {
                await axios.get(
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
                );
                console.log('[Digio] Signed doc downloaded successfully');
              } catch (error) {
                console.error('[Digio] Error downloading signed PDF (non-blocking):', error);
              }

              // Show success modal with anti-drop-off mechanism instead of direct payment
              setDigioSuccessModal(true);
              setLoading(false);
              console.log('this get true----');

              // Clear pending Digio on successful completion
              await clearPendingDigio();
              console.log('[Digio] Cleared pending Digio after successful signature');
            } else {
              // console.log('this opens----');
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
    // Convert ArrayBuffer to base64 string
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
        uri: fileUri, // file://... path, not data: URI
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
        // This catches cases where Digio webhook arrives but WebView callback doesn't fire
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
  /////////////////////////////////////////////////////////

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
        // setPaymentFailed(true);
      }
    } else {
      setPaymentSuccess(false);
      setShowPaymentFail(true);
      setLoadingmp(false);
      onClose();
      // setPaymentFailed(true);
      // Optionally log or notify about payment failure
    }
  };
  // useEffect(() => {
  //   console.log('Setting up Cashfree event and callback handlers');

  //   const onReceivedEvent = (eventName, map) => {
  //     console.log('[Cashfree] Event received:', eventName, map);
  //   };

  //   // Only process first onVerify per orderId
  //   const onVerify = orderId => {
  //     if (handledOrderIdsRef.current.has(orderId)) {
  //       // Already processed, ignore all later repeated calls for same order
  //       return;
  //     }
  //     handledOrderIdsRef.current.add(orderId);
  //     console.log('[Cashfree] Payment verification for orderId:', orderId);
  //     handlePaymentVerification(orderId);
  //   };

  //   // Standard error dedupe (optional)
  //   const lastErrorKeyRef = { current: null };
  //   const onError = (error, orderId) => {
  //     const errorKey =
  //       orderId + '-' + (error?.code || '') + '-' + (error?.message || '');
  //     if (lastErrorKeyRef.current === errorKey) {
  //       return;
  //     }
  //     lastErrorKeyRef.current = errorKey;
  //     setShowPaymentFail(true);
  //     setLoading(false);
  //     console.log(
  //       '[Cashfree] Payment error:',
  //       JSON.stringify(error),
  //       'orderId:',
  //       orderId,
  //     );
  //     console.log(
  //       '[Cashfree] Payment Failed:',
  //       error?.message || 'Payment failed',
  //     );
  //   };

  //   CFPaymentGatewayService.setEventSubscriber({ onReceivedEvent });
  //   CFPaymentGatewayService.setCallback({ onVerify, onError });

  //   return () => {
  //     console.log('Cleaning up Cashfree handlers');
  //     CFPaymentGatewayService.removeCallback();
  //     CFPaymentGatewayService.removeEventSubscriber();
  //     handledOrderIdsRef.current.clear();
  //     lastErrorKeyRef.current = null;
  //   };
  // }, []); // On

  // useEffect(() => {
  //   console.log('[Cashfree] Setup subscription callbacks');

  //   const handled = new Set();
  //   let lastErrorKey = null;

  //   const onReceivedEvent = (evt, map) => {
  //     console.log('[Cashfree] Event:', evt, map);
  //   };

  //   const onVerify = (subscriptionId) => {
  //     if (handled.has(subscriptionId)) return;
  //     handled.add(subscriptionId);
  //     console.log('[Cashfree] Verified subscription:', subscriptionId);
  //     handlePaymentComplete('ACTIVE', subscriptionId);
  //   };

  //   const onError = (error, subscriptionId) => {
  //     const key = subscriptionId + '-' + (error?.code || '') + '-' + (error?.message || '');
  //     if (lastErrorKey === key) return;
  //     lastErrorKey = key;
  //     console.error('[Cashfree] Subscription Error:', error, 'subscriptionId:', subscriptionId);
  //     handlePaymentComplete('FAIL', subscriptionId);
  //   };

  //   CFPaymentGatewayService.setEventSubscriber({ onReceivedEvent });
  //   CFPaymentGatewayService.setCallback({ onVerify, onError });

  //   return () => {
  //     console.log('[Cashfree] Cleanup callbacks');
  //     CFPaymentGatewayService.removeCallback();
  //     CFPaymentGatewayService.removeEventSubscriber();
  //   };
  // }, []);

  const onErrorCountRef = useRef(0);

  // Set up SDK callbacks ONCE per mount

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
      //  console.log('Here pay 2', response);
      const paymentId = response?.data?.subscription?.cashfree_order_id;
      const paymentSessionId = response?.data?.data?.payment_session_id;
      const subscriptionId = response?.data?.subscription?.id;
      if (!paymentId || !paymentSessionId) {
        throw new Error('Missing payment session data from server');
      }

      setCurrentPaymentId(paymentId);

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

      // ✅ Set Cashfree CALLBACK specifically for this payment
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

      // Use environment based on .env configuration
      const cfEnvironment = Config.REACT_APP_ENV === 'production'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;

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
      // This polls the backend to check if payment succeeded, in case callback doesn't fire
      pollingShouldStopRef.current = false;
      const startBackgroundPolling = async () => {
        // Wait 30 seconds before starting polling (give SDK time to work)
        await new Promise(resolve => setTimeout(resolve, 30000));

        if (pollingShouldStopRef.current) return;

        console.log('[OneTime] Starting background payment status polling...');
        setPaymentPollingMessage('Checking payment status...');

        const pollResult = await pollPaymentStatus(paymentId, configData, {
          maxAttempts: 54, // ~4.5 minutes more (total ~5 minutes)
          intervalMs: 5000,
          shouldStop: () => pollingShouldStopRef.current,
          onStatusUpdate: (update) => {
            if (update.attempt % 6 === 0) { // Update message every 30 seconds
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
          await clearPendingPayment();
          setPaymentPollingMessage('');
          setShowPaymentFail(true);
          setLoading(false);
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
        } else {
          // Still pending after max attempts - show message but keep pending payment for later
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

        // Start polling in background after initiating payment (don't await - let it run in parallel with SDK)
        startBackgroundPolling();
      } catch (sdkError) {
        pollingShouldStopRef.current = true;
        console.error('[OneTime] SDK doPayment error:', sdkError);
        setLoading(false);
        setShowPaymentFail(true);
        CFPaymentGatewayService.removeCallback();
        CFPaymentGatewayService.removeEventSubscriber();
      }
    } catch (err) {
      setLoading(false);
      setShowPaymentFail(true);
      console.error(
        '[OneTime] Payment initialization failed:',
        err.response?.data || err.message,
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
        // onClose(); // Let the success modal handle closing or navigation
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

      // 1. Fetch payment session from backend
      const response = await axios.post(
        `${server.server.baseUrl}api/cashfree/subscription/create/payment`,
        {
          plan_id: strategyDetails?._id,
          user_email: userEmail,
          mobileNumber: mobileNumber,
          name: name,
          appliedCouponId,
          panNumber: panNumber,
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

      // 2. Extract session info
      let subsSessionId = response?.data?.data?.subscription_session_id;
      if (typeof subsSessionId === 'string')
        subsSessionId = subsSessionId.replace(/(payment){1,2}$/, '');
      const orderId = response?.data?.data?.order_id;
      const redirectTarget = '_self';
      console.log('response of CF---', response);
      // 3. Save user/session data
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
          // Clear pending payment on success
          await clearPendingPayment();
          handlePaymentSuccessWithTelegram();
          //  setPaymentFailed(false);
          handlePaymentComplete('ACTIVE', subscriptionId);
          CFPaymentGatewayService.removeCallback(); // Optional cleanup
          CFPaymentGatewayService.removeEventSubscriber();
        },
        onError: async (error, subscriptionId) => {
          console.error('[CF Recurring] Payment error:', error);
          pollingShouldStopRef.current = true;

          // Check if user cancelled
          const isCancellation = error?.code === 'CANCELLED' ||
            error?.code === 'USER_CANCELLED' ||
            error?.message?.includes('cancelled');

          if (isCancellation) {
            await clearPendingPayment();
          }

          setPaymentSuccess(false);
          //  setPaymentFailed(true);
          handlePaymentComplete('FAIL', subscriptionId);
          CFPaymentGatewayService.removeCallback(); // Optional cleanup
          CFPaymentGatewayService.removeEventSubscriber();
        },
      });

      CFPaymentGatewayService.setEventSubscriber({
        onReceivedEvent: (eventName, map) => {
          console.log('[CF Recurring] Event:', eventName, map);
        },
      });
      //
      const subscriptionId = response?.data?.data?.subscription_id;
      console.log('End of this--', subsSessionId, orderId);
      // 4. Prepare Cashfree session
      const session = new CFSubscriptionSession(
        subsSessionId,
        subscriptionId,
        CFEnvironment.PRODUCTION, // or CFEnvironment.PRODUCTION on live
      );

      // 5. Start payment
      CFPaymentGatewayService.doSubscriptionPayment(session);

      // (No need for explicit modal or redirectTarget in RN SDK)
    } catch (err) {
      setLoadingmp(false);
      Alert.alert(
        'Error',
        err?.message || 'Failed to initialize payment. Please try again.',
      );
      console.error(
        'Error',
        err?.message || 'Failed to initialize payment. Please try again.',
      );
      console.error('Payment failed to initialize:', err.response);
    }
  };

  //END CF RECURRING

  // ============================================================================
  // PAYU PAYMENT FUNCTIONS
  // ============================================================================

  /**
   * Initiate PayU one-time payment
   * Creates order and opens WebView for payment
   */
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

      // Create PayU order via backend
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

  /**
   * Initiate PayU Standing Instructions (recurring) payment
   * Creates SI mandate and opens WebView for payment
   */
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

      // Register PayU Standing Instructions via backend
      const response = await registerPayUSI({
        amount,
        user_email: userEmail,
        name,
        phone: mobileNumber,
        plan_id: plandata?._id,
        frequency,
        duration: 12, // Default 12 billing cycles
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
        subscriptionId: response.data.udf2, // SI subscription ID stored in udf2
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

  /**
   * Handle PayU payment success callback from WebView
   */
  const handlePayUSuccess = async (txnid, callbackDetails) => {
    console.log('[PayU] Payment success callback:', { txnid, callbackDetails });

    try {
      setLoading(true);
      setShowPayUWebView(false);

      // Verify payment with backend
      const verifyResult = await verifyPayUPayment(txnid, configData);
      console.log('[PayU] Verification result:', verifyResult);

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Payment verification failed');
      }

      const paymentStatus = verifyResult.transaction?.status?.toLowerCase();
      if (paymentStatus !== 'success' && paymentStatus !== 'captured') {
        throw new Error(`Payment status: ${paymentStatus}. Please contact support.`);
      }

      // Complete the payment based on type
      if (payuIsSI) {
        // Recurring payment completion
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
        // One-time payment completion
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

      // Clear pending payment on success
      await clearPendingPayment();

      // Log payment success
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

      // Handle success with Telegram collection if needed
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

  /**
   * Handle PayU payment failure callback from WebView
   */
  const handlePayUFailure = async (error) => {
    console.log('[PayU] Payment failure:', error);

    setShowPayUWebView(false);
    setLoading(false);
    setLoadingmp(false);

    // Clear pending payment on explicit cancellation
    await clearPendingPayment();

    setShowPaymentFail(true);
    setPaymentSuccess(false);

    // Log payment failure
    await logPayment('PAYMENT_FAILED', {
      error: error || 'Payment cancelled or failed',
      clientName: name,
      email: userEmail,
      plan: plandata?.name,
      gateway: 'payu',
    });

    Toast.show({
      type: 'error',
      text1: 'Payment Failed',
      text2: error || 'Payment was cancelled or failed. Please try again.',
    });
  };

  // END PAYU PAYMENT FUNCTIONS

  const handlePaymentType = async () => {
    if (payu) {
      // PayU payment flow
      if (selectedPlanType === 'recurring') {
        initiatePayUSIPayment(plandata, selectedCard);
      } else {
        initiatePayUPayment(plandata, onetimeamount);
      }
    } else if (cashfree) {
      // Cashfree payment flow
      if (selectedPlanType === 'recurring') {
        initiateCashfreeRecurringPayment(plandata, selectedCard, inputValue);
      } else {
        console.log('this');
        initiateCashfreePayment(plandata, onetimeamount);
      }
    } else {
      // Razorpay payment flow (default)
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

  const handleDigioPayment = async () => {
    await updateLeadUser();

    // If Digio is disabled for this advisor, skip Digio entirely
    if (!isDigioEnabled) {
      console.log('Digio is disabled for this advisor, proceeding to payment');
      handlePaymentType();
      return;
    }

    // If user already has Digio verification, skip Digio
    if (advisorSpecificUserDetails?.digio_verification === true) {
      handlePaymentType();
      return;
    }

    // Check Digio timing configuration: 'beforePayment' or 'afterPayment'
    if (digioCheck === 'beforePayment') {
      // Digio verification before payment
      openDigioModal();
    } else if (digioCheck === 'afterPayment') {
      // Digio verification after payment - proceed to payment first
      // Digio will be triggered after successful payment
      handlePaymentType();
    } else {
      // Default: proceed to payment
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
        // iOS: Use Apple In-App Purchase
        if (selectedPlanType === 'recurring') {
          await handleIOSSubscription(selectedCard, sip_amount);
        } else {
          await handleIOSOneTimePurchase(onetimeamount);
        }
      } else {
        // Android: Use existing Razorpay flow
        if (selectedPlanType === 'recurring') {
          await subscribeToPlan(selectedCard, sip_amount);
        } else {
          await handleSinglePayment(onetimeamount);
        }
      }

      // Update user details regardless of platform
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
      // Add your actual plan names here
    };

    const productKey = planMapping[planName?.toLowerCase()] || 'stockOption';

    const productId = IOS_PRODUCT_IDS[productKey];

    return productId;
  };

  // Enhanced initialization with better error handling
  useEffect(() => {
    const initializeIAP = async () => {
      if (!isIOS) return;

      try {
        console.log('🍎 Initializing iOS IAP for sandbox testing...');

        // Initialize connection
        const result = await RNIap.initConnection();
        console.log('IAP Connection result:', result);

        // Wait a moment for connection to establish
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test product availability
        const productIds = Object.values(IOS_PRODUCT_IDS);
        console.log('Testing product IDs:', productIds);

        const products = await RNIap.getProducts({
          skus: productIds,
        });

        console.log('✅ Available products:', products.length);
        products.forEach(product => {
          console.log(
            `- ${product.productId}: ${product.title} (${product.localizedPrice})`,
          );
        });

        if (products.length === 0) {
          console.warn(
            '⚠️ No products found - this might be normal for first-time sandbox testing',
          );
        }
      } catch (error) {
        console.error('❌ IAP initialization failed:', error);

        if (error.code === 'E_IAP_NOT_AVAILABLE') {
          console.log(
            '💡 IAP not available - ensure you are on a physical device',
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

  // iOS In-App Purchase handlers
  const handleIOSSubscription = async (frequency, amount) => {
    try {
      // Initialize IAP connection
      await RNIap.initConnection();

      // Get available products from App Store
      const products = await RNIap.getSubscriptions({
        skus: [`${formattedName}_${frequency}`], // e.g., "premium_monthly"
      });

      if (products.length === 0) {
        throw new Error('No subscription products available');
      }

      // Request subscription purchase
      await RNIap.requestSubscription({
        sku: products[0].productId,
      });

      // Listen for purchase updates
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

      // Cleanup listeners after use
      setTimeout(() => {
        purchaseUpdateSubscription?.remove();
        purchaseErrorSubscription?.remove();
      }, 300000); // 5 minutes timeout
    } catch (error) {
      console.error('iOS subscription error:', error);
      setLoadingmp(false);
      Alert.alert('Error', 'Could not initialize iOS subscription');
    }
  };

  // Complete iOS subscription
  const completeIOSSubscription = async (purchase, frequency, amount) => {
    try {
      // Finish the transaction
      await RNIap.finishTransaction({ purchase, isConsumable: false });

      // Validate receipt with your backend
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

      // Continue with your existing success flow
      await handlePostPaymentSuccess(response.data, 'subscription');
    } catch (error) {
      console.error('Error completing iOS subscription:', error);
      setLoadingmp(false);
    }
  };

  const handleIOSOneTimePurchase = async amount => {
    try {
      // console.log('🛒 Starting iOS IAP process...');
      setLoading(true);

      // Initialize IAP connection
      const connectionResult = await RNIap.initConnection();
      // console.log('IAP Connection:', connectionResult);

      const productId = getIOSProductId(specificPlan?.name);
      // console.log(`Product ID: ${productId} for plan: ${specificPlan?.name}`);

      if (!productId) {
        throw new Error(`No product ID found for plan: ${specificPlan?.name}`);
      }

      // Get products with timeout
      // console.log('Fetching products...');
      const products = await Promise.race([
        RNIap.getProducts({ skus: [productId] }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Product fetch timeout')), 15000),
        ),
      ]);

      // console.log('Available products:', products);

      if (products.length === 0) {
        throw new Error(`Product not available: ${productId}`);
      }

      // Set up purchase listeners
      const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
        async purchase => {
          // console.log('✅ Purchase successful:', purchase);
          const subscriptionResponse = await axios.post(
            `${server.server.baseUrl}api/admin/subscription/one-time-payment/subscription`,
            {
              // Required fields
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

              // Apple IAP specific fields - initially empty, will be updated after purchase
              is_apple_iap: true,
              iap_product_id: purchase?.productId, // Set the expected product ID
              iap_transaction_receipt: purchase?.transactionReceipt, // Will be filled after purchase
              iap_transaction_id: purchase?.transactionId, // Will be filled after purchase
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

          // console.log(
          //   '✅ Subscription record created:',
          //   subscriptionResponse.data,
          // );
          try {
            await completeIOSPurchase(purchase, amount);
          } catch (error) {
            console.error('❌ Error completing purchase:', error);
            setLoading(false);
            Alert.alert('Error', 'Purchase validation failed');
          }
        },
      );

      const purchaseErrorSubscription = RNIap.purchaseErrorListener(error => {
        console.error('❌ Purchase error:', error);
        setLoading(false);

        if (error.code === 'E_USER_CANCELLED') {
          Alert.alert('Purchase Cancelled', 'You cancelled the purchase.');
        } else {
          Alert.alert('Purchase Failed', `Error: ${error.message}`);
        }
      });

      // Request purchase
      // console.log('🛒 Requesting purchase...');
      await RNIap.requestPurchase({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      // Clean up listeners after timeout
      setTimeout(() => {
        purchaseUpdateSubscription?.remove();
        purchaseErrorSubscription?.remove();
      }, 300000);
    } catch (error) {
      console.error('💥 Purchase initialization failed:', error);
      setLoading(false);
      Alert.alert('Error', `Purchase failed: ${error.message}`);
    }
  };

  const completeIOSPurchase = async (purchase, amount) => {
    try {
      // console.log('🔄 Processing purchase:', purchase);

      // Validate with your backend
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
          // is_sandbox: __DEV__,
          is_sandbox: true,
          // Additional data
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

      console.log('✅ Backend validation successful');

      // Finish the transaction ONLY after successful validation
      await RNIap.finishTransaction({
        purchase,
        isConsumable: false,
      });

      console.log('✅ Transaction finished');

      // Continue with success flow
      await handlePostPaymentSuccess(response.data, 'onetime');
    } catch (error) {
      console.error('❌ Purchase completion failed:', error);
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

  // Function to add days to a date and return ISO string
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
      visibilityTime: 4000, // Duration the toast is visible
      autoHide: true,
      topOffset: 60, // Adjust this value to position the toast
      bottomOffset: 80,

      text1Style: {
        color: 'black',
        fontSize: 12,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium', // Customize your font
      },

      text2Style: {
        color: 'black',
        fontSize: 13,
        fontFamily: 'Poppins-Regular', // Customize your font
      },
    });
  };

  function calculateNewExpiryDate(currentExpiry, plan) {
    const newExpiry = new Date(currentExpiry);

    if (plan.frequency) {
      // For recurring subscriptions
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
          newExpiry.setMonth(newExpiry.getMonth() + 1); // Default to monthly
      }
    } else {
      // For one-time payments
      // Add the plan duration (assuming it's in days)
      newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30)); // Default to 30 days if not specified
    }

    return newExpiry;
  }
  async function subscribeToPlan(frequency, sip_amount) {
    console.log('Data OF Subs:', frequency, sip_amount, planDetails, userEmail);
    try {
      setLoading(true);
      // Fetch subscription details from the backend
      console.log('API Payload:', {
        plan_id: planDetails?._id, // Using optional chaining ?. is a good practice
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
      // setLoading(false);

      const subscriptionData = response.data.data;
      console.log('Subs data res:', subscriptionData);
      // console.log(subscriptionData, "subscriptionData");

      if (subscriptionData.razorpay_subscription_id) {
        // Initialize Razorpay with the subscription details
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
          key: razorPayKey, // Your Razorpay Key ID
          subscription_id: subscriptionData?.razorpay_subscription_id, // The subscription ID from Razorpay
          name: subscriptionData?.plan_id?.name, // Plan or product name
          description: subscriptionData?.plan_id?.description
            ? subscriptionData?.plan_id?.description.slice(0, 200)
            : "",// Description of the plan
          amount: finalAmount * 100, // Amount in smallest unit (paise for INR)
          currency: 'INR', // Currency (e.g., INR)

          prefill: {
            name: '', // User's name
            email: userEmail, // User's email
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
            // setIsPostPaymentProcessing(true);
            await completeSubscription(paymentResponse);
          }
        } catch (paymentError) {
          console.log('Payment Error:-------------', paymentError);
          if (paymentError.code === 0) {
            setLoadingmp(false);
            // User cancelled the payment
            setLoading(false);
            Alert.alert(
              'Payment Cancelled',
              'The payment was cancelled. Please try again.',
            );
          } else {
            //  setLoading(false);
            // Payment failed
            Alert.alert(
              'Payment Failed',
              'The payment could not be processed. Please try again.',
            );
          }
        }
      } else {
        //  console.error("Error fetching one-time payment data");
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

  const logPayment = async (type, data) => {
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
        return '30'; // default fallback
    }
  };
  // console.log('now i get loading--',loadingmp);
  async function completeSubscription(paymentDetails) {
    console.log('Complete Subs Started', paymentDetails);
    try {
      setLoadingmp(true);
      // Send payment details to the backend to finalize the subscription
      const response = await axios.post(
        `${server.server.baseUrl}api/admin/subscription/complete-payment`,
        paymentDetails, // <--- This is the request body
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
      // console.log('data here i get----', data);
      console.log('specific Plan here i get----', specificPlan);
      setIsPostPaymentProcessing(false);
      await logPayment('SUBSCRIPTION_PAYMENT_SUCCESS', {
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
        plan: formattedName || '', // Assuming the response contains a plan
        capital: invetAmount || 0, // Assuming the response contains capital
        charges: data?.subscription?.amount || 0, // Assuming the response contains charges
        invoice: data?.subscription?.razorpay_subscription_id || '', // Assuming the response contains invoice
        expiry: addISTOffset(data?.subscription?.end_date), // Assuming the response contains expiry date
        paymentType: "recurring",
        couponId: appliedCouponId,
      };
      const clientId = userDetails?.clientId || uuid.v4().slice(0, 7);
      const newClientData = {
        clientId: clientId,
        clientName: name || '', // Assuming the response contains a client name
        email: data?.subscription?.user_email?.toLowerCase() || '', // Assuming the response contains an email
        phone: mobileNumber || '', // Assuming the response contains a phone number
        groups: [`All Client`, formattedName], // Add formatted name dynamically
        location: data.location || '', // Assuming the response contains a location
        telegram: telegramId || '', // Assuming the response contains a Telegram ID
        pan: panNumber || '', // Assuming the response contains a PAN number
        creationDate: FormatDateTime(new Date()), // Current date
        comments: data.comments || '',
        advisorName: advisorTag, // Assuming the response contains comments
        subscriptions: [
          {
            ...newSubscription, // Attach the new subscription here
          },
        ],
      };

      try {
        // Send a POST request to add the new client
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

        await logPayment('SUBSCRIPTION_CLIENT_ADDED', {
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
        await logPayment('SUBSCRIPTION_CLIENT_ADD_ERROR', {
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
      }, 1000); // 1000 milliseconds = 1 second
    } catch (error) {
      setLoadingmp(false);
      console.error('Error completing subscription:', error);
      await logPayment('SUBSCRIPTION_PAYMENT_FAILURE', {
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
      // Fetch one-time payment details from the backend
      console.log('🔍 Payment Payload:', {
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
          //appliedCouponId,
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

      // setLoading(false);
      //  setPaymentModal(false);
      const paymentData = response.data.data;

      // console.log('paymentData----', response.data);
      // console.log('onetime amount ----', onetimeamount);
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
            contact: '', // Add phone number if available
            name: '', // Add name if available
          },
          theme: { color: '#F37254' },
        };

        try {
          console.log('Options:', options);
          const razorpayResponse = await RazorpayCheckout.open(options);
          console.log('Payment Success:', razorpayResponse);

          // Create payment response object similar to web
          const paymentResponse = {
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
          };
          console.log('Payment res:', paymentResponse);
          if (userId) {
            console.log('User ID', userId);
            //setIsPostPaymentProcessing(true);
            await completeSinglePayment(paymentResponse);
          }
        } catch (paymentError) {
          console.log('Payment Error::::;', paymentError);
          if (paymentError.code === 0) {
            // User cancelled the payment
            setLoading(false);

            setLoadingmp(false);
            setShowPaymentFail(true);
          } else {
            // Payment failed
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
      // console.log('existing payment:------',existingPayment);

      if (existingPayment.data.orderExists) {
        throw new Error('This payment has already been processed');
      }
      let expiryDate;
      let isSubscriptionExtension = false;

      // Check for existing subscription with same plan
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
      // console.log('existing subs:',existingSubscription);
      if (existingSubscription.data.subscription) {
        isSubscriptionExtension = true;
        // Calculate new expiry based on existing subscription
        expiryDate = calculateNewExpiryDate(
          existingSubscription.data.subscription.end_date,
          specificPlan,
        );
      }

      // Complete payment with backend
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
      await logPayment('PAYMENT_SUCCESS', {
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
      }, 1000); // 1000 milliseconds = 1 second

      //  console.log('WHy i am here1:', latestRebalance, strategyDetails);
      if (strategyDetails) {
        //   console.log('WHy i am here2:', strategyDetails);
        let data2 = JSON.stringify({
          userEmail: userEmail,
          model: strategyDetails?.model_name,
          advisor: strategyDetails?.advisor,
          model_id: latestRebalance.model_Id,
          userBroker: broker ? broker : '',
          subscriptionAmountRaw: [
            {
              amount: invetAmount,
              dateTime: new Date().toISOString(), // safe on all platforms
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
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        userBroker: broker ? broker : '',
        subscriptionAmountRaw: [
          {
            amount: invetAmount,
            dateTime: new Date().toISOString(), // safe on all platforms
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
      }, 1000); // 1000 milliseconds = 1 second
    } catch (error) {
      console.error('Error completing payment:------------1', error);
      console.error('Error completing payment:------------2', error.response);
      await logPayment('PAYMENT_FAILURE', {
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

      await logPayment('CLIENT_ADDED', {
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
      await logPayment('CLIENT_ADD_FAILURE', {
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

      return response.data; // coupon data on success
    } catch (error) {
      throw error;
    }
  }

  const getSelectedAmount = () => {
    if (!selectedCard) return 0;
    //  console.log('selected card i get---', selectedCard);
    // If onetime option selected
    //  console.log('stratey details--', specificPlan.onetimeOptions);
    if (selectedCard?.startsWith('onetime')) {
      const selectedOption = specificPlan.onetimeOptions.find(
        (opt, idx) => `onetime-${opt.id || idx}` === selectedCard,
      );

      return selectedOption?.amount || 0;
    }

    // If recurring plan selected
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
      setCouponMessage('✅ Coupon applied successfully!');
      console.log('data==', data);
    } catch (err) {
      setAppliedCoupon(null);
      setAppliedCouponId(null);
      console.log('messa---', err?.response);
      setCouponMessage(
        `❌ ${err?.response?.data?.message || 'Failed to apply coupon'}`,
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

  // Helper: get display amount (base or GST-inclusive depending on config)
  const displayAmount = (base) => {
    const amt = Number(base || 0);
    return configGst && configGstWithText ? withGst(amt) : amt;
  };
  // Helper: get payment amount (always GST-inclusive when configGst is true)
  const paymentAmount = (base) => {
    const amt = Number(base || 0);
    return configGst ? withGst(amt) : amt;
  };

  // Main Logic: Differentiate between 'recurring' and 'oneTime' plan types
  // This IF statement for recurring plans is correct and remains unchanged.
  if (selectedPlanType === 'recurring' && selectedCard) {
    console.log('selected Card here------', selectedCard);
    // --- RECURRING PLAN LOGIC ---
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

    // 3. Your original discount logic now runs with the CORRECT amount.
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
      // Note: The original price calculation for discount was slightly different. Reverting to your original.
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

  // CORRECTED isDisabled logic to handle both plan types
  const isDisabled =
    // Disable if it's a plan with options and no card has been selected yet
    ((specificPlan?.frequency?.length > 0 ||
      specificPlan?.onetimeOptions?.length > 0) &&
      !selectedCard) ||
    // Also disable if the bespoke investment amount is invalid
    (specificPlan?.type !== 'bespoke' &&
      !(invetAmount >= specificPlan?.minInvestment));

  const Amounthint = `Amount must be ${specificPlan?.minInvestment}`;

  // Helper for auto-formatting DOB input
  const formatDOBInput = input => {
    // Remove all non-digits
    let cleaned = input.replace(/[^0-9]/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
    let formatted = '';
    if (cleaned.length > 0) {
      formatted += cleaned.slice(0, 2);
      if (cleaned.length > 2) {
        formatted += '/' + cleaned.slice(2, 4);
        if (cleaned.length > 4) {
          formatted += '/' + cleaned.slice(4);
        } else if (cleaned.length === 4) {
          formatted += '/';
        }
      } else if (cleaned.length === 2) {
        formatted += '/';
      }
    }
    return formatted;
  };

  // Function to handle DOB text change
  const handleDOBChange = text => {
    // Determine if user is deleting
    const isDeleting = text.length < prevDOB.length;
    let formatted = text;
    if (!isDeleting) {
      formatted = formatDOBInput(text);
    }
    setBirthDate(formatted);
    setPrevDOB(formatted);
  };

  // Function to handle PAN text change
  const handlePANChange = text => {
    const sanitizedValue = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    setPanNumber(sanitizedValue);
  };

  // console.log("loading true---",loading);
  const renderStepContent = stepId => {
    switch (stepId) {
      case 0:
        return (
          <View style={styles.stepContentContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.enhancedInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.enhancedInput, styles.disabledInput]}
                value={userEmail}
                editable={false}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.enhancedInput}
                value={String(mobileNumber)}
                onChangeText={setMobileNumber}
                placeholder="Enter mobile number"
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Telegram ID
              </Text>
              <TextInput
                style={styles.enhancedInput}
                value={String(telegramId)}
                onChangeText={setTelegramId}
                placeholder="Enter Telegram ID"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <TouchableOpacity
              onPress={() => completeStep(0)}
              disabled={!isStepValid(0) || isStepTransitioning}
              style={[
                styles.stepButton,
                {
                  backgroundColor:
                    currentAppVariant?.paymentModal?.buttonPrimaryBg,
                },
                !isStepValid(0) && styles.stepButtonDisabled,
              ]}>
              {isStepTransitioning ? (
                <Loader2 size={16} color="#fff" style={styles.spinning} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.stepButtonText}>
                    Continue to Investment
                  </Text>
                  <ChevronRight size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContentContainer}>
            {specificPlan?.type === 'model portfolio' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Investment Amount (₹) <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.enhancedInput}
                  value={invetAmount}
                  onChangeText={setInvestAmount}
                  placeholder={`Minimum ₹${specificPlan?.minInvestment}`}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                PAN Number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.enhancedInput,
                  panError
                    ? styles.errorInput
                    : panNumber && validatePan(panNumber)
                      ? [styles.successInput, {borderColor: stepCompletedColor}]
                      : null,
                ]}
                value={panNumber}
                onChangeText={handlePanChange}
                placeholder="Enter PAN (e.g., ABCDE1234F)"
                maxLength={10}
                autoCapitalize="characters"
                placeholderTextColor="#9ca3af"
              />
              {panError && (
                <Text style={styles.errorText}>
                  <XIcon size={12} color="#ef4444" /> {panError}
                </Text>
              )}
              {panNumber && validatePan(panNumber) && (
                <Text style={[styles.successText, {color: stepCompletedColor}]}>
                  <Check size={12} color={stepCompletedColor} /> Valid PAN format
                </Text>
              )}
            </View>

            <DatePickerSection
              birthDate={birthDate}
              setBirthDate={setBirthDate}
              userDetails={userDetails}
            />
            <TouchableOpacity
              onPress={() => completeStep(1)}
              disabled={!isStepValid(1) || isStepTransitioning}
              style={[
                styles.stepButton,
                {
                  backgroundColor:
                    currentAppVariant?.paymentModal?.buttonSecondaryBg,
                },
                !isStepValid(1) && styles.stepButtonDisabled,
              ]}>
              {isStepTransitioning ? (
                <Loader2 size={16} color="#fff" style={styles.spinning} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.stepButtonText}>Continue to Plan</Text>
                  <ChevronRight size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContentContainer}>
            <View style={styles.planGrid}>
              <View style={{ flexDirection: 'column', gap: 8 }}>
                {/* ONETIME OPTIONS */}
                {(planDetails?.planType === 'onetime' ||
                  planDetails?.planType === 'combined') &&
                  Array.isArray(planDetails?.onetimeOptions) &&
                  planDetails.onetimeOptions.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>One-Time Options</Text>
                      <FlatList
                        data={planDetails.onetimeOptions}
                        keyExtractor={(item, index) =>
                          `onetime-${item.id || index}`
                        }
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: 'space-between' }}
                        scrollEnabled={false}
                        renderItem={({ item, index }) => {
                          const originalAmount = Number(item.amountWithoutGst);
                          const discountPercentage =
                            Number(planDetails.discountPercentage) || 0;
                          const isDiscounted =
                            discountPercentage > 0 && originalAmount > 0;

                          const durationText =
                            item.duration > 0
                              ? `${item.duration} ${item.duration === 1 ? 'day' : 'days'
                              }`
                              : 'No Validity';

                          const optionKey = `onetime-${item.id || index}`;
                          const onetimefinal = appliedCoupon
                            ? appliedCoupon.discountType === 'percentage'
                              ? Math.round(
                                item.amount -
                                (item.amount *
                                  appliedCoupon.discountValue) /
                                100,
                              )
                              : Math.round(
                                item.amount - appliedCoupon.discountValue,
                              )
                            : Math.round(item.amount);

                          const isSelected = selectedCard === optionKey;

                          return (
                            <TouchableOpacity
                              style={[
                                styles.cardContainer,
                                isSelected
                                  ? [styles.cardSelected, { borderColor: mainColor }]
                                  : styles.cardUnselected,
                              ]}
                              onPress={() => {
                                setOneTimeAmount(paymentAmount(onetimefinal));
                                handleCardClick(optionKey);
                                if (durationText) {
                                  const numberOnly = parseInt(
                                    durationText.match(/\d+/)?.[0],
                                    10,
                                  );
                                  setOneTimeDurationPlan(numberOnly);
                                }
                                setSelectedPlanType('onetime');
                              }}>
                              <View style={{ alignItems: 'center' }}>
                                {/* Highlight duration at top-right */}
                                <View style={styles.durationBadgeContainer}>
                                  <Text style={styles.durationBadgeText}>
                                    {durationText}
                                  </Text>
                                </View>

                                <Text style={styles.optionLabel}>
                                  {item.label || `Option ${index + 1}`}
                                </Text>

                                <View style={{ alignItems: 'center' }}>
                                  {appliedCoupon ? (
                                    <>
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignContent: 'center',
                                          alignItems: 'center',
                                          alignSelf: 'center',
                                        }}>
                                        <Text style={[styles.lineThroughBlue, { color: mainColor }]}>
                                          ₹{item.amountWithoutGst}
                                        </Text>
                                        <Text style={[[styles.greenPrice, {color: stepCompletedColor}], {color: stepCompletedColor}]}>
                                          ₹
                                          {appliedCoupon.discountType ===
                                            'percentage'
                                            ? Math.round(
                                              item.amountWithoutGst -
                                              (item.amountWithoutGst *
                                                appliedCoupon.discountValue) /
                                              100,
                                            )
                                            : Math.round(
                                              item.amount -
                                              appliedCoupon.discountValue,
                                            )}
                                          {gstText}
                                        </Text>
                                      </View>
                                    </>
                                  ) : isDiscounted ? (
                                    <>
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignContent: 'center',
                                          alignItems: 'center',
                                          alignSelf: 'center',
                                        }}>
                                        <Text style={styles.lineThroughGray}>
                                          ₹
                                          {Math.round(
                                            originalAmount *
                                            (1 + discountPercentage / 100),
                                          )}
                                        </Text>
                                        <Text style={[styles.bluePrice, { color: mainColor }]}>
                                          ₹{displayAmount(item.amountWithoutGst)}{' '}
                                          {gstText}
                                        </Text>
                                      </View>
                                      <Text style={[styles.discountText, {color: stepCompletedColor}]}>
                                        {discountPercentage}% OFF
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={[styles.bluePrice, { color: mainColor }]}>
                                      ₹{displayAmount(item.amountWithoutGst)}{' '}
                                      {gstText}
                                    </Text>
                                  )}
                                </View>

                                <View
                                  style={[
                                    styles.radioButton,
                                    isSelected
                                      ? [styles.radioSelected, { borderColor: mainColor, backgroundColor: mainColor }]
                                      : styles.radioUnselected,
                                  ]}>
                                  {isSelected && (
                                    <Check size={10} color="#fff" />
                                  )}
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        }}
                      />
                    </>
                  )}

                {/* RECURRING OPTIONS */}
                {(planDetails?.planType === 'recurring' ||
                  planDetails?.planType === 'combined') &&
                  (() => {
                    const offerDetails = appliedCoupon
                      ? planDetails.offer_plans_details?.find((detail) => {
                        return (
                          detail.couponId?.toString() === appliedCouponId?.toString()
                        );
                      })
                      : null;


                    const frequency = offerDetails
                      ? Object.keys(
                        cashfree
                          ? offerDetails.offer_cashfree_plan_ids || {}
                          : offerDetails.offer_razorpay_plan_ids || {},
                      )
                      : planDetails.frequency;

                    return (
                      frequency &&
                      frequency.length > 0 && (
                        <>
                          <Text style={styles.sectionTitle}>
                            Recurring Plans
                          </Text>
                          <FlatList
                            data={frequency}
                            keyExtractor={item => item}
                            numColumns={2}
                            columnWrapperStyle={{
                              justifyContent: 'space-between',
                            }}
                            scrollEnabled={false}
                            renderItem={({ item }) => {
                              const isSelected = selectedCard === item;
                              return (
                                <TouchableOpacity
                                  style={[
                                    styles.cardContainer,
                                    isSelected
                                      ? [styles.cardSelected, { borderColor: mainColor }]
                                      : styles.cardUnselected,
                                  ]}
                                  onPress={() => {
                                    handleCardClick(item);
                                    setSelectedPlanType('recurring');
                                  }}>
                                  <View style={{ alignItems: 'center' }}>
                                    <Text style={styles.optionLabel}>
                                      {{
                                        monthly: 'Monthly Plan',
                                        quarterly: 'Quarterly Plan',
                                        'half-yearly': 'Half-Yearly Plan',
                                        yearly: 'Yearly Plan',
                                      }[item] || 'Recurring Plan'}
                                    </Text>

                                    <View style={{ alignItems: 'center' }}>
                                      {appliedCoupon ? (
                                        <>
                                          <View
                                            style={{
                                              flexDirection: 'row',
                                              alignContent: 'center',
                                              alignItems: 'center',
                                              alignSelf: 'center',
                                            }}>
                                            <Text
                                              style={styles.lineThroughGray}>
                                              ₹
                                              {displayAmount(
                                                planDetails.pricingWithoutGst?.[
                                                item
                                                ]
                                              )}
                                              {gstText}
                                            </Text>
                                            <Text style={[styles.greenPrice, {color: stepCompletedColor}]}>
                                              ₹
                                              {displayAmount(Math.round(
                                                offerDetails
                                                  ?.pricingWithoutGst?.[item],
                                              ))}
                                              {gstText}
                                            </Text>
                                          </View>

                                          <Text style={[styles.discountText, {color: stepCompletedColor}]}>
                                            Coupon Applied
                                          </Text>
                                        </>
                                      ) : planDetails.discountPercentage > 0 ? (
                                        <>
                                          <View
                                            style={{
                                              flexDirection: 'row',
                                              alignContent: 'center',
                                              alignItems: 'center',
                                              alignSelf: 'center',
                                            }}>
                                            <Text
                                              style={styles.lineThroughGray}>
                                              ₹
                                              {Math.round(
                                                planDetails.pricingWithoutGst?.[
                                                item
                                                ] *
                                                (1 +
                                                  planDetails.discountPercentage /
                                                  100),
                                              )}
                                            </Text>
                                            <Text style={[styles.bluePrice, { color: mainColor }]}>
                                              ₹
                                              {displayAmount(
                                                planDetails.pricingWithoutGst?.[
                                                item
                                                ]
                                              )}{' '}
                                              {gstText}
                                            </Text>
                                          </View>

                                          <Text style={[styles.discountText, {color: stepCompletedColor}]}>
                                            {planDetails.discountPercentage}%
                                            OFF
                                          </Text>
                                        </>
                                      ) : (
                                        <Text style={[styles.bluePrice, { color: mainColor }]}>
                                          ₹
                                          {displayAmount(
                                            planDetails.pricingWithoutGst?.[
                                            item
                                            ]
                                          )}{' '}
                                          {gstText}
                                        </Text>
                                      )}
                                    </View>

                                    <View
                                      style={[
                                        styles.radioButton,
                                        isSelected
                                          ? [styles.radioSelected, { borderColor: mainColor, backgroundColor: mainColor }]
                                          : styles.radioUnselected,
                                      ]}>
                                      {isSelected && (
                                        <Check size={10} color="#fff" />
                                      )}
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            }}
                          />
                        </>
                      )
                    );
                  })()}
              </View>
            </View>
            <CouponCodeInput
              couponCode={couponCode}
              setCouponCode={setCouponCode}
              isApplyingCoupon={isApplyingCoupon}
              handleApplyCoupon={handleApplyCoupon}
              couponMessage={couponMessage}
              appliedCoupon={appliedCoupon}
              mainColor={mainColor}
              stepCompletedColor={stepCompletedColor}
            />

            <View style={styles.consentContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsentChecked(!consentChecked)}>
                <View
                  style={[
                    styles.enhancedCheckbox,
                    consentChecked && {
                      backgroundColor:
                        currentAppVariant?.paymentModal?.checkboxActiveColor,
                      borderColor:
                        currentAppVariant?.paymentModal?.checkboxActiveColor,
                    },
                  ]}>
                  {consentChecked && <Check size={12} color="#fff" />}
                </View>
                <Text style={styles.consentText}>
                  I have gone through the Disclaimers mentioned in the website.
                  I'm purchasing this plan with understanding of{' '}
                  <Text
                    style={[
                      styles.linkText,
                      { color: currentAppVariant?.paymentModal?.linkColor },
                    ]}
                    onPress={() => setShowDisclaimer(true)}>
                    disclaimers
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* GST Breakdown */}
            {configGst && onetimeamount > 0 && (() => {
              const totalAmt = Number(onetimeamount);
              const baseAmt = Math.round(totalAmt / 1.18);
              const gstAmt = totalAmt - baseAmt;
              return (
                <View style={styles.gstBreakdownContainer}>
                  <View style={styles.gstBreakdownRow}>
                    <Text style={styles.gstBreakdownLabel}>Subtotal</Text>
                    <Text style={styles.gstBreakdownValue}>₹{baseAmt}</Text>
                  </View>
                  <View style={styles.gstBreakdownRow}>
                    <Text style={styles.gstBreakdownLabel}>GST @18%</Text>
                    <Text style={styles.gstBreakdownValue}>₹{gstAmt}</Text>
                  </View>
                  <View style={[styles.gstBreakdownRow, styles.gstBreakdownTotal]}>
                    <Text style={styles.gstBreakdownTotalLabel}>Total</Text>
                    <Text style={styles.gstBreakdownTotalValue}>₹{totalAmt}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Apple App Store Compliance Disclaimer */}
            <View style={styles.paymentDisclaimer}>
              <Text style={styles.paymentDisclaimerText}>
                Payments in this app are for financial research/advisory services provided by registered entities. All fees are collected on behalf of and remitted to licensed financial professionals for real-world investment services.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleDigioPayment}
              disabled={!selectedCard || loading || !consentChecked}
              style={[
                styles.stepButton,
                styles.stepButtonGreen,
                { backgroundColor: stepCompletedColor },
                (!selectedCard || loading || !consentChecked) &&
                styles.stepButtonDisabled,
              ]}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.stepButtonText}>
                    🚀 Complete Investment
                  </Text>
                  <ChevronRight size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.container}>
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={[gradient1, gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.alphaQuarkBanner}>
              <View style={styles.headerPattern} />
              <View style={styles.headerContent}>
                <View style={styles.headerTitleContainer}>
                  {(planDetails?.type || specificPlan?.type) && (
                    <View style={styles.planTypeTag}>
                      <Text style={styles.planTypeTagText}>
                        {(planDetails?.type || specificPlan?.type).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.headerTitle}>{planDetails?.name || specificPlan?.name}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <XIcon size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Progress Bar */}
          <StepProgressBar
            steps={steps}
            currentStep={currentStep}
            currentAppVariant={currentAppVariant}
            mainColor={gradient2}
          />

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.stepsContainer}>
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  isActive={currentStep === index}
                  isCompleted={currentStep > index}
                  onPress={() => currentStep > index && setCurrentStep(index)}
                  currentAppVariant={currentAppVariant}
                  mainColor={mainColor}
                  stepCompletedColor={stepCompletedColor}>
                  {renderStepContent(index)}
                </StepCard>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {digioModalOpen === true ? (
        <DigioModal
          authenticationUrl={authUrl}
          digioModalOpen={digioModalOpen}
          onClose={() => {
            // Stop background polling when modal is closed
            digioPollingShouldStopRef.current = true;
            setDigioModalOpen(false);
          }}
          onVerificationComplete={handleDigioSuccess}
          onSuccess={documentId => {
            console.log('Document signed successfully:', documentId);
            // handlePaymentType();
          }}
          onError={error => {
            console.error('Digio verification failed:', error);
            // Stop background polling on error
            digioPollingShouldStopRef.current = true;
            setDigioUnsuccessModal(true);
            setDigioModalOpen(false);
          }}
        />
      ) : null}

      {/* PayU WebView Modal */}
      <PayUWebView
        visible={showPayUWebView}
        paymentData={payuFormData}
        isSI={payuIsSI}
        onSuccess={handlePayUSuccess}
        onFailure={handlePayUFailure}
        onClose={() => {
          setShowPayUWebView(false);
          setPayuFormData(null);
        }}
      />

      {/* Digio Success Modal - Anti-drop-off mechanism */}
      {digioSuccessModal && (
        <DigioSuccessModal
          visible={digioSuccessModal}
          onClose={() => setDigioSuccessModal(false)}
          onProceedToPayment={() => {
            setDigioSuccessModal(false);
            handlePaymentType();
          }}
        />
      )}

      {/* Telegram Collection Modal */}
      {showTelegramModal && (
        <TelegramCollectionModal
          visible={showTelegramModal}
          onClose={() => {
            setShowTelegramModal(false);
            setPaymentSuccess(true); // Proceed to success screen even if skipped
          }}
          onSave={async (id) => {
            await saveTelegramId(id);
            setShowTelegramModal(false);
            setPaymentSuccess(true);
          }}
          initialValue={telegramInputValue}
          onValueChange={setTelegramInputValue}
          validateId={validateTelegramId}
        />
      )}

      {/* Disclaimer Modal */}
      <DisclaimerModal
        visible={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        whiteLabelText={whiteLabelText}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    backgroundColor: '#0056B7',
    position: 'relative',
  },
  headerPattern: {
    position: 'absolute',
    inset: 0,
    opacity: 0.3,
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
  },
  headerTitleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginHorizontal: 16,
  },
  planTypeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  planTypeTagText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    color: '#fff',
  },

  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
    marginLeft: 8,
  },
  progressBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    color: '#6b7280',
  },
  progressBarContainer: {
    position: 'relative',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  content: {
    flex: 1,
  },
  stepsContainer: {
    padding: 16,
    gap: 12,
  },
  stepCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stepCardActive: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#0056B7',
    transform: [{ scale: 1.02 }],
  },
  stepCardCompleted: {
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#29A400',
  },
  stepCardInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  stepHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stepInactive: {
    backgroundColor: '#9ca3af',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#6b7280',
  },
  stepStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedBadge: {
    backgroundColor: '#29A400',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  stepContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },

  stepContentContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: '#ef4444',
  },
  enhancedInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#1f2937',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  errorInput: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  successInput: {
    borderColor: '#29A400',
    backgroundColor: '#ecfdf5',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#ef4444',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#29A400',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  stepButtonGreen: {
    backgroundColor: '#29A400',
  },
  stepButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButtonText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
    marginRight: 8,
  },

  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#374151',
    marginBottom: 16,
  },
  planGrid: {
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    padding: 12,
    margin: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#29A400',
    backgroundColor: '#ecfdf5',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
  },
  planPrice: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 8,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
  radioButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#29A400',
    backgroundColor: '#29A400',
  },
  radioButtonUnselected: {
    borderColor: '#d1d5db',
  },

  consentContainer: {
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  enhancedCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },

  consentText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  linkText: {
    fontFamily: 'Satoshi-Bold',
    textDecorationLine: 'underline',
  },
  gstBreakdownContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gstBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  gstBreakdownLabel: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    color: '#64748b',
  },
  gstBreakdownValue: {
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
    color: '#334155',
  },
  gstBreakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
    paddingTop: 8,
  },
  gstBreakdownTotalLabel: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#1e293b',
  },
  gstBreakdownTotalValue: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#1e293b',
  },
  paymentDisclaimer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
  },
  paymentDisclaimerText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    color: '#475569',
    lineHeight: 16,
  },

  paymentHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  paymentTitle: {
    fontSize: 24,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Regular',
    color: '#6b7280',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 12,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1f2937',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: '#29A400',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#6b7280',
    marginLeft: 8,
  },
  paymentButton: {
    height: 56,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  paymentButtonText: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },

  /////////////////////////////

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151', // text-gray-700
    marginBottom: 4,
  },
  cardContainer: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    flex: 1,
    margin: 4,
  },
  cardSelected: {
    borderColor: '#0056B7', // blue-500
    backgroundColor: '#eff6ff', // blue-50
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnselected: {
    borderColor: '#e5e7eb', // gray-200
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827', // gray-900
    marginBottom: 2,
  },
  durationText: {
    fontSize: 10,
    color: '#6b7280', // gray-600
    marginBottom: 4,
  },
  lineThroughBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0056B7', // blue-600
    textDecorationLine: 'line-through',
    marginRight: 2,
  },
  greenPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#29A400', // green-600
  },
  lineThroughGray: {
    fontSize: 10,
    marginRight: 5,
    color: '#6b7280', // gray-500
    textDecorationLine: 'line-through',
  },
  bluePrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0056B7',
  },
  discountText: {
    fontSize: 8,
    color: '#29A400',
    fontWeight: '500',
  },
  radioButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  radioSelected: {
    borderColor: '#0056B7',
    backgroundColor: '#0056B7',
  },
  radioUnselected: {
    borderColor: '#d1d5db', // gray-300
  },
  durationBadgeContainer: {
    position: 'absolute',
    top: -16,
    right: -6,
    backgroundColor: '#facc15', // Tailwind yellow-400
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  durationBadgeText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: '#78350f', // Tailwind amber-900 for contrast
  },

  containerOffer: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#000',
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db', // gray-300
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#0056B7', // blue-600
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af', // gray-400
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  successMessage: {
    color: '#29A400', // green-600
  },
  errorMessage: {
    color: '#dc2626', // red-600
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#444',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  required: {
    color: 'red',
  },
  dateInput: {
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  dateText: {
    color: '#333',
    fontSize: 16,
  },
});

export default MPInvestNowModal;
