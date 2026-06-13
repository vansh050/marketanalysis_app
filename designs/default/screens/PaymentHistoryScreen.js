/**
 * PaymentHistoryScreen — design-system screen presentation (Phase G batch 2, 2026-05-02)
 *
 * Pure presentation. Container owns useTrade, useConfig, Firebase auth,
 * axios invoice fetch, PDF download/view via RNFS + FileViewer + Share.
 *
 * P1 (web-parity, D15): optional second "Fee Statements" tab for RIA AUM-billing
 * invoices. Rendered ONLY when viewModel.showFeeTab is true; otherwise this screen
 * is byte-identical to before (single transactions list). Fee rows show
 * period · AUA · fee · GST · total + a status pill + View/Download (reusing the
 * container's PDF helper). See docs/WEB_PARITY_MIGRATION_2026-06.md §5.1.
 *
 * Contract:
 *   viewModel = {
 *     invoiceData, gradient1, gradient2,
 *     showFeeTab,            // bool — render the segmented control + fee tab
 *     tab,                   // 'transactions' | 'fees'
 *     feeStatements,         // [{ id, invoice_id, period, planName, category, status, aua, fee, gst, total }]
 *     feeContract,           // { billing_mode, billing_period, billing_timing, client_category, plan_name } | null
 *   }
 *   actions = {
 *     onGoBack, onDownloadInvoice(item,index), onViewInvoice(item,index),
 *     onSelectTab(tab), onViewFee(item), onDownloadFee(item),
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
import LinearGradient from 'react-native-linear-gradient';

// Indian-grouping rupee formatter (12,40,000). Null/NaN → '—'.
const inr = v => {
    if (v === null || v === undefined || isNaN(Number(v))) return '—';
    const n = Math.round(Number(v));
    const s = String(Math.abs(n));
    let last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    if (rest) last3 = ',' + last3;
    const grouped =
        rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
    return `₹${n < 0 ? '-' : ''}${grouped}`;
};

const FEE_STATUS = {
    paid: { label: 'Paid', bg: '#DCFCE7', fg: '#16A34A' },
    issued: { label: 'Issued', bg: '#DBEAFE', fg: '#2563EB' },
    proforma: { label: 'Estimate', bg: '#FEF3C7', fg: '#B45309' },
    void: { label: 'Void', bg: '#F0F0F0', fg: '#6B7280' },
};

const PaymentHistoryScreen = ({ viewModel, actions }) => {
    const {
        invoiceData = [],
        gradient1 = 'rgba(0, 86, 183, 1)',
        gradient2 = 'rgba(0, 38, 81, 1)',
        showFeeTab = false,
        tab = 'transactions',
        feeStatements = [],
        feeContract = null,
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onDownloadInvoice = () => {},
        onViewInvoice = () => {},
        onSelectTab = () => {},
        onViewFee = () => {},
        onDownloadFee = () => {},
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

    const renderFeeItem = ({ item }) => {
        const st = FEE_STATUS[item.status] || FEE_STATUS.issued;
        return (
            <View style={styles.feeCard}>
                <View style={styles.feeHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.feePeriod}>{item.period || 'Fee period'}</Text>
                        {(!!item.planName || !!item.category) && (
                            <Text style={styles.feePlanName}>
                                {[item.planName, item.category].filter(Boolean).join('  ·  ')}
                            </Text>
                        )}
                    </View>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.pillText, { color: st.fg }]}>
                            {st.label}
                        </Text>
                    </View>
                </View>
                <View style={styles.feeKv}>
                    <Text style={styles.feeKvLabel}>AUA</Text>
                    <Text style={styles.feeKvValue}>{inr(item.aua)}</Text>
                </View>
                <View style={styles.feeKv}>
                    <Text style={styles.feeKvLabel}>Fee</Text>
                    <Text style={styles.feeKvValue}>{inr(item.fee)}</Text>
                </View>
                <View style={styles.feeKv}>
                    <Text style={styles.feeKvLabel}>GST</Text>
                    <Text style={styles.feeKvValue}>{inr(item.gst)}</Text>
                </View>
                <View style={[styles.feeKv, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLabel}>Total</Text>
                    <Text style={styles.feeTotalValue}>{inr(item.total)}</Text>
                </View>
                <View style={styles.feeActions}>
                    <TouchableOpacity onPress={() => onDownloadFee(item)}>
                        <Text style={styles.downloadText}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onViewFee(item)}>
                        <Text style={styles.invoiceText}>View</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderContractStrip = () =>
        feeContract ? (
            <View style={styles.contractStrip}>
                <Text style={styles.contractText}>
                    {[
                        feeContract.billing_mode,
                        feeContract.billing_period,
                        feeContract.billing_timing,
                    ]
                        .filter(Boolean)
                        .join('  ·  ')}
                </Text>
                {!!(feeContract.client_category || feeContract.plan_name) && (
                    <Text style={styles.contractCategory}>
                        {feeContract.plan_name
                            ? `Plan: ${feeContract.plan_name}`
                            : `Category: ${feeContract.client_category}`}
                    </Text>
                )}
            </View>
        ) : null;

    const renderEmptyComponent = () => (
        <View style={styles.emptyWrap}>
            <View style={styles.emptyBadge}>
                <Text style={{ fontSize: 32 }}>{'💸'}</Text>
            </View>
            <Text style={styles.emptyTitle}>
                {tab === 'fees' ? 'No fee statements yet' : 'No Payment History'}
            </Text>
            <Text style={styles.emptyBody}>
                {tab === 'fees'
                    ? 'Your advisory fee statements will appear here once your first billing period closes.'
                    : 'Your completed transactions will appear here once you make your first payment.'}
            </Text>
        </View>
    );

    const onFees = tab === 'fees';

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
                    <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
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

            {showFeeTab && (
                <View style={styles.segment}>
                    <TouchableOpacity
                        style={[styles.segItem, !onFees && styles.segItemOn]}
                        onPress={() => onSelectTab('transactions')}>
                        <Text
                            style={[styles.segText, !onFees && styles.segTextOn]}>
                            Transactions
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segItem, onFees && styles.segItemOn]}
                        onPress={() => onSelectTab('fees')}>
                        <Text style={[styles.segText, onFees && styles.segTextOn]}>
                            Fee Statements
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {onFees ? (
                <FlatList
                    data={feeStatements}
                    renderItem={renderFeeItem}
                    keyExtractor={item => String(item.id)}
                    ListHeaderComponent={renderContractStrip}
                    ListEmptyComponent={renderEmptyComponent}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    data={invoiceData}
                    renderItem={renderPaymentItem}
                    keyExtractor={item => String(item.id)}
                    ListEmptyComponent={renderEmptyComponent}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    listContent: { paddingHorizontal: 16 },
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
    leftContent: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: { fontSize: 14, fontWeight: '500' },
    textContainer: { marginLeft: 12 },
    nameText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#000000' },
    dateText: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 2,
    },
    rightContent: { alignItems: 'flex-end' },
    amountText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#000000' },
    invoiceText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#2563EB' },
    downloadText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#16A085' },

    // Segmented control
    segment: {
        flexDirection: 'row',
        backgroundColor: '#F0F0F0',
        borderRadius: 10,
        padding: 3,
        marginHorizontal: 16,
        marginTop: 12,
    },
    segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segItemOn: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    segText: { fontSize: 12.5, color: '#6B7280', fontFamily: 'Poppins-Medium' },
    segTextOn: { color: '#111827' },

    // Contract strip
    contractStrip: {
        backgroundColor: '#F8F9FC',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 12,
        marginBottom: 4,
    },
    contractText: { fontSize: 12, color: '#374151', fontFamily: 'Poppins-Medium' },
    contractCategory: { fontSize: 11, color: '#6B7280', fontFamily: 'Poppins-Regular', marginTop: 2 },

    // Fee statement card
    feeCard: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
    },
    feeHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    feePeriod: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#111827' },
    feePlanName: { fontSize: 11, color: '#6B7280', fontFamily: 'Poppins-Regular', marginTop: 2 },
    pill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
    pillText: { fontSize: 10, fontFamily: 'Poppins-Medium' },
    feeKv: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    feeKvLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Satoshi-Regular' },
    feeKvValue: { fontSize: 12, color: '#111827', fontFamily: 'Satoshi-Medium' },
    feeTotalRow: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        marginTop: 4,
        paddingTop: 6,
    },
    feeTotalLabel: { fontSize: 13, color: '#111827', fontFamily: 'Satoshi-Bold' },
    feeTotalValue: { fontSize: 13, color: '#111827', fontFamily: 'Satoshi-Bold' },
    feeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 10,
    },

    // Empty state
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 50,
    },
    emptyBadge: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(0,86,183,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontFamily: 'Satoshi-Bold',
        fontSize: 18,
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
    },
    emptyBody: {
        fontFamily: 'Satoshi-Medium',
        fontSize: 14,
        color: '#4B5563',
        textAlign: 'center',
        maxWidth: '85%',
        lineHeight: 21,
    },
});

export default PaymentHistoryScreen;
