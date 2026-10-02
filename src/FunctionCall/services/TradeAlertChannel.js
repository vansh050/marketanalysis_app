/**
 * Dedicated Android notification channel for trade advice.
 *
 * Client req 2026-08-13 (#1): "bell with a different ring when a trade comes
 * in." The FCM payload for trade advice now carries `sound: "trade_alert"` +
 * `androidChannelId: "trade_alerts"` (ccxt-india fcm/fcm.py + AdviceFcmNotifier),
 * so the system routes those pushes to this channel — whose sound is bound to
 * the bundled `res/raw/trade_alert.wav` raw resource — instead of the default
 * ring. Foreground displays in HomeScreen.js route through this channel too so
 * the app and the system tray use the same distinct ring.
 *
 * The channel id MUST match the backend `android_channel_id` exactly
 * ("trade_alerts") or background delivery silently falls back to the default
 * channel/sound.
 */

import notifee, { AndroidImportance } from '@notifee/react-native';

export const TRADE_ALERT_CHANNEL_ID = 'trade_alerts';
export const TRADE_ALERT_SOUND = 'trade_alert';

let tradeAlertChannelEnsured = false;

/**
 * Create (idempotent) the trade-alert channel and return its id.
 * Use it as the `channelId` for any trade-advice notification on Android.
 */
export async function ensureTradeAlertChannel() {
  if (tradeAlertChannelEnsured) return TRADE_ALERT_CHANNEL_ID;
  await notifee.createChannel({
    id: TRADE_ALERT_CHANNEL_ID,
    name: 'Trade Alerts',
    sound: TRADE_ALERT_SOUND,
    vibration: true,
    vibrationPattern: [300, 300, 300],
    importance: AndroidImportance.HIGH,
  });
  tradeAlertChannelEnsured = true;
  return TRADE_ALERT_CHANNEL_ID;
}

/**
 * Build the `android` display block for a trade-advice notification.
 * Caller passes the notifee display config for android:
 *   android: await tradeAlertAndroidBlock({ pressAction: { id: 'default' } })
 * Always routes through the dedicated channel so the custom ring plays.
 */
export async function tradeAlertAndroidBlock(extra = {}) {
  const channelId = await ensureTradeAlertChannel();
  return {
    channelId,
    importance: AndroidImportance.HIGH,
    sound: TRADE_ALERT_SOUND,
    ...extra,
  };
}

export default ensureTradeAlertChannel;
