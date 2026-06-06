/**
 * TermsModal — design-system composite (Phase F, 2026-05-01)
 *
 * Pure presentation. The terms data is hardcoded in the legacy file; this
 * migration keeps it in the container so the variant can swap copy without
 * forking the modal. Backward-compat: the legacy public API was
 * `<TermsModal modalVisible setModalVisible setIsChecked />` — the
 * container preserves that exact prop signature so SignupScreen (and any
 * other future caller) need not change.
 *
 * Contract:
 *   viewModel = { visible, termsData: [{ heading, text }] }
 *   actions   = { onAccept, onClose }
 */

import React from 'react';
import { Modal, View, FlatList, SafeAreaView, StyleSheet } from 'react-native';
import { XIcon } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Button from '../primitives/Button';
import Icon from '../primitives/Icon';

const TermsModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const { visible = false, termsData = [] } = viewModel || {};
    const { onAccept = () => {}, onClose = () => {} } = actions || {};

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer}>
                <View
                    style={[
                        styles.modalContent,
                        { backgroundColor: tokens.colors.surface.card },
                    ]}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text
                            variant="title"
                            style={{
                                fontSize: 20,
                                textAlign: 'center',
                                marginBottom: 10,
                                color: tokens.colors.text.muted,
                                fontFamily: 'Satoshi-Bold',
                            }}
                        >
                            Terms & Conditions
                        </Text>
                        <Icon Component={XIcon} onPress={onClose} color={tokens.colors.text.primary} />
                    </View>

                    <FlatList
                        data={termsData}
                        keyExtractor={(_, index) => String(index)}
                        renderItem={({ item }) => (
                            <View
                                style={[
                                    styles.itemContainer,
                                    { backgroundColor: tokens.colors.surface.card },
                                ]}
                            >
                                <Text
                                    variant="title"
                                    style={{
                                        fontSize: 18,
                                        fontFamily: 'Satoshi-Bold',
                                        color: tokens.colors.text.primary,
                                    }}
                                >
                                    {item.heading}
                                </Text>
                                <Text
                                    variant="body"
                                    style={{
                                        marginTop: 5,
                                        fontSize: 16,
                                        color: tokens.colors.text.muted,
                                        fontFamily: 'Satoshi-Medium',
                                    }}
                                >
                                    {item.text}
                                </Text>
                            </View>
                        )}
                    />

                    <Button
                        variant="secondary"
                        onPress={onAccept}
                        style={{
                            marginTop: 15,
                            backgroundColor: tokens.colors.surface.card,
                            padding: 10,
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: tokens.colors.border.default,
                        }}
                    >
                        <Text
                            variant="button"
                            style={{ color: tokens.colors.text.primary, fontFamily: 'Satoshi-Bold' }}
                        >
                            Accept
                        </Text>
                    </Button>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        padding: 20,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        elevation: 5,
    },
    itemContainer: {
        marginBottom: 15,
        padding: 15,
        borderRadius: 8,
        elevation: 2,
    },
});

export default TermsModal;
