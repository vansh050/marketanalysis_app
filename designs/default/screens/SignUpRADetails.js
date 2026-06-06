/**
 * SignUpRADetails — design-system screen presentation (Phase F batch 3, 2026-05-01)
 *
 * Pure presentation. Container owns RA-ID validation +
 * updateRACodeAndConfig + reload + tracking + post-success navigation.
 *
 * Contract:
 *   viewModel = {
 *     raId, isLoading, statusMessage,
 *     isSuccessModalVisible, isModalLoading,
 *     gradient: { start, end },
 *     logo, appName,
 *   }
 *   actions = {
 *     onRaIdChange, onCreateAccount,
 *     onSuccessModalOk, onCloseSuccessModal,
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
    Modal,
    Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Key } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import Spinner from '../primitives/Spinner';

const SignUpRADetails = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        raId = '',
        isLoading = false,
        statusMessage = '',
        isSuccessModalVisible = false,
        isModalLoading = false,
        gradient = {},
        logo,
        appName,
    } = viewModel || {};
    const {
        onRaIdChange = () => {},
        onCreateAccount = () => {},
        onSuccessModalOk = () => {},
        onCloseSuccessModal = () => {},
    } = actions || {};

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <LinearGradient
                    colors={[gradient.start || '#03275B', gradient.end || '#0156B7']}
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
                        <View style={styles.logoContainer}>
                            {logo && typeof logo === 'string' ? (
                                <Image source={{ uri: logo }} style={styles.logoImage} resizeMode="contain" />
                            ) : logo && typeof logo === 'function' ? (
                                (() => {
                                    const LogoComponent = logo;
                                    return <LogoComponent width={180} height={50} />;
                                })()
                            ) : logo ? (
                                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
                            ) : (
                                <Text variant="title" style={styles.logoText}>{appName}</Text>
                            )}
                        </View>

                        {statusMessage ? (
                            <View style={styles.statusContainer}>
                                <Text variant="caption" style={styles.statusText}>{statusMessage}</Text>
                                {isLoading && <Spinner size="small" color="#85F500" style={{ marginLeft: 8 }} />}
                            </View>
                        ) : null}

                        <Text variant="body" style={styles.label}>Enter your Unique RA ID</Text>
                        <View style={styles.inputContainer}>
                            <Icon Component={Key} color="rgba(100, 199, 59, 1)" size={16} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="XXXXXXXX1112"
                                placeholderTextColor="#C8D1E1"
                                value={raId}
                                onChangeText={onRaIdChange}
                                keyboardType="default"
                                autoCapitalize="characters"
                                editable={!isLoading}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={onCreateAccount}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Spinner size="small" color="#fff" />
                                    <Text variant="button" style={styles.loadingText}>Processing...</Text>
                                </View>
                            ) : (
                                <Text variant="button" style={styles.buttonText}>Create account</Text>
                            )}
                        </TouchableOpacity>

                        <Text variant="caption" style={styles.helpText}>
                            Don't have an RA ID? Contact your financial advisor.
                        </Text>
                    </View>
                </LinearGradient>
            </TouchableWithoutFeedback>

            <Modal
                transparent
                animationType="fade"
                visible={isSuccessModalVisible}
                onRequestClose={onCloseSuccessModal}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            backgroundColor: tokens.colors.surface.card,
                            borderRadius: 10,
                            padding: 24,
                            alignItems: 'center',
                            width: 280,
                        }}
                    >
                        <Text variant="title" style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#29A400' }}>
                            Account Created
                        </Text>
                        <Text variant="body" style={{ fontSize: 15, color: '#222', textAlign: 'center', marginBottom: 20 }}>
                            Your account has been created successfully!
                        </Text>
                        {isModalLoading ? (
                            <Spinner size="large" color="#29A400" />
                        ) : (
                            <TouchableOpacity
                                onPress={onSuccessModalOk}
                                activeOpacity={0.7}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={{
                                    backgroundColor: '#29A400',
                                    paddingHorizontal: 40,
                                    paddingVertical: 14,
                                    borderRadius: 8,
                                    minWidth: 120,
                                    minHeight: 48,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text variant="button" style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>OK</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
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
    content: { marginTop: 90, alignItems: 'center', paddingHorizontal: 24 },
    logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 26, justifyContent: 'center' },
    logoImage: { width: 180, height: 50 },
    logoText: { color: '#fff', fontWeight: '700', fontSize: 22, letterSpacing: 1.2 },
    statusContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: { color: '#85F500', fontSize: 12, textAlign: 'center', fontWeight: '500', flex: 1 },
    label: {
        color: '#fff',
        fontSize: 15,
        alignSelf: 'flex-start',
        marginBottom: 18,
    },
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
    button: {
        backgroundColor: '#29A400',
        borderRadius: 4,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 10,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    loadingContainer: { flexDirection: 'row', alignItems: 'center' },
    loadingText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
    helpText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});

export default SignUpRADetails;
