/**
 * useKitePublisherPolling
 *
 * Client-side order-book polling fallback for the Zerodha Kite Publisher
 * WebView flow. Mirrors the legacy inline implementation that lived in
 * `RebalanceModal.js:148-217` before 2026-05-12; this hook is the
 * canonical home for the pattern so any modal that hosts a Kite
 * Publisher WebView (RebalanceModal, MPReviewTradeModal, StockAdvices
 * via ZerodhaReviewModal, etc.) can share the implementation.
 *
 * Why this exists (per docs/REBALANCING.md § Kite Publisher polling
 * fallback): Kite Publisher submits the basket form inside a WebView and
 * relies on a redirect intercept to signal success back to the app. The
 * intercept can fail silently in three scenarios — cross-domain 302 loss
 * on some Android WebView versions, the OS suspending the WebView when
 * the user backgrounds to complete authentication in the Kite app, and
 * AsyncStorage hydration races where the callback fires before
 * `zerodhaStockDetails` is in state. When the intercept misses, the user
 * is left on a loading spinner with no status. This hook is layer 1 of
 * the two-layer recovery (layer 2 is the server-side
 * `add-user/status-check-queue`).
 *
 * Pattern:
 *
 *   1. Consumer calls `start()` AFTER opening the WebView. The hook
 *      captures a baseline of the broker's order book (the set of
 *      orderIds present BEFORE the user places anything).
 *   2. Every POLL_INTERVAL_MS, the hook re-fetches the order book and
 *      diffs against the baseline. Any new order IDs are by definition
 *      orders the user just placed via Kite Publisher.
 *   3. When new orders are detected (or POLL_TIMEOUT_MS expires), the
 *      hook calls `onPublisherSettled({ reason, newOrders })` and stops.
 *      The consumer drives the same state transition it would have
 *      driven from the WebView callback (`setZerodhaStatus('success')`,
 *      etc.) — single code path for both success channels.
 *
 * Double-fire protection: the hook's internal `processed` flag guards
 * against the race where the WebView callback fires AT THE SAME TIME as
 * polling detects new orders. Whichever wins first sets the flag and the
 * other path short-circuits. Consumers MUST call `stop()` from their
 * WebView callback handler (or from the downstream useEffect that runs
 * when state transitions to "success") so the polling timer is cleared
 * before the next render cycle. `stop()` is idempotent.
 *
 * Cleanup: `useEffect`'s unmount cleanup automatically calls `stop()`
 * so timers don't leak past modal close.
 *
 * Config: poll interval (5000ms) and timeout (90000ms) are sourced from
 * `PUBLISHER_POLL_CONFIG` in `src/utils/brokerPublisher.js` — single
 * source of truth across consumers.
 */

import { useCallback, useEffect, useRef } from 'react';
import { PUBLISHER_POLL_CONFIG } from '../utils/brokerPublisher';

const { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } = PUBLISHER_POLL_CONFIG;

/**
 * @param {Object}   opts
 * @param {string}   opts.broker             — broker name (typically "Zerodha")
 * @param {Object}   opts.brokerCreds        — { clientCode, apiKey, jwtToken, secretKey, sid, serverId }
 * @param {Object}   opts.configData         — full ConfigContext payload (passed through to fetchOrderBook)
 * @param {Function} opts.onPublisherSettled — callback fired once when polling detects new orders OR timeout expires.
 *                                             Receives `{ reason: 'orders-detected' | 'timeout', newOrders: any[] }`.
 *                                             Consumer should drive the same state transition as the WebView callback.
 * @returns {{ start: Function, stop: Function }}
 */
export default function useKitePublisherPolling({
  broker,
  brokerCreds,
  configData,
  onPublisherSettled,
}) {
  const processedRef = useRef(false);
  const baselineOrderIdsRef = useRef(new Set());
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);

  // Keep the latest callback in a ref so timers always invoke the
  // current closure, not a stale one captured at start() time.
  const onSettledRef = useRef(onPublisherSettled);
  onSettledRef.current = onPublisherSettled;

  // Same for credential bundle — broker session can rotate while the
  // WebView is open (rare, but possible on long-running flows).
  const brokerCredsRef = useRef(brokerCreds);
  brokerCredsRef.current = brokerCreds;

  const configDataRef = useRef(configData);
  configDataRef.current = configData;

  const brokerRef = useRef(broker);
  brokerRef.current = broker;

  const stop = useCallback(() => {
    processedRef.current = true;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    // Idempotent on consecutive calls — clear any stale timers + reset
    // the processed flag so a re-opened modal gets a clean slate.
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    pollingIntervalRef.current = null;
    pollingTimeoutRef.current = null;
    processedRef.current = false;

    // Capture baseline order IDs BEFORE the user places anything via the
    // Kite Publisher WebView. Any orderId that appears in a later poll
    // and is NOT in this baseline is, by definition, a publisher-placed
    // order. Lazy-require the API module so consumers that don't open
    // the WebView path don't pay the import cost on first mount.
    try {
      // eslint-disable-next-line global-require
      const { fetchOrderBook } = require('../services/BrokerOrderBookAPI');
      const baseline = await fetchOrderBook(
        brokerRef.current,
        brokerCredsRef.current,
        configDataRef.current,
      );
      const orders = baseline?.data || baseline || [];
      baselineOrderIdsRef.current = new Set(
        (Array.isArray(orders) ? orders : [])
          .map(o => o.orderId || o.order_id)
          .filter(Boolean),
      );
    } catch (err) {
      // Non-fatal — proceed with empty baseline. Worst case: every
      // order in the order book appears "new" on the first poll and we
      // settle immediately. Acceptable degradation vs. abandoning the
      // user on a loading spinner.
      console.warn('[Publisher Polling] Failed to fetch baseline orders:', err?.message || err);
      baselineOrderIdsRef.current = new Set();
    }

    pollingIntervalRef.current = setInterval(async () => {
      if (processedRef.current) {
        stop();
        return;
      }
      try {
        // eslint-disable-next-line global-require
        const { fetchOrderBook } = require('../services/BrokerOrderBookAPI');
        const current = await fetchOrderBook(
          brokerRef.current,
          brokerCredsRef.current,
          configDataRef.current,
        );
        const currentOrders = current?.data || current || [];
        const newOrders = (Array.isArray(currentOrders) ? currentOrders : []).filter(o => {
          const id = o.orderId || o.order_id;
          return id && !baselineOrderIdsRef.current.has(id);
        });

        if (newOrders.length > 0 && !processedRef.current) {
          console.log(`[Publisher Polling] Detected ${newOrders.length} new orders — settling.`);
          processedRef.current = true;
          stop();
          onSettledRef.current?.({ reason: 'orders-detected', newOrders });
        }
      } catch {
        // Polling errors are non-fatal — next tick will retry.
      }
    }, POLL_INTERVAL_MS);

    pollingTimeoutRef.current = setTimeout(() => {
      if (!processedRef.current) {
        console.warn('[Publisher Polling] Timed out after', POLL_TIMEOUT_MS, 'ms — settling.');
        processedRef.current = true;
        stop();
        onSettledRef.current?.({ reason: 'timeout', newOrders: [] });
      }
    }, POLL_TIMEOUT_MS);
  }, [stop]);

  // Cleanup on unmount — any active interval/timeout must be cleared so
  // we don't continue polling after the host modal goes away.
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop };
}
