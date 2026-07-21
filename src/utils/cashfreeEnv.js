/**
 * cashfreeEnv — single source of truth for CashFree environment + the
 * "install-source check failed" error classifier.
 *
 * Why this exists:
 *   CashFree's native SDK enforces a Play-Store-only install-source
 *   check in PRODUCTION mode. Sideloaded APKs (anything installed via
 *   `com.google.android.packageinstaller`, i.e. `adb install` or a
 *   manual APK tap) throw synchronously from
 *   `CFPaymentGatewayService.doPayment(...)`:
 *
 *     "com.google.android.packageinstaller is not a trusted source.
 *      App should be installed from play store or another whitelisted
 *      app store."
 *
 *   This is anti-fraud, by design, NOT configurable from JS (the check
 *   lives in the bundled native AAR). The check applies to ALL
 *   checkout types — Drop, Web, UPI Intent. The only legitimate ways
 *   around it are:
 *     1. Install via Google Play Store / Play Store Internal Testing.
 *     2. Whitelist the installer (e.g. `com.google.android.packageinstaller`)
 *        at the CashFree merchant dashboard (Settings → Whitelisted
 *        Install Sources).
 *     3. Run SANDBOX env — but the backend must also be using sandbox
 *        CF credentials, otherwise the SANDBOX SDK will reject the
 *        PRODUCTION payment_session_id with "Invalid session".
 *
 * Env selection rule:
 *   - `Config.REACT_APP_CASHFREE_ENV` (explicit override) — `sandbox`
 *     wins, `production` wins, anything else falls through.
 *   - `__DEV__` true (Metro debug build) → SANDBOX by default. Lets
 *     in-Metro developers iterate without flipping `.env`.
 *   - Else: `Config.REACT_APP_ENV === 'production'` → PRODUCTION;
 *     anything else → SANDBOX.
 *
 * Callers MUST use `getCashfreeEnvironment()` instead of constructing
 * the enum value inline so the rule stays consistent across
 * BuyWebinarTicketSheet, CoursePurchaseSheet, and any future payment
 * surface.
 */

import Config from 'react-native-config';
import { CFEnvironment } from 'cashfree-pg-api-contract';

export function getCashfreeEnvironment() {
  const override = String(Config.REACT_APP_CASHFREE_ENV || '').trim().toLowerCase();
  if (override === 'sandbox') return CFEnvironment.SANDBOX;
  if (override === 'production' || override === 'prod') return CFEnvironment.PRODUCTION;
  // Metro debug builds: default to SANDBOX. Release APKs (no Metro)
  // fall through to REACT_APP_ENV-based selection.
  if (typeof __DEV__ !== 'undefined' && __DEV__) return CFEnvironment.SANDBOX;
  return Config.REACT_APP_ENV === 'production'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;
}

const INSTALL_SOURCE_PATTERNS = [
  /not a trusted source/i,
  /trusted store/i,
  /trusted app store/i,
  /whitelisted app store/i,
  /com\.google\.android\.packageinstaller/i,
];

export function isInstallSourceError(err) {
  const msg = String(err?.message || err || '');
  return INSTALL_SOURCE_PATTERNS.some((re) => re.test(msg));
}

// One-liner friendly message for the install-source case. The full
// remediation text lives in docs (CHANGELOG 2026-06-09 entry +
// COURSES_WEBINARS_MOBILE_PORTING.md); the in-modal message stays short
// so it fits the small error box.
export function installSourceFriendlyMessage() {
  return (
    "This build wasn't installed from Google Play, so CashFree blocked the payment for safety. " +
    'Install the app via Play Store internal testing, or ask the developer to add this installer ' +
    'to the CashFree merchant whitelist.'
  );
}

export function friendlyPaymentError(err, fallback = 'Could not open payment') {
  if (isInstallSourceError(err)) return installSourceFriendlyMessage();
  return err?.message || fallback;
}

// Friendly, actionable decline + retry message for a FAILED payment.
// Web parity: prod-alphaquark-github utils/paymentErrorHandler.js
// describeCashfreeDecline (2026-07-17). The native CF SDK's onError gives
// {code,type,message} (not the REST payment_group/error_details), so this
// maps from the SDK error object. Returns { title, message } for Alert.
// Rationale: bank declines are usually issuer-side and clear on a
// different method/app or after checking limits — but the app previously
// showed only a generic "Payment Failed", so customers just re-tried the
// same method blindly (marketanalysis: one user, 8 UPI declines).
export function describeCashfreeDecline(err) {
  if (isInstallSourceError(err)) {
    return {title: 'Payment unavailable', message: installSourceFriendlyMessage()};
  }
  const raw = String(err?.message || err?.getMessage?.() || '').trim();
  const code = String(err?.code || err?.getCode?.() || '').toUpperCase();
  const lower = raw.toLowerCase();
  const isCancel =
    code.includes('CANCEL') ||
    lower.includes('cancel') ||
    lower.includes('user dropped') ||
    lower.includes('user_dropped');
  if (isCancel) {
    return {
      title: 'Payment cancelled',
      message:
        'Looks like the payment was cancelled — no money was deducted. ' +
        'You can try again with UPI, a card, or netbanking.',
    };
  }
  let message = 'Your payment couldn’t be completed';
  if (raw && raw.length < 140) message += `: ${raw}`;
  message +=
    '. This is usually a block by your bank, not an issue on our side — ' +
    'please try a different method (a card, netbanking, or another UPI app), ' +
    'or check your balance / daily transaction limit and try again. ' +
    'No money has been deducted.';
  return {title: 'Payment could not be completed', message};
}

// Same job as describeCashfreeDecline, but for a STORED payment record rather
// than a live SDK error object.
//
// The pending-payment recovery check (PendingPaymentManager) runs on every
// modal open and every app foreground resume, long after the SDK error object
// is gone. It only has the payment row fetched back from Cashfree. It used to
// render a flat "Payment was not successful. Please try again." with no cause,
// which is the same dead end describeCashfreeDecline was written to fix — a
// customer told only "failed" just retries the identical method (marketanalysis:
// one user, 8 consecutive UPI declines).
//
// @param {object} payment a Cashfree payment row (payment_status + whatever
//        message/error fields that gateway version supplies)
// @returns {{title: string, message: string}}
export function describeStoredPaymentFailure(payment) {
  const status = String(payment?.payment_status || '').toUpperCase();
  // Cashfree has moved these around across versions; check the known spellings
  // rather than assuming one shape.
  const raw = String(
    payment?.payment_message ||
      payment?.error_details?.error_description ||
      payment?.error_description ||
      payment?.failure_reason ||
      '',
  ).trim();

  if (status === 'USER_DROPPED' || status === 'CANCELLED') {
    return {
      title: 'Payment cancelled',
      message:
        'Your last payment was cancelled — no money was deducted. ' +
        'You can try again with UPI, a card, or netbanking.',
    };
  }

  let message = 'Your last payment didn’t go through';
  if (raw && raw.length < 140) message += `: ${raw}`;
  message +=
    '. This is usually a block by your bank, not an issue on our side — ' +
    'try a different method (a card, netbanking, or another UPI app), or ' +
    'check your balance / daily limit. No money has been deducted.';
  return {title: 'Payment could not be completed', message};
}
