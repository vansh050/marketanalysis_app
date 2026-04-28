import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';

const { width: screenWidth, } = Dimensions.get('window');
const IgnoreAdviceModal = ({ isVisible, onClose, handleIgnore, stockIgnoreId }) => {
  const [reason, setReason] = useState('');

  const handleIgnorePress = () => {
    handleIgnore(stockIgnoreId, reason); // Pass stock ID and reason to handleIgnore
    onClose(); 
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      useNativeDriver
      hideModalContentWhileAnimating
      onRequestClose={onClose} 
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.indicator}></View>
              <Text style={styles.modalTitle}>Are you sure you want to ignore this investment advice?</Text>
              <TextInput
                style={styles.input}
                placeholder="Reason for Ignoring (Optional)"
                placeholderTextColor="#B0B0B0"
              
                value={reason}
                onChangeText={setReason}
              />
              <TouchableOpacity style={styles.ignoreButton} onPress={handleIgnorePress}>
                <Text style={styles.ignoreButtonText}>Ignore Advice</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: screenWidth * 0.05, // Adjusting the radius based on screen width
    borderTopRightRadius: screenWidth * 0.05, // Adjusting the radius based on screen width
    padding: screenWidth * 0.05, // Responsive padding
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  indicator: {
    width: screenWidth * 0.1, // Responsive width
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 2.5,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: screenWidth * 0.045, // Responsive font size
    fontWeight: '600',
    fontFamily:'Poppins-Medium',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000',
  },
  input: {
    width: '100%',

    height: 40, // Fixed height for the input
    borderColor: '#E0E0E0',
    borderWidth: 1,
    
    borderRadius: screenWidth * 0.02, // Responsive border radius
    paddingHorizontal: screenWidth * 0.03, // Responsive padding
    marginBottom: 20, // Space below input
  },
  ignoreButton: {
    backgroundColor: '#FF3B30',
    fontFamily:'Poppins-Regular',
    borderRadius: screenWidth * 0.02, // Responsive button radius
    paddingVertical: 12, // Padding inside button
    paddingHorizontal: 20, // Padding inside button
    alignItems: 'center',
    width: '100%',
  },
  ignoreButtonText: {
    color: 'white',
    fontFamily:'Poppins-Regular',
    fontSize: 16, // Responsive font size
    fontWeight: '600',
  },
});

export default IgnoreAdviceModal;
