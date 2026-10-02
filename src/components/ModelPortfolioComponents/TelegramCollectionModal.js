import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { X, MessageCircle, CheckCircle } from 'lucide-react-native';
import { useConfig } from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';

import { designColor, designFont } from '../../design/literalTokens';

const TelegramCollectionModal = ({
    visible,
    onClose,
    telegramId,
    setTelegramId,
    onSave,
    validateTelegramId,
}) => {
    // Get dynamic colors from config
    const config = useConfig();
    const mainColor = useTokens().colors.brand.primary;

    const [showInstructions, setShowInstructions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!validateTelegramId(telegramId)) {
            return;
        }

        setIsSaving(true);
        await onSave(telegramId);
        setIsSaving(false);
        onClose();
    };

    const handleSkip = () => {
        setTelegramId('skipped');
        onClose();
    };

    const isValid = validateTelegramId(telegramId);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: `${mainColor}20` }]}>
                                <MessageCircle size={32} color={mainColor} />
                            </View>
                            <Text style={styles.title}>Connect with Telegram! 📱</Text>
                            <Text style={styles.subtitle}>
                                Get instant trade alerts and updates via Telegram
                            </Text>
                        </View>

                        {/* Benefits Section */}
                        <View style={styles.benefitsContainer}>
                            <Text style={styles.benefitsTitle}>Why add Telegram ID?</Text>
                            <View style={styles.benefitsList}>
                                <View style={styles.benefitItem}>
                                    <CheckCircle size={16} color={mainColor} />
                                    <Text style={styles.benefitText}>
                                        Receive real-time trade alerts instantly
                                    </Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <CheckCircle size={16} color={mainColor} />
                                    <Text style={styles.benefitText}>
                                        Get portfolio updates directly on your phone
                                    </Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <CheckCircle size={16} color={mainColor} />
                                    <Text style={styles.benefitText}>
                                        Never miss important market updates
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Instructions Section */}
                        <View style={styles.instructionsContainer}>
                            <TouchableOpacity
                                onPress={() => setShowInstructions(!showInstructions)}
                                style={styles.instructionsHeader}>
                                <Text style={styles.instructionsHeaderText}>
                                    How to get your Telegram ID?
                                </Text>
                                <Text style={styles.chevron}>
                                    {showInstructions ? '▲' : '▼'}
                                </Text>
                            </TouchableOpacity>

                            {showInstructions && (
                                <View style={styles.instructionsContent}>
                                    <View style={styles.instructionStep}>
                                        <View style={[styles.stepNumber, { backgroundColor: mainColor }]}>
                                            <Text style={styles.stepNumberText}>1</Text>
                                        </View>
                                        <View style={styles.stepContent}>
                                            <Text style={styles.stepTitle}>Open Telegram app</Text>
                                            <Text style={styles.stepDescription}>
                                                Download from Play Store / App Store if you don't have
                                                it
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.instructionStep}>
                                        <View style={[styles.stepNumber, { backgroundColor: mainColor }]}>
                                            <Text style={styles.stepNumberText}>2</Text>
                                        </View>
                                        <View style={styles.stepContent}>
                                            <Text style={styles.stepTitle}>
                                                Search for "@userinfobot"
                                            </Text>
                                            <Text style={styles.stepDescription}>
                                                In the search bar at top
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.instructionStep}>
                                        <View style={[styles.stepNumber, { backgroundColor: mainColor }]}>
                                            <Text style={styles.stepNumberText}>3</Text>
                                        </View>
                                        <View style={styles.stepContent}>
                                            <Text style={styles.stepTitle}>Start the bot</Text>
                                            <Text style={styles.stepDescription}>
                                                Click "Start" or type /start
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.instructionStep}>
                                        <View style={[styles.stepNumber, { backgroundColor: mainColor }]}>
                                            <Text style={styles.stepNumberText}>4</Text>
                                        </View>
                                        <View style={styles.stepContent}>
                                            <Text style={styles.stepTitle}>Copy your ID</Text>
                                            <Text style={styles.stepDescription}>
                                                Bot will show your ID (number only, e.g., 123456789)
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.noteContainer}>
                                        <Text style={styles.noteText}>
                                            <Text style={styles.noteBold}>Note:</Text> Enter only the
                                            number, without @ symbol or username
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Input Field */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>
                                Telegram ID{' '}
                                <Text style={styles.optional}>(Optional but recommended)</Text>
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={telegramId === 'skipped' ? '' : telegramId}
                                onChangeText={text => {
                                    // Only allow numbers
                                    const numericValue = text.replace(/\D/g, '');
                                    setTelegramId(numericValue);
                                }}
                                placeholder="Enter your Telegram ID (e.g., 123456789)"
                                placeholderTextColor={designColor('9ca3af')}
                                keyboardType="numeric"
                            />
                            <Text style={styles.inputHint}>
                                Example: 123456789 (numbers only)
                            </Text>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                onPress={handleSkip}
                                style={[styles.button, styles.skipButton]}>
                                <Text style={styles.skipButtonText}>Update later</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={!isValid || isSaving}
                                style={[
                                    styles.button,
                                    styles.saveButton,
                                    { backgroundColor: mainColor, shadowColor: mainColor },
                                    (!isValid || isSaving) && styles.saveButtonDisabled,
                                ]}>
                                {isSaving ? (
                                    <ActivityIndicator size="small" color={designColor('fff')} />
                                ) : (
                                    <>
                                        <MessageCircle size={20} color={designColor('fff')} />
                                        <Text style={styles.saveButtonText}>Save & Continue</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Footer Note */}
                        <Text style={styles.footerNote}>
                            You can always add or update your Telegram ID later from your
                            profile settings
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContainer: {
        backgroundColor: designColor('fff'),
        borderRadius: 16,
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        shadowColor: designColor('000'),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: designColor('dbeafe'),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('111827'),
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('6b7280'),
        textAlign: 'center',
    },
    benefitsContainer: {
        backgroundColor: designColor('eff6ff'),
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    benefitsTitle: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('1e40af'),
        marginBottom: 12,
    },
    benefitsList: {
        gap: 8,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    benefitText: {
        flex: 1,
        fontSize: 13,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('1e40af'),
        lineHeight: 18,
    },
    instructionsContainer: {
        backgroundColor: designColor('f9fafb'),
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
    },
    instructionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    instructionsHeaderText: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('374151'),
    },
    chevron: {
        fontSize: 12,
        color: designColor('6b7280'),
    },
    instructionsContent: {
        padding: 16,
        paddingTop: 0,
        gap: 16,
    },
    instructionStep: {
        flexDirection: 'row',
        gap: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: designColor('2563eb'),
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontSize: 12,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('fff'),
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('111827'),
        marginBottom: 2,
    },
    stepDescription: {
        fontSize: 12,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('6b7280'),
    },
    noteContainer: {
        backgroundColor: designColor('fef3c7'),
        borderLeftWidth: 4,
        borderLeftColor: designColor('f59e0b'),
        padding: 12,
        borderRadius: 4,
    },
    noteText: {
        fontSize: 12,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('92400e'),
    },
    noteBold: {
        fontFamily: designFont('Satoshi-Bold'),
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('374151'),
        marginBottom: 8,
    },
    optional: {
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('6b7280'),
    },
    input: {
        borderWidth: 1,
        borderColor: designColor('d1d5db'),
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('111827'),
        backgroundColor: designColor('fff'),
    },
    inputHint: {
        fontSize: 12,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('6b7280'),
        marginTop: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButton: {
        backgroundColor: designColor('f3f4f6'),
        borderWidth: 1,
        borderColor: designColor('d1d5db'),
    },
    skipButtonText: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('374151'),
    },
    saveButton: {
        backgroundColor: designColor('2563eb'),
        flexDirection: 'row',
        gap: 8,
        shadowColor: designColor('2563eb'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: designColor('9ca3af'),
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        fontSize: 14,
        fontFamily: designFont('Satoshi-Bold'),
        color: designColor('fff'),
    },
    footerNote: {
        fontSize: 12,
        fontFamily: designFont('Satoshi-Regular'),
        color: designColor('6b7280'),
        textAlign: 'center',
    },
});

export default TelegramCollectionModal;
