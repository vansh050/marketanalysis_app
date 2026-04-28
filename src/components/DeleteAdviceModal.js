import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
 

const { height: screenHeight } = Dimensions.get('window');
const DeleteAdviceModal = ({ isVisible, onClose, onConfirm, handleIgnore, stockIgnoreId, stockname }) => {
  const [reason, setReason] = useState('');
  console.log('Item in delete modal:',stockname,stockIgnoreId);
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
              <Text style={styles.modalTitle}>{`Are you sure you want to delete ${stockname}?`}</Text>
              <TouchableOpacity style={styles.ignoreButton} onPress={onConfirm}>
                <Text style={styles.ignoreButtonText}>Delete</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,

    alignItems: 'center',
    height: screenHeight / 4,
  },
  indicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 2.5,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000',
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  ignoreButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 5,
    paddingVertical: 12,
    marginTop:15,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  ignoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeleteAdviceModal;
