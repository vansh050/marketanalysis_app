/**
 * SignupScreen — design-system screen presentation (Phase F batch 2, 2026-05-01)
 *
 * Pure presentation. Container owns Firebase email signup + post-signup
 * orchestration (3 paths: hasAdvisorRaCode + auto-resolve + fallback to
 * SignUpRADetails) + tracking calls.
 *
 * Contract:
 *   viewModel = {
 *     email, name, password, isPasswordVisible, isChecked,
 *     error, errorShow, success, isLoading,
 *     gradient: { start, end },
 *     logoComponent, configLoading, whiteLabelText,
 *   }
 *   actions = {
 *     onEmailChange, onNameChange, onPasswordChange,
 *     onPasswordVisibilityToggle, onTermsToggle,
 *     onSignup, dismissError,
 *     onNavigateToLogin, onOpenTerms, onOpenPrivacy,
 *   }
 */

import React from 'react';
import {
    View,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    TouchableOpacity,
    TextInput,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { Mail, Lock, Eye, CheckIcon, User } from 'lucide-react-native';
import { SvgUri } from 'react-native-svg';
import Config from 'react-native-config';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import Spinner from '../primitives/Spinner';

// Default-variant logo now resolved via `useTokens().assets.logoPng` and
// passed in as `defaultLogo`. See Phase 2 (whitelabel-sync, 2026-05-09) and
// docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.

const renderLogo = (LogoComponent, configLoading, defaultLogo) => {
    if (configLoading) return <View style={styles.logo} />;
    if (LogoComponent && typeof LogoComponent === 'function') {
        return <LogoComponent style={styles.logo} />;
    }
    if (LogoComponent && typeof LogoComponent === 'string' && LogoComponent.endsWith('.svg')) {
        return <SvgUri uri={LogoComponent} width={styles.logo.width} height={styles.logo.height} />;
    }
    if (LogoComponent && typeof LogoComponent === 'string') {
        return <Image source={{ uri: LogoComponent }} style={styles.logo} resizeMode="contain" />;
    }
    if (LogoComponent && typeof LogoComponent === 'object' && LogoComponent.uri) {
        return <Image source={{ uri: LogoComponent.uri }} style={styles.logo} resizeMode="contain" />;
    }
    if (LogoComponent && typeof LogoComponent === 'object') {
        return <Image source={LogoComponent} style={styles.logo} resizeMode="contain" />;
    }
    return <Image source={defaultLogo} style={styles.logo} resizeMode="contain" />;
};

const SignupScreen = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        email = '',
        name = '',
        password = '',
        isPasswordVisible = false,
        isChecked = false,
        error = '',
        errorShow = false,
        success = '',
        isLoading = false,
        gradient = {},
        logoComponent,
        configLoading,
        whiteLabelText,
    } = viewModel || {};
    const {
        onEmailChange = () => {},
        onNameChange = () => {},
        onPasswordChange = () => {},
        onPasswordVisibilityToggle = () => {},
        onTermsToggle = () => {},
        onSignup = () => {},
        dismissError = () => {},
        onNavigateToLogin = () => {},
        onOpenTerms = () => {},
        onOpenPrivacy = () => {},
    } = actions || {};

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'space-between' }}
        >
            <TouchableWithoutFeedback onPress={dismissError}>
                <LinearGradient
                    colors={[
                        gradient.start || 'rgba(0, 38, 81, 1)',
                        gradient.end || 'rgba(0, 86, 183, 1)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.container, { justifyContent: 'space-between' }]}
                >
                    <StatusBar barStyle="light-content" />

                    <View style={[styles.backgroundCircleabove, styles.circleOne]} />
                    <View style={[styles.backgroundCircle, styles.circleFour]} />
                    <View style={[styles.backgroundCircle, styles.circleTwo]} />
                    <View style={[styles.backgroundCircle, styles.circleThree]} />

                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            {renderLogo(logoComponent, configLoading, tokens.assets.logoPng)}
                            <Text variant="title" style={styles.logoText}>
                                {whiteLabelText || Config?.REACT_APP_WHITE_LABEL_TEXT}
                            </Text>
                        </View>

                        <View style={{ alignItems: 'flex-start' }}>
                            <Text
                                variant="title"
                                style={{ color: tokens.colors.text.inverse, fontSize: 14, fontFamily: 'Poppins-SemiBold' }}
                            >
                                Step into the Future with {whiteLabelText || Config?.REACT_APP_WHITE_LABEL_TEXT}!
                            </Text>
                            <View style={styles.underline} />
                        </View>
                        <Text variant="caption" style={{ color: '#BDCFFF', fontSize: 12, marginBottom: 35 }}>
                            It only takes a minute to create your account
                        </Text>

                        <View style={styles.inputContainer}>
                            <Icon Component={User} color="rgba(100, 199, 59, 1)" size={16} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor="#9E9E9E"
                                value={name}
                                onChangeText={onNameChange}
                                keyboardType="default"
                                autoCapitalize="words"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon Component={Mail} color="rgba(100, 199, 59, 1)" size={16} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email address"
                                placeholderTextColor="#9E9E9E"
                                value={email}
                                onChangeText={(text) => onEmailChange(text.toLowerCase().trim())}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon Component={Lock} color="rgba(100, 199, 59, 1)" size={16} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#9E9E9E"
                                value={password}
                                onChangeText={onPasswordChange}
                                secureTextEntry={!isPasswordVisible}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity onPress={onPasswordVisibilityToggle}>
                                <Icon Component={Eye} color="#9E9E9E" size={20} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.checkboxContainer}>
                            <TouchableOpacity style={styles.checkboxWrapper} onPress={onTermsToggle}>
                                <View style={styles.checkbox}>
                                    {isChecked && (
                                        <Icon Component={CheckIcon} size={14} color={'rgba(0, 86, 183, 1)'} style={{ alignSelf: 'center' }} />
                                    )}
                                </View>
                            </TouchableOpacity>
                            <View style={styles.tcTextContainer}>
                                <Text variant="caption" style={styles.tcText}>
                                    I agree to the {whiteLabelText || Config?.REACT_APP_WHITE_LABEL_TEXT}{' '}
                                </Text>
                                <TouchableOpacity onPress={onOpenTerms}>
                                    <Text variant="caption" style={styles.tcText2}>Terms of Service</Text>
                                </TouchableOpacity>
                                <Text variant="caption" style={styles.tcText}> and </Text>
                                <TouchableOpacity onPress={onOpenPrivacy}>
                                    <Text variant="caption" style={styles.tcText2}>Privacy Policy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isLoading && <Spinner size="large" color="#FFFFFF" style={{ marginVertical: 10 }} />}
                        {errorShow && (
                            <Text variant="caption" style={{ color: '#FF6B6B', textAlign: 'center', marginBottom: 10, fontSize: 14, paddingHorizontal: 10 }}>
                                {error}
                            </Text>
                        )}
                        {success && (
                            <Text variant="caption" style={{ color: 'lightgreen', textAlign: 'center', marginBottom: 10, fontSize: 14 }}>
                                {success}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
                            onPress={onSignup}
                            disabled={isLoading}
                        >
                            <Text variant="button" style={{ color: tokens.colors.text.inverse, fontSize: 14 }}>
                                {isLoading ? 'Creating Account...' : 'Create Account'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Toast />
                    <View style={styles.loginContainer}>
                        <Text variant="body" style={{ color: tokens.colors.text.inverse, fontSize: 14 }}>
                            Already have an account?{' '}
                        </Text>
                        <TouchableOpacity onPress={onNavigateToLogin} disabled={isLoading}>
                            <Text variant="bodyEmphasis" style={{ color: 'rgba(133, 245, 0, 1)', fontSize: 14, marginLeft: 5 }}>
                                Sign In
                            </Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-start' },
    backgroundCircle: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 500 },
    backgroundCircleabove: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 500 },
    circleOne: { width: 350, height: 350, top: -80, right: -80 },
    circleFour: { width: 300, height: 300, top: -80, right: -80 },
    circleTwo: { width: 250, height: 250, bottom: -50, left: -50 },
    circleThree: { width: 250, height: 250, bottom: -100, left: -100 },
    content: { paddingTop: 50, paddingHorizontal: 20 },
    logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    logo: { width: 40, height: 40, marginRight: 8 },
    logoText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 1.5,
        fontFamily: Platform.select({ ios: 'Azonix', android: 'Azonix', default: 'System' }),
    },
    underline: { height: 2, width: '100%', backgroundColor: '#0D47A1', marginTop: 4 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 15,
        paddingHorizontal: 15,
        height: 40,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, height: '100%', color: '#000', fontSize: 13 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    checkboxWrapper: { marginRight: 10 },
    checkbox: {
        width: 15,
        height: 15,
        borderWidth: 1,
        borderRadius: 0,
        borderColor: 'white',
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tcTextContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', flex: 1, marginLeft: 5 },
    tcText: { color: '#fff', fontFamily: 'Poppins-Medium', fontSize: 12 },
    tcText2: { color: 'rgba(133, 245, 0, 1)', fontFamily: 'Poppins-Medium', fontSize: 12, textDecorationLine: 'underline' },
    signupButton: {
        backgroundColor: 'rgba(41, 164, 0, 1)',
        paddingVertical: 5,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
    },
    signupButtonDisabled: { backgroundColor: 'rgba(41, 164, 0, 0.6)' },
    loginContainer: { marginBottom: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});

export default SignupScreen;
