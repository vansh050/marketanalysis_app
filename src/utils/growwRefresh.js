/**
 * Groww session refresh — customer-initiated one-tap daily refresh.
 *
 * Mirrors src/utils/growwRefresh.js on the web. Posts to
 * /api/groww/refresh-token, which reads the server-stored TOTP seed
 * (encrypted AES-256-CBC at rest), decrypts it, mints a fresh 6-digit
 * code via pyotp, and swaps it with Groww for a new access token. No
 * user input needed.
 *
 * Error-code routing:
 *   200 OK              → saveBrokerSessionTime + refreshEvent + toast
 *   400 NO_TOTP_SEED    → legacy approval-mode customer without a
 *                          stored seed. Open the connect modal so the
 *                          user can do the one-time TOTP seed capture.
 *   400 INVALID_SEED    → Groww rejected the TOTP. Usually means the
 *                          key was revoked on Groww's dashboard. Open
 *                          groww.in/trade-api/api-keys in the external
 *                          browser AND re-open the connect modal so
 *                          the customer can regenerate + paste a new
 *                          seed.
 *   429 RATE_LIMITED    → silent (the backend's 30s cooldown is a
 *                          correctness guardrail, not a UX signal).
 */
import axios from 'axios';
import { Alert, Linking } from 'react-native';
import Config from 'react-native-config';

import server from './serverConfig';
import { generateToken } from './SecurityTokenManager';
import { getAdvisorSubdomain } from './variantHelper';
import { saveBrokerSessionTime } from './brokerSessionUtils';
import eventEmitter from '../components/EventEmitter';

const GROWW_API_KEYS_URL = 'https://groww.in/trade-api/api-keys';

const buildHeaders = (advisorSubdomain) => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain':
    advisorSubdomain || Config.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

const openGrowwExternal = () => {
  Linking.openURL(GROWW_API_KEYS_URL).catch((err) =>
    console.warn('[Groww] Failed to open Groww API keys page:', err?.message),
  );
};

/**
 * Run the refresh. Callers typically provide:
 *   - userId              (required — backend uses it to find stored seed)
 *   - advisorSubdomain    (optional — falls back to Config / variantHelper)
 *   - showAlert           (optional — modalStore.showAlert(type,title,body))
 *   - onOpenConnectModal  (optional — called on NO_TOTP_SEED / INVALID_SEED
 *                          to surface the GrowwConnectModal for seed capture)
 *   - onSuccess           (optional — invoked after a successful refresh,
 *                          typically getUserDetails() to re-hydrate state)
 *   - onClose             (optional — closes the token-expire modal)
 *   - skipConfirm         (optional bool — skip the Alert.alert confirm)
 *
 * Returns true on success, false on any handled failure. Errors are
 * surfaced via showAlert (or fall-through toast).
 */
export async function refreshGrowwSession({
  userId,
  advisorSubdomain,
  showAlert,
  onOpenConnectModal,
  onSuccess,
  onClose,
  skipConfirm,
} = {}) {
  if (!userId) {
    showAlert?.(
      'error',
      'Error',
      'Please sign in again to refresh your Groww session.',
    );
    return false;
  }

  const proceed = () => doRefresh({
    userId,
    advisorSubdomain,
    showAlert,
    onOpenConnectModal,
    onSuccess,
    onClose,
  });

  if (skipConfirm) {
    return proceed();
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Refresh Groww session?',
      'Takes about 2 seconds. No page reload, no re-pasting credentials.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Refresh',
          onPress: async () => resolve(await proceed()),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

async function doRefresh({
  userId,
  advisorSubdomain,
  showAlert,
  onOpenConnectModal,
  onSuccess,
  onClose,
}) {
  try {
    const res = await axios.post(
      `${server.server.baseUrl}api/groww/refresh-token`,
      { uid: userId },
      { headers: buildHeaders(advisorSubdomain), timeout: 25000 },
    );

    if (res.data?.success) {
      try {
        await saveBrokerSessionTime('Groww');
      } catch (_) {
        // non-critical
      }
      eventEmitter.emit('refreshEvent', { source: 'Groww session refresh' });
      showAlert?.(
        'success',
        'Groww session refreshed',
        'You can place trades for the rest of the day.',
      );
      onClose?.();
      onSuccess?.();
      return true;
    }

    showAlert?.(
      'error',
      'Could not refresh Groww',
      res.data?.message || 'Please try again.',
    );
    return false;
  } catch (err) {
    const status = err?.response?.status;
    const code = err?.response?.data?.error_code;
    const message = err?.response?.data?.message;

    if (status === 429 || code === 'RATE_LIMITED') {
      // Silent — the 30s cooldown is a correctness guard, not a UX signal.
      return false;
    }

    if (code === 'NO_TOTP_SEED') {
      showAlert?.(
        'info',
        'One-time upgrade needed',
        'Your Groww connection needs a one-time upgrade to enable one-tap refresh. On Groww, open the "Generate TOTP token" dialog and copy the Base32 secret shown below the QR code (not the JWT-style "TOTP Token" at the top). Paste it here — after that, refresh is a single tap.',
      );
      onClose?.();
      onOpenConnectModal?.();
      return false;
    }

    // INVALID_SEED / GROWW_REJECTED both mean Groww refused the stored
    // token. The user has to regenerate — open groww.in, then the
    // connect modal so they can paste the fresh value.
    if (code === 'INVALID_SEED' || code === 'GROWW_REJECTED') {
      showAlert?.(
        'error',
        'Groww rejected the stored token',
        'Your Groww key seems to have been revoked. Opening groww.in so you can regenerate a new TOTP Secret Key — remember: the one we need is the Base32 secret shown below the QR, not the JWT-style "TOTP Token" at the top. Come back and paste it once you have it.',
      );
      onClose?.();
      openGrowwExternal();
      onOpenConnectModal?.();
      return false;
    }

    console.error('[Groww] refresh-token failed:', status, code, message);
    showAlert?.(
      'error',
      'Connection Error',
      message ||
        err?.message ||
        'Could not refresh Groww session. Please try again.',
    );
    return false;
  }
}
