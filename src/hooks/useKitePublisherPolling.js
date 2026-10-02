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
 *   3. When the new orders detected cover the whole basket (or
 *      POLL_TIMEOUT_MS expires), the hook calls
 *      `onPublisherSettled({ reason, newOrders })` and stops.
 *      Consumers MUST preserve `reason`: only `orders-detected` proves a
 *      polling success. A timeout means "unconfirmed" and may trigger one
 *      final server-side order-book check, but must never be promoted to
 *      publisher success.
 *
 * Whole-basket rule (2026-09-18, prod/arulthakur 7-leg basket cut to 2):
 * Kite places basket items one at a time, about a second apart. Every
 * consumer closes the WebView when this hook settles, so settling on the
 * FIRST new order tore down the Kite basket page while the remaining legs
 * were still queued there — they never reached Zerodha at all (no order,
 * not even a rejection). `start({ expectedOrderCount })` now tells the hook
 * how many legs the open basket carries; a poll that sees fewer new orders
 * than that is progress, not settlement, and polling continues. Kite's own
 * redirect (handled by the consumer's WebView navigation callback) remains
 * the authoritative "the basket page is done" signal for partial baskets,
 * with the timeout as the fallback. The timeout still carries whatever orders
 * the poll did see: the reason stays `timeout` (unconfirmed — only
 * `orders-detected` is promoted, see `resolvePublisherSettlement`), so a
 * genuinely partial basket is reported as unconfirmed rather than as nothing.
 * Without an expected count the hook keeps the legacy first-order behaviour.
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
 *                                             Only `orders-detected` is a success signal.
 * @returns {{ start: Function, stop: Function, getNewOrders: Function }}
 *
 * `start({ expectedOrderCount })` — number of basket legs the WebView is
 * about to submit. When > 0, polling settles on `orders-detected` only once
 * at least that many new orders are visible. Omit (or pass 0) to settle on
 * the first new order (legacy behaviour for callers that cannot count).
 */
export default function useKitePublisherPolling({
  broker,
  brokerCreds,
  configData,
  onPublisherSettled,
}) {
  const processedRef = useRef(false);
  const baselineOrderIdsRef = useRef(new Set());
  const baselineReadyRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const expectedOrderCountRef = useRef(0);
  const lastPartialCountRef = useRef(0);
  const detectedOrdersRef = useRef([]);

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

  // Read the orders created after the current basket's baseline without
  // consuming the publisher callback. The rebalance flow uses this after Kite
  // redirects so SELL detection cannot be mistaken for SELL completion.
  const getNewOrders = useCallback(async () => {
    if (!baselineReadyRef.current) return [];
    // eslint-disable-next-line global-require
    const { fetchOrderBook } = require('../services/BrokerOrderBookAPI');
    const current = await fetchOrderBook(
      brokerRef.current,
      brokerCredsRef.current,
      configDataRef.current,
    );
    const currentOrders = current?.data || current || [];
    if (!Array.isArray(currentOrders)) return [];
    return currentOrders.filter(order => {
      const id = order?.orderId || order?.order_id;
      return id && !baselineOrderIdsRef.current.has(id);
    });
  }, []);

  const start = useCallback(async ({ expectedOrderCount = 0 } = {}) => {
    // Idempotent on consecutive calls — clear any stale timers + reset
    // the processed flag so a re-opened modal gets a clean slate.
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    pollingIntervalRef.current = null;
    pollingTimeoutRef.current = null;
    processedRef.current = false;
    baselineReadyRef.current = false;
    const parsedExpected = Number(expectedOrderCount);
    expectedOrderCountRef.current =
      Number.isFinite(parsedExpected) && parsedExpected > 0
        ? Math.floor(parsedExpected)
        : 0;
    lastPartialCountRef.current = 0;
    detectedOrdersRef.current = [];

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
      baselineReadyRef.current = true;
    } catch (err) {
      // Do not treat an empty fallback baseline as authoritative. Otherwise
      // every historical order returned by the first successful poll looks
      // "new" and can create another false success. The first recovered poll
      // below establishes the baseline without settling.
      console.warn('[Publisher Polling] Failed to fetch baseline orders:', err?.message || err);
      baselineOrderIdsRef.current = new Set();
      baselineReadyRef.current = false;
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
        const normalizedOrders = Array.isArray(currentOrders)
          ? currentOrders
          : [];

        if (!baselineReadyRef.current) {
          baselineOrderIdsRef.current = new Set(
            normalizedOrders
              .map(o => o.orderId || o.order_id)
              .filter(Boolean),
          );
          baselineReadyRef.current = true;
          console.log(
            '[Publisher Polling] Recovered order-book baseline; waiting for subsequent orders.',
          );
          return;
        }
        const newOrders = normalizedOrders.filter(o => {
          const id = o.orderId || o.order_id;
          return id && !baselineOrderIdsRef.current.has(id);
        });

        if (newOrders.length === 0 || processedRef.current) return;

        // Keep the fullest detection so the timeout below can still report
        // what did reach the broker instead of discarding it.
        detectedOrdersRef.current = newOrders;

        const expected = expectedOrderCountRef.current;
        if (expected > 0 && newOrders.length < expected) {
          // Kite is still working through the basket. Closing the WebView
          // now would drop every leg it has not yet sent (see header).
          if (newOrders.length !== lastPartialCountRef.current) {
            lastPartialCountRef.current = newOrders.length;
            console.log(
              `[Publisher Polling] ${newOrders.length}/${expected} basket orders visible — basket still in progress, not settling.`,
            );
          }
          return;
        }

        console.log(`[Publisher Polling] Detected ${newOrders.length} new orders — settling.`);
        processedRef.current = true;
        stop();
        onSettledRef.current?.({ reason: 'orders-detected', newOrders });
      } catch {
        // Polling errors are non-fatal — next tick will retry.
      }
    }, POLL_INTERVAL_MS);

    pollingTimeoutRef.current = setTimeout(() => {
      if (!processedRef.current) {
        console.warn('[Publisher Polling] Timed out after', POLL_TIMEOUT_MS, 'ms — settling.');
        processedRef.current = true;
        stop();
        onSettledRef.current?.({
          reason: 'timeout',
          newOrders: detectedOrdersRef.current,
        });
      }
    }, POLL_TIMEOUT_MS);
  }, [stop]);

  // Cleanup on unmount — any active interval/timeout must be cleared so
  // we don't continue polling after the host modal goes away.
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop, getNewOrders };
}
