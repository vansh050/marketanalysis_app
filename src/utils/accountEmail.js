/**
 * accountEmail — THE single source of truth for "who is the signed-in user".
 *
 * WHY THIS EXISTS
 * ---------------
 * With Apple "Hide My Email", Firebase's `auth().currentUser.email` is null
 * or a `@privaterelay.appleid.com` alias for the LIFE of the Firebase user,
 * while every backend record (users, clientlistdatas, subscriptions, plans,
 * model portfolios, FCM tokens) is keyed by the REAL email the user typed on
 * EmailScreenAppleLogin. Any code that reads `currentUser.email` directly
 * therefore sees `null` for Apple users and silently fetches nothing.
 *
 * The 2026-07-20 fix (d9dd8f78) solved this inside TradeContext only — the
 * resolver was module-private and never exported, so ~60 other screens kept
 * reading Firebase directly (empty Plans tab, "Hello, Apple User", no push
 * notifications, broker modals posting a null email). This module is the
 * shared replacement.
 *
 * USAGE — replace every occurrence of this pattern:
 *
 *     const user = auth.currentUser;
 *     const userEmail = user?.email ? user.email.toLowerCase() : user?.email;
 *
 * with:
 *
 *     import {getAccountEmail} from '../utils/accountEmail';
 *     const userEmail = getAccountEmail();
 *
 * `getAccountEmail()` is SYNCHRONOUS so it drops into render bodies and
 * effect gates unchanged. It reads an in-memory cache primed at module load
 * and refreshed on every sign-in, so it is correct by the time any
 * post-login screen mounts. On a cold start before the cache primes it can
 * briefly return null — for code paths that run at app boot (splash /
 * routing), await `getAccountEmailAsync()` instead.
 *
 * PRECEDENCE: a usable Firebase email wins (Google/password users), then the
 * typed account email. A relay alias is NEVER usable — it matches no backend
 * record.
 */

import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import eventEmitter from '../components/EventEmitter';

export const ACCOUNT_EMAIL_KEY = 'aq_account_email';
export const ACCOUNT_EMAIL_EVENT = 'aq:accountEmailResolved';

const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

// In-memory mirror of the stored account email, so callers get a value
// without awaiting AsyncStorage on every render.
let _cachedAccountEmail = null;
let _primed = false;

/**
 * The literal name Apple sign-in used to fall back to. It was written onto
 * the Firebase profile AND persisted server-side as the account name, so it
 * has to be recognised (and refused) wherever a name is chosen or rendered.
 */
export const isPlaceholderName = name =>
  !name || String(name).trim().toLowerCase() === 'apple user';

/** A Firebase email is only usable when it exists and isn't an Apple alias. */
export const isUsableEmail = email => {
  const e = (email || '').trim().toLowerCase();
  return !!e && !e.endsWith(APPLE_RELAY_SUFFIX);
};

/** Read the persisted typed identity, refreshing the in-memory cache. */
export const primeAccountEmail = async () => {
  try {
    const v = await AsyncStorage.getItem(ACCOUNT_EMAIL_KEY);
    _cachedAccountEmail = v ? v.trim().toLowerCase() : null;
  } catch {
    // Keep whatever we had; a storage failure must never blank an identity.
  }
  _primed = true;
  return _cachedAccountEmail;
};

/** Persist the typed identity and broadcast it to already-mounted screens. */
export const setAccountEmail = async email => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  _cachedAccountEmail = normalized;
  _primed = true;
  try {
    await AsyncStorage.setItem(ACCOUNT_EMAIL_KEY, normalized);
  } catch {
    // Cache still holds it for this session.
  }
  try {
    eventEmitter.emit(ACCOUNT_EMAIL_EVENT, normalized);
  } catch {}
  return normalized;
};

/** Clear on logout / account deletion. */
export const clearAccountEmail = async () => {
  _cachedAccountEmail = null;
  try {
    await AsyncStorage.removeItem(ACCOUNT_EMAIL_KEY);
  } catch {}
};

/**
 * The account email, synchronously. Firebase first, typed identity second.
 * Returns null when nobody is signed in (or before the cold-start prime).
 */
export const getAccountEmail = () => {
  let firebaseEmail = null;
  try {
    firebaseEmail = auth().currentUser?.email || null;
  } catch {
    // auth() can throw before Firebase initialises; fall through to cache.
  }
  if (isUsableEmail(firebaseEmail)) return firebaseEmail.trim().toLowerCase();
  return _cachedAccountEmail;
};

/**
 * Same precedence, but guarantees the stored identity has been read at
 * least once. Use at app boot (splash, routing gates, background tasks)
 * where the in-memory cache may not be primed yet.
 */
export const getAccountEmailAsync = async () => {
  let firebaseEmail = null;
  try {
    firebaseEmail = auth().currentUser?.email || null;
  } catch {}
  if (isUsableEmail(firebaseEmail)) return firebaseEmail.trim().toLowerCase();
  if (!_primed) await primeAccountEmail();
  return _cachedAccountEmail;
};

/**
 * Display name that never renders the "Apple User" placeholder when a real
 * identity exists. Pass whatever the caller already has.
 */
export const getAccountDisplayName = (userDetailsName, firebaseDisplayName) => {
  if (!isPlaceholderName(userDetailsName)) return userDetailsName;
  if (!isPlaceholderName(firebaseDisplayName)) return firebaseDisplayName;
  const email = getAccountEmail();
  if (email) return email.split('@')[0];
  return '';
};

/**
 * Reactive form of getAccountEmail() for screens whose fetch effects gate on
 * the email. A screen can mount BEFORE the identity is known (cold start, or
 * an Apple sign-in where the auth listener fires before the email screen is
 * submitted) — a plain synchronous read would capture null and never
 * re-render, which is exactly how the Plans tab stayed empty. This hook
 * re-renders when the identity resolves or the Firebase user changes.
 */
export const useAccountEmail = () => {
  const [email, setEmail] = useState(() => getAccountEmail());

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const next = getAccountEmail();
      setEmail(prev => (prev === next ? prev : next));
    };

    // Cold start: the stored identity may not be primed yet.
    getAccountEmailAsync().then(sync).catch(() => {});

    const onResolved = () => sync();
    try {
      eventEmitter.on(ACCOUNT_EMAIL_EVENT, onResolved);
    } catch {}

    let unsubscribeAuth = () => {};
    try {
      unsubscribeAuth = auth().onAuthStateChanged(sync);
    } catch {}

    return () => {
      cancelled = true;
      try {
        eventEmitter.off(ACCOUNT_EMAIL_EVENT, onResolved);
      } catch {}
      try {
        unsubscribeAuth();
      } catch {}
    };
  }, []);

  return email;
};

// Prime as early as the module is first imported.
primeAccountEmail();

// Keep the cache honest when another surface resolves the identity.
try {
  eventEmitter.on(ACCOUNT_EMAIL_EVENT, email => {
    const normalized = (email || '').trim().toLowerCase();
    if (normalized) {
      _cachedAccountEmail = normalized;
      _primed = true;
    }
  });
} catch {}

export default getAccountEmail;
