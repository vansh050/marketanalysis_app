/**
 * AppleEmailVerifyService — prove the user owns the email they typed.
 *
 * Apple "Hide My Email" leaves Firebase without a usable address, so we ask
 * the user for the email their account lives under. That typed value used to
 * be trusted verbatim — meaning anyone could sign in with Apple, type someone
 * else's address and have the app render THAT person's account (the customer
 * data routes are gated only by the shared static key every install carries).
 *
 * These two calls close that: the backend mails a one-time code, and on a
 * correct code it binds the address to the Firebase user
 * (`updateUser(uid, {email, emailVerified:true})`). Afterwards
 * `currentUser.email` is authoritative again for that account.
 *
 * Auth: the caller's OWN Firebase ID token. The backend derives the uid from
 * that verified token and ignores any uid in the body, so a caller can only
 * bind an email onto their own account.
 */

import axios from 'axios';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import server from '../utils/serverConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../utils/variantHelper';

const NODE_BASE = server.server.baseUrl;

/** Headers: platform key + the per-user Firebase ID token the backend verifies. */
const authHeaders = async () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error('not_signed_in');
  // force=false — a cached token is fine, the backend allows normal clock skew.
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
    Authorization: `Bearer ${idToken}`,
  };
};

/**
 * Ask the backend to mail a code to `email`.
 * Resolves { ok: true, ttlMs } or { ok: false, error, retryAfterMs }.
 * Never throws for expected refusals — the screen renders them as messages.
 */
export const requestEmailOtp = async (email) => {
  try {
    const res = await axios.post(
      `${NODE_BASE}api/auth/apple/request-email-otp`,
      { email: String(email || '').trim().toLowerCase() },
      { headers: await authHeaders(), timeout: 20000 },
    );
    return { ok: true, ttlMs: res.data?.ttlMs };
  } catch (e) {
    const body = e?.response?.data || {};
    return {
      ok: false,
      error: body.error || e?.message || 'request_failed',
      retryAfterMs: body.retryAfterMs,
    };
  }
};

/**
 * Submit the code. On success the email is bound to the Firebase user.
 * Resolves { ok: true } or { ok: false, error, remainingAttempts }.
 */
export const verifyEmailOtp = async (email, otp) => {
  try {
    const res = await axios.post(
      `${NODE_BASE}api/auth/apple/verify-email-otp`,
      {
        email: String(email || '').trim().toLowerCase(),
        otp: String(otp || '').trim(),
      },
      { headers: await authHeaders(), timeout: 20000 },
    );
    // The Firebase user now carries the verified email; refresh the local
    // token/user so currentUser.email reflects it without a re-login.
    try {
      const user = getAuth().currentUser;
      if (user) {
        await user.reload();
        await user.getIdToken(true);
      }
    } catch (_) {
      // Non-fatal: the binding succeeded server-side regardless.
    }
    // `relinked` means the backend merged this throwaway Apple user into the
    // account that already owned the email — the local session now points at
    // a DELETED uid, so the caller must sign out and re-run Apple sign-in.
    return {
      ok: true,
      relinked: !!res?.data?.relinked,
      reauthRequired: !!res?.data?.reauthRequired,
    };
  } catch (e) {
    const body = e?.response?.data || {};
    return {
      ok: false,
      error: body.error || e?.message || 'verify_failed',
      remainingAttempts: body.remainingAttempts,
    };
  }
};

/** User-facing copy for every error the backend can return. */
export const messageForError = (error, extra = {}) => {
  switch (error) {
    case 'invalid_email':
      return 'That email address doesn\'t look right.';
    case 'relay_email_not_allowed':
      return 'Please enter your own email address, not a private-relay one.';
    case 'resend_too_soon':
      return `Please wait ${Math.ceil((extra.retryAfterMs || 60000) / 1000)}s before requesting another code.`;
    case 'too_many_requests':
      return 'Too many codes requested. Please try again later.';
    case 'otp_send_failed':
      return 'We couldn\'t send the code right now. Please try again.';
    case 'invalid_otp':
      return typeof extra.remainingAttempts === 'number'
        ? `Incorrect code. ${extra.remainingAttempts} attempt${extra.remainingAttempts === 1 ? '' : 's'} left.`
        : 'Incorrect code.';
    case 'too_many_attempts':
      return 'Too many incorrect attempts. Request a new code.';
    case 'expired':
      return 'That code has expired. Request a new one.';
    case 'already_used':
      return 'That code was already used. Request a new one.';
    case 'email_belongs_to_another_account':
      return 'That email is already registered to another account. Sign in with that account instead.';
    case 'not_signed_in':
      return 'Please sign in again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export default { requestEmailOtp, verifyEmailOtp, messageForError };
