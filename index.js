import { AppRegistry, AppState } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import NatificationServiceNav from './src/components/NatificationServiceNav';
import messaging from '@react-native-firebase/messaging';
import WebinarReminderHandler from './src/FunctionCall/services/WebinarReminderHandler';

let notificationDisplayed = false;

// Display the notification function
const displayNotification = async (title, body) => {
  try {
    await notifee.requestPermission();
    const channelId = await notifee.createChannel({
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
  // Webinar reminders may arrive data-only (cron sometimes omits the
  // `notification` block) — defend against undefined access and let the
  // handler render via the dedicated channel.
  if (WebinarReminderHandler.matches(remoteMessage)) {
    await WebinarReminderHandler.displayInBackground(remoteMessage);
    return;
  }
  if (remoteMessage.notification) {
    const { title, body } = remoteMessage.notification;
    await displayNotification(title, body);
    console.log('Notification received in background');
  }
});

// Handle notification when the app was closed and opened via notification
messaging().getInitialNotification().then(async (remoteMessage) => {
  if (!remoteMessage) return;
  // Cold-start tap on a webinar reminder — route straight to WebinarDetail.
  if (WebinarReminderHandler.matches(remoteMessage)) {
    WebinarReminderHandler.routeTap(remoteMessage);
    return;
  }
  if (remoteMessage.notification) {
    const { title, body } = remoteMessage.notification;
    await displayNotification(title, body);
    console.log('Notification received when app was closed');
  }
});

// App was backgrounded (not killed) when the user tapped a webinar
// reminder — route to WebinarDetail. Existing notifications continue
// to fall through to the default NotificationScreen route below.
messaging().onNotificationOpenedApp((remoteMessage) => {
  if (!remoteMessage) return;
  if (WebinarReminderHandler.matches(remoteMessage)) {
    WebinarReminderHandler.routeTap(remoteMessage);
  }
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
  NatificationServiceNav.navigate('NotificationScreen');
});

// Register the app
AppRegistry.registerComponent(appName, () => App);
