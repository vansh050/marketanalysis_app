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
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Check } from "lucide-react-native";
import {useNavigation} from '@react-navigation/native';
import { designToken } from '../../design/literalTokens';
// Returns / weights arrive as raw floats (e.g. 2.1342819030680326); show two
// decimals. Missing or non-numeric values keep the old "-" (0 stays "-" too,
// as before).
export const formatPercent = value => {
  const n = Number(value);
  return value && Number.isFinite(n) ? `${n.toFixed(2)}%` : '-';
};

const TerminateStrategyModal = ({
  terminateModal,
  setTerminateModal,
  strategyDetails,
  userEmail,
  getStrategyDetails,
  userDetails,
  tableData,
}) => {
  const navigation = useNavigation();
  const [ignoreText, setIgnoreText] = useState("");
  const [ignoreLoading, setIgnoreLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const terminateModalPortfolio = () => {
    if (!isConfirmed) return;
    setIgnoreLoading(true);

    const history = strategyDetails?.model?.rebalanceHistory || [];
    const latest = [...history].sort(
      (a, b) => new Date(b?.rebalanceDate || 0) - new Date(a?.rebalanceDate || 0),
    )[0];
    setTerminateModal(false);
    setIgnoreLoading(false);
    navigation.navigate('RebalanceReview', {
      portfolio: {
        ...strategyDetails,
        modelName: strategyDetails?.model_name,
        model_id: latest?.model_Id,
      },
      userEmail,
      broker: userDetails?.user_broker,
      brokerCredentials: userDetails,
      exitPortfolio: true,
      exitReason: ignoreText.trim(),
    });
  };


  const toggleCheckbox = () => {
    console.log('toog');
    setIsConfirmed(!isConfirmed);
  };

  const renderTable = () => (
    <FlatList
      data={tableData || [{}]}
      keyExtractor={(item, index) => index.toString()}
      contentContainerStyle={{ borderWidth: 1, borderColor: designToken('terminateModal.table.borderColor') }}
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
          <Text style={styles.cell}>{formatPercent(item.returns)}</Text>
          <Text style={styles.cell}>{formatPercent(item.weights)}</Text>
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
            Exit holdings and close this Model Portfolio?
          </Text>
          <ScrollView style={styles.tableContainer}>{renderTable()}</ScrollView>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Reason for Terminate (Optional)"
              placeholderTextColor={designToken('terminateModal.input.placeholderColor')}
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
    {isConfirmed && <Check size={20} color={designToken('terminateModal.checked.iconColor')} />}
      </TouchableOpacity>
            <Text style={styles.checkboxText}>
              Prepare SELL orders only for this model's attributed holdings.
              Closure happens after broker-confirmed fills. Subscription and
              payment-mandate cancellation remain separate.
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
                <ActivityIndicator color={designToken('terminateModal.terminateText.spinnerColor')} />
              ) : (
                <Text style={styles.terminateText}>Review SELL Orders</Text>
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
    backgroundColor: designToken('terminateModal.modalOverlay.backgroundColor'),
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: designToken('terminateModal.modalContent.backgroundColor'),
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
    backgroundColor: designToken('terminateModal.checked.backgroundColor'), // Tailwind color for success
    borderColor: designToken('terminateModal.checked.borderColor'), // Green border when checked
  },
  unchecked: {
    backgroundColor: designToken('terminateModal.unchecked.backgroundColor'),
    borderColor: designToken('terminateModal.unchecked.borderColor'), // Light gray border when unchecked
  },
  modalTitle: {
    fontSize: 18,
    textAlign: "center",
    color:designToken('terminateModal.modalTitle.color'),
    fontFamily:designToken('terminateModal.modalTitle.fontFamily'),
    marginBottom: 10,
  },
  tableContainer: {
    maxHeight: 150,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: designToken('terminateModal.row.borderColor'),
  },
  headerRow: {
    backgroundColor: designToken('terminateModal.headerRow.backgroundColor'),
  },
  headerText: {
    flex: 1,
    textAlign: "center",
    padding: 5,
    color:designToken('terminateModal.headerText.color'),
    fontFamily:designToken('terminateModal.headerText.fontFamily'),
    fontSize: 12,
  },
  cell: {
    flex: 1,
    textAlign: "center",
    padding: 5,
    color:designToken('terminateModal.cell.color'),
    fontFamily:designToken('terminateModal.cell.fontFamily'),
    fontSize: 10,
  },
  altRow: {
    backgroundColor: designToken('terminateModal.altRow.backgroundColor'),
  },
  inputContainer: {
    marginVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: designToken('terminateModal.input.borderColor'),
    borderRadius: 5,
    color:designToken('terminateModal.input.color'),
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
    color:designToken('terminateModal.checkboxText.color')
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: designToken('terminateModal.cancelButton.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('terminateModal.cancelButton.borderColor'),
    padding: 10,
    alignItems: "center",
    borderRadius: 5,
    marginRight: 5,
  },
  cancelText: {
    color: designToken('terminateModal.cancelText.color'),
    fontFamily:designToken('terminateModal.cancelText.fontFamily'),
    fontSize: 14,
  },
  terminateButton: {
    flex: 1,
    backgroundColor: designToken('terminateModal.terminateButton.backgroundColor'),
    padding: 10,
    alignItems: "center",
    borderRadius: 5,
    marginLeft: 5,
  },
  terminateText: {
    color: designToken('terminateModal.terminateText.color'),
    fontSize: 14,
    fontFamily:designToken('terminateModal.terminateText.fontFamily'),
  },
  disabledButton: {
    backgroundColor: designToken('terminateModal.disabledButton.backgroundColor'),
  },
});

export default TerminateStrategyModal;
