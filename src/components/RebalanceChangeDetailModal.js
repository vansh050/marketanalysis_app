// RebalanceChangeDetailModal.js
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import {X, ChevronDown, ArrowUp, ArrowDown} from 'lucide-react-native';
import server from '../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../utils/SecurityTokenManager';
import axios from 'axios';
import {useTrade} from '../screens/TradeContext';
import {useConfig} from '../context/ConfigContext';

const {width} = Dimensions.get('window');

const colorPalette = [
  '#EAE7DC',
  '#F5F3F4',
  '#D4ECDD',
  '#FFDDC1',
  '#F8E9A1',
  '#B2C9AB',
  '#FFC8A2',
  '#F6BD60',
  '#CB997E',
  '#A5A58D',
  '#B7CADB',
  '#E2F0CB',
  '#C1D37F',
  '#FFEBBB',
  '#D3C4C4',
  '#D4A5A5',
  '#FFF3E2',
  '#F7B7A3',
  '#EFD6AC',
  '#FAE3D9',
];

const RebalanceChangeDetailModal = ({
  isVisible,
  onClose,
  modelName,
  handleAcceptClick,
}) => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradient2 = config?.gradient2 || '#0076FB';
  const [rebalanceData, setRebalanceData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const getStrategyDetails = () => {
    if (modelName) {
      setLoading(true);
      axios
        .get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${modelName.replaceAll(
            /_/g,
            ' ',
          )}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0]?.originalData;
          if (portfolioData?.model?.rebalanceHistory?.length > 0) {
            const history = portfolioData.model.rebalanceHistory;
            setRebalanceData(history);
            processTableData(history);
          }
          setLoading(false);
        })
        .catch(err => {
          console.log('Error fetching strategy details:', err);
          setLoading(false);
        });
    }
  };

  const processTableData = history => {
    if (history.length === 0) return;

    const latestRebalance = history[history.length - 1];
    const previousRebalance =
      history.length > 1 ? history[history.length - 2] : null;

    console.log('Latest Rebalance:', latestRebalance?.rebalanceDate);
    console.log('Previous Rebalance:', previousRebalance?.rebalanceDate);
    console.log('Total history entries:', history.length);

    // Create a map of previous allocations for quick lookup
    const previousAllocMap = {};
    if (previousRebalance && previousRebalance.adviceEntries) {
      previousRebalance.adviceEntries.forEach(entry => {
        previousAllocMap[entry.symbol] = parseFloat(entry.value) || 0;
      });
    }

    // Process current allocations
    const processedData = latestRebalance.adviceEntries.map((entry, index) => {
      const currentAlloc = parseFloat(entry.value) * 100 || 0;
      const previousValue = previousAllocMap[entry.symbol];
      const previousAlloc = previousValue ? previousValue * 100 : null;

      let previousHoldings = 'NA';
      let isNewStock = false;
      let isIncrease = false;
      let isDecrease = false;
      let diffValue = 0;

      if (previousAlloc === null || previousAlloc === undefined) {
        // New stock added
        isNewStock = true;
        previousHoldings = '0%';
      } else {
        previousHoldings = `${Math.round(previousAlloc)}%`;
        const diff = currentAlloc - previousAlloc;
        diffValue = Math.round(diff);

        if (Math.abs(diff) < 0.5) {
          // No significant change (less than 0.5%)
          diffValue = 0;
        } else if (diff > 0) {
          isIncrease = true;
        } else if (diff < 0) {
          isDecrease = true;
        }
      }

      return {
        symbol: entry.symbol,
        price: entry.price,
        currHoldings: `${Math.round(currentAlloc)}%`,
        previousHoldings: previousHoldings,
        diffValue: diffValue,
        isNewStock: isNewStock,
        isIncrease: isIncrease,
        isDecrease: isDecrease,
        bgColor: colorPalette[index % colorPalette.length],
      };
    });

    console.log('Processed data sample:', processedData.slice(0, 3));
    setTableData(processedData);
    setLoading(false);
  };
  console.log('loading---', loading);
  useEffect(() => {
    if (isVisible && modelName) {
      getStrategyDetails();
    }
  }, [isVisible, modelName]);

  const renderItem = ({item}) => (
    <View style={[styles.row, {backgroundColor: `${item.bgColor}4D`}]}>
      <View style={styles.cellStock}>
        <View style={styles.stockNameContainer}>
          <Text style={styles.stockText}>{item.symbol}</Text>
        </View>
        <Text style={styles.ltpText}>LTP: {item.price}</Text>
      </View>
      <View style={styles.cell}>
        <Text
          style={[
            styles.previousHoldingsText,
            item.isNewStock
              ? {color: gradient2, fontWeight: '700'}
              : {color: '#000'},
          ]}>
          {item.previousHoldings}
        </Text>
      </View>
      <View style={styles.cell}>
        <View style={styles.holdingsContainer}>
          <Text style={styles.holdingsText}>{item.currHoldings}</Text>
          {item.diffValue !== 0 && (
            <View style={styles.diffContainer}>
              {item.isIncrease && (
                <ArrowUp
                  style={{marginBottom: 2}}
                  color="#00B761"
                  size={14}
                  strokeWidth={2}
                />
              )}
              {item.isDecrease && (
                <ArrowDown
                  style={{marginBottom: 2}}
                  color="#FF3B30"
                  size={14}
                  strokeWidth={2}
                />
              )}
              <Text
                style={[
                  styles.diffText,
                  item.isIncrease ? {color: '#00B761'} : {color: '#FF3B30'},
                ]}>
                {item.isIncrease
                  ? `(+${item.diffValue})`
                  : `(${item.diffValue})`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Expected vs Current Holdings</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#000" size={24} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={gradient2} />
            </View>
          ) : (
            <>
              {/* Table Header */}
              <View style={[styles.tableHeaderContainer, {backgroundColor: gradient2}]}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, styles.headerCellStock]}>
                    Stocks
                  </Text>
                  <Text style={[styles.headerCell, styles.headerCellCenter]}>
                    Allocation (prior)
                  </Text>
                  <Text style={[styles.headerCell, styles.headerCellCenter]}>
                    Allocation (required)
                  </Text>
                </View>
              </View>

              {/* Table Content */}
              <ScrollView style={styles.tableContent}>
                <FlatList
                  data={tableData}
                  renderItem={renderItem}
                  keyExtractor={(item, index) => item.symbol + index}
                  scrollEnabled={false}
                />
              </ScrollView>

              {/* Accept Button */}
              <TouchableOpacity
                style={[styles.acceptButton, {backgroundColor: gradient2}]}
                onPress={handleAcceptClick}>
                <Text style={styles.acceptButtonText}>View and act</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loaderContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 20,
    paddingHorizontal: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  tableHeaderContainer: {
    backgroundColor: '#0056B7',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCell: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
  },
  headerCellStock: {
    flex: 2,
  },
  headerCellCenter: {
    flex: 1,
    textAlign: 'center',
  },
  tableContent: {
    paddingHorizontal: 0,
    maxHeight: 400,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    justifyContent: 'space-between',
    borderRadius: 8,
    marginVertical: 0,
  },
  cellStock: {
    flex: 2,
  },
  stockNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: '#000',
  },
  newLabel: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newLabelText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
  },
  ltpText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
  },
  holdingsText: {
    fontSize: 13,
    color: '#000',
    fontFamily: 'Poppins-Medium',
  },
  holdingsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  diffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 0,
  },
  diffText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  previousHoldingsText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
  },
  reqHoldingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqHoldingsText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
  },
  dropdownContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropdownButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#0056B7',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
    fontFamily: 'Poppins-Medium',
  },
});

export default RebalanceChangeDetailModal;
