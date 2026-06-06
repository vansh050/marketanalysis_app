/**
 * StockCard — design-system composite presentation (Phase G batch 4, 2026-05-02)
 *
 * Pure presentation for a single trade advice card rendered in FlatList rows.
 * Container owns useLTPStore, useConfig, useNavigation, useModalStore,
 * Animated.Value refs + useEffect coupling, advisedRangeCondition useMemo.
 *
 * Contract:
 *   viewModel = {
 *     // identity
 *     symbol, id, tradeId, index,
 *     // display
 *     displaySymbol, formattedPlanName, positionStatus,
 *     action, type, date,
 *     // pricing
 *     price, entryPrice, ltp, pnl, changePercent,
 *     advisedPrice, advisedPriceByAdvisor,
 *     advisedRangeLower, advisedRangeHigher,
 *     advisedRangeCondition,
 *     // order
 *     OrderType, OptionType, segment, strike, searchSymbol, Exchange,
 *     Price, cmp, quantity,
 *     stopLoss, profitTarget,
 *     closurestatus,
 *     // state
 *     isSelected, isExpanded, planList,
 *     cancel, edit,
 *     tradePlaceStatus, rejectionMessage, rejectionClassification, rejectionBroker,
 *     // animations
 *     animatedHeight, translateY,
 *     // theme
 *     themeColor, CardborderWidth, cardElevation, cardverticalmargin,
 *     // loading
 *     loadingcart,
 *     // attachments
 *     fileUrls,
 *     showAttachmentModal,
 *     // sub-components
 *     stockRecoNotExecuted,
 *   }
 *   actions = {
 *     onToggleExpand,
 *     onSelectStock, onDecreaseQty, onIncreaseQty,
 *     onTradePress, onRevertTrades, onIgnoreTradePress,
 *     onLimitOrderInputChange, onQuantityInputChange,
 *     onAddToCart,
 *     onNavigateModelPortfolio,
 *     onOpenAttachmentModal, onCloseAttachmentModal,
 *     onOpenDdpiHelp,
 *   }
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import moment from 'moment';
import {
  ShoppingCart,
  CalendarDays,
  MinusIcon,
  PlusIcon,
  MoveHorizontal,
  ArrowRight,
  Clock,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  X,
} from 'lucide-react-native';

import BlurredComponent from '../../../src/components/GlassmorphicText';
import PriceTextAdvice from '../../../src/components/AdviceScreenComponents/DynamicText/PriceTextAdvice';

const StockCard = ({ viewModel, actions }) => {
  const {
    symbol = '',
    tradeId = '',
    action = '',
    type,
    date = new Date(),
    displaySymbol = '',
    formattedPlanName = null,
    positionStatus,
    price,
    entryPrice = 0,
    ltp = 0,
    pnl = null,
    changePercent = null,
    advisedPrice,
    advisedPriceByAdvisor,
    advisedRangeLower = '',
    advisedRangeHigher = '',
    advisedRangeCondition = true,
    OrderType = '',
    OptionType = '',
    segment = '',
    strike = '',
    searchSymbol = '',
    Exchange = '',
    Price = '',
    cmp = '',
    quantity = 1,
    stopLoss,
    profitTarget,
    closurestatus,
    isSelected = false,
    isExpanded = false,
    planList,
    cancel,
    edit,
    tradePlaceStatus,
    rejectionMessage,
    rejectionClassification,
    rejectionBroker,
    animatedHeight,
    translateY,
    themeColor = '#0056B7',
    loadingcart = false,
    fileUrls = [],
    showAttachmentModal = false,
    stockRecoNotExecuted,
  } = viewModel || {};

  const {
    onToggleExpand = () => {},
    onSelectStock = () => {},
    onDecreaseQty = () => {},
    onIncreaseQty = () => {},
    onTradePress = () => {},
    onRevertTrades = () => {},
    onIgnoreTradePress = () => {},
    onLimitOrderInputChange = () => {},
    onQuantityInputChange = () => {},
    onAddToCart = () => {},
    onNavigateModelPortfolio = () => {},
    onOpenAttachmentModal = () => {},
    onCloseAttachmentModal = () => {},
    onOpenDdpiHelp = () => {},
  } = actions || {};

  return (
    <TouchableOpacity
      style={[styles.container]}
      activeOpacity={1}
      disabled={!planList || !advisedRangeCondition}>
      <View style={styles.outerBorderContainer}>
        <View style={styles.glassBackground} />

        <View style={[
          styles.outerBorderContainer,
          cancel && styles.outerBorderCancelled,
          edit && styles.outerBorderEdited,
        ]}>

          {/* Status badge if cancelled or edited */}
          {(cancel || edit) && (
            <View style={[
              styles.statusBadge,
              cancel && styles.cancelledBadge,
              edit && styles.editedBadge,
            ]}>
              <Text style={styles.statusBadgeText}>
                {cancel ? 'CANCELLED' : 'EDITED'}
              </Text>
            </View>
          )}

          <View style={styles.header}>
            <View style={styles.symbolContainer}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: 15,
                }}>
                <View
                  style={{
                    flex: 1,
                    alignContent: 'flex-start',
                    alignItems: 'flex-start',
                  }}>
                  {!planList ? (
                    <BlurredComponent>
                      <Text style={[styles.symbol, {opacity: 1}]}>
                        {displaySymbol.length > 18 && !isExpanded
                          ? `${displaySymbol.substring(0, 18)}...`
                          : displaySymbol}
                      </Text>
                    </BlurredComponent>
                  ) : (
                    <Text style={[styles.symbol, {opacity: 1}]}>
                      {displaySymbol.length > 18 && !isExpanded
                        ? `${displaySymbol.substring(0, 18)}...`
                        : displaySymbol}
                    </Text>
                  )}
                </View>

                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  {fileUrls && fileUrls.length > 0 && (
                    <TouchableOpacity
                      onPress={onOpenAttachmentModal}
                      style={{
                        padding: 6,
                        borderRadius: 20,
                        backgroundColor: '#EBF5FF',
                      }}>
                      <Paperclip size={16} color="#0056B7" />
                    </TouchableOpacity>
                  )}
                  <View
                    style={[
                      styles.actionBadge,
                      action === 'BUY' ? styles.buyBadge : styles.sellBadge,
                    ]}>
                    <Text
                      style={[
                        styles.actionText,
                        action === 'BUY' ? styles.buyText : styles.sellText,
                      ]}>
                      {action}
                    </Text>
                  </View>
                </View>
              </View>

              <PriceTextAdvice
                closurestatus={closurestatus}
                Exchange={Exchange}
                type={'mainLTP'}
                advisedRangeCondition={advisedRangeCondition}
                advisedRangeHigher={advisedRangeHigher}
                advisedRangeLower={advisedRangeLower}
                symbol={symbol}
                stockDetails={stockRecoNotExecuted}
                advisedPrice={advisedPrice}
              />
            </View>
          </View>

          {!isExpanded && (
            <Animated.View
              style={[
                styles.collapsedContent,
                {opacity: 1, transform: [{translateY}]},
              ]}>

              {/* Symbol breakdown */}
              {OptionType && (
                <View style={{paddingVertical: 4}}>
                  <Text style={styles.symbolBreakdownText}>
                    {searchSymbol} | {strike} | {OptionType}
                  </Text>
                </View>
              )}

              <View style={styles.row1}>
                <View style={{flexDirection: 'column', flex: 1}}>
                  <Text style={styles.label1}>{action} AT {OrderType} PRICE</Text>
                  <Text style={styles.value1}>
                    {OrderType === 'LIMIT' ? `₹${Price}` : 'MARKET'}
                  </Text>
                </View>

                <View style={{flexDirection: 'column', alignItems: 'flex-end'}}>
                  <Text style={styles.label}>Recommended Range</Text>
                  <Text style={styles.value1}>
                    {advisedRangeLower && advisedRangeHigher
                      ? `₹${advisedRangeLower}-₹${advisedRangeHigher}`
                      : advisedRangeLower
                      ? `₹${advisedRangeLower}`
                      : advisedRangeHigher
                      ? `₹${advisedRangeHigher}`
                      : `NA - use other details`}
                  </Text>
                </View>
              </View>

              {/* Market Price Row */}
              <View style={{paddingVertical: 4, paddingHorizontal: 3.5}}>
                <PriceTextAdvice
                  closurestatus={closurestatus}
                  Exchange={Exchange}
                  type={'marketLTP1'}
                  advisedRangeCondition={advisedRangeCondition}
                  advisedRangeHigher={advisedRangeHigher}
                  advisedRangeLower={advisedRangeLower}
                  symbol={symbol}
                  stockDetails={stockRecoNotExecuted}
                  advisedPrice={advisedPrice}
                />
              </View>

              {/* SL/PT Row */}
              {(stopLoss || profitTarget) && (
                <View style={styles.slPtRow}>
                  {stopLoss && (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={styles.slPtLabel}>SL </Text>
                      <Text style={styles.slPtValue}>₹{stopLoss}</Text>
                    </View>
                  )}
                  {profitTarget && (
                    <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 16}}>
                      <Text style={styles.slPtLabel}>PT </Text>
                      <Text style={styles.slPtValue}>₹{profitTarget}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* P&L and Change% Row */}
              {pnl !== null && (
                <View style={[styles.row1, {paddingVertical: 2}]}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.slPtLabel}>P&L </Text>
                    <Text style={[styles.slPtValue, {color: pnl >= 0 ? '#16A34A' : '#DC2626'}]}>
                      {pnl >= 0 ? '₹' : '-₹'}{Math.abs(pnl).toFixed(2)}
                    </Text>
                  </View>
                  {changePercent !== null && (
                    <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 16}}>
                      <Text style={styles.slPtLabel}>Change </Text>
                      <Text style={[styles.slPtValue, {color: changePercent >= 0 ? '#16A34A' : '#DC2626'}]}>
                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Plan Name and Position Status */}
              {(formattedPlanName || positionStatus) ? (
                <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, paddingHorizontal: 3.5}}>
                  {formattedPlanName ? (
                    <Text style={{fontSize: 11, fontFamily: 'Poppins-Regular', color: '#6B7280'}}>
                      Plan: {formattedPlanName}
                    </Text>
                  ) : <View />}
                  {positionStatus ? (
                    <View style={{
                      backgroundColor: positionStatus === 'Open' ? '#DCFCE7' : '#F3F4F6',
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
                    }}>
                      <Text style={{fontSize: 10, fontFamily: 'Poppins-Medium', color: positionStatus === 'Open' ? '#16A34A' : '#6B7280'}}>
                        {positionStatus}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Date/Time Row */}
              <View style={{paddingVertical: 6, paddingHorizontal: 3.5}}>
                <Text style={styles.dateText}>
                  {moment(date).format('Do MMM YYYY')} | {moment(date).format('h:mm A')}
                </Text>
              </View>

              {/* Rejection reason for rejected orders */}
              {type === 'OSrejected' && rejectionMessage ? (
                <View style={{backgroundColor: '#FEF2F2', borderRadius: 6, padding: 8, marginHorizontal: 10, marginBottom: 6}}>
                  <Text style={{fontSize: 11, fontFamily: 'Poppins-Medium', color: '#991B1B'}}>
                    Rejected: {rejectionMessage}
                  </Text>
                  {rejectionBroker && (
                    <TouchableOpacity
                      onPress={() => onOpenDdpiHelp(rejectionBroker)}
                      hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}
                      style={{marginTop: 4, alignSelf: 'flex-start'}}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Poppins-Bold',
                          color: '#1E7E34',
                          textDecorationLine: 'underline',
                        }}>
                        What is DDPI / EDIS? How to enable →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {/* Action Buttons */}
              {cancel === true ? (
                <View style={[styles.actionButtons, {marginBottom: 10}]}>
                  <TouchableOpacity
                    style={[
                      styles.tradeButtonCancel,
                      {opacity: advisedRangeCondition ? 1 : 0.5},
                    ]}>
                    <Text style={styles.tradeButtonTextCancel}>Cancelled</Text>
                  </TouchableOpacity>
                </View>
              ) : type === 'OSrejected' ? (
                <View style={[styles.actionButtons, {marginBottom: 10}]}>
                  <TouchableOpacity
                    onPress={() => onIgnoreTradePress(tradeId)}
                    style={styles.addButton}>
                    <Text style={styles.addButtonText}>Ignore</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (!planList) {
                        onNavigateModelPortfolio();
                      } else {
                        onTradePress(symbol, tradeId, action);
                      }
                    }}
                    style={styles.tradeButton}>
                    <Text style={styles.tradeButtonText}>Trade Now</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.actionButtons, {marginBottom: 10}]}>
                  <TouchableOpacity
                    disabled={!advisedRangeCondition}
                    onPress={() =>
                      onAddToCart(
                        symbol,
                        tradeId,
                        isSelected ? 'remove' : 'add',
                      )
                    }
                    style={[
                      styles.addButton,
                      isSelected && styles.undoButton,
                      {opacity: advisedRangeCondition ? 1 : 0.5},
                    ]}>
                    {loadingcart ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.addButtonText,
                          {color: isSelected ? '#fff' : '#000'},
                        ]}>
                        {isSelected ? 'Remove' : 'Add to Cart'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!advisedRangeCondition}
                    onPress={() => {
                      if (!planList) {
                        onNavigateModelPortfolio();
                      } else {
                        onTradePress(symbol, tradeId, action);
                      }
                    }}
                    style={[
                      styles.tradeButton,
                      {opacity: advisedRangeCondition ? 1 : 0.5},
                    ]}>
                    <Text style={styles.tradeButtonText}>Trade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          )}

          {isExpanded && (
            <Animated.View
              style={[styles.animatedSection, {height: animatedHeight}]}>
              <View style={{paddingVertical: 15}}>
                <View style={styles.row}>
                  <View style={{flexDirection: 'row'}}>
                    <View
                      style={{
                        alignContent: 'center',
                        alignItems: 'center',
                        alignSelf: 'center',
                      }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignContent: 'center',
                          alignItems: 'center',
                        }}>
                        <MoveHorizontal size={14} color={'#475569'} />
                        <Text style={styles.label}>Recommended Range</Text>
                      </View>

                      <Text style={[styles.value]}>
                        {advisedRangeLower && advisedRangeHigher
                          ? `₹${advisedRangeLower} - ₹${advisedRangeHigher}`
                          : advisedRangeLower
                          ? `₹${advisedRangeLower}`
                          : advisedRangeHigher
                          ? `₹${advisedRangeHigher}`
                          : `-`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.label}>Market</Text>
                    <PriceTextAdvice
                      Exchange={Exchange}
                      type={'marketLTP'}
                      advisedRangeCondition={advisedRangeCondition}
                      advisedRangeHigher={advisedRangeHigher}
                      advisedRangeLower={advisedRangeLower}
                      symbol={symbol}
                      stockDetails={stockRecoNotExecuted}
                    />
                  </View>
                </View>

                <View style={styles.footer}>
                  <CalendarDays
                    size={18}
                    color="#475569"
                    style={styles.iconSpacing}
                  />
                  <Text
                    style={[
                      styles.dateText,
                      {opacity: !advisedRangeCondition ? 0.8 : 1},
                    ]}>
                    {moment(date).format('Do MMM YYYY')} |{' '}
                  </Text>
                  <Text
                    style={[
                      styles.dateText,
                      {opacity: !advisedRangeCondition ? 0.8 : 1},
                    ]}>
                    {moment(date).format('h:mm A')}
                  </Text>
                </View>
              </View>

              <View style={{paddingBottom: 0}}>
                <View style={styles.actionButtons}>
                  <View style={styles.quantityContainer}>
                    <Text style={styles.quantityLabel}>Quantity</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        onPress={() => onDecreaseQty(symbol, tradeId)}
                        disabled={quantity <= 1}
                        style={styles.quantityButton}>
                        <MinusIcon
                          style={{opacity: !advisedRangeCondition ? 0.6 : 1}}
                          size={16}
                          color="#475569"
                        />
                      </TouchableOpacity>
                      <TextInput
                        value={quantity?.toString()}
                        onChangeText={value =>
                          onQuantityInputChange(symbol, value, tradeId)
                        }
                        style={[
                          styles.quantityInput,
                          {opacity: !advisedRangeCondition ? 0.6 : 1},
                        ]}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        onPress={() => onIncreaseQty(symbol, tradeId)}
                        style={styles.quantityButton}>
                        <PlusIcon
                          style={{opacity: !advisedRangeCondition ? 0.6 : 1}}
                          size={16}
                          color="#475569"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onToggleExpand}
                    style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() =>
                      onAddToCart(
                        symbol,
                        tradeId,
                        isSelected ? 'remove' : 'add',
                      )
                    }
                    style={[
                      styles.addButton,
                      isSelected && styles.undoButton,
                    ]}>
                    {loadingcart ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        {isSelected ? (
                          <MinusIcon size={15} color={'white'} />
                        ) : (
                          <ShoppingCart size={15} color={'white'} />
                        )}
                        <Text style={[styles.addButtonText]}>
                          {isSelected ? 'Remove' : 'Add'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onTradePress(symbol, tradeId, action)}
                    style={[
                      styles.tradeButtonExpanded,
                      {opacity: !advisedRangeCondition ? 0.8 : 1},
                    ]}>
                    <Text style={styles.tradeButtonText}>Trade Now</Text>
                    <View style={styles.arrowContainer}>
                      <ArrowRight
                        style={{
                          alignContent: 'center',
                          alignItems: 'center',
                          alignSelf: 'center',
                        }}
                        size={16}
                        color={'#FFFFFF'}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Attachment Modal */}
      <Modal
        visible={showAttachmentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={onCloseAttachmentModal}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={onCloseAttachmentModal}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              width: '85%',
              maxHeight: '70%',
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}>
              <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1F2937'}}>
                Attachments ({fileUrls?.length || 0})
              </Text>
              <TouchableOpacity onPress={onCloseAttachmentModal}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {fileUrls && fileUrls.map((url, idx) => {
                const isPdf = url.toLowerCase().endsWith('.pdf');
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                const fileName = url.split('/').pop() || `Attachment ${idx + 1}`;

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      Linking.openURL(url).catch(() =>
                        Alert.alert('Error', 'Could not open attachment')
                      );
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: '#F9FAFB',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}>
                    {isPdf ? (
                      <FileText size={20} color="#EF4444" />
                    ) : isImage ? (
                      <ImageIcon size={20} color="#10B981" />
                    ) : (
                      <Download size={20} color="#6B7280" />
                    )}
                    <Text
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        fontSize: 14,
                        color: '#374151',
                      }}
                      numberOfLines={1}>
                      {fileName}
                    </Text>
                    <Download size={16} color="#0056B7" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 5,
    marginVertical: 6,
  },
  outerBorderContainer: {
    borderRadius: 10,
  },
  glassBackground: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16,
    shadowColor: 'rgba(255, 255, 255, 0.5)',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 0,
  },
  undoButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    flex: 1,
    borderRadius: 3,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#E8E8E880',
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderColor: 'rgba(71, 85, 105, 0.3)',
    flexDirection: 'row',
    shadowColor: 'rgba(51, 65, 85, 0.4)',
    shadowOffset: {width: 0, height: 2},
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    marginTop: 2,
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3.5,
  },
  iconSpacing: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Poppins-Medium',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
    borderBottomWidth: 1,
  },
  symbolContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 0,
  },
  symbol: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  actionBadge: {
    paddingHorizontal: 12,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 3,
    paddingVertical: 2,
    marginRight: 3,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  buyBadge: {
    backgroundColor: '#29A400',
    borderColor: '#29A400',
  },
  sellBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  actionText: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'Poppins-Medium',
  },
  buyText: {
    color: '#fff',
  },
  sellText: {
    color: '#fff',
  },
  collapsedContent: {
    paddingTop: 5,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 3.5,
    justifyContent: 'space-between',
  },
  row1: {
    flexDirection: 'row',
    paddingHorizontal: 3.5,
    paddingVertical: 0,
    justifyContent: 'space-between',
  },
  column: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 11,
    color: '#0056B7',
    marginBottom: 0,
    marginRight: 0,
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
  },
  label1: {
    fontSize: 11,
    color: '#0056B7',
    marginBottom: 5,
    marginRight: 8,
    marginLeft: 0,
    padding: 0,
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
  },
  animatedSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginHorizontal: 15,
  },
  value: {
    fontSize: 15,
    color: '#0369A1',
    marginBottom: 4,
    fontFamily: 'Satoshi-Bold',
  },
  value1: {
    fontSize: 11,
    color: '#0F172A',
    fontFamily: 'Poppins-Medium',
    fontWeight: '600',
  },
  quantityContainer: {
    flex: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(203, 213, 225, 0.6)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Satoshi-Medium',
    marginBottom: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 8,
  },
  tradeButton: {
    flex: 1,
    backgroundColor: '#0056B7',
    alignContent: 'center',
    alignSelf: 'center',
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tradeButtonCancel: {
    flex: 1,
    backgroundColor: '#ffe2e2',
    alignContent: 'center',
    alignSelf: 'center',
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderColor: '#c94d49',
    borderWidth: 1,
  },
  tradeButtonExpanded: {
    flex: 1.2,
    backgroundColor: 'rgba(5, 86, 130, 0.95)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    shadowColor: 'rgba(3, 105, 161, 0.4)',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tradeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    marginTop: 2,
  },
  tradeButtonTextCancel: {
    color: '#c94d49',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    marginTop: 2,
  },
  arrowContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quantityInput: {
    height: 24,
    padding: 0,
    width: 40,
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    fontWeight: '500',
  },
  symbolBreakdownText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.3,
  },
  slPtRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 3.5,
    alignItems: 'center',
  },
  slPtLabel: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Poppins-Medium',
  },
  slPtValue: {
    fontSize: 11,
    color: '#0F172A',
    fontFamily: 'Poppins-SemiBold',
  },
  statusBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  cancelledBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  editedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  outerBorderCancelled: {
    shadowColor: 'rgba(239, 68, 68, 0.5)',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  outerBorderEdited: {
    shadowColor: 'rgba(245, 158, 11, 0.5)',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default StockCard;
