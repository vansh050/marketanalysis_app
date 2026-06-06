/**
 * designs/default/sdk/BrokerSelectionList.js
 *
 * Default: broker grid/list for selecting which broker to connect.
 * Props: { brokers[], onSelect(brokerName), onCancel }
 *
 * This is the broker picker shown when executeAdvice detects no
 * connected broker (Phase E). Custom variants replace this to
 * match their own broker selection UX.
 */
import React from 'react';
import {View, Text, TouchableOpacity, FlatList, StyleSheet} from 'react-native';

export default function BrokerSelectionList({brokers = [], onSelect, onCancel}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Broker</Text>
      <FlatList
        data={brokers}
        numColumns={3}
        keyExtractor={(item) => item.name || item}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.brokerTile}
            onPress={() => onSelect(item.name || item)}
          >
            <Text style={styles.brokerName}>{item.name || item}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 20},
  title: {fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 16, textAlign: 'center'},
  brokerTile: {
    flex: 1,
    margin: 6,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  brokerName: {fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center'},
  cancelBtn: {marginTop: 16, alignItems: 'center', padding: 12},
  cancelText: {fontSize: 14, color: '#6b7280'},
});
