import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Info } from 'lucide-react-native'; // ✅ using lucide-react-native

const { width } = Dimensions.get('window');

const CommonInformationModal = ({ openModal, setCloseModal }) => {
  const mesmerizingText =
    'A trade has been executed in this model portfolio today. Kindly proceed with the necessary updates/repairs tomorrow.';

  return (
    <Modal
      transparent
      visible={openModal}
      animationType="fade"
      onRequestClose={() => setCloseModal(false)}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Centered Icon */}
          <View style={styles.iconContainer}>
            <Info size={60} color="#4B5563" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Important Update</Text>

          {/* Message */}
          <Text style={styles.message}>{mesmerizingText}</Text>

          {/* Button */}
          <TouchableOpacity
            onPress={() => setCloseModal(false)}
            style={styles.button}>
            <Text style={styles.buttonText}>Acknowledged</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};



const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  message: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
  },
  button: {
    backgroundColor: '#2563EB', // blue-600
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
});

export default CommonInformationModal;
