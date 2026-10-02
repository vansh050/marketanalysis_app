/**
 * Keep the phone's HTTPS connection to ccxt warm while a rebalance may be
 * accepted (2026-10-02).
 *
 * The first Accept tap after the app sat idle paid ~0.6–0.9 s to open a new
 * TLS connection through Cloudflare (most Indian customers reach it via
 * Singapore/Marseille). A tiny read-only GET to ccxt's `/health/live` keeps
 * the connection in the HTTP client's pool, so the tap finds it ready.
 *
 * Load is bounded on purpose: one ping when enabled, one when the app returns
 * to the foreground, then every 5 minutes while in the foreground — never in
 * the background and never more than once a minute. No auth, no data, and a
 * failed ping is ignored.
 */
import {useEffect} from 'react';
import {AppState} from 'react-native';
import axios from 'axios';
import server from '../utils/serverConfig';

export const WARMUP_INTERVAL_MS = 5 * 60 * 1000;
export const WARMUP_MIN_GAP_MS = 60 * 1000;

export default function useConnectionWarmup(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let lastPingAt = 0;
    const ping = () => {
      if (AppState.currentState !== 'active') return;
      const now = Date.now();
      if (now - lastPingAt < WARMUP_MIN_GAP_MS) return;
      lastPingAt = now;
      axios
        .get(`${server.ccxtServer.baseUrl}health/live`, {timeout: 8000})
        .catch(() => {});
    };
    ping();
    const timer = setInterval(ping, WARMUP_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') ping();
    });
    return () => {
      clearInterval(timer);
      subscription?.remove?.();
    };
  }, [enabled]);
}
