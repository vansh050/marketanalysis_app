/**
 * designs/default/sdk/KitePublisherHeader.js
 *
 * Default: header bar for the Zerodha Kite Publisher WebView.
 * Props: { onClose }
 */
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

export default function KitePublisherHeader({onClose}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Zerodha Kite — Review & Place</Text>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#387ed1',
  },
  title: {fontSize: 16, fontWeight: '600', color: '#fff'},
  close: {fontSize: 20, color: '#fff', paddingHorizontal: 8},
});
