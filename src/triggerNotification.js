import { NativeModules } from 'react-native';

const { CustomNotificationModule } = NativeModules;

// Trigger Custom Notification
const triggerNotification = () => {
  CustomNotificationModule.showCustomNotification(
    'DEEPAKNITR',
    '₹1988'
  );
};

export default triggerNotification;
