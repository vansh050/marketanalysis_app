/**
 * EmailScreenAppleLogin — design-system screen presentation (Phase F, 2026-05-01)
 *
 * Pure presentation. Container owns the email validation + onSubmit callback
 * routing. This renders the form + Toast host.
 *
 * Contract:
 *   viewModel = { email, isLoading, gradient: { start, end } }
 *   actions   = { onEmailChange, onSubmit, onCancel }
 */

import React from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { Mail } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import Spinner from '../primitives/Spinner';

const EmailScreenAppleLogin = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const { email = '', isLoading = false, gradient = {} } = viewModel || {};
    const { onEmailChange = () => {}, onSubmit = () => {}, onCancel = () => {} } = actions || {};

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
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
                <View style={[styles.backgroundCircle, styles.circleOne]} />
                <View style={[styles.backgroundCircle, styles.circleTwo]} />

                <View style={styles.content}>
                    <Text
                        variant="title"
                        style={{
                            fontFamily: 'Poppins-SemiBold',
                            color: tokens.colors.text.inverse,
                            textAlign: 'center',
                            marginBottom: 10,
                            fontSize: 22,
                        }}
                    >
                        Enter Your Email
                    </Text>
                    <Text
                        variant="body"
                        style={{
                            fontFamily: 'Poppins-Regular',
                            color: '#BDCFFF',
                            textAlign: 'center',
                            marginBottom: 30,
                            lineHeight: 22,
                            paddingHorizontal: 10,
                        }}
                    >
                        We need your email address to complete the Apple Sign-In process. Apple has hidden your email for privacy.
                    </Text>

                    <View style={styles.inputContainer}>
                        <Icon Component={Mail} size={16} color="rgba(100, 199, 59, 1)" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#9E9E9E"
                            value={email}
                            onChangeText={(text) => onEmailChange(text.toLowerCase())}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity onPress={onSubmit} style={styles.submitButton} disabled={isLoading}>
                        {isLoading ? (
                            <Spinner size="small" color="#fff" />
                        ) : (
                            <Text variant="button" style={{ color: '#fff', fontSize: 16 }}>Continue</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onCancel} style={styles.cancelButton} disabled={isLoading}>
                        <Text variant="button" style={{ color: '#BDCFFF', fontSize: 16 }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
                <Toast />
            </LinearGradient>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center' },
    backgroundCircle: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 500 },
    circleOne: { width: 300, height: 300, top: -80, right: -80 },
    circleTwo: { width: 250, height: 250, bottom: -50, left: -50 },
    content: { paddingHorizontal: 20 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 20,
        paddingHorizontal: 15,
        height: 50,
    },
    input: { flex: 1, height: '100%', color: '#000', fontSize: 14, fontFamily: 'Poppins-Regular' },
    submitButton: {
        backgroundColor: 'rgba(41, 164, 0, 1)',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        marginBottom: 15,
    },
    cancelButton: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});

export default EmailScreenAppleLogin;
