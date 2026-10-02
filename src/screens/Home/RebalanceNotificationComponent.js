import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
    ArrowLeft,
    RefreshCw,
    TrendingUp,
    X,
    Calendar,
    Clock,
    Target,
    Bell,
    Filter,
    ChevronLeft,
    Repeat,
} from 'lucide-react-native';

import { designColor } from '../../design/literalTokens';

const formatFullDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const RebalanceNotificationComponent = ({ selectedNotification }) => {
    const [isExpanded, setIsExpanded] = useState(false); // State to track if the user wants to expand the list

    const handleExpandToggle = () => {
        setIsExpanded(!isExpanded); // Toggle expanded/collapsed state
    };

    const InfoRow = ({ label, value, icon, stylePrefix }) => (
        <View style={styles[`${stylePrefix}InfoRow`]}>
            <View style={styles[`${stylePrefix}InfoLabelRow`]}>
                {icon && <View style={styles[`${stylePrefix}IconWrapper`]}>{icon}</View>}
                <Text style={styles[`${stylePrefix}InfoLabel`]}>{label}</Text>
            </View>
            <Text style={styles[`${stylePrefix}InfoValue`]}>{value}</Text>
        </View>
    );

    const renderAdviceEntries = () => {
        const entriesToDisplay = isExpanded
            ? selectedNotification.latestRebalance.adviceEntries
            : selectedNotification.latestRebalance.adviceEntries.slice(0, 5);

        return entriesToDisplay.map((entry, index) => (
            <View key={`advice-entry-${index}`} style={styles.rebalanceNotificationListItem}>
                <Text style={styles.rebalanceNotificationListItemText}>
                    {entry.symbol} — {entry.price ? `₹${entry.price}` : 'Price N/A'}
                </Text>
                <Text style={styles.rebalanceNotificationListSubText}>
                    Segment: {entry.segment || 'EQUITY'} | Exchange: {entry.exchange || 'N/A'}
                </Text>
            </View>
        ));
    };

    return (
        <View style={styles.rebalanceNotificationContainer}>
            {/* Header Section */}
            <View style={styles.rebalanceNotificationHeaderCard}>
                <View style={styles.rebalanceNotificationHeaderIconRow}>
                    <Repeat color={designColor('407bff')} size={20} />
                    <Text style={styles.rebalanceNotificationHeaderTitle}>Portfolio Rebalance Alert</Text>
                </View>
                <Text style={styles.rebalanceNotificationSubText}>
                    Your portfolio "{selectedNotification.modelName}" received a new rebalance update.
                </Text>

            </View>
            {/* Portfolio Details */}
            <View style={styles.rebalanceNotificationCard}>
                <Text style={styles.rebalanceNotificationSectionTitle}>Portfolio Details</Text>
                {selectedNotification.modelName && (
                    <InfoRow
                        label="Portfolio Name"
                        value={selectedNotification.modelName}
                        stylePrefix="rebalanceNotification"
                    />
                )}
            </View>
            {/* Latest Rebalance Info */}
            {selectedNotification.latestRebalance && (
                <View style={styles.rebalanceNotificationCard}>
                    <Text style={styles.rebalanceNotificationSectionTitle}>Latest Rebalance</Text>
                    {selectedNotification.latestRebalance.rebalanceDate && (
                        <InfoRow
                            label="Rebalance Date"
                            icon={<Calendar color={designColor('6b7280')} size={16} />}
                            value={formatFullDateTime(selectedNotification.latestRebalance.rebalanceDate)}
                            stylePrefix="rebalanceNotification"
                        />
                    )}
                    {/* {selectedNotification.latestRebalance.totalInvestmentvalue && (
                        <InfoRow
                            label="Total Investment Value"
                            value={`₹${selectedNotification.latestRebalance.totalInvestmentvalue}`}
                            stylePrefix="rebalanceNotification"
                        />
                    )} */}
                    {selectedNotification?.latestRebalance.researchReportLink && (
                        <InfoRow
                            label="Research Report Link"
                            value={selectedNotification.latestRebalance.researchReportLink || 'No report available'}
                            stylePrefix="rebalanceNotification"
                        />
                    )}
                </View>
            )}
            {/* Advice Entries */}
            {selectedNotification?.latestRebalance?.adviceEntries?.length > 0 && (
                <View style={styles.rebalanceNotificationCard}>
                    <Text style={styles.rebalanceNotificationSectionTitle}>Final state of portfolio</Text>
                    {renderAdviceEntries()}
                    {selectedNotification.latestRebalance.adviceEntries.length > 5 && (
                        <TouchableOpacity onPress={handleExpandToggle} style={styles.expandButton}>
                            <Text style={styles.expandButtonText}>
                                {isExpanded ? 'Show Less' : 'Show More'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    rebalanceNotificationContainer: {
        padding: 0,
        backgroundColor: designColor('f9fafb'),
    },
    rebalanceNotificationHeaderCard: {
        backgroundColor: designColor('e8f0ff'),
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: designColor('bcccdc'),
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    rebalanceNotificationHeaderIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    rebalanceNotificationHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: designColor('407bff'),
        marginLeft: 12,
    },
    rebalanceNotificationSubText: {
        fontSize: 14,
        color: designColor('4b5563'),
        marginTop: 8,
    },
    rebalanceNotificationCard: {
        backgroundColor: designColor('ffffff'),
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: designColor('000'),
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    rebalanceNotificationSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: designColor('111827'),
        marginBottom: 12,
    },
    rebalanceNotificationInfoRow: {
        marginBottom: 8,
    },
    rebalanceNotificationInfoLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rebalanceNotificationIconWrapper: {
        marginRight: 8,
    },
    rebalanceNotificationInfoLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: designColor('374151'),
    },
    rebalanceNotificationInfoValue: {
        fontSize: 14,
        color: designColor('1f2937'),
        marginLeft: 6,
    },
    rebalanceNotificationListItem: {
        backgroundColor: designColor('f3f4f6'),
        borderRadius: 8,
        padding: 14,
        marginVertical: 6,
        borderLeftWidth: 4,
        borderLeftColor: designColor('4caf50'),
        shadowColor: designColor('d1d5db'),
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    rebalanceNotificationListItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: designColor('1f2937'),
    },
    rebalanceNotificationListSubText: {
        fontSize: 13,
        color: designColor('6b7280'),
        marginTop: 4,
    },
    expandButton: {
        marginTop: 12,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: designColor('407bff'),
        borderRadius: 8,
    },
    expandButtonText: {
        fontSize: 14,
        color: designColor('ffffff'),
        fontWeight: '600',
    },
});

export default RebalanceNotificationComponent;
