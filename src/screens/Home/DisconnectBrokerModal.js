import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTrade } from "../TradeContext";

import { designColor } from '../../design/literalTokens';

const DisconnectBrokerModal = ({
  showDisconnectBroker,
  setShowDisconnectBroker,
  handleContinueWithoutBrokerSave,
  withoutBrokerLoader,
}) => {
 
  return (
    <Modal
      visible={showDisconnectBroker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDisconnectBroker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Confirm Disconnect</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to disconnect broker?
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowDisconnectBroker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={handleContinueWithoutBrokerSave}
              activeOpacity={0.8}
            >
              {withoutBrokerLoader ? (
                <ActivityIndicator color={designColor('fff')} size="small" />
              ) : (
                <Text style={styles.disconnectText}>Disconnect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DisconnectBrokerModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: designColor('fff'),
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: designColor('000'),
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: designColor('111827'),
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: designColor('4b5563'),
    textAlign: "center",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
    backgroundColor: designColor('fff'),
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: designColor('374151'),
  },
  disconnectButton: {
    backgroundColor: designColor('dc2626'),
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: "600",
    color: designColor('fff'),
  },
});
