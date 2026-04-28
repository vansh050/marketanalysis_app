import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Check } from "lucide-react-native";
const TerminateStrategyModal = ({
  terminateModal,
  setTerminateModal,
  strategyDetails,
  userEmail,
  getStrategyDetails,
  userDetails,
  tableData,
}) => {
  const [ignoreText, setIgnoreText] = useState("");
  const [ignoreLoading, setIgnoreLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const terminateModalPortfolio = () => {
    if (!isConfirmed) return;
    setIgnoreLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIgnoreLoading(false);
      setTerminateModal(false);
      Alert.alert(
        "Success",
        "You have successfully terminated the Model Portfolio."
      );
    }, 2000);
  };


  const toggleCheckbox = () => {
    console.log('toog');
    setIsConfirmed(!isConfirmed);
  };

  const renderTable = () => (
    <FlatList
      data={tableData || [{}]}
      keyExtractor={(item, index) => index.toString()}
      contentContainerStyle={{ borderWidth: 1, borderColor: "#ccc" }}
      ListHeaderComponent={() => (
        <View style={[styles.row, styles.headerRow]}>
          {["Stock", "Current Price(₹)", "Avg. Buy Price(₹)", "Returns(%)", "Weights(%)", "Shares"].map(
            (header, index) => (
              <Text key={index} style={styles.headerText}>
                {header}
              </Text>
            )
          )}
        </View>
      )}
      renderItem={({ item, index }) => (
        <View style={[styles.row, index % 2 === 0 && styles.altRow]}>
          <Text style={styles.cell}>{item.symbol || "-"}</Text>
          <Text style={styles.cell}>{item.currentPrice || "-"}</Text>
          <Text style={styles.cell}>{item.avgBuyPrice || "-"}</Text>
          <Text style={styles.cell}>{item.returns ? `${item.returns}%` : "-"}</Text>
          <Text style={styles.cell}>{item.weights ? `${item.weights}%` : "-"}</Text>
          <Text style={styles.cell}>{item.shares || "-"}</Text>
        </View>
      )}
    />
  );

  return (
    <Modal
      transparent={true}
      visible={terminateModal}
      animationType="slide"
      onRequestClose={() => setTerminateModal(false)}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            Are you sure you want to terminate this Model Portfolio?
          </Text>
          <ScrollView style={styles.tableContainer}>{renderTable()}</ScrollView>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Reason for Terminate (Optional)"
              placeholderTextColor="#aaa"
              value={ignoreText}
              onChangeText={setIgnoreText}
            />
          </View>
          <View style={styles.checkboxContainer}>
          <TouchableOpacity
        onPress={toggleCheckbox}
        style={[
          styles.checkbox,
          isConfirmed ? styles.checked : styles.unchecked,
        ]}
      >
    {isConfirmed && <Check size={20} color={'#fff'} />}
      </TouchableOpacity>
            <Text style={styles.checkboxText}>
              I understand that this action cannot be undone and I want to
              terminate this Model Portfolio.
            </Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setTerminateModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.terminateButton,
                !isConfirmed && styles.disabledButton,
              ]}
              onPress={terminateModalPortfolio}
              disabled={!isConfirmed}
            >
              {ignoreLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.terminateText}>Terminate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  
    padding: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checked: {
    backgroundColor: '#10B981', // Tailwind color for success
    borderColor: '#10B981', // Green border when checked
  },
  unchecked: {
    backgroundColor: '#fff',
    borderColor: '#D1D5DB', // Light gray border when unchecked
  },
  modalTitle: {
    fontSize: 18,
    textAlign: "center",
    color:'grey',
    fontFamily:'Satoshi-Bold',
    marginBottom: 10,
  },
  tableContainer: {
    maxHeight: 150,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  headerRow: {
    backgroundColor: "#f5f5f5",
  },
  headerText: {
    flex: 1,
    textAlign: "center",
    padding: 5,
    color:'grey',
    fontFamily:'Satoshi-Bold',
    fontSize: 12,
  },
  cell: {
    flex: 1,
    textAlign: "center",
    padding: 5,
    color:'black',
    fontFamily:'Satoshi-Medium',
    fontSize: 10,
  },
  altRow: {
    backgroundColor: "#f9f9f9",
  },
  inputContainer: {
    marginVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    color:'#000',
    padding: 10,
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  checkboxText: {
    fontSize: 12,
    marginLeft: 10,
    color:'grey'
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    alignItems: "center",
    borderRadius: 5,
    marginRight: 5,
  },
  cancelText: {
    color: "#000",
    fontFamily:'Satoshi-Medium',
    fontSize: 14,
  },
  terminateButton: {
    flex: 1,
    backgroundColor: "#e43d3d",
    padding: 10,
    alignItems: "center",
    borderRadius: 5,
    marginLeft: 5,
  },
  terminateText: {
    color: "white",
    fontSize: 14,
    fontFamily:'Satoshi-Medium',
  },
  disabledButton: {
    backgroundColor: "#e0e0e0",
  },
});

export default TerminateStrategyModal;
