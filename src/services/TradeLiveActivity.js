import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';

const native = NativeModules.TradeLiveActivity;
const ORDER_STATUS = {
  'order.queued': 'Queued',
  'order.checking_broker': 'Checking broker',
  'order.partial': 'Partly completed',
  'order.complete': 'Complete',
};

export const isTradeLiveActivityAvailable = () =>
  Platform.OS === 'ios' && !!native;

const payloadFor = message => {
  const data = message?.data || {};
  const eventType = data.event_type || '';
  return {
    activityId: data.execution_id || data.attempt_id || data.event_id || '',
    title: data.recommendation_title || 'Trade recommendation',
    broker: data.broker || '',
    status: eventType === 'advice.sent'
      ? 'Review required'
      : ORDER_STATUS[eventType] || data.status || 'In progress',
    detail: eventType === 'order.checking_broker'
      ? 'Checking broker — do not resubmit'
      : message?.notification?.body || '',
    progress: eventType === 'order.complete' ? 1 : eventType === 'order.partial' ? 0.65 : eventType === 'order.queued' ? 0.25 : 0.1,
    deepLink: `alphaquark://recommendation/status?event_id=${encodeURIComponent(data.event_id || '')}`,
  };
};

export async function syncTradeLiveActivity(message, enabled) {
  if (!enabled) return null;
  const eventType = message?.data?.event_type || '';
  if (Platform.OS === 'android' && (eventType === 'advice.sent' || eventType.startsWith('order.'))) {
    const payload = payloadFor(message);
    const channelId = await notifee.createChannel({
      id: 'trade_status',
      name: 'Trade recommendation status',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
    const complete = eventType === 'order.complete';
    await notifee.displayNotification({
      id: `trade-status-${payload.activityId || 'current'}`,
      title: 'Trade status updated',
      body: 'Unlock to review the latest status.',
      data: {
        event_id: message?.data?.event_id || '',
        event_type: eventType,
        route: 'NotificationScreen',
      },
      android: {
        channelId,
        category: AndroidCategory.STATUS,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PRIVATE,
        ongoing: !complete,
        autoCancel: complete,
        pressAction: {id: 'trade_status', launchActivity: 'default'},
        progress: complete
          ? {max: 100, current: 100, indeterminate: false}
          : {max: 100, current: Math.round(payload.progress * 100), indeterminate: false},
      },
    });
    return payload.activityId;
  }
  if (!isTradeLiveActivityAvailable()) return null;
  if (eventType === 'advice.sent') {
    return native.start(payloadFor(message));
  }
  if (eventType.startsWith('order.')) {
    const payload = payloadFor(message);
    if (eventType === 'order.complete') return native.end(payload);
    return native.update(payload);
  }
  return null;
}

export function subscribeToTradeLiveActivityToken(listener) {
  if (!isTradeLiveActivityAvailable()) return () => {};
  const emitter = new NativeEventEmitter(native);
  const subscription = emitter.addListener('TradeLiveActivityToken', listener);
  native.getPushToken().then(token => token && listener({token})).catch(() => {});
  return () => subscription.remove();
}
