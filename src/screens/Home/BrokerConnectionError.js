import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import { designColor } from '../../design/literalTokens';

const BrokerConnectionError = () => {
  const [brokerName, setBrokerName] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Broker not connected</Text>
        <Text style={styles.errorText}>
          Connect your broker and contact manager for subscription
        </Text>
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Created Date:</Text>
          <Text style={styles.infoValue}>22nd Jul 2024</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Broker:</Text>
          <TextInput
            style={styles.infoInput}
            value={brokerName}
            onChangeText={setBrokerName}
            placeholder="Enter Broker Name"
          />
        </View>
      </View>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Connect Broker</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColor('fff'),
    padding: 20,
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'red',
  },
  infoContainer: {
    borderWidth: 1,
    borderColor: designColor('ddd'),
    padding: 10,
    borderRadius: 5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 100,
  },
  infoValue: {
    flex: 1,
  },
  infoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: designColor('ddd'),
    padding: 5,
    borderRadius: 5,
  },
  button: {
    backgroundColor: designColor('007bff'),
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
  },
  buttonText: {
    color: designColor('fff'),
    textAlign: 'center',
    fontSize: 16,
  },
});

export default BrokerConnectionError;
