import React, {useMemo} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, FlatList} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const InvestFlowScreen = ({viewModel, actions}) => {
  const {
    portfolio, currentStep, completedSteps, name, email, phone,
    selectedCountry, phoneError, telegram, residencyType, pan, panError,
    dob, gst, gstError, hasIndianPan, form60Acknowledged, passport,
    ociPio, addressLine1, addressLine2, city, country, postalCode,
    nationality, investmentAmount, investmentError, isFree, pricingKeys,
    selectedTier, couponCode, couponLoading, couponMessage, couponIsError,
    discountAmount, selectedAmount, payableAmount, consentChecked, loading,
    showCountryPicker, countrySearch, countryCodes, nationalities,
  } = viewModel;
  const COUNTRY_CODES = countryCodes;
  const NATIONALITIES = nationalities;
  const {
    onBack, setName, setEmail, setPhone, setTelegram, setShowCountryPicker,
    setResidencyType, setForm60Acknowledged, setPan, setDob, setGst,
    setHasIndianPan, setPassport, setOciPio, setAddressLine1,
    setAddressLine2, setCity, setCountry, setPostalCode, setNationality,
    setInvestmentAmount, setSelectedTier, setCouponApplied, setCouponCode,
    setDiscountAmount, setCouponMessage, setConsentChecked, setCountrySearch,
    setSelectedCountry, validatePhone, validatePan, validateGst,
    validateInvestment, isStepValid, goToStep, submitLeadUser, applyCoupon,
    handleFreeSubscribe, handlePayDispatch,
  } = actions;
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
        <TouchableOpacity onPress={() => onBack()} style={styles.backBtn}>
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
                      {couponLoading ? <ActivityIndicator size="small" color={designColor('fff')} /> :
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
                onPress={isFree ? handleFreeSubscribe : handlePayDispatch}
                disabled={!isStepValid(3) || loading}
              >
                {loading ? <ActivityIndicator color={designColor('fff')} /> :
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
  container: { flex: 1, backgroundColor: designColor('f8f9fc') },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: designColor('1a237e'),
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: designColor('fff'), fontSize: 22, fontWeight: '600' },
  headerTitle: { color: designColor('fff'), fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  progressBar: { height: 4, backgroundColor: designColor('e0e0e0') },
  progressFill: { height: 4, backgroundColor: designColor('4caf50') },

  scrollContent: { paddingBottom: 40 },

  // Step headers
  stepHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: designColor('e8e8e8'), backgroundColor: designColor('fff'),
  },
  stepHeaderActive: { backgroundColor: designColor('f3f4ff') },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: designColor('ccc'),
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  stepCircleCompleted: { backgroundColor: designColor('4caf50'), borderColor: designColor('4caf50') },
  stepCircleCurrent: { borderColor: designColor('1a237e') },
  stepNum: { fontSize: 13, fontWeight: '700', color: designColor('999') },
  stepNumActive: { color: designColor('fff') },
  stepTitle: { fontSize: 15, fontWeight: '600', color: designColor('666') },
  stepTitleActive: { color: designColor('1a237e') },

  stepContent: { padding: 20, backgroundColor: designColor('fff'), borderBottomWidth: 1, borderBottomColor: designColor('e8e8e8') },

  label: { fontSize: 13, fontWeight: '600', color: designColor('333'), marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: designColor('1a237e'), marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: designColor('f8f9fc'), borderWidth: 1, borderColor: designColor('e0e0e0'),
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: designColor('333'),
  },
  inputError: { borderColor: designColor('ef5350') },
  inputText: { fontSize: 15, color: designColor('333') },
  placeholderText: { fontSize: 15, color: designColor('999') },
  errorText: { fontSize: 12, color: designColor('ef5350'), marginTop: 4 },

  phoneRow: { flexDirection: 'row', gap: 8 },
  countryBtn: {
    backgroundColor: designColor('f8f9fc'), borderWidth: 1, borderColor: designColor('e0e0e0'),
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center',
  },
  countryBtnText: { fontSize: 15, fontWeight: '600', color: designColor('333') },
  phoneInput: { flex: 1 },

  residencyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  residencyCard: {
    flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: designColor('e0e0e0'),
    alignItems: 'center', backgroundColor: designColor('f8f9fc'),
  },
  residencyCardActive: { borderColor: designColor('1a237e'), backgroundColor: designColor('e8eaf6') },
  residencyText: { fontSize: 11, fontWeight: '600', color: designColor('666'), textAlign: 'center' },
  residencyTextActive: { color: designColor('1a237e') },

  panToggle: { marginTop: 10 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  toggleBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: designColor('e0e0e0'), backgroundColor: designColor('f8f9fc'),
  },
  toggleBtnActive: { borderColor: designColor('1a237e'), backgroundColor: designColor('e8eaf6') },
  toggleText: { fontSize: 14, fontWeight: '600', color: designColor('666') },
  toggleTextActive: { color: designColor('1a237e') },

  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: designColor('ccc'),
    justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: designColor('1a237e'), borderColor: designColor('1a237e') },
  checkmark: { color: designColor('fff'), fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1, fontSize: 13, color: designColor('555'), lineHeight: 20 },

  continueBtn: {
    backgroundColor: designColor('1a237e'), paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: designColor('fff'), fontSize: 16, fontWeight: '700' },

  // Plan & Payment
  freeBanner: {
    padding: 16, backgroundColor: designColor('e8f5e9'), borderRadius: 12, alignItems: 'center', marginBottom: 16,
  },
  freeText: { fontSize: 16, fontWeight: '700', color: designColor('2e7d32') },

  tierCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderWidth: 1, borderColor: designColor('e0e0e0'), borderRadius: 12, marginBottom: 8, backgroundColor: designColor('f8f9fc'),
  },
  tierCardActive: { borderColor: designColor('1a237e'), backgroundColor: designColor('e8eaf6') },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: designColor('ccc'), marginRight: 12 },
  radioActive: { borderColor: designColor('1a237e'), backgroundColor: designColor('1a237e') },
  tierLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: designColor('333') },
  tierPrice: { fontSize: 16, fontWeight: '700', color: designColor('1a237e') },

  couponRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  couponInput: { flex: 1 },
  couponBtn: {
    backgroundColor: designColor('1a237e'), paddingHorizontal: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  couponBtnText: { color: designColor('fff'), fontSize: 14, fontWeight: '700' },
  couponMsg: { fontSize: 12, color: designColor('4caf50'), marginTop: 6 },
  couponMsgError: { color: designColor('ef5350') },

  priceBreakdown: { marginTop: 12, padding: 12, backgroundColor: designColor('f5f5f5'), borderRadius: 10 },
  priceLabel: { fontSize: 13, color: designColor('666'), marginBottom: 4 },
  priceTotal: { fontSize: 16, fontWeight: '700', color: designColor('1a237e'), marginTop: 4 },

  payBtn: {
    backgroundColor: designColor('2e7d32'), paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 20,
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnText: { color: designColor('fff'), fontSize: 17, fontWeight: '700' },

  // Country picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: designColor('fff'), borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: designColor('333'), marginBottom: 12 },
  modalSearch: {
    backgroundColor: designColor('f5f5f5'), borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 12,
  },
  countryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: designColor('f0f0f0') },
  countryName: { fontSize: 15, color: designColor('333') },
  countryDial: { fontSize: 15, fontWeight: '600', color: designColor('1a237e') },
  modalClose: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: designColor('999') },
});

export default InvestFlowScreen;
