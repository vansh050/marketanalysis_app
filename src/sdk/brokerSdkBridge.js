/**
 * brokerSdkBridge — gated wrappers that route legacy broker connect
 * persistence through the SDK data plane when REACT_APP_SDK_INTEGRATION
 * is on. Imported by the pilot 4 broker connect modals (Zerodha,
 * Kotak, Angel One, AliceBlue) so QA can flip the flag and exercise
 * the SDK routes (/sdk/v1/connections/:broker/{connect,update-credentials,exchange-token})
 * without changing the visible UX.
 *
 * Why a bridge module instead of replacing the legacy axios calls
 * outright:
 *   - Legacy /api/* routes still serve the production app on
 *     advisors that haven't enabled the SDK flag yet. Removing them
 *     prematurely breaks every non-pilot tenant.
 *   - The SDK client requires a session token (mintSession + setUser)
 *     which the legacy flow doesn't have. We need to verify
 *     `ready === true` before dispatching to SDK; if the SDK isn't
 *     ready (e.g. token mint failed, user not logged in) we fall back
 *     to legacy so the connect doesn't fail.
 *   - This gives us per-broker gating: each pilot modal calls the
 *     bridge with `tryDualWrite: true` (do legacy, then SDK as a
 *     verification post) until we're confident, then flips to
 *     `preferSdk: true` (SDK first, legacy as fallback). No flag day.
 *
 * Usage from a legacy modal:
 *   import {sdkConnectBroker, sdkUpdateBrokerCredentials,
 *           sdkExchangeBrokerToken, useSdkBridgeReady} from '../../sdk/brokerSdkBridge';
 *
 *   const sdkReady = useSdkBridgeReady();
 *   // After legacy axios put /api/user/connect-broker succeeds:
 *   if (sdkReady) {
 *     await sdkConnectBroker(client, 'Kotak', body)
 *       .catch(e => console.warn('[sdk-bridge] dual-write failed:', e));
 *   }
 */
import {useAqSdk} from '@alphaquark/mobile-sdk';
import {isSdkIntegrationEnabled} from './SdkProviderRoot';

/**
 * Hook for legacy modals to know if SDK is wired and ready. Returns
 * {client, ready, enabled}; consumers should `if (enabled && ready)`
 * before calling the SDK functions below.
 *
 * Safe to call even when isSdkIntegrationEnabled() is false because
 * AqSdkProvider is only mounted when the flag is on; the catch
 * handles the case where useAqSdk throws.
 */
export function useSdkBridge() {
  const enabled = isSdkIntegrationEnabled();
  if (!enabled) {
    return {enabled: false, ready: false, client: null, userRef: null};
  }
  try {
    const ctx = useAqSdk();
    return {
      enabled: true,
      ready: ctx.ready,
      client: ctx.client,
      userRef: ctx.userRef,
    };
  } catch (e) {
    // Provider not mounted — flag was on but tree unwrapped. Treat
    // same as disabled so legacy flow continues unaffected.
    return {enabled: false, ready: false, client: null, userRef: null};
  }
}

/**
 * Send credentials through the SDK's update-credentials route.
 * Backend dispatches to /api/:broker/update-key under the hood —
 * same upstream as the legacy /api/user/connect-broker preflight,
 * but session-token authenticated and per-tenant scoped.
 *
 * @returns Promise that resolves with the SDK response, or rejects
 * with SdkRequestError. Caller decides whether to swallow or surface.
 */
export async function sdkUpdateBrokerCredentials(client, broker, body) {
  if (!client) throw new Error('sdk-bridge: client missing');
  return client.updateBrokerCredentials(broker, body);
}

/**
 * PUT /sdk/v1/connections/:broker/connect — persist credentials
 * directly. Used for brokers without a separate /update-key step
 * (Angel One, AliceBlue, Dhan, Groww, Fyers, Motilal).
 */
export async function sdkConnectBroker(client, broker, body) {
  if (!client) throw new Error('sdk-bridge: client missing');
  return client.connectBroker(broker, body);
}

/**
 * POST /sdk/v1/connections/:broker/exchange-token — finishes an
 * OAuth round-trip after the WebView captures the redirect. The body
 * carries broker-specific keys (Zerodha: requestToken+apiKey;
 * AliceBlue: authCode+apiKey; Upstox: code; Fyers: auth_code).
 */
export async function sdkExchangeBrokerToken(client, broker, body) {
  if (!client) throw new Error('sdk-bridge: client missing');
  return client.exchangeBrokerToken(broker, body);
}

/**
 * Convenience: wrap an SDK call so its failure never breaks the
 * caller's legacy flow. Logs to console.warn so QA can grep
 * `[sdk-bridge]` in logcat to see real-world parity with legacy.
 */
export async function sdkDualWriteSafely(promise, broker, op) {
  try {
    const r = await promise;
    console.log(`[sdk-bridge] ${op} ${broker} OK`, r);
    return r;
  } catch (e) {
    console.warn(`[sdk-bridge] ${op} ${broker} FAILED:`, e?.message || e);
    return null;
  }
}
