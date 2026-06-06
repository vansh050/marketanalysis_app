/**
 * WebinarReminderHandler — single source of truth for FCM payloads from
 * the server-side webinar-reminders cron.
 *
 * Server contract
 *   data: {
 *     type:               'live_class_reminder',
 *     courseId:           '<mongo id>',
 *     lessonId:           '<mongo id>',
 *     scheduledStartTime: '<ISO 8601>',
 *     threshold:          't-1hr' | 't-15min' | 't-1min',
 *   }
 *   notification: { title, body }    // may be absent in data-only sends
 *   priority: 'high'
 *
 * Cron: aq_backend_github/CronJob/CronLiveClassReminders.js (T-1hr push,
 * T-15min push, T-1min push; T-24hr is email-only). One device row per
 * (lessonId, userEmail) via webinar_registrations on the server side —
 * the client doesn't subscribe to any topic; it just receives a
 * data-bearing message keyed to its FCM token.
 *
 * What this module does
 *   - matches(remoteMessage)         — is this a webinar-reminder payload?
 *   - displayInForeground(rm)        — render via notifee with our channel
 *                                     (FCM does NOT auto-display in
 *                                     foreground).
 *   - displayInBackground(rm)        — same render path — Android background
 *                                     FCM auto-shows the `notification`
 *                                     block, but if the payload is data-only
 *                                     this fills the gap.
 *   - routeTap(data)                 — navigate to WebinarDetail with the
 *                                     lessonId.
 *   - extractData(rmOrEvent)         — utility: pull the data object out
 *                                     of either an FCM RemoteMessage or a
 *                                     notifee event's notification.data.
 *
 * iOS:
 *   APNS-side wiring (requestPermission, registerForRemoteNotifications,
 *   APNS topic) is deferred. Android only for v1.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.8.
 */

import notifee, { AndroidImportance } from '@notifee/react-native';
import NatificationServiceNav from '../../components/NatificationServiceNav';

const CHANNEL_ID = 'webinar_reminders';
const CHANNEL_NAME = 'Webinar reminders';
const PRESS_ACTION_ID = 'webinar_reminder_open';
export const REMINDER_TYPE = 'live_class_reminder';

let channelEnsured = false;

async function ensureChannel() {
  if (channelEnsured) return CHANNEL_ID;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
  });
  channelEnsured = true;
  return CHANNEL_ID;
}

function thresholdLabel(threshold) {
  switch (threshold) {
    case 't-1hr':   return 'in 1 hour';
    case 't-15min': return 'in 15 minutes';
    case 't-1min':  return 'starting in 1 minute';
    default:        return 'soon';
  }
}

/**
 * Pull a `data` object out of either an FCM RemoteMessage
 * (`{ data: {...}, notification: {...} }`) or a notifee event
 * (`{ notification: { data: {...} } }`). Returns `{}` when neither
 * shape is present (defensive).
 */
export function extractData(input) {
  if (!input) return {};
  if (input.data && typeof input.data === 'object') return input.data;
  if (input.notification?.data && typeof input.notification.data === 'object') {
    return input.notification.data;
  }
  return {};
}

/**
 * True iff the payload is a webinar reminder. Use this from the
 * foreground / background dispatchers to decide whether to call our
 * display/route helpers vs falling through to the existing routing.
 */
export function matches(rmOrEvent) {
  const data = extractData(rmOrEvent);
  return data?.type === REMINDER_TYPE && !!data?.lessonId;
}

function buildBody(remoteMessage) {
  const data = extractData(remoteMessage);
  const provided = remoteMessage?.notification?.body || data?.body;
  if (provided) return String(provided);
  // Fallback copy when the cron sent a data-only payload (no
  // notification block). Mirrors the email-side phrasing.
  return `Your live webinar starts ${thresholdLabel(data?.threshold)}. Tap to join.`;
}

function buildTitle(remoteMessage) {
  const data = extractData(remoteMessage);
  return (
    remoteMessage?.notification?.title
    || data?.title
    || 'Webinar reminder'
  );
}

async function display(remoteMessage) {
  const channelId = await ensureChannel();
  const data = extractData(remoteMessage);
  await notifee.displayNotification({
    title: buildTitle(remoteMessage),
    body: buildBody(remoteMessage),
    // Stamp the payload onto the notification so we can recover the
    // lessonId on tap (notifee's pressAction.data round-trips through
    // both foreground + background event types).
    data: {
      type: REMINDER_TYPE,
      lessonId: String(data?.lessonId || ''),
      courseId: String(data?.courseId || ''),
      threshold: String(data?.threshold || ''),
    },
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_launcher',
      color: '#d97706',
      pressAction: {
        id: PRESS_ACTION_ID,
        launchActivity: 'default',
      },
    },
  });
}

export async function displayInForeground(remoteMessage) {
  if (!matches(remoteMessage)) return false;
  try {
    await display(remoteMessage);
    return true;
  } catch (e) {
    console.warn('[WebinarReminderHandler] foreground display failed:', e?.message);
    return false;
  }
}

export async function displayInBackground(remoteMessage) {
  if (!matches(remoteMessage)) return false;
  try {
    await display(remoteMessage);
    return true;
  } catch (e) {
    console.warn('[WebinarReminderHandler] background display failed:', e?.message);
    return false;
  }
}

/**
 * Deep-link to WebinarDetail. Tolerates either a raw data object or a
 * full RemoteMessage / notifee event — both go through extractData.
 * Returns true if a navigation was attempted.
 */
export function routeTap(rmOrEventOrData) {
  // routeTap accepts the raw data shape too (so callers can hand us
  // whatever they have without conditional unwrapping).
  const data = (rmOrEventOrData && rmOrEventOrData.type === REMINDER_TYPE)
    ? rmOrEventOrData
    : extractData(rmOrEventOrData);
  if (data?.type !== REMINDER_TYPE || !data?.lessonId) return false;
  try {
    NatificationServiceNav.navigate('WebinarDetail', { lessonId: data.lessonId });
    return true;
  } catch (e) {
    console.warn('[WebinarReminderHandler] route navigation failed:', e?.message);
    return false;
  }
}

/**
 * Inspect a notifee event's pressAction and route iff it matches our
 * press-action id. Returns true when handled so callers can short-circuit
 * the existing default route (NotificationScreen).
 */
export function isOurPressAction(detail) {
  return detail?.pressAction?.id === PRESS_ACTION_ID;
}

export default {
  REMINDER_TYPE,
  matches,
  extractData,
  displayInForeground,
  displayInBackground,
  routeTap,
  isOurPressAction,
};
