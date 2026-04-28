/**
 * InvestFlowScreen — 4-step KYC + payment flow for model portfolio subscription.
 * Ported from Tidi's InvestInPlanSheet.dart with NRI/Foreign national support.
 * Keeps Alphab2b's 3 payment gateways (Razorpay, CashFree, PayU).
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
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
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

  const auth = getAuth();
  const userEmail = auth.currentUser?.email;

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
        prefill: { email: email.trim(), contact: `${selectedCountry.dialCode}${phone}` },
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

  // ── Post-subscription ──
  const onSubscriptionSuccess = async () => {
    // Save user details
    await AsyncStorage.multiSet([
      ['user_first_name', name.trim()],
      ['user_email', email.trim()],
      ['user_phone', phone.trim()],
      ['user_pan', pan.toUpperCase()],
    ]).catch(() => {});

    // Add to client groups
    axios.post(
      `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`,
      { userEmail: email.trim(), phoneNumber: `${selectedCountry.dialCode}${phone}` },
      { headers: getHeaders(), timeout: 10000 },
    ).catch(() => {});

    showAlert('success', 'Subscribed!', 'You have successfully subscribed to this portfolio.');
    if (onSubscribed) onSubscribed();
    navigation.goBack();
  };

  // ── Render helpers ──
  const StepHeader = ({ step, title, isCompleted, isCurrent }) => (
    <TouchableOpacity
      style={[styles.stepHeader, isCurrent && styles.stepHeaderActive]}
      onPress={() => { if (isCompleted || step === currentStep) goToStep(step); }}
      disabled={!isCompleted && step !== currentStep}
    >
      <View style={[styles.stepCircle, isCompleted && styles.stepCircleCompleted, isCurrent && styles.stepCircleCurrent]}>
        <Text style={[styles.stepNum, (isCompleted || isCurrent) && styles.stepNumActive]}>
          {isCompleted ? '✓' : step + 1}
        </Text>
      </View>
      <Text style={[styles.stepTitle, isCurrent && styles.stepTitleActive]}>{title}</Text>
    </TouchableOpacity>
  );

  const ContinueButton = ({ step, onPress }) => (
    <TouchableOpacity
      style={[styles.continueBtn, !isStepValid(step) && styles.continueBtnDisabled]}
      onPress={onPress}
      disabled={!isStepValid(step)}
    >
      <Text style={styles.continueBtnText}>Continue</Text>
    </TouchableOpacity>
  );

  // ── Country picker modal ──
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRY_CODES;
    const q = countrySearch.toLowerCase();
    return COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q));
  }, [countrySearch]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invest in {portfolio?.name || 'Portfolio'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((completedSteps.size + (currentStep === 3 ? 1 : 0)) / 4) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ═══ STEP 0: Personal Info ═══ */}
          <StepHeader step={0} title="Personal Info" isCompleted={completedSteps.has(0)} isCurrent={currentStep === 0} />
          {currentStep === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter full name" />
              <Text style={styles.label}>Email Address *</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Enter email" keyboardType="email-address" autoCapitalize="none" />
              <ContinueButton step={0} onPress={() => goToStep(1)} />
            </View>
          )}

          {/* ═══ STEP 1: Contact ═══ */}
          <StepHeader step={1} title="Contact" isCompleted={completedSteps.has(1)} isCurrent={currentStep === 1} />
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity style={styles.countryBtn} onPress={() => setShowCountryPicker(true)}>
                  <Text style={styles.countryBtnText}>{selectedCountry.dialCode}</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.phoneInput, phoneError && styles.inputError]}
                  value={phone}
                  onChangeText={(v) => { setPhone(v.replace(/\D/g, '')); validatePhone(v.replace(/\D/g, '')); }}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                  maxLength={selectedCountry.dialCode === '+91' ? 10 : 15}
                />
              </View>
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

              <Text style={styles.label}>Telegram (optional)</Text>
              <TextInput style={styles.input} value={telegram} onChangeText={setTelegram} placeholder="@username" autoCapitalize="none" />
              <ContinueButton step={1} onPress={() => goToStep(2)} />
            </View>
          )}

          {/* ═══ STEP 2: KYC & Investment ═══ */}
          <StepHeader step={2} title="KYC & Investment" isCompleted={completedSteps.has(2)} isCurrent={currentStep === 2} />
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              {/* Residency selector */}
              <Text style={styles.label}>Residency Type</Text>
              <View style={styles.residencyRow}>
                {[
                  { key: 'indian_resident', label: 'Indian Resident' },
                  { key: 'nri', label: 'NRI' },
                  { key: 'foreign_national', label: 'Foreign National' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.residencyCard, residencyType === key && styles.residencyCardActive]}
                    onPress={() => { setResidencyType(key); setForm60Acknowledged(false); }}
                  >
                    <Text style={[styles.residencyText, residencyType === key && styles.residencyTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Indian Resident KYC */}
              {residencyType === 'indian_resident' && (
                <>
                  <Text style={styles.label}>PAN Number *</Text>
                  <TextInput style={[styles.input, panError && styles.inputError]} value={pan}
                    onChangeText={(v) => { setPan(v.toUpperCase()); validatePan(v.toUpperCase()); }}
                    placeholder="ABCDE1234F" maxLength={10} autoCapitalize="characters" />
                  {panError && <Text style={styles.errorText}>{panError}</Text>}

                  <Text style={styles.label}>Date of Birth *</Text>
                  <TextInput style={styles.input} value={dob || ''} onChangeText={setDob} placeholder="YYYY-MM-DD" />

                  <Text style={styles.label}>GST Number (optional)</Text>
                  <TextInput style={[styles.input, gstError && styles.inputError]} value={gst}
                    onChangeText={(v) => { setGst(v.toUpperCase()); validateGst(v.toUpperCase()); }}
                    placeholder="22AAAAA0000A1Z5" maxLength={15} autoCapitalize="characters" />
                  {gstError && <Text style={styles.errorText}>{gstError}</Text>}
                </>
              )}

              {/* NRI KYC */}
              {residencyType === 'nri' && (
                <>
                  <View style={styles.panToggle}>
                    <Text style={styles.label}>Do you have an Indian PAN?</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity style={[styles.toggleBtn, hasIndianPan && styles.toggleBtnActive]} onPress={() => setHasIndianPan(true)}>
                        <Text style={[styles.toggleText, hasIndianPan && styles.toggleTextActive]}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.toggleBtn, !hasIndianPan && styles.toggleBtnActive]} onPress={() => setHasIndianPan(false)}>
                        <Text style={[styles.toggleText, !hasIndianPan && styles.toggleTextActive]}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {hasIndianPan && (
                    <>
                      <Text style={styles.label}>PAN Number *</Text>
                      <TextInput style={[styles.input, panError && styles.inputError]} value={pan}
                        onChangeText={(v) => { setPan(v.toUpperCase()); validatePan(v.toUpperCase()); }}
                        placeholder="ABCDE1234F" maxLength={10} autoCapitalize="characters" />
                      {panError && <Text style={styles.errorText}>{panError}</Text>}

                      <Text style={styles.label}>Date of Birth *</Text>
                      <TextInput style={styles.input} value={dob || ''} onChangeText={setDob} placeholder="YYYY-MM-DD" />
                    </>
                  )}

                  {!hasIndianPan && (
                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setForm60Acknowledged(!form60Acknowledged)}>
                      <View style={[styles.checkbox, form60Acknowledged && styles.checkboxChecked]}>
                        {form60Acknowledged && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>I acknowledge Form 60 requirement (no Indian PAN)</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.label}>Passport Number *</Text>
                  <TextInput style={styles.input} value={passport} onChangeText={setPassport} placeholder="Min 6 characters" />

                  <Text style={styles.label}>OCI/PIO Card (optional)</Text>
                  <TextInput style={styles.input} value={ociPio} onChangeText={setOciPio} placeholder="Card number" />

                  <Text style={styles.sectionTitle}>Overseas Address</Text>
                  <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="Address Line 1 *" />
                  <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Address Line 2" />
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City *" />
                  <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Country *" />
                  <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="Postal Code" />
                </>
              )}

              {/* Foreign National KYC */}
              {residencyType === 'foreign_national' && (
                <>
                  <TouchableOpacity style={styles.checkboxRow} onPress={() => setForm60Acknowledged(!form60Acknowledged)}>
                    <View style={[styles.checkbox, form60Acknowledged && styles.checkboxChecked]}>
                      {form60Acknowledged && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>I acknowledge Form 60 requirement</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Passport Number *</Text>
                  <TextInput style={styles.input} value={passport} onChangeText={setPassport} placeholder="Min 6 characters" />

                  <Text style={styles.label}>Nationality *</Text>
                  <TouchableOpacity style={styles.input} onPress={() => {
                    Alert.alert('Select Nationality', '', NATIONALITIES.map((n) => ({
                      text: n, onPress: () => setNationality(n),
                    })).concat([{ text: 'Cancel', style: 'cancel' }]));
                  }}>
                    <Text style={nationality ? styles.inputText : styles.placeholderText}>
                      {nationality || 'Select nationality'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.sectionTitle}>Address</Text>
                  <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="Address Line 1 *" />
                  <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Address Line 2" />
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City *" />
                  <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Country *" />
                  <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="Postal Code" />
                </>
              )}

              {/* Investment Amount */}
              <Text style={[styles.label, { marginTop: 20 }]}>Investment Amount *</Text>
              <TextInput
                style={[styles.input, investmentError && styles.inputError]}
                value={investmentAmount}
                onChangeText={(v) => { setInvestmentAmount(v.replace(/\D/g, '')); validateInvestment(v.replace(/\D/g, '')); }}
                placeholder={`Min ₹${(portfolio?.minInvestment || 0).toLocaleString('en-IN')}`}
                keyboardType="number-pad"
              />
              {investmentError && <Text style={styles.errorText}>{investmentError}</Text>}

              <ContinueButton step={2} onPress={() => { submitLeadUser(); goToStep(3); }} />
            </View>
          )}

          {/* ═══ STEP 3: Plan & Payment ═══ */}
          <StepHeader step={3} title="Plan & Payment" isCompleted={completedSteps.has(3)} isCurrent={currentStep === 3} />
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              {isFree ? (
                <View style={styles.freeBanner}>
                  <Text style={styles.freeText}>No subscription fee required</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Choose Your Plan</Text>
                  {pricingKeys.map((tier) => (
                    <TouchableOpacity
                      key={tier}
                      style={[styles.tierCard, selectedTier === tier && styles.tierCardActive]}
                      onPress={() => {
                        setSelectedTier(tier);
                        setCouponApplied(false); setCouponCode(''); setDiscountAmount(0); setCouponMessage(null);
                      }}
                    >
                      <View style={[styles.radio, selectedTier === tier && styles.radioActive]} />
                      <Text style={styles.tierLabel}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
                      <Text style={styles.tierPrice}>₹{portfolio.pricing[tier]?.toLocaleString('en-IN')}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Coupon */}
                  <View style={styles.couponRow}>
                    <TextInput
                      style={[styles.input, styles.couponInput]}
                      value={couponCode}
                      onChangeText={setCouponCode}
                      placeholder="Coupon code"
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity style={styles.couponBtn} onPress={applyCoupon} disabled={couponLoading}>
                      {couponLoading ? <ActivityIndicator size="small" color="#fff" /> :
                        <Text style={styles.couponBtnText}>Apply</Text>}
                    </TouchableOpacity>
                  </View>
                  {couponMessage && (
                    <Text style={[styles.couponMsg, couponIsError && styles.couponMsgError]}>{couponMessage}</Text>
                  )}

                  {discountAmount > 0 && (
                    <View style={styles.priceBreakdown}>
                      <Text style={styles.priceLabel}>Original: ₹{selectedAmount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.priceLabel}>Discount: -₹{discountAmount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.priceTotal}>You pay: ₹{payableAmount.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Consent */}
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setConsentChecked(!consentChecked)}>
                <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                  {consentChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the terms & conditions and understand the risks involved in investing.
                </Text>
              </TouchableOpacity>

              {/* Pay / Subscribe button */}
              <TouchableOpacity
                style={[styles.payBtn, (!isStepValid(3) || loading) && styles.payBtnDisabled]}
                onPress={isFree ? handleFreeSubscribe : handlePay}
                disabled={!isStepValid(3) || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.payBtnText}>
                    {isFree ? 'Subscribe for Free' : `Pay ₹${payableAmount.toLocaleString('en-IN')}`}
                  </Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country picker modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TextInput style={styles.modalSearch} value={countrySearch} onChangeText={setCountrySearch} placeholder="Search..." />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.countryItem} onPress={() => {
                  setSelectedCountry(item); setShowCountryPicker(false); setCountrySearch('');
                  validatePhone(phone);
                }}>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDial}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  progressBar: { height: 4, backgroundColor: '#E0E0E0' },
  progressFill: { height: 4, backgroundColor: '#4CAF50' },

  scrollContent: { paddingBottom: 40 },

  // Step headers
  stepHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#fff',
  },
  stepHeaderActive: { backgroundColor: '#F3F4FF' },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#CCC',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  stepCircleCompleted: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  stepCircleCurrent: { borderColor: '#1A237E' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#999' },
  stepNumActive: { color: '#fff' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#666' },
  stepTitleActive: { color: '#1A237E' },

  stepContent: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },

  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A237E', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#333',
  },
  inputError: { borderColor: '#EF5350' },
  inputText: { fontSize: 15, color: '#333' },
  placeholderText: { fontSize: 15, color: '#999' },
  errorText: { fontSize: 12, color: '#EF5350', marginTop: 4 },

  phoneRow: { flexDirection: 'row', gap: 8 },
  countryBtn: {
    backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center',
  },
  countryBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  phoneInput: { flex: 1 },

  residencyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  residencyCard: {
    flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0',
    alignItems: 'center', backgroundColor: '#F8F9FC',
  },
  residencyCardActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  residencyText: { fontSize: 11, fontWeight: '600', color: '#666', textAlign: 'center' },
  residencyTextActive: { color: '#1A237E' },

  panToggle: { marginTop: 10 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  toggleBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#F8F9FC',
  },
  toggleBtnActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#1A237E' },

  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#CCC',
    justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },

  continueBtn: {
    backgroundColor: '#1A237E', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Plan & Payment
  freeBanner: {
    padding: 16, backgroundColor: '#E8F5E9', borderRadius: 12, alignItems: 'center', marginBottom: 16,
  },
  freeText: { fontSize: 16, fontWeight: '700', color: '#2E7D32' },

  tierCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, marginBottom: 8, backgroundColor: '#F8F9FC',
  },
  tierCardActive: { borderColor: '#1A237E', backgroundColor: '#E8EAF6' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCC', marginRight: 12 },
  radioActive: { borderColor: '#1A237E', backgroundColor: '#1A237E' },
  tierLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  tierPrice: { fontSize: 16, fontWeight: '700', color: '#1A237E' },

  couponRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  couponInput: { flex: 1 },
  couponBtn: {
    backgroundColor: '#1A237E', paddingHorizontal: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  couponBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  couponMsg: { fontSize: 12, color: '#4CAF50', marginTop: 6 },
  couponMsgError: { color: '#EF5350' },

  priceBreakdown: { marginTop: 12, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 10 },
  priceLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  priceTotal: { fontSize: 16, fontWeight: '700', color: '#1A237E', marginTop: 4 },

  payBtn: {
    backgroundColor: '#2E7D32', paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 20,
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Country picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },
  modalSearch: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 12,
  },
  countryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  countryName: { fontSize: 15, color: '#333' },
  countryDial: { fontSize: 15, fontWeight: '600', color: '#1A237E' },
  modalClose: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#999' },
});

export default InvestFlowScreen;
