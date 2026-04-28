import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
  Image,
  SafeAreaView,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import {
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  ChevronLeft,
  CrossIcon,
  Info,
  InfoIcon,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { isOrderSuccess, isOrderRejected, isOrderPending } from '../../utils/orderStatusUtils';
const { height: screenHeight } = Dimensions.get('window');
const { width: screenWidth } = Dimensions.get('window');
import { useModal } from '../ModalContext';
import LinearGradient from 'react-native-linear-gradient';
import { useConfig } from '../../context/ConfigContext';

const CheckedIcon = require('../../assets/checked.png');
const FailureIcon = require('../../assets/cross.png');
const PartialIcon = require('../../assets/partial_success.png');

const RecommendationSuccessModal = ({
  openSuccessModal,
  setOpenSucessModal,
  orderPlacementResponse,
  currentBroker,
}) => {
  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';
  const stepCompletedColor = config?.paymentModal?.stepCompletedColor || '#29A400';
  const getProgressBarWidth = (executed, total) => {
    return (executed / total) * 100 + '%';
  };

  console.log("Order Response ----------", orderPlacementResponse);
  const { hideAddToCartModal, successclosemodel, setsuccessclosemodel } =
    useModal();

  const navigation = useNavigation();
  const [orderResponse, setOrderResponse] = useState(orderPlacementResponse);

  useEffect(() => {
    setOrderResponse(orderPlacementResponse);
  }, []);

  const [showStocksDetails, setShowStocksDetails] = useState(false);

  const getFormattedDate = () => {
    const date = new Date();
    return moment(date).format('Do MMM YYYY');
  };

  const toggleStocksDetails = () => {
    setShowStocksDetails(!showStocksDetails);
  };

  console.log('Order Response : ---', orderPlacementResponse);

  const successCount = orderResponse?.filter(
    item => isOrderSuccess(item?.orderStatus) || isOrderPending(item?.orderStatus),
  ).length;

  const failureCount = orderResponse?.filter(
    item => isOrderRejected(item?.orderStatus),
  ).length;

  const totalCount = orderResponse?.length;
  const successPercentage = (successCount / totalCount) * 100;
  const failurePercentage = (failureCount / totalCount) * 100;
  const partialFailurePercentage = 100 - successPercentage;

  // Detect cautionary listing failures
  const cautionaryListingStocks = orderResponse?.filter((item) => {
    const message = (
      item?.orderStatusMessage ||
      item?.message_aq ||
      item?.message ||
      ''
    ).toLowerCase();
    return message.includes('cautionary') && message.includes('listing');
  }) || [];

  const hasCautionaryListingFailures = cautionaryListingStocks.length > 0;

  console.log('Log----', failureCount, successCount);

  const renderOrderItem = ({ item, index }) => {
    const isSuccessStatus =
      isOrderSuccess(item?.orderStatus) || isOrderPending(item?.orderStatus);

    const cardStyle = isSuccessStatus
      ? styles.successCard
      : styles.rejectedCard;

    const failureReason =
      item?.message_aq || item?.message || item?.orderStatusMessage || '';

    return (
      <View style={[styles.orderGreenCard, cardStyle]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
          <View style={{ flexDirection: 'row', alignContent: 'center', alignItems: 'center', flex: 1 }}>
            <Text style={styles.orderTitle}>{item.symbol}</Text>
            {!isSuccessStatus && (
              <View style={{
                marginLeft: 8,
                backgroundColor: '#FEE2E2',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
                <Text style={{ color: '#DC2626', fontSize: 10, fontFamily: 'Poppins-Medium' }}>
                  {(item?.orderStatus || 'Rejected').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.orderType,
              {
                backgroundColor:
                  item.transactionType.toLowerCase() === 'buy'
                    ? stepCompletedColor
                    : '#FF2F2F',
              },
            ]}>
            <Text style={styles.buyButtonText}>{item?.transactionType}</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Text style={styles.metaTextMuted}>Qty.</Text>
          <Text style={styles.metaTextStrong}> {item.quantity} </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
            paddingBottom: 2,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={styles.metaTextMuted}>Ord. Type:</Text>
            <Text style={styles.metaTextStrong}>
              {item.orderType}
              {' |'}
            </Text>
            <Text style={styles.metaTextStrong}>{item?.exchange}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
        </View>

        {/* Rejection reason displayed inline */}
        {!isSuccessStatus && failureReason ? (
          <View style={{
            marginTop: 6,
            marginBottom: 4,
            padding: 8,
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FECACA',
            borderRadius: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <AlertCircle size={14} color="#DC2626" style={{ marginTop: 1, marginRight: 6 }} />
              <Text style={{
                flex: 1,
                color: '#991B1B',
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                lineHeight: 16,
              }}>
                {failureReason}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // Get broker display name for cautionary alert
  const brokerDisplayName = currentBroker || 'your broker';

  return (
    <Modal visible={openSuccessModal} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header Section */}
          <LinearGradient
            colors={[gradient1, gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setOpenSucessModal(false);
                  setsuccessclosemodel(true);
                  hideAddToCartModal();
                }}>
                <ChevronLeft size={24} color="#000" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Trade Details</Text>
              </View>
            </View>
            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeaderText}>All Trade Details</Text>
            </View>
          </LinearGradient>

          {/* Content Section - Scrollable */}
          <View style={styles.contentContainer}>
            {/* Success/Failure Status */}
            {successCount === totalCount && successCount !== 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: stepCompletedColor }]}>
                  <CheckIcon size={40} color={'white'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    All Orders Placed Successfully
                  </Text>
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below.
                  </Text>
                </View>
              </View>
            )}

            {totalCount === 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: '#EF4639' }]}>
                  <XIcon size={40} color={'white'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>No Orders Placed</Text>
                  <Text style={{
                    marginTop: 4, fontFamily: 'Poppins-Medium',
                    color: 'black',
                    fontSize: 10,
                    paddingRight: 10,
                  }}>
                    No trades were sent to the broker. This may be because the rebalance calculation returned no trades. Please go back and try again.
                  </Text>
                </View>
              </View>
            )}

            {failureCount === totalCount && totalCount > 0 && !hasCautionaryListingFailures && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: '#EF4639' }]}>
                  <XIcon size={40} color={'white'} />
                </View>

                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Order Failed</Text>

                  {/* Show broker-specific failure message */}
                  <Text style={{
                    marginTop: 4, fontFamily: 'Poppins-Medium',
                    color: 'black',
                    fontSize: 10,
                    paddingRight: 10,
                  }}>
                    {
                      orderResponse?.[0]?.message_aq ||
                      orderResponse?.[0]?.message ||
                      'Your order could not be placed. Please contact your advisor.'
                    }
                  </Text>

                  {/* Keep link to Orders */}
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below.
                  </Text>
                </View>
              </View>
            )}


            {successCount > 0 && successCount !== totalCount && !hasCautionaryListingFailures && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: '#FFCD28' }]}>
                  <AlertCircle size={40} color={'black'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    Some orders are not placed
                  </Text>
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below and contact your advisor for next steps.
                  </Text>
                </View>
              </View>
            )}

            {/* Cautionary Listing Alert */}
            {hasCautionaryListingFailures && (
              <View style={cautionaryStyles.alertContainer}>
                {/* Header with icon */}
                <View style={cautionaryStyles.headerRow}>
                  <View style={cautionaryStyles.iconCircle}>
                    <AlertTriangle size={20} color="#D97706" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={cautionaryStyles.alertTitle}>
                      Cautionary Listing Restriction
                    </Text>
                  </View>
                </View>

                {/* Explanation */}
                <Text style={cautionaryStyles.alertDescription}>
                  {brokerDisplayName} does not allow stocks under{' '}
                  <Text style={{ fontFamily: 'Poppins-SemiBold' }}>
                    Exchange Cautionary Listing
                  </Text>{' '}
                  to be placed through the broker API connection. The following
                  stocks need to be traded directly:
                </Text>

                {/* Affected stocks badges */}
                <View style={cautionaryStyles.stockBadgeContainer}>
                  {cautionaryListingStocks.map((stock, idx) => (
                    <View key={idx} style={cautionaryStyles.stockBadge}>
                      <Text style={cautionaryStyles.stockBadgeText}>
                        {stock?.symbol || stock?.searchSymbol || 'Unknown'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Instructions box */}
                <View style={cautionaryStyles.instructionsBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Info size={14} color="#2563EB" style={{ marginTop: 2, marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={cautionaryStyles.instructionsTitle}>
                        What you need to do:
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        1. Open your {brokerDisplayName} app or web platform directly
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        2. Place the order for the above stock(s) manually
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        3. This is a default restriction by {brokerDisplayName} for cautionary listed stocks
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Show success count if some orders went through */}
                {successCount > 0 && (
                  <Text style={cautionaryStyles.partialSuccessNote}>
                    {successCount} of {totalCount} order(s) were placed successfully. Only the above stock(s) require manual placement.
                  </Text>
                )}
              </View>
            )}

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoTitle}>Placed On</Text>
                <Text style={styles.infoValue}>{getFormattedDate()}</Text>
              </View>
              <View style={styles.infoItem1}>
                <Text style={styles.infoTitle}>Status</Text>
                <Text style={styles.infoValue}>
                  {successCount === totalCount
                    ? 'Placed'
                    : successCount > 0
                      ? 'Partially Placed'
                      : 'Failed'}
                </Text>

              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoTitle}>
                  {successCount} of {totalCount} Executed
                </Text>
                <View style={styles.progressBarContainer}>
                  {successCount === totalCount && (
                    <View
                      style={[
                        styles.successBar,
                        { width: `${successPercentage}%` },
                      ]}
                    />
                  )}

                  {failureCount === totalCount && totalCount > 0 && (
                    <View
                      style={[
                        styles.failureBar,
                        { width: `${failurePercentage}%` },
                      ]}
                    />
                  )}

                  {successCount >= 1 && successCount !== totalCount && (
                    <>
                      <View
                        style={[
                          styles.successBar,
                          { width: `${successPercentage}%` },
                        ]}
                      />
                      <View
                        style={[
                          styles.failureBar,
                          { width: `${partialFailurePercentage}%` },
                        ]}
                      />
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Orders List */}
            <FlatList
              data={orderResponse}
              renderItem={renderOrderItem}
              keyExtractor={(item, index) => index.toString()}
              style={styles.ordersList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>

        {/* Bottom safe area for iOS home indicator */}
        {Platform.OS === 'ios' && <View style={styles.bottomSafeArea} />}
      </SafeAreaView>
    </Modal>
  );
};

// Cautionary listing alert styles
const cautionaryStyles = StyleSheet.create({
  alertContainer: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#92400E',
  },
  alertDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#B45309',
    lineHeight: 18,
    marginBottom: 10,
  },
  stockBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stockBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  stockBadgeText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#92400E',
  },
  instructionsBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
  },
  instructionsTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  instructionStep: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#1D4ED8',
    lineHeight: 18,
    marginLeft: 2,
  },
  partialSuccessNote: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#166534',
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },

  headerGradient: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 0 : 10,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
  },
  subHeaderContainer: {
    marginLeft: 45,
    marginTop: 2,
  },
  subHeaderText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#f0f0f0',
  },

  contentContainer: {
    flex: 1,
  },

  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIcon: {
    padding: 10,
    borderRadius: 40,
  },
  statusTextContainer: {
    flexDirection: 'column',
    marginLeft: 10,
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Satoshi-Bold',
    color: 'black',
    fontSize: 18,
  },
  statusDescription: {
    fontFamily: 'Poppins-Regular',
    color: 'black',
    fontSize: 10,
    paddingRight: 10,
  },

  ordersList: {
    flex: 1,
  },

  bottomSafeArea: {
    height: Platform.OS === 'ios' ? 34 : 0,
    backgroundColor: '#fff',
  },

  successCard: {
    backgroundColor: '#B6FF92',
  },
  rejectedCard: {
    backgroundColor: 'rgba(255, 0, 0, 0.10)',
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  linkText: {
    fontSize: 10,
    color: 'blue',
    marginTop: 6,
    fontFamily: 'Poppins-Regular',
    textDecorationLine: 'underline',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  infoItem: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  infoItem1: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
    borderRightWidth: 0.5,
    borderLeftWidth: 0.5,
  },
  infoTitle: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#888',
  },
  infoValue: {
    color: '#464646',
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 5,
    marginVertical: 10,
    marginRight: 15,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: '#D9D9D9',
    borderRadius: 8,
  },
  successBar: {
    backgroundColor: '#338D72',
    height: 5,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  failureBar: {
    backgroundColor: '#EF344A',
    height: 5,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  orderGreenCard: {
    backgroundColor: '#B6FF92',
    paddingTop: 10,
    paddingHorizontal: 10,
    borderRadius: 0,
    width: '100%',
    borderColor: '#c8c8c8',
    borderBottomWidth: 0.5,
  },
  orderTitle: {
    fontSize: 12,
    color: '#161917',
    fontWeight: '500',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Medium',
  },
  orderType: {
    color: '#fff',
    fontFamily: 'Satoshi-Bold',
    fontSize: 10,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
  },
  metaTextMuted: {
    color: '#888B8C',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
    marginRight: 2,
  },
  metaTextStrong: {
    color: '#15171A',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
    marginRight: 6,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dateText: {
    color: '#4A4A4A',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
});

export default RecommendationSuccessModal;
