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

import { designColor, designToken } from '../../design/literalTokens';

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
                <ActivityIndicator color={designToken('disconnectBroker.surface')} size="small" />
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
    backgroundColor: designToken('disconnectBroker.surface'),
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
    color: designToken('disconnectBroker.text'),
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: designToken('disconnectBroker.textSecondary'),
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
    borderColor: designToken('disconnectBroker.border'),
    backgroundColor: designToken('disconnectBroker.surface'),
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: designToken('disconnectBroker.text2'),
  },
  disconnectButton: {
    backgroundColor: designToken('disconnectBroker.danger'),
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: "600",
    color: designToken('disconnectBroker.surface'),
  },
});
