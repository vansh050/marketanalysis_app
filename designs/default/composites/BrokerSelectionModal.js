/**
 * BrokerSelectionModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for the pre-connect broker picker and token-expire
 * re-auth prompt. Uses react-native-modal (third-party) because the UX
 * requires native-driver-backed slide-in/out with backdrop, which the
 * built-in ModalShell primitive doesn't support.
 *
 * Two rendering modes controlled by `viewModel.mode`:
 *   - 'picker'      — full gradient broker grid with SEBI disclaimer
 *   - 'tokenExpire' — bottom-sheet login prompt for expired broker
 *
 * Contract:
 *   viewModel = {
 *     visible, mode: 'picker' | 'tokenExpire',
 *     // picker mode
 *     brokerRows: [[{ key, name, logo }]], pressedBroker,
 *     brokerConnected, connectingBroker,
 *     showLetUsKnow, filteredAllBrokers, selectedUnavailableBroker,
 *     brokerSearchText,
 *     // tokenExpire mode
 *     broker, showMessage, loginLoading,
 *   }
 *   actions = {
 *     onClose,
 *     // picker
 *     onBrokerSelect(broker), onPressIn(key), onPressOut,
 *     onContinueWithoutBroker, onBrokerConnectedContinue,
 *     onLetUsKnow, onLetUsKnowBack,
 *     onBrokerSearchChange(text), onUnavailableBrokerSelect(name),
 *     // tokenExpire
 *     onBrokerLoginPress(broker),
 *     // Angel One sibling
 *     renderAngelOneWarning(),
 *   }
 */

import React from 'react';
import {
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Dimensions,
} from 'react-native';
import Modal from 'react-native-modal';
import {
    ChevronLeft,
    XIcon,
    Info,
    AlertOctagon,
    ArrowRight,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const BrokerSelectionModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        visible = false,
        mode = 'picker',
        // picker
        brokerRows = [],
        pressedBroker = null,
        brokerConnected = false,
        connectingBroker = false,
        showLetUsKnow = false,
        filteredAllBrokers = [],
        selectedUnavailableBroker = null,
        brokerSearchText = '',
        // tokenExpire
        broker = null,
        showMessage = false,
        loginLoading = false,
    } = viewModel || {};
    const {
        onClose = () => {},
        onBrokerSelect = () => {},
        onPressIn = () => {},
        onPressOut = () => {},
        onContinueWithoutBroker = () => {},
        onBrokerConnectedContinue = () => {},
        onLetUsKnow = () => {},
        onLetUsKnowBack = () => {},
        onBrokerSearchChange = () => {},
        onUnavailableBrokerSelect = () => {},
        onBrokerLoginPress = () => {},
        renderAngelOneWarning = () => null,
    } = actions || {};

    return (
        <>
            <Modal
                isVisible={visible}
                backdropOpacity={0.5}
                useNativeDriver={true}
                useNativeDriverForBackdrop={true}
                hideModalContentWhileAnimating={true}
                animationIn="slideInUp"
                animationOut="slideOutDown"
                style={styles.modal}
                onBackdropPress={onClose}
            >
                {mode === 'picker' && (
                    <LinearGradient
                        colors={['#002651', '#003572', '#0053B1']}
                        style={styles.gradientContainer}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    >
                        <SafeAreaView style={styles.safeArea}>
                            <View style={styles.contentContainer}>
                                {/* Header */}
                                <View style={styles.header}>
                                    <TouchableOpacity
                                        style={styles.backButton}
                                        onPress={onClose}
                                        activeOpacity={0.9}
                                    >
                                        <ChevronLeft size={24} color="#ffffff" />
                                    </TouchableOpacity>
                                    <Text
                                        variant="title"
                                        style={styles.headerTitle}
                                    >
                                        Select your broker for connection
                                    </Text>
                                </View>

                                {/* SEBI Disclaimer */}
                                <View style={styles.noticeBox}>
                                    <Text style={styles.noticeTitle}>SEBI Disclaimer:</Text>
                                    <Text style={styles.noticeText}>
                                        {'•'} Actions and decisions are solely yours as per SEBI (Research Analysts) Regulations, 2014.
                                    </Text>
                                    <Text style={styles.noticeText}>
                                        {'•'} RA doesn't control or influence your action.
                                    </Text>
                                    <Text style={styles.noticeText}>
                                        {'•'} RA isn't responsible for your outcome.
                                    </Text>
                                    <Text style={styles.noticeText}>
                                        {'•'} You act independently on the broker platform.
                                    </Text>
                                </View>

                                {/* Broker Grid */}
                                <ScrollView
                                    style={styles.brokerScrollView}
                                    contentContainerStyle={styles.brokerScrollContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View>
                                        {brokerRows.map((row, rowIndex) => (
                                            <View key={rowIndex} style={styles.brokerRow}>
                                                {row.map((b, index) => (
                                                    <TouchableOpacity
                                                        key={index}
                                                        activeOpacity={0.7}
                                                        style={[
                                                            styles.brokerCard,
                                                            pressedBroker === b.key && styles.brokerCardPressed,
                                                        ]}
                                                        onPressIn={() => onPressIn(b.key)}
                                                        onPressOut={onPressOut}
                                                        onPress={() => onBrokerSelect(b)}
                                                    >
                                                        <View style={styles.brokerLogoContainer}>
                                                            <Image
                                                                source={b.logo}
                                                                style={styles.brokerLogo}
                                                                resizeMode="contain"
                                                            />
                                                        </View>
                                                        <Text style={styles.brokerName}>{b.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {row.length < 4 &&
                                                    Array.from({ length: 4 - row.length }).map((_, i) => (
                                                        <View key={`ph-${i}`} style={styles.brokerCardPlaceholder} />
                                                    ))}
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>

                                {/* Bottom Buttons */}
                                {brokerConnected ? (
                                    <TouchableOpacity
                                        style={[styles.continueButton, styles.connectedButton]}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                        onPress={onBrokerConnectedContinue}
                                    >
                                        <Text style={styles.connectedButtonText}>
                                            Disconnect my current broker
                                        </Text>
                                    </TouchableOpacity>
                                ) : connectingBroker ? (
                                    <View style={[styles.continueButton, styles.connectingButton]}>
                                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
                                        <Text style={styles.continueButtonText}>Connecting broker...</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.continueButton}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                        onPress={onContinueWithoutBroker}
                                    >
                                        <Text style={styles.continueButtonText}>
                                            Continue without connecting broker
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {/* Can't find your broker? */}
                                {!showLetUsKnow ? (
                                    <TouchableOpacity
                                        style={styles.letUsKnowButton}
                                        activeOpacity={0.7}
                                        onPress={onLetUsKnow}
                                    >
                                        <Text style={styles.letUsKnowText}>
                                            Can't find your broker?{' '}
                                            <Text style={styles.letUsKnowLink}>Let us know</Text>
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.letUsKnowContainer}>
                                        <Text style={styles.letUsKnowTitle}>Search for your broker</Text>
                                        <TextInput
                                            style={styles.brokerSearchInput}
                                            placeholder="Search broker..."
                                            placeholderTextColor="#999"
                                            value={brokerSearchText}
                                            onChangeText={onBrokerSearchChange}
                                        />
                                        <ScrollView
                                            style={styles.allBrokersList}
                                            nestedScrollEnabled={true}
                                            showsVerticalScrollIndicator={true}
                                        >
                                            {filteredAllBrokers.map((item, index) => {
                                                const brokerName =
                                                    typeof item === 'string' ? item : item.name || '';
                                                return (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={[
                                                            styles.allBrokersItem,
                                                            selectedUnavailableBroker === brokerName &&
                                                                styles.allBrokersItemSelected,
                                                        ]}
                                                        activeOpacity={0.7}
                                                        onPress={() => onUnavailableBrokerSelect(brokerName)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.allBrokersItemText,
                                                                selectedUnavailableBroker === brokerName &&
                                                                    styles.allBrokersItemTextSelected,
                                                            ]}
                                                        >
                                                            {brokerName}
                                                        </Text>
                                                        {selectedUnavailableBroker === brokerName && (
                                                            <Text style={styles.selectedCheckmark}>
                                                                {'✓'}
                                                            </Text>
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                            {filteredAllBrokers.length === 0 && (
                                                <Text style={styles.noBrokersText}>No brokers found</Text>
                                            )}
                                        </ScrollView>
                                        <TouchableOpacity
                                            style={styles.letUsKnowBackButton}
                                            activeOpacity={0.7}
                                            onPress={onLetUsKnowBack}
                                        >
                                            <Text style={styles.letUsKnowBackText}>Back</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </SafeAreaView>
                    </LinearGradient>
                )}

                {mode === 'tokenExpire' && (
                    <View style={styles.expireModalContainer}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <XIcon size={24} color={tokens.colors.text.muted} />
                        </TouchableOpacity>

                        {!showMessage || !broker ? (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator
                                    size="large"
                                    color={tokens.colors.brand.gradientEnd || '#007AFF'}
                                />
                            </View>
                        ) : (
                            <View style={styles.loginPromptContainer}>
                                <View style={styles.loginPromptHeader}>
                                    <View style={styles.alertIconWrapper}>
                                        <AlertOctagon size={40} color="#FF3B30" />
                                    </View>
                                    <View style={styles.loginPromptTextContainer}>
                                        <Text
                                            variant="title"
                                            style={styles.loginPromptTitle}
                                        >
                                            Authentication Required
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.securityNoteContainer}>
                                    <Info size={16} color="#0066CC" />
                                    <Text style={styles.securityNoteText}>
                                        {broker === 'Groww'
                                            ? 'Your Groww session has expired. Tap to refresh — takes about 2 seconds, no credentials needed.'
                                            : 'Your session has expired. Please login to your broker to continue with your investments.'}
                                    </Text>
                                </View>

                                {broker && (
                                    <TouchableOpacity
                                        style={styles.enhancedLoginButton}
                                        onPress={() => onBrokerLoginPress(broker)}
                                        disabled={loginLoading}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.loginButtonContent}>
                                            <Text style={styles.loginButtonText}>
                                                {loginLoading
                                                    ? broker === 'Groww'
                                                        ? 'Refreshing Groww session...'
                                                        : `Connecting ${broker}...`
                                                    : broker === 'Groww'
                                                        ? 'Refresh Groww session'
                                                        : `Login to ${broker}`}
                                            </Text>
                                            <View style={styles.arrowIconContainer}>
                                                {loginLoading ? (
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                ) : (
                                                    <ArrowRight size={16} color="#FFFFFF" />
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )}
                {/* AngelOneCautionaryWarning must render INSIDE the Modal so it
                  * appears in the same Android window. Rendering it outside (in the
                  * main window) means it's behind the modal window and invisible. */}
                {renderAngelOneWarning()}
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    modal: { justifyContent: 'flex-end', margin: 0 },
    backButton: { padding: 6, borderRadius: 8, marginRight: 14, elevation: 3 },
    gradientContainer: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20,
        flex: 1, maxHeight: screenHeight * 0.9,
    },
    safeArea: { flex: 1 },
    contentContainer: { flex: 1, paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 10 },
    headerTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', lineHeight: 30 },
    noticeBox: {
        backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 2, borderColor: '#FFB800',
        borderRadius: 12, padding: 16, marginBottom: 20,
    },
    noticeTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#FFB800', marginBottom: 8 },
    noticeText: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#FFFFFF', lineHeight: 20, marginBottom: 4 },
    brokerScrollView: { flex: 1, marginBottom: 16 },
    brokerScrollContent: { paddingBottom: 10 },
    brokerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    brokerCardPlaceholder: { width: (screenWidth - 60) / 4, aspectRatio: 1 },
    brokerCard: {
        width: (screenWidth - 70) / 4, aspectRatio: 1, backgroundColor: '#FFFFFF',
        borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    },
    brokerCardPressed: { backgroundColor: '#E8F4FF', transform: [{ scale: 0.95 }] },
    brokerLogoContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    brokerLogo: { width: 36, height: 36 },
    brokerName: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#000', textAlign: 'center' },
    continueButton: {
        backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 18,
        paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 10, minHeight: 54,
    },
    continueButtonText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
    connectedButton: { backgroundColor: '#1B8D1B', borderColor: '#17A817' },
    connectedButtonText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
    connectingButton: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' },
    letUsKnowButton: { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
    letUsKnowText: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(255,255,255,0.7)' },
    letUsKnowLink: { fontFamily: 'Satoshi-Bold', color: '#FFB800', textDecorationLine: 'underline' },
    letUsKnowContainer: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 16, marginBottom: 16 },
    letUsKnowTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', marginBottom: 12 },
    brokerSearchInput: {
        backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 14,
        paddingVertical: 10, fontSize: 14, fontFamily: 'Satoshi-Regular', color: '#000', marginBottom: 12,
    },
    allBrokersList: { maxHeight: 180, marginBottom: 12 },
    allBrokersItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, marginBottom: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    allBrokersItemSelected: { backgroundColor: 'rgba(255,184,0,0.2)', borderWidth: 1, borderColor: '#FFB800' },
    allBrokersItemText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#FFFFFF' },
    allBrokersItemTextSelected: { color: '#FFB800', fontFamily: 'Satoshi-Bold' },
    selectedCheckmark: { fontSize: 16, color: '#FFB800', fontFamily: 'Satoshi-Bold' },
    noBrokersText: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: 20 },
    letUsKnowBackButton: { alignItems: 'center', paddingVertical: 8 },
    letUsKnowBackText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#FFB800' },
    // Token Expire styles
    expireModalContainer: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 20,
        borderTopRightRadius: 20, padding: screenWidth * 0.05,
    },
    closeButton: { position: 'absolute', right: 10, top: 10, zIndex: 1 },
    loaderContainer: { marginVertical: 80, justifyContent: 'center', alignItems: 'center' },
    loginPromptContainer: {
        marginTop: 20, marginBottom: 15, padding: 15,
        backgroundColor: '#FFFFFF', borderRadius: 12,
    },
    loginPromptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    alertIconWrapper: { backgroundColor: '#FFF2F2', padding: 12, borderRadius: 12, marginRight: 15 },
    loginPromptTextContainer: { flex: 1, justifyContent: 'center' },
    loginPromptTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#000' },
    enhancedLoginButton: {
        backgroundColor: '#0066CC', borderRadius: 25, paddingVertical: 12,
        paddingHorizontal: 20, marginTop: 15,
        shadowColor: '#0066CC', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
        borderWidth: 1, borderColor: '#0052A3',
    },
    loginButtonContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    loginButtonText: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: 0.5 },
    arrowIconContainer: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 15, padding: 5, marginLeft: 8 },
    securityNoteContainer: {
        marginBottom: 10, padding: 12, backgroundColor: '#F8F9FA', borderRadius: 8,
        borderLeftWidth: 3, borderLeftColor: '#0066CC', flexDirection: 'row', alignItems: 'flex-start',
    },
    securityNoteText: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: '#666', lineHeight: 18, marginLeft: 10, flex: 1 },
});

export default BrokerSelectionModal;
