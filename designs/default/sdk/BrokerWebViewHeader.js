/**
 * designs/default/sdk/BrokerWebViewHeader.js
 *
 * Default: simple header bar rendered above broker OAuth WebView.
 * Props: { brokerName, title, onClose }
 *
 * No SDK default export for this — it's rendered inline by
 * WebViewBrokerAuthFlow. This file serves as the template for
 * custom variants to override.
 */
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

export default function BrokerWebViewHeader({brokerName, title, onClose}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title || `Connect ${brokerName}`}</Text>
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
