/**
 * useSdkClient — safe hook that returns the SDK client when inside
 * <AqSdkProvider> and the user is bound, or null otherwise.
 *
 * Wraps useAqSdk() in a try/catch so callers don't crash when the
 * SDK provider isn't in the tree (REACT_APP_SDK_INTEGRATION=false).
 */
import {useRef} from 'react';

let useAqSdk = null;
try {
  useAqSdk = require('@alphaquark/mobile-sdk').useAqSdk;
} catch {
  // SDK not installed
}

export default function useSdkClient() {
  const cachedRef = useRef(null);
  if (!useAqSdk) return null;
  try {
    const ctx = useAqSdk();
    cachedRef.current = ctx?.client || null;
  } catch {
    cachedRef.current = null;
  }
  return cachedRef.current;
}
