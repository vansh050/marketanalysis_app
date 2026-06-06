/**
 * EmptyStateMP — design-system composite presentation (Phase I, 2026-05-02)
 *
 * Pure presentation for the "Premium Access Required" empty state.
 * Container passes theme colors; presentation renders the lock icon +
 * title + subtitle.
 *
 * Contract:
 *   viewModel = {
 *     title        — string (default 'Premium Access Required')
 *     subtitle     — string (default 'Purchase this plan...')
 *     themeColor   — string — icon color
 *     mainColor    — string — title color
 *   }
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';

const EmptyStateInfoMP = ({ viewModel }) => {
  const {
    title = 'Premium Access Required',
    subtitle = 'Purchase this plan to view all distributions and unlock advanced insights.',
    themeColor = '#0056B7',
    mainColor = '#002651',
  } = viewModel || {};

  return (
    <View style={styles.container}>
      <Lock size={60} color={themeColor} style={styles.icon} />
      <Text style={[styles.title, { color: mainColor }]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    backgroundColor: 'transparent',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#002651',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#606060',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EmptyStateInfoMP;
