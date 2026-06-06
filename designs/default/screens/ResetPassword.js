/**
 * ResetPassword — design-system screen presentation (Phase F, 2026-05-01)
 *
 * Pure presentation. Container owns the Firebase sendPasswordResetEmail
 * call + form state. This renders the gradient hero + form.
 *
 * Contract:
 *   viewModel = {
 *     email, error, errorShow, success, isLoading,
 *     gradient: { start, end },
 *     logoComponent, whiteLabelText, iconColor, configLoading,
 *   }
 *   actions = { onEmailChange, onSubmit, onDismissError, onNavigateBack }
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
    Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { SvgUri } from 'react-native-svg';
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

const ResetPassword = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        email = '',
        error = '',
        errorShow = false,
        success = false,
        isLoading = false,
        gradient = {},
        logoComponent,
        whiteLabelText,
        iconColor,
        configLoading,
    } = viewModel || {};
    const {
        onEmailChange = () => {},
        onSubmit = () => {},
        onDismissError = () => Keyboard.dismiss(),
        onNavigateBack = () => {},
    } = actions || {};

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={onDismissError}>
                <LinearGradient
                    colors={[
                        gradient.start || 'rgba(0, 38, 81, 1)',
                        gradient.end || 'rgba(0, 86, 183, 1)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.container}
                >
                    <StatusBar barStyle="light-content" />

                    <View style={[styles.backgroundCircleabove, styles.circleOne]} />
                    <View style={[styles.backgroundCircle, styles.circleFour]} />
                    <View style={[styles.backgroundCircle, styles.circleTwo]} />
                    <View style={[styles.backgroundCircle, styles.circleThree]} />

                    <View style={styles.content}>
                        <TouchableOpacity style={{ marginBottom: 20 }} onPress={onNavigateBack}>
                            <Icon Component={ArrowLeft} size={22} color={tokens.colors.text.inverse} />
                        </TouchableOpacity>

                        <View style={styles.logoContainer}>
                            {renderLogo(logoComponent, configLoading, tokens.assets.logoPng)}
                            <Text
                                variant="title"
                                style={{
                                    fontSize: 22,
                                    fontWeight: '700',
                                    color: tokens.colors.text.inverse,
                                    letterSpacing: 1.5,
                                }}
                            >
                                {' '}{whiteLabelText}
                            </Text>
                        </View>

                        <Text
                            variant="title"
                            style={{
                                color: tokens.colors.text.inverse,
                                fontSize: 16,
                                fontFamily: 'Poppins-SemiBold',
                                marginBottom: 10,
                            }}
                        >
                            Forgot Password
                        </Text>
                        <Text
                            variant="caption"
                            style={{ color: '#BDCFFF', fontSize: 12, marginBottom: 25 }}
                        >
                            Enter your registered email to reset your password
                        </Text>

                        <View style={styles.inputContainer}>
                            <Icon Component={Mail} color={iconColor || 'rgba(100, 199, 59, 1)'} size={16} style={{ marginRight: 10 }} />
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

                        {success && (
                            <Text variant="bodyEmphasis" style={{ color: tokens.colors.status.success, fontFamily: 'Poppins-SemiBold', textAlign: 'center', marginBottom: 10, fontSize: 13 }}>
                                Password reset email sent successfully.
                            </Text>
                        )}
                        {isLoading && (
                            <Spinner size="large" color="#FFFFFF" style={{ marginVertical: 10 }} />
                        )}
                        {errorShow && (
                            <Text variant="caption" style={{ color: '#FF6B6B', textAlign: 'center', marginBottom: 10, fontSize: 13 }}>
                                {error}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={onSubmit}
                            disabled={isLoading}
                        >
                            <Text variant="button" style={{ color: '#FFFFFF', fontSize: 14 }}>Send Link</Text>
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
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 15,
        paddingHorizontal: 15,
        height: 40,
    },
    input: { height: '100%', color: '#000', fontSize: 13 },
    resetButton: {
        backgroundColor: 'rgba(41, 164, 0, 1)',
        paddingVertical: 5,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
        marginTop: 15,
    },
});

export default ResetPassword;
