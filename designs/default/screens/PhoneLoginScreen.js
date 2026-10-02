/**
 * PhoneLoginScreen — phone-first login flow (Tier 1)
 *
 * Ported from arfs_app's original pre-sync flow (2026-07-17, see arfs_app
 * git tag `pre-fullsync-20260717`) and upstreamed into Alphab2bapp as a
 * fleet-wide, config-gated feature. Gated end-to-end by
 * `config.phoneFirstLoginEnabled` (default OFF) — reached only via
 * OnboardingScreen, which SplashScreen only routes to when the advisor has
 * opted in. See ConfigContext.js + Models/AdvisorConfigModel.js
 * `phone_first_login_enabled` (aq_backend_github).
 *
 * NOT the same screen as PhoneNumberScreen.js (which collects a phone number
 * from an already-authenticated user to complete their profile). This screen
 * runs BEFORE authentication and only captures phone + FCM token as a lead
 * signal — it does not perform Firebase phone-number OTP verification. The
 * `phoneVerified: true` param passed to Login is inherited from arfs's
 * original naming and means "phone was collected here", not "OTP-verified";
 * kept as-is as this port does not change auth semantics.
 *
 * De-tenanting: the arfs original read the logo/gradient/advisor-name from
 * the static, build-time `APP_VARIANTS[Config.APP_VARIANT]` object and
 * hardcoded 'ARFS' as the text fallback. This version reads all of that from
 * `useConfig()` (backend-driven, falls back to the variant defaults itself)
 * and `getAdvisorSubdomain()`, matching the pattern already used by
 * PhoneNumberScreen.js / LoginScreen.js elsewhere in this app.
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import CountryCodeDropdownPicker from 'react-native-dropdown-country-picker';
import {CheckIcon} from 'lucide-react-native';
import {SvgUri} from 'react-native-svg';
import {designColor, designFont} from '../../../src/design/literalTokens';

const PhoneLoginScreen = ({viewModel, actions, slots}) => {
  const {
    LogoComponent,
    logoPng,
    gradient1,
    gradient2,
    whiteLabelText,
    countryCode,
    phoneNumber,
    isChecked,
    modalVisible,
  } = viewModel;
  const {TermsModal, Toast} = slots;

  // Logo cascade mirrors SplashScreen.js — advisor-provided logo
  // (URL/SVG/require) wins; falls back to the variant's brand-mark asset
  // token when none is set. See theme/assets.js § Variant assets.
  const renderLogo = () => {
    if (LogoComponent && typeof LogoComponent === 'function') {
      return <LogoComponent width={60} height={60} />;
    }
    if (LogoComponent && typeof LogoComponent === 'string' && LogoComponent.endsWith('.svg')) {
      return <SvgUri uri={LogoComponent} width={60} height={60} />;
    }
    if (LogoComponent && typeof LogoComponent === 'string') {
      return <Image source={{uri: LogoComponent}} style={styles.logoImage} />;
    }
    if (LogoComponent && typeof LogoComponent === 'object' && LogoComponent.uri) {
      return <Image source={{uri: LogoComponent.uri}} style={styles.logoImage} />;
    }
    if (LogoComponent && typeof LogoComponent === 'object') {
      return <Image source={LogoComponent} style={styles.logoImage} />;
    }
    return (
      <Image
        source={logoPng}
        style={styles.logoImage}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}>
      <TouchableWithoutFeedback onPress={actions.onDismissKeyboard}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.container}>
          <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Decorative background circles */}
            <View style={[styles.backgroundCircle, styles.circleOne]} />
            <View style={[styles.backgroundCircle, styles.circleTwo]} />
            <View style={[styles.backgroundCircle, styles.circleThree]} />

            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                {renderLogo()}
                <Text style={styles.logoText}>{whiteLabelText}</Text>
              </View>

              <View style={styles.titleContainer}>
                <Text style={styles.title}>Enter your phone number</Text>
                <View style={styles.underline} />
              </View>
              <Text style={styles.subtitle}>
                Enter your phone number to continue
              </Text>

              {/* Phone Input */}
              <View style={styles.phoneInputContainer}>
                <CountryCodeDropdownPicker
                  selected={countryCode}
                  setSelected={actions.onCountryCodeChange}
                  setCountryDetails={actions.onCountryChange}
                  phone={phoneNumber}
                  searchTextStyles={{color: 'black', fontSize: 14}}
                  phoneStyles={{
                    padding: 0,
                    color: designColor('1f2937'),
                    fontFamily: designFont('Satoshi-Medium'),
                    fontSize: 15,
                  }}
                  countryCodeContainerStyles={{
                    padding: 8,
                    backgroundColor: designColor('ffffff'),
                    borderRadius: 12,
                  }}
                  setPhone={actions.onPhoneChange}
                  dropdownTextStyles={{color: 'black', fontFamily: designFont('Satoshi-Medium')}}
                  countryCodeTextStyles={{
                    fontSize: 15,
                    fontFamily: designFont('Satoshi-Medium'),
                    color: designColor('1f2937'),
                  }}
                />
              </View>

              {/* Terms Checkbox */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkboxTouchable}
                  onPress={actions.onToggleTerms}>
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <CheckIcon size={14} color={designColor('fff')} />}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={actions.onOpenTerms}>
                  <Text style={styles.tcText}>
                    I agree to the Terms & Conditions
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={styles.continueButton}
                onPress={actions.onContinue}>
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>

            <TermsModal
              modalVisible={modalVisible}
              setModalVisible={actions.onModalVisibleChange}
              setIsChecked={actions.onTermsChange}
            />
            <Toast />
          </View>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  backgroundCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 500,
  },
  circleOne: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  circleTwo: {
    width: 200,
    height: 200,
    bottom: -50,
    left: -50,
  },
  circleThree: {
    width: 150,
    height: 150,
    bottom: 100,
    right: -30,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: designColor('fff'),
    letterSpacing: 1,
    marginLeft: 12,
    fontFamily: designFont('Satoshi-Bold'),
  },
  titleContainer: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    color: designColor('ffffff'),
    fontSize: 18,
    fontFamily: designFont('Satoshi-Bold'),
  },
  underline: {
    height: 3,
    width: 60,
    backgroundColor: designColor('6366f1'),
    marginTop: 6,
    borderRadius: 2,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 30,
    fontFamily: designFont('Satoshi-Regular'),
  },
  phoneInputContainer: {
    backgroundColor: designColor('ffffff'),
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: designColor('000'),
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxTouchable: {
    marginRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: designColor('6366f1'),
    borderColor: designColor('6366f1'),
  },
  tcText: {
    color: designColor('93c5fd'),
    textDecorationLine: 'underline',
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 14,
  },
  continueButton: {
    backgroundColor: designColor('6366f1'),
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: designColor('6366f1'),
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonText: {
    color: designColor('ffffff'),
    fontSize: 16,
    fontFamily: designFont('Satoshi-Bold'),
  },
});

export default PhoneLoginScreen;
