/**
 * ChangeAdvisor — design-system screen presentation (Phase F batch 4, 2026-05-01)
 *
 * Pure presentation. Container owns RA-ID loading, validation,
 * updateRACodeAndConfig, restart-app orchestration (RNRestart →
 * DevSettings.reload → softRestart fallback chain).
 *
 * Contract:
 *   viewModel = { currentRAId, newRAId, isLoading, isInitialLoading }
 *   actions   = { onNewRAIdChange, onUpdateRACode, onBack, onOpenNotifications }
 */

import React from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, TextInput, Image, SafeAreaView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft, Bell } from 'lucide-react-native';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import Spinner from '../primitives/Spinner';
import useTokens from '../../../src/theme/useTokens';

// Default-variant faded logo now resolved via `useTokens().assets.logoFadedPng`
// — see Phase 2 (whitelabel-sync, 2026-05-09) and
// docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.

const ChangeAdvisor = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        currentRAId = '',
        newRAId = '',
        isLoading = false,
        isInitialLoading = false,
    } = viewModel || {};
    const {
        onNewRAIdChange = () => {},
        onUpdateRACode = () => {},
        onBack = () => {},
        onOpenNotifications = () => {},
    } = actions || {};

    if (isInitialLoading) {
        return (
            <LinearGradient colors={['#002651', '#0056B7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Spinner size="large" color="#FFFFFF" />
                    <Text variant="body" style={styles.loadingText}>Loading settings...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#002651', '#0056B7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="#002651" />

                <View style={styles.logoContainer} pointerEvents="none">
                    <Image source={tokens.assets.logoFadedPng} style={[styles.logo, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
                </View>

                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Icon Component={ChevronLeft} size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text variant="title" style={styles.headerTitle}>Manager Settings</Text>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={onOpenNotifications} style={styles.iconButton}>
                            <View style={styles.iconCircle}>
                                <Icon Component={Bell} size={18} color="#FFFFFF" />
                                <View style={styles.notificationDot} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.container1}>
                    <Text variant="heading" style={styles.title}>Change Manager</Text>

                    <View style={styles.section}>
                        <Text variant="bodyEmphasis" style={styles.label}>Current RA ID:</Text>
                        <Text variant="body" style={styles.currentValue}>{currentRAId || 'Not Set'}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text variant="bodyEmphasis" style={styles.label}>New RA ID:</Text>
                        <TextInput
                            style={styles.input}
                            value={newRAId}
                            onChangeText={onNewRAIdChange}
                            placeholder="Enter new RA ID"
                            placeholderTextColor="#999"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            spellCheck={false}
                            keyboardType="ascii-capable"
                            maxLength={20}
                        />
                        <Text variant="caption" style={styles.helpText}>
                            Spaces will be removed automatically and converted to uppercase
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={onUpdateRACode}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <View style={styles.loadingButton}>
                                <Spinner size="small" color="#fff" />
                                <Text variant="button" style={[styles.buttonText, { marginLeft: 10 }]}>Updating...</Text>
                            </View>
                        ) : (
                            <Text variant="button" style={styles.buttonText}>Update RA ID</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.infoSection}>
                        <Text variant="caption" style={styles.infoText}>• RA ID must be provided by your financial advisor</Text>
                        <Text variant="caption" style={styles.infoText}>• Spaces and lowercase letters will be automatically corrected</Text>
                        <Text variant="caption" style={styles.infoText}>• App will restart after successful update</Text>
                    </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    logoContainer: { position: 'absolute', top: 20, right: 20, zIndex: 0, opacity: 0.1 },
    logo: { width: 220, height: 220, color: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 1,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', flex: 1, marginLeft: 16 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { marginLeft: 12 },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notificationDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
    },
    container1: { flex: 1, padding: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#FFFFFF', fontSize: 16 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#ffffff' },
    section: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#ffffff' },
    currentValue: {
        fontSize: 16,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        color: '#000000',
        fontSize: 16,
        backgroundColor: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '500',
    },
    helpText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontStyle: 'italic' },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    buttonDisabled: { backgroundColor: '#cccccc', elevation: 0, shadowOpacity: 0 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    loadingButton: { flexDirection: 'row', alignItems: 'center' },
    infoSection: {
        marginTop: 30,
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    infoText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 5, lineHeight: 16 },
});

export default ChangeAdvisor;
