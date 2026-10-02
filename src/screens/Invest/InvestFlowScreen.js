/**
 * InvestFlowScreen — 4-step KYC + payment flow for model portfolio subscription.
 * Ported from Tidi's InvestInPlanSheet.dart with NRI/Foreign national support.
 * Keeps Alphab2b's 3 payment gateways (Razorpay, CashFree, PayU) — gateway is
 * resolved per-tenant from /api/adminControl/get-payment-platform (source of
 * truth: payment_gateway_config.active_gateway) rather than hardcoded, so a
 * tenant with Cashfree configured/active routes to Cashfree, not Razorpay.
 * See docs/PAYMENT_ARCHITECTURE.md changelog 2026-07-16.
 *
 * Steps:
 *   0 — Personal Info (name, email)
 *   1 — Contact (phone with country code, telegram)
 *   2 — KYC & Investment (residency-based: Indian/NRI/Foreign + amount)
 *   3 — Plan Selection & Payment (tier, coupon, consent, pay)
 *
 * Route params:
 *   portfolio: ModelPortfolio object (name, pricing, minInvestment, id, etc.)
 *   onSubscribed: () => void (callback after successful subscription)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Platform, AppState, Linking} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { CFSubscriptionSession } from 'cashfree-pg-api-contract';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';
import { getCashfreeEnvironment, isInstallSourceError, friendlyPaymentError } from '../../utils/cashfreeEnv';
import { CashFreeRecurringPayment } from '../../FunctionCall/services/CashFreeOneTimePayment';
import {
  savePendingPayment,
  clearPendingPayment,
  createPendingPaymentData,
  PaymentType,
} from '../../FunctionCall/services/PendingPaymentManager';
import { logPayment } from '../../utils/Logging';
import { isDigioEnabledFromBackend } from '../../utils/digioConfig';
import { useConfig } from '../../context/ConfigContext';
import {getAccountEmail} from '../../utils/accountEmail';
import { normalizePaymentPhone } from '../../utils/paymentPhone';
import {
  openPhonePeCheckout,
  getPendingPhonePeOrderId,
  pollPhonePeOrder,
} from '../../FunctionCall/services/PhonePePaymentService';

import {useComponent} from '../../design/useDesign';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;

// Top 41 country codes (matching Tidi)
const COUNTRY_CODES = [
  { name: 'India', dialCode: '+91', code: 'IN' },
  { name: 'United States', dialCode: '+1', code: 'US' },
  { name: 'United Kingdom', dialCode: '+44', code: 'GB' },
  { name: 'Canada', dialCode: '+1', code: 'CA' },
  { name: 'Australia', dialCode: '+61', code: 'AU' },
  { name: 'Singapore', dialCode: '+65', code: 'SG' },
  { name: 'UAE', dialCode: '+971', code: 'AE' },
  { name: 'Germany', dialCode: '+49', code: 'DE' },
  { name: 'France', dialCode: '+33', code: 'FR' },
  { name: 'Japan', dialCode: '+81', code: 'JP' },
  { name: 'China', dialCode: '+86', code: 'CN' },
  { name: 'Hong Kong', dialCode: '+852', code: 'HK' },
  { name: 'South Korea', dialCode: '+82', code: 'KR' },
  { name: 'Malaysia', dialCode: '+60', code: 'MY' },
  { name: 'Thailand', dialCode: '+66', code: 'TH' },
  { name: 'Indonesia', dialCode: '+62', code: 'ID' },
  { name: 'Philippines', dialCode: '+63', code: 'PH' },
  { name: 'New Zealand', dialCode: '+64', code: 'NZ' },
  { name: 'South Africa', dialCode: '+27', code: 'ZA' },
  { name: 'Brazil', dialCode: '+55', code: 'BR' },
  { name: 'Mexico', dialCode: '+52', code: 'MX' },
  { name: 'Netherlands', dialCode: '+31', code: 'NL' },
  { name: 'Switzerland', dialCode: '+41', code: 'CH' },
  { name: 'Sweden', dialCode: '+46', code: 'SE' },
  { name: 'Norway', dialCode: '+47', code: 'NO' },
  { name: 'Denmark', dialCode: '+45', code: 'DK' },
  { name: 'Italy', dialCode: '+39', code: 'IT' },
  { name: 'Spain', dialCode: '+34', code: 'ES' },
  { name: 'Portugal', dialCode: '+351', code: 'PT' },
  { name: 'Ireland', dialCode: '+353', code: 'IE' },
  { name: 'Saudi Arabia', dialCode: '+966', code: 'SA' },
  { name: 'Qatar', dialCode: '+974', code: 'QA' },
  { name: 'Kuwait', dialCode: '+965', code: 'KW' },
  { name: 'Bahrain', dialCode: '+973', code: 'BH' },
  { name: 'Oman', dialCode: '+968', code: 'OM' },
  { name: 'Sri Lanka', dialCode: '+94', code: 'LK' },
  { name: 'Bangladesh', dialCode: '+880', code: 'BD' },
  { name: 'Nepal', dialCode: '+977', code: 'NP' },
  { name: 'Pakistan', dialCode: '+92', code: 'PK' },
];

const NATIONALITIES = [
  'American', 'Australian', 'Bahraini', 'Bangladeshi', 'Brazilian', 'British',
  'Canadian', 'Chinese', 'Danish', 'Dutch', 'Emirati', 'Filipino', 'French',
  'German', 'Hong Konger', 'Indian', 'Indonesian', 'Irish', 'Italian',
  'Japanese', 'Korean', 'Kuwaiti', 'Malaysian', 'Mexican', 'Nepalese',
  'New Zealander', 'Norwegian', 'Omani', 'Pakistani', 'Portuguese', 'Qatari',
  'Saudi', 'Singaporean', 'South African', 'Spanish', 'Sri Lankan', 'Swedish',
  'Swiss', 'Thai',
];

const InvestFlowScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { portfolio, onSubscribed } = route.params || {};
  const showAlert = useModalStore((state) => state.showAlert);
  const appConfig = useConfig();

  const auth = getAuth();
  const userEmail = getAccountEmail();

  // ── Step tracking ──
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // ── Step 0: Personal Info ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // ── Step 1: Contact ──
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // India
  const [phoneError, setPhoneError] = useState(null);
  const [telegram, setTelegram] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const paymentPhone = normalizePaymentPhone(phone, selectedCountry.dialCode);

  // ── Step 2: KYC ──
  const [residencyType, setResidencyType] = useState('indian_resident');
  const [panCategory, setPanCategory] = useState('Individual');
  const [pan, setPan] = useState('');
  const [panError, setPanError] = useState(null);
  const [dob, setDob] = useState(null);
  const [gst, setGst] = useState('');
  const [gstError, setGstError] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [investmentError, setInvestmentError] = useState(null);
  // NRI
  const [hasIndianPan, setHasIndianPan] = useState(true);
  const [passport, setPassport] = useState('');
  const [ociPio, setOciPio] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [form60Acknowledged, setForm60Acknowledged] = useState(false);
  // Foreign
  const [nationality, setNationality] = useState(null);

  // ── Step 3: Plan & Payment ──
  const pricingKeys = useMemo(() => Object.keys(portfolio?.pricing || {}), [portfolio]);
  const isFree = pricingKeys.length === 0;
  const [selectedTier, setSelectedTier] = useState(pricingKeys[0] || null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null);
  const [couponIsError, setCouponIsError] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedAmount = portfolio?.pricing?.[selectedTier] || 0;
  const payableAmount = Math.max(0, selectedAmount - discountAmount);

  // ── Payment gateway (per-tenant, DB-backed — default "razorpay" until loaded) ──
  const [paymentPlatform, setPaymentPlatform] = useState('razorpay');
  const configDataShim = useMemo(
    () => ({ config: { REACT_APP_HEADER_NAME: getTenantSubdomain() } }),
    [],
  );
  const pollingShouldStopRef = useRef(false);
  const phonePeResumeCheckRef = useRef(false);

  const onSubscriptionSuccess = useCallback(async () => {
    await AsyncStorage.multiSet([
      ['user_first_name', name.trim()],
      ['user_email', email.trim()],
      ['user_phone', phone.trim()],
      ['user_pan', pan.toUpperCase()],
    ]).catch(() => {});

    axios.post(
      `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`,
      { userEmail: email.trim(), phoneNumber: paymentPhone.e164 },
      { headers: getHeaders(), timeout: 10000 },
    ).catch(() => {});

    showAlert('success', 'Subscribed!', 'You have successfully subscribed to this portfolio.');
    if (onSubscribed) onSubscribed();
    navigation.goBack();
  }, [email, name, navigation, onSubscribed, pan, paymentPhone.e164, phone, showAlert]);

  const reconcilePendingPhonePe = useCallback(async () => {
      if (phonePeResumeCheckRef.current) return;
      const pendingOrderId = await getPendingPhonePeOrderId();
      if (!pendingOrderId) return;
      phonePeResumeCheckRef.current = true;
      setLoading(true);
      try {
        const result = await pollPhonePeOrder(pendingOrderId, { attempts: 5, delayMs: 3000 });
        if (result.state === 'COMPLETED') {
          await onSubscriptionSuccess();
        } else if (result.state === 'FAILED') {
          showAlert('error', 'Payment Failed', 'PhonePe reported that this payment was not completed.');
        } else {
          showAlert('info', 'Payment Pending', 'PhonePe is still processing this payment. We will reconcile it automatically.');
        }
      } catch (error) {
        console.warn('[InvestFlow][PhonePe] resume status check failed:', error.message);
      } finally {
        phonePeResumeCheckRef.current = false;
        setLoading(false);
      }
  }, [onSubscriptionSuccess, showAlert]);

  useEffect(() => {
    const checkPendingPhonePe = nextState => {
      if (nextState === 'active') reconcilePendingPhonePe();
    };
    const appStateSubscription = AppState.addEventListener('change', checkPendingPhonePe);
    // UPI apps can return via a deep link without producing a reliable
    // background→active transition. Reconcile on both lifecycle signals.
    const linkSubscription = Linking.addEventListener('url', () => reconcilePendingPhonePe());
    if (AppState.currentState === 'active') reconcilePendingPhonePe();
    return () => {
      appStateSubscription.remove();
      linkSubscription.remove();
    };
  }, [reconcilePendingPhonePe]);

  useEffect(() => {
    axios
      .get(`${server.server.baseUrl}api/adminControl/get-payment-platform`, { headers: getHeaders(), timeout: 10000 })
      .then((res) => {
        if (res?.data?.paymentPlatform) setPaymentPlatform(res.data.paymentPlatform);
      })
      .catch((e) => {
        console.warn('[InvestFlow] get-payment-platform failed, defaulting razorpay:', e.message);
      });
  }, []);

  // ── Load saved user data ──
  useEffect(() => {
    (async () => {
      const [savedName, savedEmail, savedPhone, savedPan] = await Promise.all([
        AsyncStorage.getItem('user_first_name'),
        AsyncStorage.getItem('user_email'),
        AsyncStorage.getItem('user_phone'),
        AsyncStorage.getItem('user_pan'),
      ]);
      if (savedName) setName(savedName);
      if (savedEmail || userEmail) setEmail(savedEmail || userEmail || '');
      if (savedPhone) setPhone(savedPhone);
      if (savedPan) setPan(savedPan.toUpperCase());
    })();
  }, [userEmail]);

  // ── Validation ──
  const validatePhone = (val) => {
    if (!val) { setPhoneError(null); return; }
    if (selectedCountry.dialCode === '+91' && val.length !== 10) {
      setPhoneError('Enter a valid 10-digit number');
    } else if (val.length < 7) {
      setPhoneError('Enter a valid phone number');
    } else {
      setPhoneError(null);
    }
  };

  const validatePan = (val) => {
    if (!val) { setPanError(null); return; }
    setPanError(PAN_REGEX.test(val.toUpperCase()) ? null : 'Format: ABCDE1234F');
  };

  const validateGst = (val) => {
    if (!val) { setGstError(null); return; }
    setGstError(GST_REGEX.test(val.toUpperCase()) ? null : 'Invalid GST format');
  };

  const validateInvestment = (val) => {
    if (!val) { setInvestmentError(null); return; }
    const amt = parseInt(val.replace(/,/g, ''), 10);
    if (isNaN(amt)) { setInvestmentError('Enter a valid amount'); return; }
    if (amt < (portfolio?.minInvestment || 0)) {
      setInvestmentError(`Minimum: ₹${(portfolio.minInvestment || 0).toLocaleString('en-IN')}`);
    } else {
      setInvestmentError(null);
    }
  };

  const isStepValid = (step) => {
    switch (step) {
      case 0: return name.trim().length > 0 && email.trim().length > 0;
      case 1: return phone.trim().length > 0 && !phoneError;
      case 2: return isKycValid() && isInvestmentValid();
      case 3: return consentChecked && (isFree || selectedTier != null);
      default: return false;
    }
  };

  const isInvestmentValid = () => {
    const amt = parseInt(investmentAmount.replace(/,/g, ''), 10);
    return !isNaN(amt) && amt >= (portfolio?.minInvestment || 0);
  };

  const isKycValid = () => {
    switch (residencyType) {
      case 'indian_resident':
        return panCategory && pan && !panError && dob && (!gst || !gstError);
      case 'nri':
        if (hasIndianPan) {
          return panCategory && pan && !panError && dob && passport.length >= 6 &&
                 addressLine1.trim() && city.trim() && country.trim();
        }
        return form60Acknowledged && passport.length >= 6 &&
               addressLine1.trim() && city.trim() && country.trim();
      case 'foreign_national':
        return form60Acknowledged && passport.length >= 6 && nationality &&
               addressLine1.trim() && city.trim() && country.trim();
      default: return false;
    }
  };

  // ── Step navigation ──
  const goToStep = (next) => {
    if (next > currentStep) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
    }
    setCurrentStep(next);
  };

  // ── Submit lead user (non-blocking, matching Tidi) ──
  const submitLeadUser = async () => {
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        planName: portfolio?.modelName || portfolio?.name,
        phone: phone.trim(),
        date: new Date().toISOString(),
        residencyStatus: residencyType,
      };
      if (telegram.trim()) payload.telegram = telegram.trim();

      if (residencyType === 'indian_resident') {
        payload.pan = pan.toUpperCase();
        payload.dateOfBirth = dob || '';
        if (gst) payload.gstNumber = gst.toUpperCase();
      } else if (residencyType === 'nri') {
        payload.pan = hasIndianPan ? pan.toUpperCase() : '';
        payload.dateOfBirth = hasIndianPan && dob ? dob : '';
        payload.passportNumber = passport.trim();
        payload.ociPioCard = ociPio.trim();
        payload.overseasAddress = {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          country: country.trim(),
          postalCode: postalCode.trim(),
        };
      } else if (residencyType === 'foreign_national') {
        payload.passportNumber = passport.trim();
        payload.nationality = nationality;
        payload.foreignAddress = {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          country: country.trim(),
          postalCode: postalCode.trim(),
        };
      }

      await axios.post(
        `${server.server.baseUrl}api/all-users/lead_user`,
        payload,
        { headers: getHeaders(), timeout: 10000 },
      );
    } catch (e) {
      console.warn('[InvestFlow] submitLeadUser failed (non-blocking):', e.message);
    }
  };

  // ── Coupon ──
  const applyCoupon = async () => {
    if (!couponCode.trim() || !selectedTier) return;
    setCouponLoading(true);
    try {
      const resp = await axios.post(
        `${server.server.baseUrl}api/promo/validate`,
        { couponCode: couponCode.trim(), planId: portfolio?.id, amount: selectedAmount },
        { headers: getHeaders(), timeout: 10000 },
      );
      const data = resp.data;
      if (data?.success) {
        const discounted = data.data?.discountedAmount;
        const disc = selectedAmount - (typeof discounted === 'number' ? discounted : selectedAmount);
        setCouponApplied(true);
        setDiscountAmount(disc > 0 ? disc : 0);
        setCouponMessage(`Coupon applied! You save ₹${disc > 0 ? disc.toLocaleString('en-IN') : 0}`);
        setCouponIsError(false);
      } else {
        setCouponApplied(false);
        setDiscountAmount(0);
        setCouponMessage(data?.message || 'Invalid coupon code');
        setCouponIsError(true);
      }
    } catch (e) {
      setCouponMessage('Failed to validate coupon');
      setCouponIsError(true);
    }
    setCouponLoading(false);
  };

  // ── Payment: Cashfree (recurring subscription checkout) ──
  const handleCashfreeComplete = async (status, subscriptionId) => {
    if (status !== 'ACTIVE') {
      setLoading(false);
      showAlert('error', 'Payment Failed', 'Payment was cancelled or failed. Please try again.');
      return;
    }
    try {
      await CashFreeRecurringPayment({
        paymentDetails: subscriptionId,
        email: email.trim(),
        name: name.trim(),
        panNumber: pan.toUpperCase(),
        mobileNumber: paymentPhone.nationalNumber,
        countryCode: paymentPhone.countryCode,
        formattedName: name.trim(),
        specificPlan: { ...portfolio, _id: portfolio?._id || portfolio?.id },
        telegramId: telegram.trim(),
        advisorTag: getTenantSubdomain(),
        birthDate: dob,
        invetAmount: investmentAmount.replace(/,/g, ''),
        singleStrategyDetails: portfolio,
        configData: configDataShim,
        panCategory,
      });
      await clearPendingPayment();
      await onSubscriptionSuccess();
    } catch (e) {
      console.error('[InvestFlow][Cashfree] completion error:', e);
      showAlert('error', 'Payment Failed', e.message || 'Please try again.');
    }
    setLoading(false);
  };

  const initiateCashfreeRecurringInvest = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/cashfree/subscription/create/payment`,
        {
          plan_id: portfolio?.id,
          user_email: email.trim(),
          mobileNumber: paymentPhone.nationalNumber,
          name: name.trim(),
          panNumber: pan.toUpperCase(),
          countryCode: paymentPhone.countryCode,
          selectedCard: selectedTier,
          redirectSpecificLocation: `${Config.REACT_APP_WEBSITE_URL || ''}/pricing`,
          advisor: getTenantSubdomain(),
          birthDate: dob,
          telegramId: telegram.trim(),
          capital: investmentAmount.replace(/,/g, ''),
        },
        { headers: getHeaders(), timeout: 15000 },
      );

      const subsSessionId = response?.data?.data?.subscription_session_id;
      const subscriptionId = response?.data?.data?.subscription_id;
      const orderId = response?.data?.data?.order_id;
      if (!subsSessionId || !subscriptionId) {
        throw new Error(response?.data?.message || 'Failed to create Cashfree subscription session');
      }

      const pendingPaymentData = createPendingPaymentData({
        orderId,
        subscriptionId,
        userEmail: email.trim(),
        planId: portfolio?.id,
        paymentType: PaymentType.RECURRING,
        amount: portfolio?.amount,
        planDetails: { ...portfolio, _id: portfolio?._id || portfolio?.id },
        userDetails: {
          email: email.trim(),
          name: name.trim(),
          panNumber: pan,
          mobileNumber: paymentPhone.nationalNumber,
          countryCode: paymentPhone.countryCode,
        },
        // Was hardcoded false — meant this screen's recurring purchases never
        // recorded a Digio requirement, so the pending-payment resume flow
        // (PendingPaymentManager.js:250) could never prompt for a missed
        // signature. Compliance gap found 2026-07-23.
        digioRequired: isDigioEnabledFromBackend(appConfig?.digioEnabled),
      });
      await savePendingPayment(pendingPaymentData);

      pollingShouldStopRef.current = false;

      CFPaymentGatewayService.setCallback({
        onVerify: async (verifiedSubscriptionId) => {
          pollingShouldStopRef.current = true;
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
          await handleCashfreeComplete('ACTIVE', verifiedSubscriptionId);
        },
        onError: async (error, erroredSubscriptionId) => {
          console.error('[InvestFlow][Cashfree] error:', error);
          logPayment('CASHFREE_RECURRING_ERROR', {
            subscriptionId: erroredSubscriptionId,
            orderId,
            code: error?.code,
            type: error?.type,
            message: error?.message,
            isInstallSourceError: isInstallSourceError(error),
            platform: Platform.OS,
            userEmail: email.trim(),
          }, configDataShim);
          pollingShouldStopRef.current = true;

          const isCancellation = error?.code === 'CANCELLED' || error?.code === 'USER_CANCELLED' ||
            error?.message?.includes('cancelled');
          if (isCancellation) await clearPendingPayment();

          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
          await handleCashfreeComplete('FAIL', erroredSubscriptionId);
        },
      });

      const session = new CFSubscriptionSession(subsSessionId, subscriptionId, getCashfreeEnvironment());
      CFPaymentGatewayService.doSubscriptionPayment(session);
    } catch (e) {
      setLoading(false);
      const message = isInstallSourceError(e) ? friendlyPaymentError(e) : (e.message || 'Failed to initialize payment. Please try again.');
      showAlert('error', isInstallSourceError(e) ? 'Payment unavailable' : 'Payment Failed', message);
      console.error('[InvestFlow][Cashfree] initiation error:', e);
    }
  };

  // ── Payment dispatch — routes by the tenant's configured gateway ──
  const initiatePhonePePayment = async () => {
    setLoading(true);
    try {
      await openPhonePeCheckout({
        plan_id: portfolio?._id || portfolio?.id,
        amount: payableAmount,
        user_email: email.trim(),
        mobileNumber: paymentPhone.nationalNumber,
        name: name.trim(),
        panNumber: pan.toUpperCase(),
        countryCode: paymentPhone.countryCode,
        birthDate: dob,
        frequency: selectedTier,
        duration: portfolio?.onetimeOptions?.find((option) => Number(option.amount) === Number(payableAmount))?.duration,
        couponCode: couponApplied ? couponCode : undefined,
      });
      // Some Android UPI intents never background the host app. Start a
      // guarded status reconciliation as well as waiting for AppState/deep link.
      setTimeout(() => reconcilePendingPhonePe(), 1500);
    } catch (error) {
      setLoading(false);
      showAlert('error', 'PhonePe unavailable', error.response?.data?.message || error.message || 'Could not start PhonePe checkout.');
    }
  };

  const handlePayDispatch = async () => {
    if (!paymentPhone.e164) {
      showAlert('error', 'Check your phone number', 'Select the correct country code and enter a valid phone number.');
      return;
    }

    if (String(paymentPlatform).trim().toLowerCase() === 'phonepe') {
      await initiatePhonePePayment();
    } else if (String(paymentPlatform).trim().toLowerCase() === 'cashfree') {
      await initiateCashfreeRecurringInvest();
    } else {
      await handlePay();
    }
  };

  // ── Payment: Razorpay (primary — keeping existing Alphab2b gateway) ──
  const handlePay = async () => {
    setLoading(true);
    try {
      // Create order on backend
      const orderResp = await axios.post(
        `${server.server.baseUrl}api/admin/subscription`,
        {
          plan_id: portfolio?.id,
          frequency: selectedTier,
          user_email: email.trim(),
          sip_amount: investmentAmount.replace(/,/g, ''),
        },
        { headers: getHeaders(), timeout: 15000 },
      );

      const subscriptionData = orderResp.data?.data;
      if (!subscriptionData) throw new Error('Failed to create subscription');

      const options = {
        key: Config.REACT_APP_RAZORPAY_LIVE_API_KEY,
        subscription_id: subscriptionData.razorpay_subscription_id,
        amount: subscriptionData.amount,
        currency: 'INR',
        name: portfolio?.name || 'Model Portfolio',
        description: `${selectedTier} subscription`,
        prefill: { email: email.trim(), contact: paymentPhone.e164 },
      };

      const rzpResponse = await RazorpayCheckout.open(options);

      // Verify payment
      await axios.post(
        `${server.server.baseUrl}api/admin/subscription/complete-payment`,
        {
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_subscription_id: rzpResponse.razorpay_subscription_id,
          razorpay_signature: rzpResponse.razorpay_signature,
          user_email: email.trim(),
          plan_id: portfolio?.id,
        },
        { headers: getHeaders(), timeout: 15000 },
      );

      await onSubscriptionSuccess();
    } catch (e) {
      console.error('[InvestFlow] payment error:', e);
      if (e?.error?.description) {
        showAlert('error', 'Payment Failed', e.error.description);
      } else {
        showAlert('error', 'Payment Failed', e.message || 'Please try again.');
      }
    }
    setLoading(false);
  };

  // ── Free subscribe ──
  const handleFreeSubscribe = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${server.server.baseUrl}api/admin/subscription`,
        { plan_id: portfolio?.id, user_email: email.trim(), frequency: 'free' },
        { headers: getHeaders(), timeout: 15000 },
      );
      await onSubscriptionSuccess();
    } catch (e) {
      showAlert('error', 'Subscription Failed', e.message || 'Please try again.');
    }
    setLoading(false);
  };

  const Presentation = useComponent('screens.InvestFlowScreen');
  return (
    <Presentation
      viewModel={{
        portfolio, currentStep, completedSteps, name, email, phone,
        selectedCountry, phoneError, telegram, residencyType, pan, panError,
        dob, gst, gstError, hasIndianPan, form60Acknowledged, passport,
        ociPio, addressLine1, addressLine2, city, country, postalCode,
        nationality, investmentAmount, investmentError, isFree, pricingKeys,
        selectedTier, couponCode, couponLoading, couponMessage, couponIsError,
        discountAmount, selectedAmount, payableAmount, consentChecked, loading,
        showCountryPicker, countrySearch, countryCodes: COUNTRY_CODES,
        nationalities: NATIONALITIES,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        setName, setEmail, setPhone, setTelegram, setShowCountryPicker,
        setResidencyType, setForm60Acknowledged, setPan, setDob, setGst,
        setHasIndianPan, setPassport, setOciPio, setAddressLine1,
        setAddressLine2, setCity, setCountry, setPostalCode, setNationality,
        setInvestmentAmount, setSelectedTier, setCouponApplied, setCouponCode,
        setDiscountAmount, setCouponMessage, setConsentChecked, setCountrySearch,
        setSelectedCountry, validatePhone, validatePan, validateGst,
        validateInvestment, isStepValid, goToStep, submitLeadUser, applyCoupon,
        handleFreeSubscribe, handlePayDispatch,
      }}
    />
  );
};

export default InvestFlowScreen;
