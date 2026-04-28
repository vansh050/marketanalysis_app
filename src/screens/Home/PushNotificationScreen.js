import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import {useNavigation} from '@react-navigation/native';
import {useTrade} from '../TradeContext';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  X,
  Calendar,
  Clock,
  Target,
  Bell,
  Filter,
  ChevronLeft,
  Repeat,
} from 'lucide-react-native';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useConfig} from '../../context/ConfigContext';
import RebalanceNotificationComponent from './RebalanceNotificationComponent';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const PushNotificationScreen = () => {
  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#0056B7';
  const secondaryColor = config?.secondaryColor || '#F0F0F0';
  const gradient1 = config?.gradient1 || '#0056B7';
  const gradient2 = config?.gradient2 || '#002651';
  const {
    allNotifications,
    getAllNotifcations,
    isNotificationLoading,
    userEmail,
    configData, // Assuming you have userEmail in context
  } = useTrade();

  const navigation = useNavigation();
  const [todayNotifications, setTodayNotifications] = useState([]);
  const [earlierNotifications, setEarlierNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // API Base URL - Update this with your actual API URL
  const API_BASE_URL = 'http://10.90.60.251:8001'; // Update this

  // Format symbol helper function - FIXED
  const formatSymbol = stock => {
    if (!stock) return '';
    const isOption = stock.exchange === 'NFO' || stock.exchange === 'BFO';
    const formattedSymbol = isOption
                        ? `${stock.searchSymbol || ''} | ${stock.strike || ''} | ${stock.optionType || ''}`
                        : (stock.symbol || '');
    return formattedSymbol;
  };


  useEffect(() => {
    getAllNotifcations();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await getAllNotifcations();
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (
      allNotifications &&
      allNotifications.notifications &&
      Array.isArray(allNotifications.notifications)
    ) {
      sortNotificationsByDate(allNotifications.notifications);
    }
  }, [allNotifications, showUnreadOnly]);

  const markNotificationAsReadById = async (notificationId, userEmailParam) => {
    console.log('Marking notification as read:', {
      notificationId,
      userEmail: userEmailParam,
    });
    try {
      if (!notificationId) {
        return {success: false, message: 'No notification ID'};
      }

      const url = `${server.server.baseUrl}api/sendnotification/mark-notification-read-by-id`;
      console.log('Full URL:', url); // ✅ Debug: Check the full URL

      const requestBody = {
        userEmail: userEmailParam,
        notificationId: notificationId,
      };
      console.log('Request body:', requestBody); // ✅ Debug: Check request data

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status); // ✅ Debug: Check response status
      console.log('Response ok:', response.ok); // ✅ Debug: Check if response is ok

      // ✅ Get response as text first to see what we're actually receiving
      const responseText = await response.text();
      console.log('Raw response:', responseText.substring(0, 500)); // ✅ Debug: Show first 500 chars

      // ✅ Check if response is actually JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response was not JSON:', responseText.substring(0, 200));

        // Check if it's an HTML error page
        if (
          responseText.includes('<html>') ||
          responseText.includes('<!DOCTYPE')
        ) {
          return {
            success: false,
            error:
              'Server returned HTML instead of JSON. Check if API endpoint exists and authentication is correct.',
          };
        }

        return {
          success: false,
          error: `Invalid response format: ${parseError.message}`,
        };
      }

      if (data.success) {
        console.log('Notification marked as read successfully');
        await getAllNotifcations();
      } else {
        console.error('API returned error:', data.message);
      }

      return data;
    } catch (error) {
      console.error('Network/Fetch Error:', error);
      return {success: false, error: error.message};
    }
  };

  const sortNotificationsByDate = notifications => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const todayNotifs = [];
    const earlierNotifs = [];

    // Create expanded notifications array to handle individual in-app notifications
    const expandedNotifications = [];

    notifications.forEach((notification, notificationIndex) => {
      // Add notificationIndex
      // Check if it has in-app notifications
      if (
        notification.inAppNotifications &&
        Array.isArray(notification.inAppNotifications) &&
        notification.inAppNotifications.length > 0
      ) {
        // Create separate entries for each in-app notification
        notification.inAppNotifications.forEach((inAppNotif, index) => {
          const expandedNotification = {
            ...notification,
            type: 'inApp',
            inAppNotificationData: inAppNotif,
            sortDate: new Date(inAppNotif.date),
            // ✅ FIXED: Use notification index + timestamp for unique keys
            uniqueId: notification._id
              ? `inapp-${notification._id}-${index}`
              : `inapp-${notificationIndex}-${index}-${new Date(
                  inAppNotif.date,
                ).getTime()}`,
          };

          // Filter by unread status if showUnreadOnly is true
          if (!showUnreadOnly || !notification.isRead) {
            expandedNotifications.push(expandedNotification);
          }
        });
      } else if (notification.modelName) {
      const rebalanceNotification = {
        ...notification,
        type: 'rebalance',
        sortDate: new Date(notification.insertedAt || notification.date || Date.now()),
        uniqueId: notification._id
          ? `rebalance-${notification._id}`
          : `rebalance-${notificationIndex}-${Date.now()}`,
      };

      if (!showUnreadOnly || !notification.isRead) {
        expandedNotifications.push(rebalanceNotification);
      }
    } else if (
        notification.symbolPrice &&
        Array.isArray(notification.symbolPrice) &&
        notification.symbolPrice.length > 0
      ) {
        // Stock notification
        const stockNotification = {
          ...notification,
          type: 'stock',
          sortDate: new Date(notification.insertedAt),
          // ✅ FIXED: Use notification index + timestamp for unique keys
          uniqueId: notification._id
            ? `stock-${notification._id}`
            : `stock-${notificationIndex}-${new Date(
                notification.insertedAt,
              ).getTime()}`,
        };

        // Filter by unread status if showUnreadOnly is true
        if (!showUnreadOnly || !notification.isRead) {
          expandedNotifications.push(stockNotification);
        }
      }
    });

    // Sort all notifications by date
    expandedNotifications.forEach(notification => {
      if (notification.sortDate >= todayStart) {
        todayNotifs.push(notification);
      } else {
        earlierNotifs.push(notification);
      }
    });

    // Sort each group by date (newest first)
    todayNotifs.sort((a, b) => b.sortDate - a.sortDate);
    earlierNotifs.sort((a, b) => b.sortDate - a.sortDate);

    setTodayNotifications(todayNotifs);
    setEarlierNotifications(earlierNotifs);
  };

  const formatTime = dateString => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year:
          date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatFullDateTime = dateString => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Handle notification click - simplified
  const handleNotificationPress = async notification => {
    setSelectedNotification(notification);
    // Mark as read if not already read - simple check
    if (!notification.isRead && notification._id && userEmail) {
      await markNotificationAsReadById(notification._id, userEmail);
    }
    setModalVisible(true);
  };

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedNotification(null);
  };


    // Close modal
  const navigateToHomeScreen = () => {
    navigation.navigate('HomeS');  // Navigate to HomeScreen
    closeModal();
  };


  // Toggle unread filter
  const toggleUnreadFilter = () => {
    setShowUnreadOnly(!showUnreadOnly);
  };

  const renderNotificationItem = ({item}) => {
    // Handle in-app notification type
    if (item.type === 'inApp' && item.inAppNotificationData) {
      const inAppNotif = item.inAppNotificationData;
      return (
        <TouchableOpacity
          style={styles.notificationItem}
          onPress={() => handleNotificationPress(item)}>
          <View style={styles.notificationContent}>
            <View style={styles.notificationIcon}>
              {inAppNotif.imageUrl ? (
                <Image
                  source={{uri: inAppNotif.imageUrl}}
                  style={styles.notificationImage}
                  onError={() => console.log('Image load error')}
                />
              ) : (
                <View style={styles.defaultIcon}>
                  <Bell color="#407BFF" size={20} style={{marginBottom: -3}} />
                </View>
              )}
            </View>

            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>{inAppNotif.title}</Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {inAppNotif.message}
              </Text>

              <Text style={styles.notificationType}>
                {inAppNotif.notificationType === 'news_alert'
                  ? 'News Alert'
                  : inAppNotif.notificationType}
              </Text>

              {inAppNotif.date && (
                <Text style={styles.notificationTime}>
                  {formatTime(inAppNotif.date)} • {formatDate(inAppNotif.date)}
                </Text>
              )}
            </View>

            {!item.isRead && <View style={styles.unreadIndicator} />}
          </View>
        </TouchableOpacity>
      );
    }

    // Handle stock notification type - UPDATED WITH BETTER SYMBOL DISPLAY
    if (
      item.type === 'stock' &&
      item.symbolPrice &&
      Array.isArray(item.symbolPrice) &&
      item.symbolPrice.length > 0
    ) {
      return (
        <TouchableOpacity
          style={styles.notificationItem}
          onPress={() => handleNotificationPress(item)}>
          <View style={styles.notificationContent}>
            <View style={styles.notificationIcon}>
              <View style={styles.defaultIcon}>
                <TrendingUp color="#407BFF" size={20} />
              </View>
            </View>

            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>
                Recommendation Alert
              </Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                New trading recommendations available for your portfolio
              </Text>

              <View style={styles.stockContainer}>
                {item.symbolPrice.slice(0, 3).map((stock, index) => {
                  const displaySymbol = formatSymbol(stock);

                  // ✅ FIX: Skip rendering if displaySymbol is empty or all N/A
                  if (!displaySymbol || displaySymbol.trim() === '' || displaySymbol === ' |  | ') {
                    return null;
                  }

                  return (
                    <View
                      key={`${stock.symbol}-${index}`}
                      style={styles.stockChipContainer}>

                      <View style={styles.stockChip}>
                        <Text style={styles.stockSymbol}>{displaySymbol}</Text>

                        {Number(stock.price) > 0 && (
                          <Text style={styles.stockPrice}>₹{stock.price}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                {item.symbolPrice.length > 3 && (
                  <Text style={styles.moreStocks}>
                    +{item.symbolPrice.length - 3} more
                  </Text>
                )}
              </View>

              {item.adviceRecoIds &&
                Array.isArray(item.adviceRecoIds) &&
                item.adviceRecoIds.length > 0 && (
                  <Text style={styles.adviceCount}>
                    {item.adviceRecoIds.length} recommendation
                    {item.adviceRecoIds.length > 1 ? 's' : ''}
                  </Text>
                )}

              {item.insertedAt && (
                <Text style={styles.notificationTime}>
                  {formatTime(item.insertedAt)} • {formatDate(item.insertedAt)}
                </Text>
              )}
            </View>

            {!item.isRead && <View style={styles.unreadIndicator} />}
          </View>
        </TouchableOpacity>
      );
    }

     if (item.type === 'rebalance') {
    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationIcon}>
            <View style={styles.defaultIcon}>
              <Repeat color="#407BFF" size={20} />
            </View>
          </View>

          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle}>Portfolio Rebalance Alert</Text>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.modelName
                ? `Your portfolio "${item.modelName}" has a new rebalance update.`
                : 'Your portfolio has a new rebalance notification.'}
            </Text>

            {item.insertedAt && (
              <Text style={styles.notificationTime}>
                {formatTime(item.insertedAt)} • {formatDate(item.insertedAt)}
              </Text>
            )}
          </View>

          {!item.isRead && <View style={styles.unreadIndicator} />}
        </View>
      </TouchableOpacity>
    );
  }

    return null;
  };

const getUnreadCount = () => {
  const unreadToday = todayNotifications.filter(
    notification => !notification.isRead
  ).length;

  const unreadEarlier = earlierNotifications.filter(
    notification => !notification.isRead
  ).length;

  return unreadToday + unreadEarlier;
};



  // Notification Detail Modal Component
  const renderNotificationModal = () => {
    if (!selectedNotification) return null;

    const isInAppNotification =
      selectedNotification.type === 'inApp' &&
      selectedNotification.inAppNotificationData;
    const isStockNotification =
      selectedNotification.type === 'stock' &&
      selectedNotification.symbolPrice &&
      Array.isArray(selectedNotification.symbolPrice) &&
      selectedNotification.symbolPrice.length > 0;
    const isRebalanceNotification =
      selectedNotification.type === 'rebalance' &&
      selectedNotification.modelName;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIcon}>
                  {isInAppNotification ? (
                    <Bell color="#407BFF" size={24} style={{marginBottom: -3}} />
                  ) : (
                    <TrendingUp color="#407BFF" size={24} />
                  )}
                </View>
                <Text style={styles.modalTitle}>
                  {isInAppNotification
                    ? selectedNotification.inAppNotificationData.title
                    : 'Notification Details'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <X color="#6B7280" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              {/* Render In-App Notification Details */}
              {isInAppNotification && (
                <>
                  {/* Notification Image */}
                  {selectedNotification.inAppNotificationData.imageUrl && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Image</Text>
                      <Image
                        source={{
                          uri: selectedNotification.inAppNotificationData
                            .imageUrl,
                        }}
                        style={styles.modalNotificationImage}
                        onError={() => console.log('Modal image load error')}
                      />
                    </View>
                  )}

                  {/* Alert Type */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Alert Type</Text>
                                          <View style={styles.alertTypeContainer}>
                        <Bell color="#407BFF" size={16} style={{marginBottom: -3}} />
                        <Text style={styles.alertTypeText}>
                          {selectedNotification.inAppNotificationData
                            .notificationType === 'news_alert'
                            ? 'News Alert'
                            : selectedNotification.inAppNotificationData
                                .notificationType}
                        </Text>
                      </View>
                  </View>

                  {/* Message */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Message</Text>
                    <Text style={styles.messageText}>
                      {selectedNotification.inAppNotificationData.message}
                    </Text>
                  </View>

                  {/* Date & Time */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Date & Time</Text>
                    <View style={styles.dateTimeContainer}>
                      <View style={styles.dateTimeRow}>
                        <Calendar color="#6B7280" size={16} />
                        <Text style={styles.dateTimeText}>
                          {selectedNotification.inAppNotificationData.date &&
                            formatFullDateTime(
                              selectedNotification.inAppNotificationData.date,
                            )}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              {/* Render Stock Notification Details - UPDATED WITH BETTER SYMBOL DISPLAY */}
              {isStockNotification && (
                <>
                  {/* Notification Type */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Alert Type</Text>
                    <View style={styles.alertTypeContainer}>
                      <Target color="#407BFF" size={16} />
                      <Text style={styles.alertTypeText}>
                        Recommendation Alert
                      </Text>
                    </View>
                  </View>

                  {/* Date & Time */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Date & Time</Text>
                    <View style={styles.dateTimeContainer}>
                      <View style={styles.dateTimeRow}>
                        <Calendar color="#6B7280" size={16} />
                        <Text style={styles.dateTimeText}>
                          {selectedNotification.insertedAt &&
                            formatFullDateTime(selectedNotification.insertedAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Stock Symbols - WITH IMPROVED FORMATTING */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>
                      Stock Symbols ({selectedNotification.symbolPrice.length})
                    </Text>
                    <View style={styles.stockDetailContainer}>
                      {selectedNotification.symbolPrice.map((stock, index) => {
                        const formattedSymbol = formatSymbol(stock);

                        // ✅ FIX: Skip if empty or invalid
                        if (!formattedSymbol || formattedSymbol.trim() === '' || formattedSymbol === ' |  | ') {
                          return null;
                        }

                        return (
                          <View
                            key={`${stock.symbol}-${index}`}
                            style={styles.stockDetailItem}>
                            <View style={styles.stockDetailLeft}>
                              <Text style={styles.stockSymbolDetail}>
                                {formattedSymbol}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Advice Recommendations - ENHANCED WITH DETAILS */}
                  {selectedNotification.adviceRecoIds &&
                    Array.isArray(selectedNotification.adviceRecoIds) &&
                    selectedNotification.adviceRecoIds.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>
                          Recommendations (
                          {selectedNotification.adviceRecoIds.length})
                        </Text>

                        {/* Display each recommendation */}
                        <View style={styles.recommendationContainer}>
                          {selectedNotification.symbolPrice.map((stock, index) => {
                            try {
                              console.log('=== Processing stock at index:', index);
                              console.log('Stock object:', JSON.stringify(stock, null, 2));

                              const formattedSymbol = formatSymbol(stock);
                              console.log('formattedSymbol:', formattedSymbol);

                              // ✅ FIX: Skip if empty or invalid
                              if (!formattedSymbol || formattedSymbol.trim() === '' || formattedSymbol === ' |  | ') {
                                console.log('⚠️ Skipping stock due to invalid symbol');
                                return null;
                              }

                              // Safe property access with fallbacks
                              // Backend sends "type" field (e.g., "Buy"/"Sell"), normalize to uppercase
                              const rawAction = stock.action || stock.type || '';
                              const action = rawAction.toUpperCase();
                              const orderType = stock.orderType || '';
                              const limitPrice = stock.limitPrice ? Number(stock.limitPrice) : 0;
                              const advisedRangeLower = stock.advisedRangeLower ? String(stock.advisedRangeLower) : '';
                              const advisedRangeHigher = stock.advisedRangeHigher ? String(stock.advisedRangeHigher) : '';
                              const stopLoss = stock.stopLoss ? Number(stock.stopLoss) : 0;
                              const profitTarget = stock.profitTarget ? Number(stock.profitTarget) : 0;
                              const quantity = stock.quantity ? Number(stock.quantity) : 0;
                              const segment = stock.segment ? String(stock.segment) : '';
                              const exchange = stock.exchange ? String(stock.exchange) : '';
                              const rationale = stock.rationale ? String(stock.rationale) : '';

                              console.log('✅ Parsed values:', {
                                action,
                                orderType,
                                limitPrice,
                                stopLoss,
                                profitTarget,
                                quantity
                              });

                              return (
                                <View key={`reco-${index}`} style={styles.recommendationCard}>
                                  {/* Symbol Header */}
                                  <View style={styles.recommendationHeader}>
                                    <Text style={styles.recommendationSymbol}>
                                      {formattedSymbol}
                                    </Text>
                                    <View style={[
                                      styles.actionBadgeSmall,
                                      action === 'BUY' ? styles.buyBadgeSmall : styles.sellBadgeSmall
                                    ]}>
                                      <Text style={[
                                        styles.actionTextSmall,
                                        action === 'BUY' ? styles.buyTextSmall : styles.sellTextSmall
                                      ]}>
                                        {action}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Recommendation Details Grid */}
                                  <View style={styles.recommendationGrid}>
                                    {/* MARKET Order */}
                                    {orderType === 'MARKET' && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationValue}>
                                          {action === 'BUY' ? 'BUY at market' : 'SELL at market'}
                                        </Text>
                                      </View>
                                    )}

                                    {/* Limit Price */}
                                    {limitPrice > 0 && orderType !== 'MARKET' && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Limit Price for trade:</Text>
                                        <Text style={styles.recommendationValue}>₹{limitPrice}</Text>
                                      </View>
                                    )}

                                    {/* Order Type */}
                                    {orderType && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Order Type:</Text>
                                        <Text style={styles.recommendationValue}>{orderType}</Text>
                                      </View>
                                    )}

                                    {/* Advised Range */}
                                    {(advisedRangeLower || advisedRangeHigher) && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Advised Range:</Text>
                                        <Text style={styles.recommendationValue}>
                                          {advisedRangeLower && advisedRangeHigher
                                            ? `₹${advisedRangeLower} - ₹${advisedRangeHigher}`
                                            : advisedRangeLower
                                            ? `₹${advisedRangeLower}`
                                            : advisedRangeHigher
                                            ? `₹${advisedRangeHigher}`
                                            : 'N/A'}
                                        </Text>
                                      </View>
                                    )}

                                    {/* Stop Loss */}
                                    {stopLoss > 0 && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Stop Loss:</Text>
                                        <Text style={[styles.recommendationValue, styles.stopLossText]}>
                                          ₹{stopLoss}
                                        </Text>
                                      </View>
                                    )}

                                    {/* Target Price */}
                                    {profitTarget > 0 && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Target:</Text>
                                        <Text style={[styles.recommendationValue, styles.targetText]}>
                                          ₹{profitTarget}
                                        </Text>
                                      </View>
                                    )}

                                    {/* Quantity */}
                                    {quantity > 0 && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Quantity:</Text>
                                        <Text style={styles.recommendationValue}>{quantity}</Text>
                                      </View>
                                    )}

                                    {/* Segment */}
                                    {segment && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Segment:</Text>
                                        <Text style={styles.recommendationValue}>{segment}</Text>
                                      </View>
                                    )}

                                    {/* Exchange */}
                                    {exchange && (
                                      <View style={styles.recommendationRow}>
                                        <Text style={styles.recommendationLabel}>Exchange:</Text>
                                        <Text style={styles.recommendationValue}>{exchange}</Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Rationale if available */}
                                  {rationale && (
                                    <View style={styles.rationaleContainer}>
                                      <Text style={styles.rationaleLabel}>Rationale:</Text>
                                      <Text style={styles.rationaleText}>{rationale}</Text>
                                    </View>
                                  )}
                                </View>
                              );
                            } catch (error) {
                              console.error('❌ Error rendering stock recommendation at index', index, ':', error);
                              console.error('Error details:', error.message);
                              console.error('Stock data that caused error:', JSON.stringify(stock, null, 2));

                              // Return a safe fallback UI instead of crashing
                              return (
                                <View key={`reco-error-${index}`} style={styles.recommendationCard}>
                                  <Text style={styles.errorText}>
                                    Unable to display recommendation {index + 1}
                                  </Text>
                                </View>
                              );
                            }
                          })}
                        </View>
                      </View>
                    )}

                  {/* Read Status */}
                </>
              )}




              {/* Render Rebalance Notification Details */}
{isRebalanceNotification && (
  <RebalanceNotificationComponent selectedNotification={selectedNotification}/>
)}

            </ScrollView>

          {(isRebalanceNotification) ? (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={navigateToHomeScreen}>
                <Text style={styles.closeModalButtonText}>Navigate to Home Screen and Accept</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={closeModal}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          </View>
        </View>
      </Modal>
    );
  };

  const renderSectionHeader = (title, count) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title} {count > 0 && `(${count})`}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <FlatList
      data={[]}
      renderItem={null}
      ListEmptyComponent={() => (
        <View style={styles.emptyState}>
          <Icon name="bell-off" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {showUnreadOnly
              ? 'No unread notifications'
              : 'No notifications yet'}
          </Text>
          <Text style={styles.emptyMessage}>
            {showUnreadOnly
              ? 'All notifications have been read'
              : 'Pull down to refresh and check for new stock recommendations'}
          </Text>
        </View>
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#407BFF']}
          tintColor="#407BFF"
          title="Pull to refresh"
          titleColor="#6B7A99"
        />
      }
    />
  );

  if (isNotificationLoading && !refreshing) {
    return (
      <LinearGradient
        colors={['#EAEEFF', '#fff']}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={{flex: 1}}>
        <SafeAreaView style={{flex: 1}}>
             <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ paddingHorizontal: 15, paddingVertical: 10, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, }}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontFamily: 'Poppins-Medium', color: '#fff' }}>
                Push Notification
              </Text>
            </View>
          </View>
          <View style={{ marginLeft: 45, marginTop: 2 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: '#f0f0f0' }}>
              Stay updated with the latest alerts
            </Text>
          </View>
        </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7A99" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#EAEEFF', '#fff']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={{flex: 1}}>
      <SafeAreaView style={{flex: 1}}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ paddingHorizontal: 15, paddingVertical: 10, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, }}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontFamily: 'Poppins-Medium', color: '#fff' }}>
                Push Notification
              </Text>
            </View>
          </View>
          <View style={{ marginLeft: 45, marginTop: 2 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: '#f0f0f0' }}>
                Stay updated with the latest alerts
            </Text>
          </View>
            <View style={styles.filterContainer}>
                <TouchableOpacity
                  style={[
                    styles.unreadFilterBtn,
                    showUnreadOnly && styles.unreadFilterBtnActive,
                  ]}
                  onPress={toggleUnreadFilter}>
                  <Filter
                    color={showUnreadOnly ? '#FFFFFF' : '#FFFFFF'}
                    size={16}
                  />
                  <Text
                    style={[
                      styles.unreadFilterText,
                      showUnreadOnly && styles.unreadFilterTextActive,
                    ]}>
                    Unread {getUnreadCount() > 0 && `(${getUnreadCount()})`}
                  </Text>
                </TouchableOpacity>
              </View>
        </LinearGradient>

        {!allNotifications ||
        !allNotifications.notifications ||
        allNotifications.notifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            style={{flex: 1}}
            contentContainerStyle={{paddingBottom: 20}}

            data={[
              ...(todayNotifications.length > 0
                ? [
                    {
                      type: 'header',
                      title: 'Today',
                      count: todayNotifications.length,
                    },
                  ]
                : []),
              ...todayNotifications.map(item => ({
                ...item,
                type: item.type || 'notification',
              })),
              ...(earlierNotifications.length > 0
                ? [
                    {
                      type: 'header',
                      title: 'Earlier',
                      count: earlierNotifications.length,
                    },
                  ]
                : []),
              ...earlierNotifications.map(item => ({
                ...item,
                type: item.type || 'notification',
              })),
            ]}
            keyExtractor={(item, index) => {
              if (item.type === 'header') return `header-${item.title}`;
              return (
                item.uniqueId ||
                `notification-${item.insertedAt || item.sortDate || index}`
              );
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#407BFF']}
                tintColor="#407BFF"
                title="Pull to refresh"
                titleColor="#6B7A99"
              />
            }
            renderItem={({item}) => {
              if (item.type === 'header') return renderSectionHeader(item.title, item.count);
              return renderNotificationItem({ item });
            }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {renderNotificationModal()}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: { padding: 4, borderRadius: 5, backgroundColor: '#fff', marginRight: 10 },
  filterButtonWrapper: {
    position: 'relative',
  },

  unreadCountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  unreadFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  unreadFilterBtnActive: {
    backgroundColor: "#29A400",
  },

  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // Aligns to left
    paddingHorizontal: 18,
    marginTop:10,
    paddingBottom:10,
    backgroundColor:'transparent'
  },
  unreadFilterText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  unreadFilterTextActive: {
    color: '#FFFFFF',
  },
  modalNotificationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginTop: 8,
  },
  notificationImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  notificationType: {
    fontSize: 12,
    color: '#407BFF',
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  messageText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginTop: 8,
    fontFamily: 'HelveticaNeue',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  adviceText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    fontFamily: 'HelveticaNeue',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    color: '#6B7A99',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  notificationItem: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  notificationIcon: {
    marginRight: 12,
  },
  defaultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'HelveticaNeue',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'HelveticaNeue',
  },
  stockContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  stockChipContainer: {
    marginBottom: 4,
  },
  stockChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  stockSymbol: {
    fontSize: 11,
    color: '#407BFF',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
    marginBottom: 2,
  },
  stockPrice: {
    fontSize: 10,
    color: '#059669',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
  },
  moreStocks: {
    fontSize: 12,
    color: '#6B7280',
    alignSelf: 'center',
    fontStyle: 'italic',
    fontFamily: 'HelveticaNeue',
  },
  adviceCount: {
    fontSize: 12,
    color: '#407BFF',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
    marginBottom: 6,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: 8,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'HelveticaNeue',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7A99',
    fontFamily: 'HelveticaNeue',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth,
    maxHeight: screenHeight - 100,
    flex: 1,
    backgroundColor: '#fff',
    borderTopRightRadius:20,
    borderTopLeftRadius:20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  alertTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 12,
  },
  alertTypeText: {
    fontSize: 14,
    color: '#407BFF',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
    marginLeft: 8,
  },
  dateTimeContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontFamily: 'HelveticaNeue',
  },
  stockDetailContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stockDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stockDetailLeft: {
    flex: 1,
  },
  stockSymbolDetail: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
  },
  stockDetailRight: {
    alignItems: 'flex-end',
  },
  stockPriceDetail: {
    fontSize: 16,
    color: '#059669',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  stockPriceNA: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'HelveticaNeue',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  closeModalButton: {
    flex: 1,
    backgroundColor: '#407BFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium', // fallback
    }),
  },
  ///
    rebalanceNotificationContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },

  rebalanceNotificationHeaderCard: {
    backgroundColor: '#E8F0FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rebalanceNotificationHeaderIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rebalanceNotificationHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#407BFF',
    marginLeft: 8,
  },
  rebalanceNotificationSubText: {
    fontSize: 14,
    color: '#4B5563',
  },

  rebalanceNotificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rebalanceNotificationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },

  rebalanceNotificationInfoRow: {
    marginBottom: 8,
  },
  rebalanceNotificationInfoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rebalanceNotificationIconWrapper: {
    marginRight: 6,
  },
  rebalanceNotificationInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  rebalanceNotificationInfoValue: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 2,
    marginTop: 2,
  },

  rebalanceNotificationListItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
  },
  rebalanceNotificationListItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  rebalanceNotificationListSubText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Recommendation Card Styles
  recommendationContainer: {
    marginTop: 8,
  },
  recommendationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recommendationSymbol: {
    fontSize: 15,
    color: '#1F2937',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Bold',
      android: 'HelveticaNeueBold',
      default: 'HelveticaNeueBold',
    }),
    flex: 1,
  },
  actionBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  buyBadgeSmall: {
    backgroundColor: '#29A400',
    borderColor: '#29A400',
  },
  sellBadgeSmall: {
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  actionTextSmall: {
    fontSize: 10,
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
  },
  buyTextSmall: {
    color: '#fff',
  },
  sellTextSmall: {
    color: '#fff',
  },
  recommendationGrid: {
    gap: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  recommendationLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
  },
  recommendationValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
  },
  stopLossText: {
    color: '#EF4444',
  },
  targetText: {
    color: '#059669',
  },
  rationaleContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  rationaleLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-Medium',
      android: 'HelveticaNeueMedium',
      default: 'HelveticaNeueMedium',
    }),
    marginBottom: 4,
  },
  rationaleText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'HelveticaNeue',
  },
});

export default PushNotificationScreen;