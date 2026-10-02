import React from 'react';
import { AppRegistry, AppState } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import NatificationServiceNav from './src/components/NatificationServiceNav';
import messaging from '@react-native-firebase/messaging';
import WebinarReminderHandler from './src/FunctionCall/services/WebinarReminderHandler';
import {
  ensureTradeAlertChannel,
} from './src/FunctionCall/services/TradeAlertChannel';
import codePush from '@revopush/react-native-code-push';
import DeviceInfo from 'react-native-device-info';
import {syncTradeLiveActivity} from './src/services/TradeLiveActivity';
import {installExactTargetOta} from './src/utils/otaPolicy';

let notificationDisplayed = false;

// Trade-advice notification types that get the distinct ring (client req
// 2026-08-13 #1). Mirrors the foreground switch in HomeScreen.js.
const TRADE_ALERT_TYPES = new Set([
  'bespoke',
  'New Rebalance',
  'trade_modified',
  'reco_message',
]);

const isTradeAlert = (remoteMessage) => {
  const type = remoteMessage?.data?.notificationType
    || remoteMessage?.notification?.data?.notificationType;
  return !!type && TRADE_ALERT_TYPES.has(type);
};
const routeSdkTradeTap = (message) => {
  const eventType = message?.data?.event_type || '';
  if (eventType === 'advice.sent' || eventType.startsWith('order.')) {
    NatificationServiceNav.navigate('NotificationScreen', {
      sdkEventId: message?.data?.event_id,
      sdkEventType: eventType,
      checkingBroker: eventType === 'order.checking_broker',
      recommendationKind: message?.data?.recommendation_kind,
      recommendationTitle: message?.data?.recommendation_title,
      broker: message?.data?.broker,
    });
    return true;
  }
  return false;
};
const syncLiveActivity = message =>
  syncTradeLiveActivity(message, message?.data?.live_activity_enabled === 'true')
    .catch(error => console.warn('[LiveActivity] sync failed:', error?.message || error));

// Display the notification function
const displayNotification = async (title, body, tradeAlert = false) => {
  try {
    await notifee.requestPermission();
    // Trade advice rings with the bundled `trade_alert.wav` via the dedicated
    // channel; everything else keeps the default sound. The FCM payload
    // already carries android.channel_id = trade_alerts, but the in-app
    // foreground render path (this function) still needs the same channel.
    const channelId = tradeAlert
      ? await ensureTradeAlertChannel()
      : await notifee.createChannel({
          id: 'default',
          name: 'Default Channel',
          vibration: true,
          sound: 'default',
          importance: AndroidImportance.HIGH,
          vibrationPattern: [300, 500],
        });

    // Display notification only if the app is not in the foreground and notification hasn't been shown
    if (AppState.currentState !== 'active' && !notificationDisplayed) {
      console.log('App not active, displaying notification');
      await notifee.displayNotification({
        title: title,
        body: body,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default', // Handle notification press event
          },
        },
      });
      notificationDisplayed = true;
    }
  } catch (error) {
    console.log('Error displaying notification: ' + error);
  }
};

// Background message handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  if (!remoteMessage) return;
  await syncLiveActivity(remoteMessage);
  // Webinar reminders may arrive data-only (cron sometimes omits the
  // `notification` block) — defend against undefined access and let the
  // handler render via the dedicated channel.
  if (WebinarReminderHandler.matches(remoteMessage)) {
    await WebinarReminderHandler.displayInBackground(remoteMessage);
    return;
  }
  if (remoteMessage.notification) {
    const { title, body } = remoteMessage.notification;
    const tradeAlert = isTradeAlert(remoteMessage);
    await displayNotification(title, body, tradeAlert);
    console.log('Notification received in background');
  }
});

// Handle notification when the app was closed and opened via notification
messaging().getInitialNotification().then(async (remoteMessage) => {
  if (!remoteMessage) return;
  await syncLiveActivity(remoteMessage);
  // Cold-start tap on a webinar reminder — route straight to WebinarDetail.
  if (WebinarReminderHandler.matches(remoteMessage)) {
    WebinarReminderHandler.routeTap(remoteMessage);
    return;
  }
  if (routeSdkTradeTap(remoteMessage)) return;
  if (remoteMessage.notification) {
    const { title, body } = remoteMessage.notification;
    await displayNotification(title, body, isTradeAlert(remoteMessage));
    console.log('Notification received when app was closed');
  }
});

// App was backgrounded (not killed) when the user tapped a webinar
// reminder — route to WebinarDetail. Existing notifications continue
// to fall through to the default NotificationScreen route below.
messaging().onNotificationOpenedApp((remoteMessage) => {
  if (!remoteMessage) return;
  syncLiveActivity(remoteMessage);
  if (WebinarReminderHandler.matches(remoteMessage)) {
    WebinarReminderHandler.routeTap(remoteMessage);
    return;
  }
  routeSdkTradeTap(remoteMessage);
});

messaging().onMessage(async remoteMessage => {
  if (remoteMessage) await syncLiveActivity(remoteMessage);
});

// Handle notification press events when the app is in the foreground
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type !== EventType.PRESS) return;
  // Webinar reminder tap → WebinarDetail (delegated to handler).
  if (WebinarReminderHandler.isOurPressAction(detail)
      || WebinarReminderHandler.matches({ notification: detail?.notification })) {
    if (WebinarReminderHandler.routeTap({ notification: detail?.notification })) return;
  }
  console.log('Notification pressed in foreground');
  if (routeSdkTradeTap({data: detail?.notification?.data || {}})) return;
  // Default route for all other notification types.
  NatificationServiceNav.navigate('NotificationScreen');
});

// Handle notification press events when the app is in the background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.PRESS) return;
  if (WebinarReminderHandler.isOurPressAction(detail)
      || WebinarReminderHandler.matches({ notification: detail?.notification })) {
    if (WebinarReminderHandler.routeTap({ notification: detail?.notification })) return;
  }
  console.log('Notification pressed in background');
  if (routeSdkTradeTap({data: detail?.notification?.data || {}})) return;
  NatificationServiceNav.navigate('NotificationScreen');
});

let otaCheckInFlight = null;

const checkForExactTargetOta = () => {
  if (otaCheckInFlight) return otaCheckInFlight;
  otaCheckInFlight = installExactTargetOta({
    codePush,
    binaryVersion: DeviceInfo.getVersion(),
  })
    .catch(error => console.warn('[OTA] exact-target check failed:', error?.message || error))
    .finally(() => {
      otaCheckInFlight = null;
    });
  return otaCheckInFlight;
};

const ExactTargetOtaApp = () => {
  React.useEffect(() => {
    checkForExactTargetOta();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkForExactTargetOta();
    });
    return () => subscription.remove();
  }, []);
  return <App />;
};

// Release binaries report OTA status through the CodePush HOC, but update
// acquisition is manual and exact-version-only. An open-ended package such as
// Production v93 (>=3.9.129) must never replace a newer APK's embedded bundle.
// Downloads still activate only on the next clean restart, never mid-trade.
// Debug remains attached to Metro and never checks OTA.
const OtaEnabledApp = __DEV__
  ? App
  : codePush({
      checkFrequency: codePush.CheckFrequency.MANUAL,
      installMode: codePush.InstallMode.ON_NEXT_RESTART,
      mandatoryInstallMode: codePush.InstallMode.ON_NEXT_RESTART,
    })(ExactTargetOtaApp);

AppRegistry.registerComponent(appName, () => OtaEnabledApp);
