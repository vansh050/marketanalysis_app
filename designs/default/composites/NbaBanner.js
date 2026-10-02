/**
 * NbaBanner — pure presentation for the ranked next-best-action banner.
 * Data derivation, TradeContext reads, and navigation live in
 * src/components/designContainers/NbaBannerContainer.js.
 */

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

const Pill = ({tone, label}) => (
  <View style={[styles.pill, styles[`pill_${tone}`]]}>
    <View style={[styles.dot, styles[`dot_${tone}`]]} />
    <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
  </View>
);

const NbaBanner = ({viewModel, actions}) => {
  const {
    visible = false,
    focal = null,
    brokerPill = {tone: 'grey', label: 'Broker —'},
    kycDone = false,
    healthGap = null,
  } = viewModel || {};
  const {onAct = () => {}} = actions || {};

  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      {focal && (
        <TouchableOpacity style={styles.banner} activeOpacity={0.85} onPress={onAct}>
          <View style={styles.accent} />
          <View style={styles.bangIcon}>
            <Text style={{color: '#0056B7', fontWeight: '700'}}>!</Text>
          </View>
          <Text style={styles.bannerText} numberOfLines={2}>{focal.title}</Text>
          {focal.ctaLabel ? (
            <View style={styles.fixBtn}>
              <Text style={styles.fixText}>{focal.ctaLabel}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      )}

      <View style={styles.strip}>
        <Pill tone={brokerPill.tone} label={brokerPill.label} />
        <Pill tone={kycDone ? 'green' : 'amber'} label={kycDone ? 'KYC Done' : 'KYC Pending'} />
        {healthGap !== null && (
          <Pill tone={healthGap > 0 ? 'amber' : 'green'} label={`Health ${healthGap}`} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 12 },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 11,
        marginBottom: 8,
        gap: 9,
        overflow: 'hidden',
    },
    accent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: '#0056B7',
    },
    bangIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: '#EAF2FB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerText: { flex: 1, fontSize: 12.5, color: '#111827', fontFamily: 'Poppins-Medium' },
    fixBtn: {
        backgroundColor: '#0056B7',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    fixText: { color: '#fff', fontSize: 11, fontFamily: 'Poppins-Medium' },

    strip: { flexDirection: 'row', gap: 6 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 18,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    pill_green: { backgroundColor: '#DCFCE7' },
    pill_amber: { backgroundColor: '#FEF3C7' },
    pill_grey: { backgroundColor: '#F0F0F0' },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dot_green: { backgroundColor: '#16A34A' },
    dot_amber: { backgroundColor: '#B45309' },
    dot_grey: { backgroundColor: '#9CA3AF' },
    pillText: { fontSize: 10.5, fontFamily: 'Poppins-Medium' },
    pillText_green: { color: '#16A34A' },
    pillText_amber: { color: '#B45309' },
    pillText_grey: { color: '#6B7280' },
});

export default NbaBanner;
