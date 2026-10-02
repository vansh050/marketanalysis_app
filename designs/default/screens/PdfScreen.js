/**
 * PdfScreen — design-system screen presentation (Phase G batch 3, 2026-05-02)
 *
 * Pure presentation. Thin KnowledgeHub wrapper for the "PDFs" tab.
 *
 * Contract:
 *   viewModel = { navigation }
 *   actions   = {}
 */

import React from 'react';
import { SafeAreaView, View, StyleSheet } from 'react-native';
const PdfScreen = ({ viewModel, slots }) => {
    const { navigation } = viewModel || {};
    const { KnowledgeHub } = slots || {};

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <KnowledgeHub navigation={navigation} type="full" initialTab="PDFs" />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
});

export default PdfScreen;
