/**
 * IgnoreTradesScreen — design-system screen presentation (Phase G batch 4, 2026-05-02)
 *
 * Pure presentation. Container owns useTrade, useConfig, useModal, useCart,
 * Firebase getAuth, useSdkClient, all broker state machines, axios calls,
 * EventEmitter listeners, placeOrder / getAllTrades / getAllFunds logic.
 *
 * The actual render is thin: a header bar (back + title) and a StockAdvices
 * component. The ~1500 LOC of broker/trade logic in the container feeds into
 * StockAdvices via props — the presentation layer only renders the chrome.
 *
 * Contract:
 *   viewModel = {
 *     userEmail,         // string — passed to StockAdvices
 *     type,              // string — 'Ignore' (trade filter type)
 *     headerTitle,       // string — 'Ignored Trades'
 *   }
 *   actions = {
 *     onGoBack,          // () => void — navigation.goBack()
 *   }
 *   slots = {
 *     StockAdvicesSlot,  // ReactElement — pre-built <StockAdvices> from container
 *   }
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

const IgnoreTradesScreen = ({ viewModel, actions, slots }) => {
    const {
        headerTitle = 'Ignored Trades',
    } = viewModel || {};
    const {
        onGoBack = () => {},
    } = actions || {};
    const {
        StockAdvicesSlot = null,
    } = slots || {};

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onGoBack}>
                    <ChevronLeft
                        style={styles.backIcon}
                        size={20}
                        color={'black'}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{headerTitle}</Text>
            </View>
            {StockAdvicesSlot}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        backgroundColor: '#F9F9F9',
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 0.5,
        borderBottomColor: '#DEECE9',
    },
    backIcon: {
        marginRight: 10,
        alignContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 3,
    },
    headerTitle: {
        fontFamily: 'Satoshi-Bold',
        fontSize: 20,
        color: 'black',
    },
});

export default IgnoreTradesScreen;
