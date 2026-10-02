import React, {useEffect, useState} from 'react';
import {useWindowDimensions} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useTrade} from '../TradeContext';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useConfig} from '../../context/ConfigContext';
import RebalanceNotificationComponent from './RebalanceNotificationComponent';
import {adviceHeaderLabel, orderTypeDisplay} from '../../utils/adviceDisplay';
import dedupeNotificationFeed, {
  dedupeNotificationSymbols,
  formatNotificationSymbol,
} from '../../utils/notificationDedup';

import {designColor} from '../../design/literalTokens';
import {useComponent} from '../../design/useDesign';

const PushNotificationScreen = () => {
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  // Get dynamic config from API
  const config = useConfig();
  const gradient1 = config?.gradient1 || designColor('0056b7');
  const gradient2 = config?.gradient2 || designColor('002651');
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

    dedupeNotificationFeed(notifications).forEach(
      (notification, notificationIndex) => {
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
            sortDate: new Date(
              notification.insertedAt || notification.date || Date.now(),
            ),
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
      },
    );

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
    setModalVisible(true);
    // Mark as read if not already read - simple check
    if (!notification.isRead && notification._id && userEmail) {
      // Do not block opening the detail modal on a list refetch. The previous
      // await replaced the whole screen with "Loading notifications..." on
      // every unread tap and could reset the list scroll position.
      markNotificationAsReadById(notification._id, userEmail);
    }
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

  const Presentation = useComponent('screens.PushNotificationScreen');
  return (
    <Presentation
      viewModel={{
        screenWidth, screenHeight, gradient1, gradient2, todayNotifications,
        earlierNotifications, refreshing, showUnreadOnly, selectedNotification,
        modalVisible, isNotificationLoading, allNotifications,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        handleNotificationPress, formatTime, formatDate, formatFullDateTime,
        toggleUnreadFilter, onRefresh, closeModal, navigateToHomeScreen,
        dedupeNotificationSymbols, formatNotificationSymbol,
        adviceHeaderLabel, orderTypeDisplay,
      }}
      slots={{RebalanceNotification: RebalanceNotificationComponent}}
    />
  );
};

export default PushNotificationScreen;
