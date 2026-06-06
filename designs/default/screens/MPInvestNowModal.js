/**
 * MPInvestNowModal — design-system screen presentation (Phase I, 2026-05-02)
 *
 * Pure presentation. Container owns ALL payment gateway SDKs (Razorpay,
 * Cashfree, PayU, Apple IAP, Google Play), ALL payment state/callbacks,
 * ALL API calls (axios), Digio e-signature flow, subscription creation,
 * coupon validation, and investment amount calculation.
 *
 * The presentation NEVER touches payment SDKs, payment callbacks, or
 * payment state. It renders the step wizard UI and delegates every
 * user interaction back to the container via `actions`.
 *
 * Contract:
 *   viewModel = {
 *     // Modal state
 *     visible,                 // boolean — modal visibility
 *     loading,                 // boolean — global loading state
 *     loadingmp,               // boolean — secondary loading state
 *     isStepTransitioning,     // boolean — step transition animation
 *
 *     // Step wizard
 *     currentStep,             // number (0, 1, 2)
 *     steps,                   // array of { id, title, description, icon }
 *     isStepValid,             // function(stepId) => boolean
 *
 *     // Theme / colors
 *     gradient1,               // string — header gradient start
 *     gradient2,               // string — header gradient end
 *     mainColor,               // string — primary accent color
 *     stepCompletedColor,      // string — completed step badge color
 *     currentAppVariant,       // object — paymentModal theme config
 *
 *     // Plan info
 *     planDetails,             // object — full plan details from API
 *     specificPlan,            // object — the specific plan selected
 *     planName,                // string — display name
 *     planType,                // string — plan type label
 *
 *     // Step 0 — Personal Info
 *     name,                    // string
 *     userEmail,               // string
 *     mobileNumber,            // string
 *     telegramId,              // string
 *
 *     // Step 1 — Investment / KYC
 *     invetAmount,             // string — investment amount
 *     panNumber,               // string
 *     panError,                // string
 *     isPanValid,              // boolean
 *     birthDate,               // string/Date
 *     userDetails,             // object — for DatePickerSection
 *     isModelPortfolio,        // boolean — shows investment amount input
 *     minInvestment,           // number — minimum investment
 *
 *     // Step 2 — Plan selection
 *     selectedCard,            // string — selected plan card key
 *     selectedPlanType,        // string — 'recurring' or 'onetime'
 *     consentChecked,          // boolean
 *     showDisclaimer,          // boolean
 *     onetimeamount,           // number — computed total amount
 *
 *     // Coupon
 *     couponCode,              // string
 *     isApplyingCoupon,        // boolean
 *     couponMessage,           // string
 *     appliedCoupon,           // object|null
 *
 *     // GST
 *     configGst,               // boolean — GST enabled
 *     gstText,                 // string — GST label text
 *     displayAmount,           // function(base) => number
 *
 *     // Sub-modals state
 *     digioModalOpen,          // boolean
 *     digioSuccessModal,       // boolean
 *     showTelegramModal,       // boolean
 *     showPayUWebView,         // boolean
 *
 *     // Sub-modal props
 *     authUrl,                 // string — Digio auth URL
 *     payuFormData,            // object — PayU form data
 *     payuIsSI,                // boolean — PayU standing instructions
 *     whiteLabelText,          // string — for DisclaimerModal
 *     telegramInputValue,      // string — for TelegramCollectionModal
 *     validateTelegramId,      // function
 *   }
 *   actions = {
 *     // Navigation
 *     onClose,                 // () => void
 *     onBack,                  // () => void
 *     onStepPress,             // (stepIndex) => void
 *     onCompleteStep,          // (stepId) => void
 *
 *     // Step 0
 *     onNameChange,            // (text) => void
 *     onMobileNumberChange,    // (text) => void
 *     onTelegramIdChange,      // (text) => void
 *
 *     // Step 1
 *     onInvestAmountChange,    // (text) => void
 *     onPanChange,             // (text) => void
 *     onBirthDateChange,       // (date) => void
 *
 *     // Step 2
 *     onCardClick,             // (cardKey) => void
 *     onSetSelectedPlanType,   // (type) => void
 *     onSetOneTimeAmount,      // (amount) => void
 *     onSetOneTimeDurationPlan,// (days) => void
 *     onConsentToggle,         // () => void
 *     onShowDisclaimer,        // () => void
 *     onHideDisclaimer,        // () => void
 *     onApplyCoupon,           // () => void
 *     onCouponCodeChange,      // (text) => void
 *
 *     // Payment
 *     onDigioPayment,          // () => void — triggers the Digio/payment flow
 *
 *     // Sub-modal actions
 *     onDigioModalClose,       // () => void
 *     onDigioVerificationComplete, // () => void
 *     onDigioSuccess,          // (documentId) => void
 *     onDigioError,            // (error) => void
 *     onDigioSuccessModalClose,// () => void
 *     onDigioSuccessPayment,   // () => void
 *     onTelegramModalClose,    // () => void
 *     onTelegramModalSave,     // (id) => void
 *     onTelegramInputChange,   // (text) => void
 *     onPayUClose,             // () => void
 *     onPayUSuccess,           // (txnid, details) => void
 *     onPayUFailure,           // (error) => void
 *   }
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry for resolution rules.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  FlatList,
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
import LinearGradient from 'react-native-linear-gradient';
import DisclaimerModal from '../../../src/components/ModelPortfolioComponents/DisclaimerModal';
import DigioModal from '../../../src/components/ModelPortfolioComponents/DigioModal';
import DigioSuccessModal from '../../../src/components/ModelPortfolioComponents/DigioSuccessModal';
import TelegramCollectionModal from '../../../src/components/ModelPortfolioComponents/TelegramCollectionModal';
import DatePickerSection from '../../../src/components/ModelPortfolioComponents/DatePickerSection';
import PayUWebView from '../../../src/components/PayUWebView';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// ============================================================================
// CouponCodeInput — pure UI sub-component
// ============================================================================
const CouponCodeInput = React.memo(
  ({
    couponCode,
    onCouponCodeChange,
    isApplyingCoupon,
    onApplyCoupon,
    couponMessage,
    appliedCoupon,
    mainColor,
    stepCompletedColor,
  }) => {
    const handleChangeCouponCode = useCallback(
      text => {
        onCouponCodeChange(text);
      },
      [onCouponCodeChange],
    );

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
            onSubmitEditing={onApplyCoupon}
          />
          <TouchableOpacity
            style={[
              styles.button,
              mainColor && { backgroundColor: mainColor },
              (!couponCode || isApplyingCoupon) && styles.buttonDisabled,
            ]}
            onPress={onApplyCoupon}
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

// ============================================================================
// StepProgressBar — pure UI sub-component
// ============================================================================
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

// ============================================================================
// StepCard — pure UI sub-component
// ============================================================================
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

// ============================================================================
// MPInvestNowModal — main presentation component
// ============================================================================
const MPInvestNowModal = ({ viewModel, actions }) => {
  const {
    visible = false,
    loading = false,
    isStepTransitioning = false,

    currentStep = 0,
    steps = [],
    isStepValid = () => false,

    gradient1 = '#002651',
    gradient2 = '#0076FB',
    mainColor = '#0076FB',
    stepCompletedColor = '#29A400',
    currentAppVariant = {},

    planDetails = null,
    specificPlan = null,
    planName = '',
    planType = '',

    name = '',
    userEmail = '',
    mobileNumber = '',
    telegramId = '',

    invetAmount = '',
    panNumber = '',
    panError = '',
    isPanValid = false,
    birthDate = '',
    userDetails = null,
    isModelPortfolio = false,
    minInvestment = 0,

    selectedCard = null,
    selectedPlanType = 'onetime',
    consentChecked = false,
    showDisclaimer = false,
    onetimeamount = 0,

    couponCode = '',
    isApplyingCoupon = false,
    couponMessage = '',
    appliedCoupon = null,

    configGst = false,
    gstText = '',
    displayAmount = (v) => v,

    digioModalOpen = false,
    digioSuccessModal = false,
    showTelegramModal = false,
    showPayUWebView = false,

    authUrl = '',
    payuFormData = null,
    payuIsSI = false,
    whiteLabelText = '',
    telegramInputValue = '',
    validateTelegramId = () => false,
  } = viewModel || {};

  const {
    onClose = () => {},
    onStepPress = () => {},
    onCompleteStep = () => {},

    onNameChange = () => {},
    onMobileNumberChange = () => {},
    onTelegramIdChange = () => {},

    onInvestAmountChange = () => {},
    onPanChange = () => {},
    onBirthDateChange = () => {},

    onCardClick = () => {},
    onSetSelectedPlanType = () => {},
    onSetOneTimeAmount = () => {},
    onSetOneTimeDurationPlan = () => {},
    onConsentToggle = () => {},
    onShowDisclaimer = () => {},
    onHideDisclaimer = () => {},
    onApplyCoupon = () => {},
    onCouponCodeChange = () => {},

    onDigioPayment = () => {},

    onDigioModalClose = () => {},
    onDigioVerificationComplete = () => {},
    onDigioSuccess = () => {},
    onDigioError = () => {},
    onDigioSuccessModalClose = () => {},
    onDigioSuccessPayment = () => {},
    onTelegramModalClose = () => {},
    onTelegramModalSave = () => {},
    onTelegramInputChange = () => {},
    onPayUClose = () => {},
    onPayUSuccess = () => {},
    onPayUFailure = () => {},
  } = actions || {};

  // ---- Step 0: Personal Info ----
  const renderStep0 = () => (
    <View style={styles.stepContentContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Full Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.enhancedInput}
          value={name}
          onChangeText={onNameChange}
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
          onChangeText={onMobileNumberChange}
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
          onChangeText={onTelegramIdChange}
          placeholder="Enter Telegram ID"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <TouchableOpacity
        onPress={() => onCompleteStep(0)}
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

  // ---- Step 1: Investment / KYC ----
  const renderStep1 = () => (
    <View style={styles.stepContentContainer}>
      {isModelPortfolio && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            Investment Amount (₹) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.enhancedInput}
            value={invetAmount}
            onChangeText={onInvestAmountChange}
            placeholder={`Minimum ₹${minInvestment}`}
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
              : isPanValid
                ? [styles.successInput, {borderColor: stepCompletedColor}]
                : null,
          ]}
          value={panNumber}
          onChangeText={onPanChange}
          placeholder="Enter PAN (e.g., ABCDE1234F)"
          maxLength={10}
          autoCapitalize="characters"
          placeholderTextColor="#9ca3af"
        />
        {panError ? (
          <Text style={styles.errorText}>
            <XIcon size={12} color="#ef4444" /> {panError}
          </Text>
        ) : null}
        {isPanValid ? (
          <Text style={[styles.successText, {color: stepCompletedColor}]}>
            <Check size={12} color={stepCompletedColor} /> Valid PAN format
          </Text>
        ) : null}
      </View>

      <DatePickerSection
        birthDate={birthDate}
        setBirthDate={onBirthDateChange}
        userDetails={userDetails}
      />
      <TouchableOpacity
        onPress={() => onCompleteStep(1)}
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

  // ---- Step 2: Plan Selection ----
  const renderStep2 = () => {
    // Compute coupon/discount offer details for recurring section
    const offerDetails = appliedCoupon
      ? planDetails?.offer_plans_details?.find((detail) => {
        return (
          detail.couponId?.toString() === appliedCoupon?.couponId?.toString()
        );
      })
      : null;

    // Determine the frequency list for recurring
    const cashfree = String(viewModel?.adminpaymentPlatform || '').trim().toLowerCase() === 'cashfree';
    const frequency = offerDetails
      ? Object.keys(
        cashfree
          ? offerDetails.offer_cashfree_plan_ids || {}
          : offerDetails.offer_razorpay_plan_ids || {},
      )
      : planDetails?.frequency;

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

                      const durationLabel =
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
                            onSetOneTimeAmount(onetimefinal);
                            onCardClick(optionKey);
                            if (durationLabel) {
                              const numberOnly = parseInt(
                                durationLabel.match(/\d+/)?.[0],
                                10,
                              );
                              onSetOneTimeDurationPlan(numberOnly);
                            }
                            onSetSelectedPlanType('onetime');
                          }}>
                          <View style={{ alignItems: 'center' }}>
                            {/* Highlight duration at top-right */}
                            <View style={styles.durationBadgeContainer}>
                              <Text style={styles.durationBadgeText}>
                                {durationLabel}
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
                            onCardClick(item);
                            onSetSelectedPlanType('recurring');
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
                              ) : planDetails?.discountPercentage > 0 ? (
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
              )}
          </View>
        </View>
        <CouponCodeInput
          couponCode={couponCode}
          onCouponCodeChange={onCouponCodeChange}
          isApplyingCoupon={isApplyingCoupon}
          onApplyCoupon={onApplyCoupon}
          couponMessage={couponMessage}
          appliedCoupon={appliedCoupon}
          mainColor={mainColor}
          stepCompletedColor={stepCompletedColor}
        />

        <View style={styles.consentContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={onConsentToggle}>
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
                onPress={onShowDisclaimer}>
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
          onPress={onDigioPayment}
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
  };

  // ---- renderStepContent dispatcher ----
  const renderStepContent = (stepId) => {
    switch (stepId) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      default: return null;
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
                  {planType ? (
                    <View style={styles.planTypeTag}>
                      <Text style={styles.planTypeTagText}>
                        {planType}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.headerTitle}>{planName}</Text>
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
                  onPress={() => currentStep > index && onStepPress(index)}
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

      {digioModalOpen ? (
        <DigioModal
          authenticationUrl={authUrl}
          digioModalOpen={digioModalOpen}
          onClose={onDigioModalClose}
          onVerificationComplete={onDigioVerificationComplete}
          onSuccess={onDigioSuccess}
          onError={onDigioError}
        />
      ) : null}

      {/* PayU WebView Modal */}
      <PayUWebView
        visible={showPayUWebView}
        paymentData={payuFormData}
        isSI={payuIsSI}
        onSuccess={onPayUSuccess}
        onFailure={onPayUFailure}
        onClose={onPayUClose}
      />

      {/* Digio Success Modal - Anti-drop-off mechanism */}
      {digioSuccessModal && (
        <DigioSuccessModal
          visible={digioSuccessModal}
          onClose={onDigioSuccessModalClose}
          onProceedToPayment={onDigioSuccessPayment}
        />
      )}

      {/* Telegram Collection Modal */}
      {showTelegramModal && (
        <TelegramCollectionModal
          visible={showTelegramModal}
          onClose={onTelegramModalClose}
          onSave={onTelegramModalSave}
          initialValue={telegramInputValue}
          onValueChange={onTelegramInputChange}
          validateId={validateTelegramId}
        />
      )}

      {/* Disclaimer Modal */}
      <DisclaimerModal
        visible={showDisclaimer}
        onClose={onHideDisclaimer}
        whiteLabelText={whiteLabelText}
      />
    </>
  );
};

// ============================================================================
// StyleSheet — exact copy from original
// ============================================================================
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
    marginTop: 6,
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

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    borderColor: '#0056B7',
    backgroundColor: '#eff6ff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnselected: {
    borderColor: '#e5e7eb',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  durationText: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
  },
  lineThroughBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0056B7',
    textDecorationLine: 'line-through',
    marginRight: 2,
  },
  greenPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#29A400',
  },
  lineThroughGray: {
    fontSize: 10,
    marginRight: 5,
    color: '#6b7280',
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
  radioSelected: {
    borderColor: '#0056B7',
    backgroundColor: '#0056B7',
  },
  radioUnselected: {
    borderColor: '#d1d5db',
  },
  durationBadgeContainer: {
    position: 'absolute',
    top: -16,
    right: -6,
    backgroundColor: '#facc15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  durationBadgeText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: '#78350f',
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
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#0056B7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
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
    color: '#29A400',
  },
  errorMessage: {
    color: '#dc2626',
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
  spinning: {},
});

export default MPInvestNowModal;
