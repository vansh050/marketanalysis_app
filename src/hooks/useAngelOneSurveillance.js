/**
 * useAngelOneSurveillance — pre-trade Angel One surveillance check
 * =============================================================================
 *
 * Angel One refuses API orders on scrips under surveillance (GSM/ASM/ESM
 * stages). Without a pre-trade check the customer fires the order, it is
 * rejected broker-side, and the only signal is the rejection message after
 * the fact — which is what the app did on the rebalance and basket surfaces
 * until 2026-08-01.
 *
 * The web app checks BEFORE placing on three surfaces (ReviewTradeModel,
 * UpdateRebalanceModal, BasketModal). The app only covered two of them; this
 * hook exists so the remaining surfaces get the same check without a fourth
 * and fifth copy of the same 60 lines drifting across six repos.
 *
 * Behaviour is deliberately WARN, not BLOCK — matching web. We surface which
 * scrips will be refused and tell the customer to place those manually; we do
 * not prevent the rest of the basket/rebalance from going through.
 *
 * Fail-open by design: a surveillance-endpoint outage must never stop a
 * customer trading. On error we mark the check done and return null, so the
 * warning simply doesn't render.
 *
 * @param {object}   opts
 * @param {string}   opts.broker      — resolved broker name; no-ops unless 'Angel One'
 * @param {Array}    opts.stocks      — [{symbol, exchange}]; re-checked when its length changes
 * @param {boolean}  opts.enabled     — gate (e.g. modal visibility)
 * @param {object}   opts.configData  — useTrade() configData, for the subdomain header
 *
 * @returns {{surveillanceStocks: Array, loading: boolean, raw: object|null}}
 *   `surveillanceStocks` is already filtered to the rows worth showing, so
 *   callers just check `.length` — the filter predicate is defined once here
 *   rather than re-derived per surface.
 */

import {useState, useEffect, useCallback} from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {filterSurveillanceStocks} from '../utils/surveillance';

export const useAngelOneSurveillance = ({
  broker,
  stocks,
  enabled = true,
  configData,
}) => {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    if (broker !== 'Angel One') return null;
    if (loading || checked) return raw;
    if (!Array.isArray(stocks) || stocks.length === 0) return null;

    const symbols = stocks
      .map(s => ({
        symbol: s?.tradingSymbol || s?.symbol,
        exchange: s?.exchange,
      }))
      .filter(s => s.symbol);

    if (symbols.length === 0) return null;

    setLoading(true);
    try {
      const response = await axios.request({
        method: 'post',
        url: `${server.ccxtServer.baseUrl}angelone/equity/surveillance`,
        data: symbols,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain':
            configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });
      setRaw(response.data);
      setChecked(true);
      return response.data;
    } catch (error) {
      // Fail open — never block a trade because this endpoint is unavailable.
      console.error('[surveillance] check failed:', error?.message);
      setChecked(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [broker, stocks, loading, checked, raw, configData]);

  useEffect(() => {
    if (enabled && broker === 'Angel One' && !checked && !loading) {
      check();
    }
  }, [enabled, broker, stocks?.length, checked, loading, check]);

  // Reset when the surface closes or the broker changes, so re-opening with a
  // different broker or a different set of scrips re-checks instead of showing
  // a stale verdict.
  useEffect(() => {
    if (!enabled || broker !== 'Angel One') {
      setChecked(false);
      setRaw(null);
    }
  }, [enabled, broker]);

  const surveillanceStocks = filterSurveillanceStocks(raw);

  return {surveillanceStocks, loading, raw};
};

export default useAngelOneSurveillance;
