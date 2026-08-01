import React, { useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { CheckCircle, AlertTriangle, CreditCard } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useConfig } from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';

/**
 * @param {boolean} afterPayment - true for advisors on `digioCheck:
 *   'afterPayment'`, where the customer has ALREADY paid before signing.
 *   Every "you still owe us a payment" affordance in this modal is wrong in
 *   that mode: the anti-drop-off toast, the "NOT yet activated" warning, the
 *   step-3-is-payment progress rail, the "Proceed to Payment" CTA and the
 *   footer note all told an already-paid customer their plan was inactive.
 *   Default false keeps the original beforePayment behaviour untouched.
 */
const DigioSuccessModal = ({ visible, onClose, onProceedToPayment, afterPayment = false }) => {
    const config = useConfig();
    const mainColor = useTokens().colors.brand.primary;
    // 15-second reminder toast (anti-drop-off mechanism). Only meaningful when
    // a payment is genuinely still outstanding.
    useEffect(() => {
        if (visible && !afterPayment) {
            const timer = setTimeout(() => {
                Toast.show({
                    type: 'warning',
                    text1: "Don't forget to complete your payment!",
                    text2: 'Your plan will be activated only after payment',
                    visibilityTime: 6000,
                });
            }, 15000); // After 15 seconds

            return () => clearTimeout(timer);
        }
    }, [visible, afterPayment]);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}>
            <View style={styles.overlay}>
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}>
                    <View style={styles.modalContainer}>
                        {/* Close Button */}
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>

                        {/* Success Icon */}
                        <View style={styles.iconContainer}>
                            <CheckCircle size={48} color="#10B981" />
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>
                            {afterPayment
                                ? "You're all set! ✓"
                                : 'MITC Signing Completed! ✓'}
                        </Text>

                        {/* Notice box. beforePayment: anti-drop-off warning —
                            a payment is genuinely still outstanding.
                            afterPayment: confirmation — the customer paid
                            BEFORE signing, so nothing is owed. */}
                        {afterPayment ? (
                            <View style={styles.successBox}>
                                <View style={styles.warningHeader}>
                                    <CheckCircle size={20} color="#10B981" />
                                    <Text style={styles.successTitle}>All done:</Text>
                                </View>
                                <Text style={[styles.warningText, styles.successBodyText]}>
                                    Your payment and document signing are both{' '}
                                    <Text style={styles.boldText}>complete</Text>.
                                </Text>
                                <Text style={[styles.warningSubtext, styles.successBodyText]}>
                                    Your plan is active. A signed copy of your document
                                    will be emailed to you.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.warningBox}>
                                <View style={styles.warningHeader}>
                                    <AlertTriangle size={20} color="#F59E0B" />
                                    <Text style={styles.warningTitle}>Important:</Text>
                                </View>
                                <Text style={styles.warningText}>
                                    Your document signing is completed, but your plan is{' '}
                                    <Text style={styles.boldText}>NOT yet activated</Text>.
                                </Text>
                                <Text style={styles.warningSubtext}>
                                    To finish your joining process and activate your plan, you{' '}
                                    <Text style={styles.boldText}>
                                        must complete the payment
                                    </Text>{' '}
                                    in the next step.
                                </Text>
                            </View>
                        )}

                        {/* Visual Workflow Progress */}
                        <View style={styles.progressSection}>
                            <Text style={styles.progressTitle}>Your Progress</Text>
                            {/* Step order follows the advisor's actual sequence.
                                beforePayment: Join → e-Sign → Payment (current)
                                → Activation (pending).
                                afterPayment: Join → Payment → e-Sign →
                                Activation, all complete. */}
                            <View style={styles.progressContainer}>
                                {(afterPayment
                                    ? [
                                          { label: `Start${'\n'}Joining`, state: 'done' },
                                          { label: `Payment`, state: 'done' },
                                          { label: `MITC /${'\n'}e-Sign`, state: 'done' },
                                          { label: `Plan${'\n'}Activation`, state: 'done' },
                                      ]
                                    : [
                                          { label: `Start${'\n'}Joining`, state: 'done' },
                                          { label: `MITC /${'\n'}e-Sign`, state: 'done' },
                                          { label: `Payment${'\n'}(Mandatory)`, state: 'current', index: 3 },
                                          { label: `Plan${'\n'}Activation`, state: 'pending', index: 4 },
                                      ]
                                ).map((step, i, steps) => (
                                    <React.Fragment key={step.label}>
                                        {i > 0 && (
                                            <Text
                                                style={[
                                                    styles.arrow,
                                                    steps[i].state === 'pending' && styles.arrowInactive,
                                                ]}>
                                                →
                                            </Text>
                                        )}
                                        <View style={styles.stepContainer}>
                                            {step.state === 'done' && (
                                                <View style={[styles.stepCircle, styles.stepCompleted]}>
                                                    <Text style={styles.stepCompletedText}>✓</Text>
                                                </View>
                                            )}
                                            {step.state === 'current' && (
                                                <View style={[styles.stepCircle, styles.stepCurrent, { backgroundColor: mainColor }]}>
                                                    <Text style={styles.stepCurrentText}>{step.index}</Text>
                                                </View>
                                            )}
                                            {step.state === 'pending' && (
                                                <View style={[styles.stepCircle, styles.stepPending]}>
                                                    <Text style={styles.stepPendingText}>{step.index}</Text>
                                                </View>
                                            )}
                                            <Text
                                                style={[
                                                    styles.stepLabel,
                                                    step.state === 'current' && styles.stepCurrentLabel,
                                                    step.state === 'current' && { color: mainColor },
                                                    step.state === 'pending' && styles.stepPendingLabel,
                                                ]}>
                                                {step.label}
                                            </Text>
                                        </View>
                                    </React.Fragment>
                                ))}
                            </View>
                        </View>

                        {/* Action Buttons. afterPayment has nothing to cancel
                            out of and nothing left to pay — a single Continue
                            (still routed through onProceedToPayment, which the
                            container branches on digioCheck). */}
                        <View style={styles.buttonContainer}>
                            {!afterPayment && (
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={[styles.button, styles.cancelButton]}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={onProceedToPayment}
                                style={[styles.button, styles.paymentButton, { backgroundColor: mainColor, shadowColor: mainColor }]}>
                                {!afterPayment && <CreditCard size={20} color="#fff" />}
                                <Text style={styles.paymentButtonText}>
                                    {afterPayment ? 'Continue' : 'Proceed to Payment →'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Footer Note */}
                        <Text style={styles.footerNote}>
                            {afterPayment
                                ? 'Your plan is active. You can start using it right away.'
                                : 'Your plan will be activated only after successful payment completion'}
                        </Text>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
        padding: 8,
    },
    closeButtonText: {
        fontSize: 24,
        color: '#9CA3AF',
        fontFamily: 'Satoshi-Regular',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    title: {
        fontSize: 24,
        fontFamily: 'Satoshi-Bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 20,
    },
    warningBox: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
    },
    // afterPayment counterpart of warningBox — green/confirmatory rather than
    // amber/urgent, since nothing is outstanding.
    successBox: {
        backgroundColor: '#D1FAE5',
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 14,
        fontFamily: 'Satoshi-Bold',
        color: '#065F46',
        marginLeft: 8,
    },
    // Overrides the amber body colour inherited from warningText/warningSubtext.
    successBodyText: {
        color: '#065F46',
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    warningTitle: {
        fontSize: 14,
        fontFamily: 'Satoshi-Bold',
        color: '#92400E',
        marginLeft: 8,
    },
    warningText: {
        fontSize: 14,
        fontFamily: 'Satoshi-Regular',
        color: '#92400E',
        marginBottom: 8,
        lineHeight: 20,
    },
    warningSubtext: {
        fontSize: 13,
        fontFamily: 'Satoshi-Regular',
        color: '#78350F',
        lineHeight: 18,
    },
    boldText: {
        fontFamily: 'Satoshi-Bold',
    },
    progressSection: {
        marginBottom: 24,
    },
    progressTitle: {
        fontSize: 14,
        fontFamily: 'Satoshi-Bold',
        color: '#374151',
        textAlign: 'center',
        marginBottom: 16,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepContainer: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepCompleted: {
        backgroundColor: '#10B981',
    },
    stepCurrent: {
        backgroundColor: '#2563EB',
    },
    stepPending: {
        backgroundColor: '#D1D5DB',
    },
    stepCompletedText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Satoshi-Bold',
    },
    stepCurrentText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Satoshi-Bold',
    },
    stepPendingText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Satoshi-Bold',
    },
    stepLabel: {
        fontSize: 10,
        fontFamily: 'Satoshi-Regular',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 14,
    },
    stepCurrentLabel: {
        color: '#2563EB',
        fontFamily: 'Satoshi-Bold',
    },
    stepPendingLabel: {
        color: '#9CA3AF',
    },
    arrow: {
        fontSize: 20,
        color: '#9CA3AF',
        marginHorizontal: 4,
    },
    arrowInactive: {
        color: '#D1D5DB',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    cancelButtonText: {
        fontSize: 14,
        fontFamily: 'Satoshi-Bold',
        color: '#374151',
    },
    paymentButton: {
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        gap: 8,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    paymentButtonText: {
        fontSize: 14,
        fontFamily: 'Satoshi-Bold',
        color: '#fff',
    },
    footerNote: {
        fontSize: 12,
        fontFamily: 'Satoshi-Regular',
        color: '#6B7280',
        textAlign: 'center',
    },
});

export default DigioSuccessModal;
