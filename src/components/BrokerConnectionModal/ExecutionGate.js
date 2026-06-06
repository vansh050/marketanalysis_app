/**
 * ExecutionGate — RN port of `tidi_new/lib/widgets/ExecutionGate.dart`.
 *
 * Shared "Session Expired" gate for broker-trade entry points. Wraps a
 * tap-target (e.g. "Place Order" / "Trade Now" / "Execute") in a
 * Pressable that runs the SDK `evaluateSessionGate` probe + reconnect
 * dialog inline, firing `onProceed(broker)` exactly once when the gate
 * passes. Consolidates the previously-duplicated pre-trade probe code
 * paths (StockAdvices / RebalanceCard / RebalanceAdvices) behind a
 * single composable widget.
 *
 * Status (2026-04-30): GREENFIELD — the component is shipped as a
 * library primitive but no existing entry points have been migrated
 * yet. RN parity ships first; per-screen migrations land separately
 * after the SDK gains the helpers enumerated in
 * `../../alphaquark-mobile-sdk/docs/EXECUTION_GATE_COMPOSITION.md`
 * (broker-mismatch, EDIS detection, Dummy confirmation). Existing
 * entry points must NOT be migrated to ExecutionGate until those
 * helpers exist — otherwise we'd lose surface area that today lives
 * inline in each entry point.
 *
 * Lifecycle (per tap):
 *   1. Run `evaluateSessionGate` — drops the consumer's
 *      useRefreshBrokerStatus cache (via the cacheInvalidator hook)
 *      and re-fetches user status via the SDK client.
 *   2. On `ok` → fire `onProceed(broker)` once and return.
 *   3. On `transient` → orange Toast, return without firing.
 *   4. On `tokenExpired` / `notConnected` → show the reconnect alert.
 *      User accepts → open BrokerConnectModalDispatch for the
 *      resolved broker (which routes SDK or legacy via the existing
 *      `REACT_APP_USE_SDK_BROKER_FLOW` flag — we DO NOT bypass the
 *      dispatch).
 *   5. After successful reconnect → re-evaluate. If `ok`, fire
 *      `onProceed`; otherwise re-show the dialog or surface an error
 *      and call `onCancel`.
 *   6. On `probeFailed` → log + proceed (don't block on probe
 *      ambiguity — same as tidi). Network blips shouldn't gate trades.
 *
 * The `onProceed` callback fires AT MOST ONCE per tap. Transient
 * failures, user-cancelled reconnects, and probe errors do not fire it.
 *
 * If `initialBroker` is supplied AND it's effectively connected
 * (brokerStatus === 'connected', non-DummyBroker), the gate
 * short-circuits the network probe and calls `onProceed(initialBroker)`
 * directly. Mirrors tidi's "skip if cached and effectively connected"
 * pattern.
 *
 * Composition contract (read this before adding pre-execution logic):
 *
 * ExecutionGate is ONE LAYER in the order-placement chain. It handles
 * session probe + reconnect + post-reconnect refetch — that's it.
 * Other concerns (broker-mismatch dialog, DummyBroker confirmation,
 * EDIS retry, funds check) belong in OTHER layers. Do NOT extend this
 * component to cover them; instead chain them at the entry point:
 *
 *   const onTap = async () => {
 *     if (!await checkBrokerMismatch()) return;       // layer 1
 *     if (!await confirmDummyBroker()) return;        // layer 2
 *     // ExecutionGate handles layer 3 (session + reconnect)
 *   };
 *   <ExecutionGate ... onProceed={broker => placeOrders(broker)}>
 *
 * See `alphaquark-mobile-sdk/docs/EXECUTION_GATE_COMPOSITION.md` for
 * the full composition design + the SDK helpers proposed for layers
 * 1, 2, and 4 (EDIS retry).
 *
 * Cross-references:
 *   - `@alphaquark/mobile-sdk` `evaluateSessionGate` — the underlying
 *      stateless logic. See packages/rn/src/session/sessionGate.ts.
 *   - `BrokerConnectModalDispatch` — flag-aware reconnect dispatcher
 *      we delegate to (so SDK/legacy routing stays a single switch).
 *   - `useRefreshBrokerStatus` — consumer-side cache the gate drops
 *      via cacheInvalidator (mirror of tidi's
 *      AqApiService.invalidateUserCache + CacheService.invalidate).
 *   - `validateBrokerSession` (`utils/brokerSessionValidator.js`) —
 *      the existing typed live probe; bridged in as the gate's
 *      livenessProbe so we don't double-probe (Funds API is the
 *      authoritative check both legacy and SDK already use).
 *   - tidi_new `lib/widgets/ExecutionGate.dart` — Flutter mirror.
 */

import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {evaluateSessionGate, useAqSdk} from '@alphaquark/mobile-sdk';
import {AlertCircle} from 'lucide-react-native';

import {useTrade} from '../../screens/TradeContext';
import useRefreshBrokerStatus from '../../hooks/useRefreshBrokerStatus';
import {validateBrokerSession} from '../../utils/brokerSessionValidator';
import BrokerConnectModalDispatch from './BrokerConnectModalDispatch';

const isEffectivelyConnected = broker => {
  if (!broker) {return false;}
  const name = typeof broker === 'string' ? broker : broker.broker || broker.name;
  return Boolean(name) && name !== 'DummyBroker';
};

const brokerLabel = broker => {
  if (!broker) {return 'broker';}
  if (typeof broker === 'string') {return broker;}
  return broker.broker || broker.name || 'broker';
};

/**
 * Shared "Session Expired" gate.
 *
 * @param {object} props
 * @param {string} props.email — user email, required for SDK calls.
 * @param {string|object} [props.initialBroker] — pre-resolved broker
 *   hint. When effectively connected, gate short-circuits the network
 *   probe.
 * @param {(broker: object) => void} props.onProceed — fired exactly
 *   once with the resolved BrokerConnection on a successful gate.
 * @param {() => void} [props.onCancel] — fired when user cancels the
 *   reconnect dialog or probeFailed/transient terminate the flow.
 * @param {React.ReactNode} props.children — tap-target. Should NOT
 *   carry its own onPress; the gate intercepts taps via a wrapping
 *   Pressable. While busy, the children are dimmed and a spinner
 *   overlays them.
 * @param {boolean} [props.disabled] — passes through to the wrapping
 *   Pressable.
 */
const ExecutionGate = ({
  email,
  initialBroker,
  onProceed,
  onCancel,
  children,
  disabled = false,
}) => {
  const sdk = useAqSdk();
  const {brokerStatus, broker: ctxBroker, userDetails} = useTrade();
  const refreshBrokerStatus = useRefreshBrokerStatus(email);

  const [busy, setBusy] = useState(false);
  const [reconnect, setReconnect] = useState(null); // {brokerName, resolved} | null
  const [reconnectBrokerName, setReconnectBrokerName] = useState(null);
  // Inline-rendered dispatcher so the gate doesn't depend on the global
  // Zustand modal store — works the same whether or not ModalManager
  // is mounted under us.
  const [dispatchOpen, setDispatchOpen] = useState(null); // {brokerName, onClose}|null
  const reconnectResolveRef = useRef(null);

  // Drop the consumer's HTTP caches so the SDK's getUserStatus call
  // and any downstream refresh both read fresh server state. Mirrors
  // step 1 + 2 of tidi's post-reconnect state-refresh contract
  // (`docs/BROKER_TRADING_ARCHITECTURE.md § 15`). On RN we don't have
  // a separate AqApiService cache layer; useRefreshBrokerStatus's
  // forceNetwork: true is the equivalent — we run it for its side
  // effect of pushing fresh user/funds into TradeContext.
  const invalidateCaches = useCallback(async () => {
    try {
      await refreshBrokerStatus({forceNetwork: true});
    } catch (e) {
      console.warn('[ExecutionGate] cache-refresh failed:', e?.message);
    }
  }, [refreshBrokerStatus]);

  // Bridge the consumer's typed validateBrokerSession into the SDK's
  // GateLivenessProbe shape. Funds-call is the authoritative liveness
  // probe both legacy and SDK already use; we deliberately reuse it
  // rather than introducing a second probe.
  const livenessProbe = useCallback(
    async sdkBroker => {
      const probe = await validateBrokerSession({
        broker: sdkBroker.broker,
        brokerStatus: 'connected',
        userDetails,
        userEmail: email,
      });
      let mapped;
      switch (probe.reason) {
        case 'OK':
          mapped = 'ok';
          break;
        case 'TRANSIENT':
          mapped = 'transient';
          break;
        case 'TOKEN_EXPIRED':
          mapped = 'tokenExpired';
          break;
        case 'NOT_CONNECTED':
          mapped = 'notConnected';
          break;
        case 'PROBE_FAILED':
        default:
          // probeFailed → caller proceeds; actual execution surfaces
          // any real issue. Same semantics as tidi.
          mapped = 'ok';
      }
      return {status: mapped, message: probe.message};
    },
    [email, userDetails],
  );

  const runGate = useCallback(
    async hint => {
      if (!sdk?.client) {
        // SDK not ready — fall back to "trust the cached state" path so
        // the tap doesn't dead-end on advisors that haven't enabled
        // REACT_APP_SDK_INTEGRATION yet. Caller's downstream execution
        // surfaces real failures.
        if (isEffectivelyConnected(ctxBroker) && brokerStatus === 'connected') {
          return {status: 'ok', broker: {broker: ctxBroker}};
        }
        return {
          status: 'probeFailed',
          message: 'SDK is not ready. Please reopen the app and try again.',
        };
      }
      return evaluateSessionGate({
        client: sdk.client,
        hint: hint || undefined,
        cacheInvalidator: invalidateCaches,
        livenessProbe,
      });
    },
    [sdk, ctxBroker, brokerStatus, invalidateCaches, livenessProbe],
  );

  const showReconnectDialog = useCallback(brokerName => {
    return new Promise(resolve => {
      reconnectResolveRef.current = resolve;
      setReconnectBrokerName(brokerName || 'broker');
      setReconnect({pending: true});
    });
  }, []);

  const closeReconnectDialog = useCallback(value => {
    const resolver = reconnectResolveRef.current;
    reconnectResolveRef.current = null;
    setReconnect(null);
    setReconnectBrokerName(null);
    if (resolver) {resolver(value);}
  }, []);

  const handleTap = useCallback(async () => {
    if (busy || disabled) {return;}
    setBusy(true);
    try {
      // Short-circuit when initialBroker is effectively connected and
      // the consumer's TradeContext agrees. Mirrors tidi's "skip if
      // cached and effectively connected" — the tap is fast, the
      // network probe runs only when state is uncertain.
      if (
        isEffectivelyConnected(initialBroker) &&
        brokerStatus === 'connected' &&
        ctxBroker &&
        brokerLabel(initialBroker) === ctxBroker
      ) {
        onProceed(initialBroker);
        return;
      }

      const hint = isEffectivelyConnected(initialBroker)
        ? brokerLabel(initialBroker)
        : null;

      let outcome = await runGate(hint);

      switch (outcome.status) {
        case 'ok':
          if (outcome.broker) {
            onProceed(outcome.broker);
          } else {
            onCancel?.();
          }
          return;
        case 'transient':
          Toast.show({
            type: 'info',
            text1: brokerLabel(outcome.broker),
            text2:
              outcome.message ||
              `${brokerLabel(outcome.broker)} is temporarily unavailable. Please try again in a few minutes.`,
            visibilityTime: 4000,
          });
          return;
        case 'probeFailed':
          // Soft error — let it through (network blips shouldn't gate
          // trades). The actual order-placement call will surface any
          // real issue. Same semantics as the tidi widget.
          if (outcome.broker) {
            onProceed(outcome.broker);
          } else {
            Toast.show({
              type: 'error',
              text1: 'Connection issue',
              text2: outcome.message || 'Could not reach AlphaQuark. Please try again.',
              visibilityTime: 4000,
            });
            onCancel?.();
          }
          return;
        case 'tokenExpired':
        case 'notConnected':
          break;
        default:
          onCancel?.();
          return;
      }

      // tokenExpired / notConnected → reconnect dialog.
      const targetBrokerName =
        brokerLabel(outcome.broker) ||
        brokerLabel(initialBroker) ||
        ctxBroker ||
        'broker';

      const accepted = await showReconnectDialog(targetBrokerName);
      if (!accepted) {
        onCancel?.();
        return;
      }

      // Open the dispatcher for the resolved broker. The dispatcher
      // already routes to SDK or legacy based on the flag — we
      // intentionally compose with it instead of reproducing the
      // routing here. The user reconnects in-place; on close,
      // fetchBrokerStatusModal() will have refreshed userDetails.
      // Wait for the modal close, then re-evaluate.
      await new Promise(resolveDispatch => {
        // Stash a one-shot close handler in state.
        setDispatchOpen({
          brokerName: targetBrokerName,
          onClose: () => {
            setDispatchOpen(null);
            resolveDispatch();
          },
        });
      });

      // Post-reconnect re-evaluation. evaluateSessionGate re-runs
      // cacheInvalidator (forceNetwork refresh) — fresh user/funds
      // get pulled into TradeContext. If reconnect succeeded, the
      // new outcome is `ok`.
      outcome = await runGate(null);
      if (outcome.status === 'ok' && outcome.broker) {
        onProceed(outcome.broker);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Reconnect incomplete',
          text2: outcome.message || 'Broker session is still not ready.',
          visibilityTime: 4000,
        });
        onCancel?.();
      }
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    disabled,
    initialBroker,
    brokerStatus,
    ctxBroker,
    runGate,
    onProceed,
    onCancel,
    showReconnectDialog,
  ]);

  return (
    <>
      <Pressable
        onPress={handleTap}
        disabled={busy || disabled}
        style={({pressed}) => [pressed && styles.pressed]}>
        <View style={[busy && styles.dimmed]}>{children}</View>
        {busy && (
          <View style={styles.spinnerOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#1F2937" />
          </View>
        )}
      </Pressable>

      {/* Reconnect dialog — same visual idiom as KotakModal/Phase3 */}
      <Modal
        visible={!!reconnect}
        transparent
        animationType="fade"
        onRequestClose={() => closeReconnectDialog(false)}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogBox}>
            <View style={styles.dialogHeader}>
              <AlertCircle size={22} color="#DC2626" />
              <Text style={styles.dialogTitle}>Session Expired</Text>
            </View>
            <Text style={styles.dialogMessage}>
              Your {reconnectBrokerName} session has expired. Please reconnect
              your broker to continue.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => closeReconnectDialog(false)}
                style={[styles.dialogBtn, styles.dialogBtnSecondary]}>
                <Text style={styles.dialogBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => closeReconnectDialog(true)}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}>
                <Text style={styles.dialogBtnPrimaryText}>Reconnect Broker</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Inline reconnect dispatcher — flag-aware via the existing
          BrokerConnectModalDispatch (no bypass). */}
      {dispatchOpen && (
        <BrokerConnectModalDispatch
          brokerName={dispatchOpen.brokerName}
          isVisible={true}
          onClose={dispatchOpen.onClose}
          setShowBrokerModal={() => {}}
          fetchBrokerStatusModal={async () => {
            // The dispatcher's child modal calls this on success.
            // We don't need to do anything here — the gate's
            // post-reconnect runGate() will pull fresh state via
            // forceNetwork refresh.
          }}
          reauthConfig={null}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  dimmed: {
    opacity: 0.6,
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  dialogMessage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dialogBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  dialogBtnSecondary: {
    backgroundColor: 'transparent',
  },
  dialogBtnSecondaryText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
  },
  dialogBtnPrimary: {
    backgroundColor: '#EA580C',
  },
  dialogBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
  },
});

export default ExecutionGate;
