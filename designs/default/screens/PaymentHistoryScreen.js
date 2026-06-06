/**
 * PaymentHistoryScreen — design-system screen presentation (Phase G batch 2, 2026-05-02)
 *
 * Pure presentation. Container owns useTrade, useConfig, Firebase auth,
 * axios invoice fetch, PDF download/view via RNFS + FileViewer + Share.
 *
 * Contract:
 *   viewModel = {
 *     invoiceData,            // array of invoice objects
 *     gradient1, gradient2,   // gradient colors from config
 *   }
 *   actions = {
 *     onGoBack,
 *     onDownloadInvoice(item, index),
 *     onViewInvoice(item, index),
 *   }
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import LinearGradient from 'react-native-linear-gradient';

const PaymentHistoryScreen = ({ viewModel, actions }) => {
    const {
        invoiceData = [],
        gradient1 = 'rgba(0, 86, 183, 1)',
        gradient2 = 'rgba(0, 38, 81, 1)',
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onDownloadInvoice = () => {},
        onViewInvoice = () => {},
    } = actions || {};

    const renderPaymentItem = ({ item, index }) => (
        <View style={styles.paymentItem}>
            <View style={styles.leftContent}>
                <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
                    <Image
                        source={{ uri: item.invoice_data?.company_logo }}
                        style={{ width: 40, height: 40, borderRadius: 25 }}
                    />
                    <Text
                        style={[
                            styles.iconText,
                            {
                                color: ['#000000', '#FEF3C7'].includes(item.bgColor)
                                    ? '#000'
                                    : '#FFF',
                            },
                        ]}>
                        {item.icon}
                    </Text>
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.nameText}>
                        {item.invoice_data?.item_description}
                    </Text>
                    <Text style={styles.dateText}>
                        {item.invoice_data?.invoice_date}
                    </Text>
                </View>
            </View>
            <View style={styles.rightContent}>
                <Text style={styles.amountText}>
                    {'₹'}{item.invoice_data?.item_amount}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => onDownloadInvoice(item, index)}>
                        <Text style={styles.downloadText}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onViewInvoice(item, index)}>
                        <Text style={styles.invoiceText}>View</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderEmptyComponent = () => (
        <View
            style={{
                flex: 1,
                alignContent: 'center',
                alignItems: 'center',
                alignSelf: 'center',
                justifyContent: 'center',
                marginVertical: 40,
            }}>
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.7,
                    backgroundColor: '#fff',
                    borderRadius: 16,
                }}>
                <View
                    style={{
                        position: 'absolute',
                        top: -80,
                        right: -80,
                        width: 200,
                        height: 200,
                        borderRadius: 100,
                        backgroundColor: 'rgba(107, 20, 0, 0.08)',
                    }}
                />
                <View
                    style={{
                        position: 'absolute',
                        bottom: -60,
                        left: -60,
                        width: 180,
                        height: 180,
                        borderRadius: 90,
                        backgroundColor: 'rgba(173, 66, 38, 0.06)',
                    }}
                />
            </View>

            <View
                style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 20,
                    shadowColor: '#6B1400',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 4,
                }}>
                <View
                    style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        backgroundColor: 'rgba(107, 20, 0, 0.05)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                    <Text style={{ fontSize: 32 }}>{'💸'}</Text>
                </View>
            </View>

            <Text
                style={{
                    fontFamily: 'Satoshi-Bold',
                    fontSize: 20,
                    color: '#3A0B00',
                    textAlign: 'center',
                    marginBottom: 12,
                }}>
                No Payment History
            </Text>

            <Text
                style={{
                    fontFamily: 'Satoshi-Medium',
                    fontSize: 15,
                    color: '#4D2418',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 22,
                    marginBottom: 20,
                }}>
                Your completed transactions will appear here once you make your
                first payment.
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[gradient1, gradient2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                    paddingHorizontal: 15,
                    paddingVertical: 15,
                    borderBottomLeftRadius: 15,
                    borderBottomRightRadius: 15,
                }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 10,
                    }}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onGoBack}>
                        <ChevronLeft size={24} color="#000" />
                    </TouchableOpacity>
                    <View style={{ justifyContent: 'center' }}>
                        <Text
                            style={{
                                fontSize: 20,
                                fontFamily: 'Poppins-Medium',
                                color: '#fff',
                            }}>
                            Payment History
                        </Text>
                    </View>
                </View>
            </LinearGradient>
            <FlatList
                data={invoiceData}
                renderItem={renderPaymentItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={renderEmptyComponent}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 4,
        borderRadius: 5,
        backgroundColor: '#fff',
        marginRight: 10,
    },
    paymentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 14,
        fontWeight: '500',
    },
    textContainer: {
        marginLeft: 12,
    },
    nameText: {
        fontSize: 16,
        fontFamily: 'Satoshi-Bold',
        color: '#000000',
    },
    dateText: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 2,
    },
    rightContent: {
        alignItems: 'flex-end',
    },
    amountText: {
        fontSize: 16,
        fontFamily: 'Satoshi-Bold',
        color: '#000000',
    },
    invoiceText: {
        fontSize: 14,
        fontFamily: 'Satoshi-Medium',
        color: '#2563EB',
    },
    downloadText: {
        fontSize: 14,
        fontFamily: 'Satoshi-Medium',
        color: '#16A085',
    },
});

export default PaymentHistoryScreen;
