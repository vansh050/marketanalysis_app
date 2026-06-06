/**
 * PrivacyPolicyScreen — design-system screen presentation (Phase G, 2026-05-02)
 *
 * Pure presentation. Container owns the URL validation effect and navigation.
 * This renders the gradient header + WebView (or error fallback).
 *
 * Contract:
 *   viewModel = {
 *     privacyURL, isValidUrl,
 *     gradient: { start, end },
 *     mainColor,
 *   }
 *   actions = { onGoBack, onShouldStartLoadWithRequest }
 */

import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import WebView from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';

const PrivacyPolicyScreen = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        privacyURL = '',
        isValidUrl = true,
        gradient = {},
        mainColor,
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onShouldStartLoadWithRequest = () => true,
    } = actions || {};

    const resolvedMainColor = mainColor || tokens.colors.brand.primary;

    return (
        <View style={styles.root}>
            {/* Header */}
            <LinearGradient
                colors={[
                    gradient.start || tokens.colors.brand.gradientStart,
                    gradient.end || tokens.colors.brand.gradientEnd,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.headerContainer}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onGoBack}
                    >
                        <ChevronLeft size={24} color="#000" />
                    </TouchableOpacity>
                    <Text
                        variant="title"
                        style={styles.headerTitle}
                    >
                        Privacy Policy
                    </Text>
                </View>
            </LinearGradient>

            {/* WebView or fallback */}
            {isValidUrl ? (
                <WebView
                    source={{ uri: privacyURL }}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.loaderOverlay}>
                            <ActivityIndicator size="large" color={resolvedMainColor} />
                            <Text
                                variant="body"
                                style={[styles.loaderText, { color: resolvedMainColor }]}
                            >
                                Loading...
                            </Text>
                        </View>
                    )}
                    onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
                    style={{ flex: 1, backgroundColor: '#fff' }}
                />
            ) : (
                <View style={styles.errorContainer}>
                    <Text
                        variant="subtitle"
                        style={[styles.errorTitle, { color: resolvedMainColor }]}
                    >
                        Invalid or Missing URL
                    </Text>
                    <Text variant="body" style={styles.errorText}>
                        The Privacy Policy page couldn't be loaded. Please check your
                        configuration or try again later.
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    headerContainer: {
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        padding: 4,
        borderRadius: 5,
        backgroundColor: '#fff',
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Medium',
        color: '#fff',
    },
    loaderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loaderText: {
        marginTop: 10,
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25,
        backgroundColor: '#fff',
    },
    errorTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 8,
    },
    errorText: {
        textAlign: 'center',
        color: 'grey',
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
    },
});

export default PrivacyPolicyScreen;
