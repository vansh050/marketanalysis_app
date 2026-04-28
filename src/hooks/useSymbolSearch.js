/**
 * useSymbolSearch.js
 * Reusable hook for symbol autocomplete search across brokers.
 * Ported from prod-alphaquark-github for feature parity.
 */
import {useState, useCallback, useRef} from 'react';
import axios from 'axios';
import {debounce} from 'lodash';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../utils/variantHelper';

/**
 * Hook for searching stock symbols.
 * @param {object} options
 * @param {string} options.broker - Broker name for symbol format
 * @param {number} options.debounceMs - Debounce delay (default 300ms)
 * @param {number} options.minChars - Minimum characters to trigger search (default 2)
 * @returns {{ query, setQuery, results, isLoading, selectedSymbol, selectSymbol, clearSearch }}
 */
export default function useSymbolSearch({
  broker,
  debounceMs = 300,
  minChars = 2,
  configData,
} = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const abortControllerRef = useRef(null);

  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  const searchSymbols = useCallback(
    debounce(async searchQuery => {
      if (!searchQuery || searchQuery.length < minChars) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      try {
        // Try Angel One symbol search first (most comprehensive)
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}angelone/equity/symbol-search`,
          {query: searchQuery},
          {
            headers: requestHeaders,
            signal: abortControllerRef.current.signal,
          },
        );

        const symbols = response.data?.data || response.data?.results || [];
        setResults(
          symbols.map(s => ({
            symbol: s.symbol || s.tradingSymbol || s.name,
            tradingSymbol: s.tradingSymbol || s.symbol,
            exchange: s.exchange || 'NSE',
            token: s.token || s.symbolToken || '',
            name: s.name || s.companyName || s.symbol,
            instrumentType: s.instrumentType || 'EQUITY',
            lotSize: s.lotSize || 1,
          })),
        );
      } catch (err) {
        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
          console.warn('[useSymbolSearch] Search error:', err);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, debounceMs),
    [minChars, debounceMs],
  );

  const handleQueryChange = useCallback(
    text => {
      setQuery(text);
      setSelectedSymbol(null);
      searchSymbols(text);
    },
    [searchSymbols],
  );

  const selectSymbol = useCallback(symbol => {
    setSelectedSymbol(symbol);
    setQuery(symbol?.symbol || symbol?.tradingSymbol || '');
    setResults([]);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedSymbol(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    query,
    setQuery: handleQueryChange,
    results,
    isLoading,
    selectedSymbol,
    selectSymbol,
    clearSearch,
  };
}
