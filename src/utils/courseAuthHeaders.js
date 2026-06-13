/**
 * courseAuthHeaders — header helpers for /api/livekit/* and /api/gumlet/*.
 *
 * Public surface (webinar discovery + detail + purchase) needs only the
 * standard header pair. Auth-gated surface (viewer token, host token,
 * playback token, admin endpoints) additionally needs a Firebase ID-token
 * Bearer.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §3.1.
 */

import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import { getAdvisorSubdomain } from './variantHelper';
import { generateToken } from './SecurityTokenManager';

export function getPublicHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };
}

export async function getAuthedHeaders() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Sign-in required');
  const idToken = await user.getIdToken(false);
  return {
    ...getPublicHeaders(),
    Authorization: `Bearer ${idToken}`,
  };
}

// Soft-auth variant — attaches a Firebase Bearer when the caller is
// signed in, falls through to the public header pair otherwise. Used by
// /webinars/:lessonId/purchase and /webinars/purchase-status/:orderId,
// which require Bearer + caller.email == body.userEmail as of backend
// commit c8512b9 (2026-05-30).
export async function getOptionalAuthHeaders() {
  const headers = getPublicHeaders();
  try {
    const user = getAuth().currentUser;
    if (user) {
      const idToken = await user.getIdToken(false);
      headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (_) { /* anonymous fallback */ }
  return headers;
}
