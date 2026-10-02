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

import { designColor, designFont } from '../design/literalTokens';

const {width} = Dimensions.get('window');

const colorPalette = [
  designColor('eae7dc'),
  designColor('f5f3f4'),
  designColor('d4ecdd'),
  designColor('ffddc1'),
  designColor('f8e9a1'),
  designColor('b2c9ab'),
  designColor('ffc8a2'),
  designColor('f6bd60'),
  designColor('cb997e'),
  designColor('a5a58d'),
  designColor('b7cadb'),
  designColor('e2f0cb'),
  designColor('c1d37f'),
  designColor('ffebbb'),
  designColor('d3c4c4'),
  designColor('d4a5a5'),
  designColor('fff3e2'),
  designColor('f7b7a3'),
  designColor('efd6ac'),
  designColor('fae3d9'),
];

const RebalanceChangeDetailModal = ({
  isVisible,
  onClose,
  modelName,
  handleAcceptClick,
  rebalanceDetails,
}) => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradient2 = config?.gradient2 || designColor('0076fb');
  const advisorHeader = configData?.config?.REACT_APP_HEADER_NAME;
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const processTableData = history => {
    if (!Array.isArray(history) || history.length === 0) {
      setTableData([]);
      return false;
    }

    const orderedHistory = [...history].sort(
      (left, right) =>
        new Date(left?.rebalanceDate || 0) -
        new Date(right?.rebalanceDate || 0),
    );

    const latestRebalance = orderedHistory[orderedHistory.length - 1];
    const previousRebalance =
      orderedHistory.length > 1
        ? orderedHistory[orderedHistory.length - 2]
        : null;

    if (!Array.isArray(latestRebalance?.adviceEntries)) {
      setTableData([]);
      return false;
    }

    console.log('Latest Rebalance:', latestRebalance?.rebalanceDate);
    console.log('Previous Rebalance:', previousRebalance?.rebalanceDate);
    console.log('Total history entries:', orderedHistory.length);

    const allocationPercent = value => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return 0;
      return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    };

    // Create a map of previous allocations for quick lookup
    const previousAllocMap = {};
    if (previousRebalance && previousRebalance.adviceEntries) {
      previousRebalance.adviceEntries.forEach(entry => {
        previousAllocMap[entry.symbol] = allocationPercent(entry.value);
      });
    }

    // Process current allocations
    const processedData = latestRebalance.adviceEntries.map((entry, index) => {
      const currentAlloc = allocationPercent(entry.value);
      const previousValue = previousAllocMap[entry.symbol];
      const hasPreviousAllocation = Object.prototype.hasOwnProperty.call(
        previousAllocMap,
        entry.symbol,
      );
      const previousAlloc = hasPreviousAllocation ? previousValue : null;

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
    return processedData.length > 0;
  };

  useEffect(() => {
    if (!isVisible || !modelName) return undefined;

    let cancelled = false;
    const loadComparison = async () => {
      setLoadError('');
      setTableData([]);

      // The card already owns the exact selected strategy snapshot. Prefer it
      // so this modal cannot go blank because a second, older public endpoint
      // is stale or temporarily returns an empty history.
      const selectedHistory = rebalanceDetails?.model?.rebalanceHistory;
      if (Array.isArray(selectedHistory) && selectedHistory.length > 0) {
        processTableData(selectedHistory);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${modelName.replaceAll(
            /_/g,
            ' ',
          )}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': advisorHeader,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
            timeout: 15000,
          },
        );
        if (cancelled) return;
        const fallbackHistory =
          response.data?.[0]?.originalData?.model?.rebalanceHistory;
        if (!processTableData(fallbackHistory)) {
          setLoadError('Allocation details are temporarily unavailable. Please refresh and try again.');
        }
      } catch (error) {
        if (cancelled) return;
        console.log('Error fetching strategy details:', error);
        setLoadError('Allocation details are temporarily unavailable. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadComparison();
    return () => {
      cancelled = true;
    };
  }, [isVisible, modelName, rebalanceDetails, advisorHeader]);

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
              : {color: designColor('000')},
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
                  color={designColor('00b761')}
                  size={14}
                  strokeWidth={2}
                />
              )}
              {item.isDecrease && (
                <ArrowDown
                  style={{marginBottom: 2}}
                  color={designColor('ff3b30')}
                  size={14}
                  strokeWidth={2}
                />
              )}
              <Text
                style={[
                  styles.diffText,
                  item.isIncrease ? {color: designColor('00b761')} : {color: designColor('ff3b30')},
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
              <X color={designColor('000')} size={24} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={gradient2} />
            </View>
          ) : (
            <>
              {tableData.length > 0 ? (
                <>
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

                  <ScrollView style={styles.tableContent}>
                    <FlatList
                      data={tableData}
                      renderItem={renderItem}
                      keyExtractor={(item, index) => item.symbol + index}
                      scrollEnabled={false}
                    />
                  </ScrollView>
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {loadError || 'No allocation changes are available.'}
                  </Text>
                </View>
              )}

              {/* Accept Button */}
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  {backgroundColor: gradient2},
                  tableData.length === 0 && styles.acceptButtonDisabled,
                ]}
                onPress={handleAcceptClick}
                disabled={tableData.length === 0}>
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
  emptyContainer: {
    minHeight: 140,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: designColor('b42318'),
    fontSize: 14,
    fontFamily: designFont('Poppins-Medium'),
    textAlign: 'center',
  },
  modalContent: {
    backgroundColor: designColor('fff'),
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
    color: designColor('000'),
  },
  tableHeaderContainer: {
    backgroundColor: designColor('0056b7'),
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
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('fff'),
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
    borderBottomColor: designColor('f0f0f0'),
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
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('000'),
  },
  newLabel: {
    backgroundColor: designColor('0066ff'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newLabelText: {
    color: designColor('fff'),
    fontSize: 10,
    fontFamily: designFont('Poppins-Medium'),
  },
  ltpText: {
    fontSize: 11,
    color: designColor('8e8e93'),
    marginTop: 4,
    fontFamily: designFont('Poppins-Regular'),
  },
  holdingsText: {
    fontSize: 13,
    color: designColor('000'),
    fontFamily: designFont('Poppins-Medium'),
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
    fontFamily: designFont('Poppins-Medium'),
  },
  previousHoldingsText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
  },
  reqHoldingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqHoldingsText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
  },
  dropdownContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropdownButton: {
    backgroundColor: designColor('f5f5f5'),
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: designColor('0056b7'),
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: designColor('fff'),
    fontSize: 14,
    marginTop: 2,
    fontFamily: designFont('Poppins-Medium'),
  },
  acceptButtonDisabled: {
    opacity: 0.45,
  },
});

export default RebalanceChangeDetailModal;
