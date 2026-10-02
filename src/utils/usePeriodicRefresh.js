import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Periodic background refresh for open advice screens — web F-10 poll parity
 * (prod StockRecommendation.js polls at 30s; the app uses a slightly gentler
 * 45s cadence to save battery/network on device) plus foreground re-fetch on
 * AppState 'active'.
 *
 * Why it's safe to run under manual-record modals: every manual-entry
 * surface in the app is refresh-safe by construction —
 *   - StandaloneManualPlacementModal resets only on a different trade _id
 *     (initializedTradeRef, stable key)
 *   - ManualBasketExitModal loads once per [visible, basketId] and
 *     merge-preserves typed evidence by symbol
 *   - RebalanceModal builds its draft once per open (ref-guarded) with
 *     symbol-keyed rows
 *   - RecommendationSuccessModal keeps edit fields as shared state
 * A background refetch replaces list props, never those drafts.
 *
 * Contract with the caller: the refresh function MUST pass { silent: true }
 * to the underlying fetch (TradeContext.getAllTrades /
 * getModelPortfolioStrategyDetails) so skeleton/loading flags don't flicker
 * on every tick.
 *
 * Guards:
 *   - only runs while enabled AND the app is foregrounded
 *   - never stacks a slow fetch (in-flight guard)
 *   - throttles the foreground re-run (no burst when returning to app)
 */
export default function usePeriodicRefresh(
  refresh,
  { intervalMs = 45000, enabled = true } = {},
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof refreshRef.current !== 'function') return;

    let alive = true;
    const appState = { current: AppState.currentState };

    const run = () => {
      if (!alive) return;
      if (appState.current !== 'active') return; // backgrounded — skip
      if (inFlightRef.current) return; // don't stack slow fetches
      const now = Date.now();
      if (now - lastRunRef.current < intervalMs / 2) return; // throttle
      lastRunRef.current = now;
      inFlightRef.current = true;
      Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => {
          /* keep polling — a failed tick is transient */
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const interval = setInterval(run, intervalMs);
    const sub = AppState.addEventListener('change', next => {
      const wasBackgrounded = appState.current !== 'active';
      appState.current = next;
      if (next === 'active' && wasBackgrounded) run();
    });

    return () => {
      alive = false;
      clearInterval(interval);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);
}
