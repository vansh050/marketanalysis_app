/**
 * LoginScreen — design-system screen presentation (Phase F batch 2, 2026-05-01)
 *
 * Pure presentation. Container owns the entire auth orchestration:
 * Firebase email auth, Google sign-in (GoogleSignin SDK), Apple sign-in
 * (appleAuth SDK), post-login navigation (3 paths: auto-resolve advisor /
 * fallback to RA details / direct to Home), backend user create/get,
 * tracking calls. All ~600 lines of handlers stay in src/.
 *
 * Contract:
 *   viewModel = {
 *     email, password, isPasswordVisible, error, errorShow, isLoading,
 *     logoComponent, configLoading, whiteLabelText,
 *     showAppleButton,                  // Platform.OS === 'ios'
 *   }
 *   actions = {
 *     onEmailChange, onPasswordChange, onPasswordVisibilityToggle,
 *     onLogin, onGoogleLogin, onAppleLogin,
 *     onForgotPassword, onNavigateToSignup,
 *     dismissKeyboard,
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
import { Mail, Lock, Eye } from 'lucide-react-native';
import { SvgUri } from 'react-native-svg';
import Config from 'react-native-config';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import Spinner from '../primitives/Spinner';

const Glogo = require('../../../src/assets/GLogo.png');

// Module-scope `require(...)` of the default-variant logo intentionally
// removed in Phase 2 (whitelabel-sync, 2026-05-09). The default logo now
// comes from `useTokens().assets.logoPng` so a variant overlay's
// `designs/<variant>/tokens/assets.js` can swap it without touching this
// presentation file. See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.

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

const LoginScreen = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        email = '',
        password = '',
        isPasswordVisible = false,
        error = '',
        errorShow = false,
        isLoading = false,
        logoComponent,
        configLoading,
        whiteLabelText,
        showAppleButton = false,
    } = viewModel || {};
    const {
        onEmailChange = () => {},
        onPasswordChange = () => {},
        onPasswordVisibilityToggle = () => {},
        onLogin = () => {},
        onGoogleLogin = () => {},
        onAppleLogin = () => {},
        onForgotPassword = () => {},
        onNavigateToSignup = () => {},
        dismissKeyboard = () => {},
    } = actions || {};

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <LinearGradient
                    colors={['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.container}
                >
                    <View style={styles.container}>
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

                            <View style={{ alignItems: 'flex-start', alignSelf: 'flex-start' }}>
                                <Text
                                    variant="title"
                                    style={{ color: tokens.colors.text.inverse, fontSize: 14, fontFamily: 'Poppins-SemiBold' }}
                                >
                                    Your {whiteLabelText || Config?.REACT_APP_WHITE_LABEL_TEXT} Universe Awaits
                                </Text>
                                <View style={styles.underline} />
                            </View>
                            <Text
                                variant="caption"
                                style={{ color: '#BDCFFF', fontSize: 12, marginBottom: 35 }}
                            >
                                Its only takes a minute to create your account
                            </Text>

                            <View style={styles.inputContainer}>
                                <Icon Component={Mail} color="rgba(100, 199, 59, 1)" size={16} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email address"
                                    placeholderTextColor="#9E9E9E"
                                    value={email}
                                    onChangeText={(text) => onEmailChange(text.toLowerCase())}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
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
                                />
                                <TouchableOpacity onPress={onPasswordVisibilityToggle}>
                                    <Icon Component={Eye} color="#9E9E9E" size={20} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={onForgotPassword}>
                                <Text variant="bodyEmphasis" style={styles.forgotPassword}>Forgot Password?</Text>
                            </TouchableOpacity>

                            {isLoading && <Spinner size="large" color="#FFFFFF" style={{ marginVertical: 10 }} />}
                            {errorShow && (
                                <Text variant="caption" style={{ color: '#FF6B6B', textAlign: 'center', marginBottom: 10, fontSize: 14 }}>
                                    {error}
                                </Text>
                            )}

                            <TouchableOpacity style={styles.loginButton} onPress={onLogin} disabled={isLoading}>
                                <Text variant="button" style={{ color: tokens.colors.text.inverse, fontSize: 14 }}>Log In</Text>
                            </TouchableOpacity>

                            <View style={styles.orContainer}>
                                <View style={styles.orLine} />
                                <Text variant="caption" style={{ color: '#BDCFFF', marginHorizontal: 15, fontSize: 14 }}>OR</Text>
                                <View style={styles.orLine} />
                            </View>

                            <TouchableOpacity style={styles.googleButton} onPress={onGoogleLogin} disabled={isLoading}>
                                <Image source={Glogo} style={styles.googleIcon} />
                                <Text variant="button" style={{ color: '#333333', fontSize: 14 }}>Continue With Google</Text>
                            </TouchableOpacity>

                            {showAppleButton && (
                                <TouchableOpacity style={styles.appleButton} onPress={onAppleLogin} disabled={isLoading}>
                                    <Text style={{ fontSize: 18, color: '#FFFFFF', marginRight: 10 }}></Text>
                                    <Text variant="button" style={{ color: '#FFFFFF', fontSize: 14 }}>Continue With Apple</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.signupContainer}>
                            <Text variant="bodyEmphasis" style={{ color: tokens.colors.text.inverse, fontSize: 14 }}>
                                Don't have an account?{' '}
                            </Text>
                            <TouchableOpacity onPress={onNavigateToSignup}>
                                <Text variant="bodyEmphasis" style={{ color: '#85F500', fontSize: 14, marginLeft: 5 }}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                        <Toast />
                    </View>
                </LinearGradient>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'space-between' },
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
    forgotPassword: {
        color: 'rgba(133, 245, 0, 1)',
        textAlign: 'right',
        marginBottom: 20,
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
    },
    loginButton: {
        backgroundColor: 'rgba(41, 164, 0, 1)',
        paddingVertical: 5,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
    },
    orContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 25 },
    orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        borderRadius: 3,
        height: 45,
    },
    googleIcon: { width: 22, height: 22, marginRight: 15 },
    appleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        paddingVertical: 14,
        borderRadius: 3,
        height: 45,
        marginTop: 12,
    },
    signupContainer: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default LoginScreen;
