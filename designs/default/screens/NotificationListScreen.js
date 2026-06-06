/**
 * NotificationListScreen — design-system screen presentation (default variant, 2026-05-06)
 *
 * Pure presentation extracted from src/components/NotificationListScreen.js.
 * Container owns useNavigation + sample/seed data + (eventually) real
 * notification fetch. This file just renders the same chrome the legacy
 * component shipped — header bar with back-chevron + title, FlatList of
 * notification rows, empty state.
 *
 * Contract:
 *   viewModel = {
 *     notifications: [{ id, title, message, time, kind, unread }],
 *     isLoading?: boolean,
 *   }
 *   actions = {
 *     onBack: () => void,
 *     onMarkAllRead?: () => void,   // not rendered by default; alphanomy variant uses it
 *     onNotificationPress?: (item) => void,
 *   }
 */

import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    RefreshControl,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

const Alpha100 = require('../../../src/assets/alpha-100.png');

const NotificationListScreen = ({ viewModel, actions }) => {
    const { notifications = [] } = viewModel || {};
    const { onBack = () => {}, onRefresh } = actions || {};

    const [refreshing, setRefreshing] = useState(false);
    const handleRefresh = useCallback(async () => {
        if (typeof onRefresh !== 'function') {return;}
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    }, [onRefresh]);

    const renderItem = ({ item }) => (
        <SafeAreaView style={styles.notificationItem}>
            <View style={styles.iconRow}>
                <Image source={Alpha100} style={styles.flameIcon} />
                <Text style={styles.slash}>/</Text>
            </View>
            <Text style={styles.notificationText}>{item.message || item.title || ''}</Text>
        </SafeAreaView>
    );

    const renderEmpty = () => (
        <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No notifications available</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={onBack}>
                    <ChevronLeft style={styles.backIcon} size={20} color="black" />
                </TouchableOpacity>
                <Text style={styles.title}>Notification Screen</Text>
            </View>

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item, index) => item?.id || `${index}`}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={
                    notifications.length === 0
                        ? styles.emptyListContent
                        : styles.listContent
                }
                refreshControl={
                    typeof onRefresh === 'function' ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                        />
                    ) : undefined
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 20 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomColor: '#00000033',
        borderBottomWidth: 1,
        paddingVertical: 15,
    },
    backIcon: { alignSelf: 'center', marginRight: 10 },
    title: { fontSize: 20, fontFamily: 'Satoshi-Medium', color: '#000' },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
    flameIcon: { width: 20, height: 20, resizeMode: 'contain' },
    slash: { fontSize: 20, color: '#333333', marginLeft: 4 },
    notificationText: { fontSize: 18, color: '#333333' },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    emptyStateText: { fontSize: 18, color: '#999999' },
    listContent: { paddingBottom: 20 },
    emptyListContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default NotificationListScreen;
