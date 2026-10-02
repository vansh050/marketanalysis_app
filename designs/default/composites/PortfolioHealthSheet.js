/**
 * PortfolioHealthSheet — pure presentation.
 * Consent persistence, holdings access, scoring and reconciliation live in
 * src/components/designContainers/PortfolioHealthSheetContainer.js.
 */

import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Pressable, StyleSheet,
} from 'react-native';

const PortfolioHealthSheet = ({viewModel, actions}) => {
  const {visible = false, open = false, phase = 'idle', result = null} = viewModel || {};
  const {onLaunch = () => {}, onAllow = () => {}, onClose = () => {}} = actions || {};
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity style={styles.launcher} onPress={onLaunch}>
        <View style={styles.launcherIcon}><Text style={{fontSize: 16}}>🛡</Text></View>
        <View style={{flex: 1}}>
          <Text style={styles.launcherTitle}>Check your portfolio health</Text>
          <Text style={styles.launcherSub}>Factual concentration & spread — not advice</Text>
        </View>
        <Text style={styles.launcherCta}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          {phase === 'consent' && (
            <View style={styles.consentCard}>
              <Text style={styles.consentTitle}>🛡 Check your portfolio health</Text>
              <Text style={styles.consentBody}>
                We read your holdings from your broker to show factual concentration and spread. Nothing is shared.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onAllow}>
                <Text style={styles.primaryBtnText}>Allow & analyze</Text>
              </TouchableOpacity>
            </View>
          )}
          {phase === 'analyzing' && (
            <View style={styles.center}>
              <ActivityIndicator color="#0056B7" />
              <Text style={styles.muted}>Analyzing your holdings…</Text>
            </View>
          )}
          {phase === 'empty' && (
            <View style={styles.center}>
              <Text style={styles.headline}>No holdings to analyze</Text>
              <Text style={styles.muted}>Connect a broker with holdings to see your portfolio health.</Text>
            </View>
          )}
          {phase === 'done' && result && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.headline}>
                {result.gapCount === 0 ? 'Nothing to review' : `${result.gapCount} thing${result.gapCount !== 1 ? 's' : ''} to review`}
              </Text>
              <Text style={styles.factualTag}>Factual checks · not advice</Text>
              {result.subScores.map(score => (
                <View key={score.key} style={styles.checkRow}>
                  <View style={[styles.flag, score.isGap ? styles.flagGap : styles.flagOk]}>
                    <Text style={styles.flagText}>{score.isGap ? '⚑' : '✓'}</Text>
                  </View>
                  <Text style={styles.checkText}>{score.detail}</Text>
                </View>
              ))}
              <Text style={styles.footer}>Factual checks only — not investment advice.</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
    launcher: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EAF2FB',
        borderColor: '#CFE2F7',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        margin: 16,
        gap: 10,
    },
    launcherIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    launcherTitle: { fontSize: 13, color: '#111827', fontFamily: 'Poppins-Medium' },
    launcherSub: { fontSize: 11, color: '#6B7280', fontFamily: 'Satoshi-Regular' },
    launcherCta: { fontSize: 22, color: '#0056B7' },

    backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.42)' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '80%',
    },
    grab: {
        width: 38,
        height: 4,
        borderRadius: 3,
        backgroundColor: '#E5E7EB',
        alignSelf: 'center',
        marginBottom: 12,
    },
    consentCard: {
        backgroundColor: '#EAF2FB',
        borderColor: '#CFE2F7',
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
    },
    consentTitle: { fontSize: 14, color: '#111827', fontFamily: 'Poppins-Medium' },
    consentBody: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 6,
        lineHeight: 18,
    },
    primaryBtn: {
        backgroundColor: '#0056B7',
        borderRadius: 10,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 12,
    },
    primaryBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Poppins-SemiBold' },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 8 },
    headline: { fontSize: 20, color: '#111827', fontFamily: 'Satoshi-Bold' },
    factualTag: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 2,
        marginBottom: 8,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 9,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    flag: {
        width: 18,
        height: 18,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    flagGap: { backgroundColor: '#FEF3C7' },
    flagOk: { backgroundColor: '#DCFCE7' },
    flagText: { fontSize: 10 },
    checkText: { flex: 1, fontSize: 12.5, color: '#111827', fontFamily: 'Satoshi-Medium' },
    muted: { fontSize: 12, color: '#6B7280', fontFamily: 'Satoshi-Regular', textAlign: 'center' },
    footer: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        textAlign: 'center',
        marginTop: 12,
    },
    closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    closeText: { fontSize: 13, color: '#6B7280', fontFamily: 'Poppins-Medium' },
});

export default PortfolioHealthSheet;
