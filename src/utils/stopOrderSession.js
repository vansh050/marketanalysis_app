/**
 * Stop-loss (SL / SL-M) orders and the exchange call-auction sessions.
 *
 * During a call auction brokers accept only MARKET and LIMIT orders, so an SL
 * order sent then is rejected. Zerodha's wording (2026-10-23, prod
 * testaccount IDEA SL BUY at 15:15:10): "Stop-loss orders not allowed in the
 * current session."
 *
 * - Pre-open call auction: 9:00–9:08 AM IST (NSE and BSE).
 * - NSE Closing Auction Session: 3:15–3:35 PM IST, since 3 Aug 2026, for
 *   stocks that trade in F&O (NSE circular NSE/CMTR/74466). Other stocks keep
 *   the old close, so this is a warning, not a block.
 *
 * The customer may continue anyway; the broker remains the authority.
 */
import {Alert} from 'react-native';

const STOP_ORDER_TYPES = new Set(['SL', 'SL_M', 'SL-M', 'STOP', 'STOPLOSS', 'STOP_LOSS']);
const IST_OFFSET_MINUTES = 330;

export const STOP_ORDER_AUCTION_WINDOWS = [
  {start: 9 * 60, end: 9 * 60 + 8, name: 'pre-open call auction (9:00–9:08 AM)', resumes: 'after 9:15 AM'},
  {start: 15 * 60 + 15, end: 15 * 60 + 35, name: 'closing auction (3:15–3:35 PM)', resumes: 'from 9:15 AM on the next trading day'},
];

const isStopLeg = leg =>
  STOP_ORDER_TYPES.has(String(leg?.orderType || leg?.order_type || '').trim().toUpperCase());

// Window active at `now`, judged in IST whatever the phone's time zone is.
export function activeStopOrderAuctionWindow(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return null;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return STOP_ORDER_AUCTION_WINDOWS.find(w => minutes >= w.start && minutes < w.end) || null;
}

/** User-facing warning for the stop-loss legs in `legs`, or null. */
export function stopOrderSessionWarning(legs, now = new Date()) {
  const stopLegs = (Array.isArray(legs) ? legs : []).filter(isStopLeg);
  if (stopLegs.length === 0) return null;
  const window = activeStopOrderAuctionWindow(now);
  if (!window) return null;
  const symbols = [...new Set(stopLegs.map(l =>
    String(l?.tradingSymbol || l?.symbol || '').replace(/-EQ$/, '')).filter(Boolean))];
  const named = symbols.length ? `${symbols.slice(0, 3).join(', ')}${symbols.length > 3 ? ` and ${symbols.length - 3} more` : ''}` : 'This order';
  return (
    `${named} ${stopLegs.length === 1 ? 'is a stop-loss order' : 'are stop-loss orders'}. ` +
    `During the exchange's ${window.name} brokers accept only market and limit orders, ` +
    `so it is likely to be rejected. It can be placed ${window.resumes}.`
  );
}

/**
 * Resolves true when there is nothing to warn about or the customer chooses
 * to place anyway; false when they cancel.
 */
export function confirmStopOrderSession(legs, now = new Date()) {
  const message = stopOrderSessionWarning(legs, now);
  if (!message) return Promise.resolve(true);
  return new Promise(resolve => {
    Alert.alert(
      'Stop-loss order may be rejected',
      message,
      [
        {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Place anyway', onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    );
  });
}
