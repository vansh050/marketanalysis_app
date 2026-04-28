import React from "react";
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Dimensions 
} from "react-native";
import { X } from "lucide-react-native"; // modern close icon
import { useConfig } from '../../context/ConfigContext';

const { width } = Dimensions.get("window");

const RebalanceDetailsModal = ({ visible, onClose, data }) => {
  const config = useConfig();
  const gradient2 = config?.gradient2 || '#0076FB';
  const latest = data?.latestRebalance;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {latest?.updatedModelName || data?.model_name}
            </Text>
            <View style={[styles.tagWrapper, {backgroundColor: gradient2}]}>
              <Text style={styles.tagText}>Rebalance</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <X size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
          >
            {[
              { label: "Advisor", value: data?.advisor },
              { label: "Rebalance Date", value: latest?.rebalanceDate ? new Date(latest.rebalanceDate).toLocaleDateString() : "-" },
              { label: "Total Investment Value", value: latest?.totalInvestmentvalue != null ? `₹ ${latest.totalInvestmentvalue}` : "-" },
              { label: "Frequency", value: data?.frequency },
              { label: "Overview", value: data?.overView },
              { label: "Rebalance Methodology", value: data?.rebalanceMethodologyText },
              { label: "Why This Strategy", value: data?.whyThisStrategy },
            ].map(
              (item, idx) =>
                item.value && (
                  <View key={idx} style={styles.infoCard}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.value}</Text>
                  </View>
                )
            )}
          </ScrollView>

          {/* Footer Button */}
          <TouchableOpacity onPress={onClose} style={[styles.modalCloseButton, {backgroundColor: gradient2}]}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default RebalanceDetailsModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  tagWrapper: {
    backgroundColor: "#0056B7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  tagText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeIcon: {
    padding: 6,
  },
  modalContent: {
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
    lineHeight: 20,
  },
  modalCloseButton: {
    alignSelf: "center",
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: "#0056B7",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  modalCloseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
