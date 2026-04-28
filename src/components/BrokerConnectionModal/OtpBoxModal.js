import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

const OtpBoxModal = ({ broker, submitOtp }) => {
  const [mpin, setMpin] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitOtp = async () => {
    setLoading(true);
    await submitOtp();
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect {broker}</Text>

      {/* Otp Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Otp:</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="Secret Key"
          value={mpin}
          keyboardType="numeric"
          onChangeText={setMpin}
        />
      </View>

      {/* Mpin Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Mpin:</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="Secret Key"
          value={otp}
          keyboardType="numeric"
          onChangeText={setOtp}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, (!mpin || !otp) && styles.disabledButton]}
        disabled={!mpin || !otp}
        onPress={handleSubmitOtp}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Otp</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    flex: 0.4,
  },
  inputBox: {
    flex: 0.6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#fff',
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: 'black',
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#00000030',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OtpBoxModal;
