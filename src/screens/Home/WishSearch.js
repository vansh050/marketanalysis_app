import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import Config from '../../utils/safeConfig';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import {useComponent} from '../../design/useDesign';

import {designColor} from '../../design/literalTokens';

const WishSearch = ({ searchQuery, onBackPress, onQueryChange, onBookmark, currentTab, watchlists }) => {
  const {configData}=useTrade();
  const Presentation = useComponent('screens.WishSearch');

  // Get dynamic config from API
  const config = useConfig();
  const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
  const themeColor = config?.themeColor || designColor('0056b7');
  const mainColor = config?.mainColor || designColor('0056b7');
  const gradient1 = config?.gradient1 || designColor('0056b7');
  const gradient2 = config?.gradient2 || designColor('002651');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedTab, setSelectedTab] = useState('Equity'); // <-- New state
  const [symbolQuery, setSymbolQuery] = useState('');
  const [strikePriceQuery, setStrikePriceQuery] = useState('');
  const [optionType, setOptionType] = useState(''); // CE or PE
  const [value, setValue] = useState('All Trades');
  const [isFocus, setIsFocus] = useState(false);
  const [fnoResults, setFnoResults] = useState([]);

  // Existing fetchSymbols


  
  const fetchSymbols = async (query) => {
    if (query.length < 3) return setResults([]);
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/get-symbol-name-exchange`,
        { symbol: query },
        { headers: { 'Content-Type': 'application/json' } }
      );
  
      const resultsWithIds = (response.data.match || []).map((item, index) => ({
        ...item,
        exchange: item.segment,        // ✅ Rename 'segment' to 'exchange'
        id: `${item.name}-${item.segment}-${index}`
      }));
  
      // Optionally remove the 'segment' key if you don't want it
      resultsWithIds.forEach(item => delete item.segment);
  
      //console.log('result with id:', resultsWithIds);
      setResults(resultsWithIds);
    } catch (error) {
      console.error('Error fetching symbols:vvvv', error);
    } finally {
      setLoading(false);
    }
  };
  

  const debouncedFetchSymbols = useCallback(debounce(fetchSymbols, 300), []);

  useEffect(() => {
    if (selectedTab === 'Equity') {
      debouncedFetchSymbols(searchQuery);
    }
    return () => debouncedFetchSymbols.cancel();
  }, [searchQuery, selectedTab]);

  const handleBookmarkPress = (item) => {
    console.log('item to add::',item);
    const currentWatchlist = watchlists[currentTab] || [];
    const isBookmarked = currentWatchlist.some(watchlistItem => watchlistItem.id === item.id);
    if (!isBookmarked) onBookmark(item);
  };

 

  const handleTabSwitch = (tab) => {
    setSelectedTab(tab);
    setResults([]);
    setSymbolQuery('');
    setStrikePriceQuery('');
    setOptionType('');
  };

  const cePeOptions = [
    { label: 'CE', value: 'CE' },
    { label: 'PE', value: 'PE' },
  ];
  

    // Derivative add entry
    const [adviceDerivativesEntries, setAdviceDerivativesEntries] = useState([
      {
        id: Date.now(),
        symbol: "",
        foType: "OPTIONS",
        expiry: "",
        strike: "",
        optionType: "",
        lots: "",
        order: "MARKET",
        price: 0,
        rationale: "",
        comments: "",
        extendedComment: "",
        strikes: [],
        optionTypes: [],
        symbols: [],
      },
    ]);

  const fetchDerivativesSymbols = async (index, inputValue, type) => {
    if (inputValue.length < 3) return;

    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}comms/fno/search`,
        {
          symbol: inputValue,
          type: type || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
            "aq-encrypted-key": generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );
      const symbols = response.data.match || [];

      const strikes = [...new Set(symbols.map((sym) => sym.strike))]
        .filter(Boolean)
        .sort((a, b) => a - b);
      const optionTypes = [
        ...new Set(symbols.map((sym) => sym.optionType)),
      ].filter(Boolean);

      setAdviceDerivativesEntries((prevEntries) =>
        prevEntries.map((entry, i) =>
          i === index
            ? {
                ...entry,
                symbols: symbols,
                strikes: strikes,
                optionTypes: optionTypes,
              }
            : entry
        )
      );
    } catch (error) {
      console.error("Error fetching derivatives symbols:", error);
    }
  };
 // console.log('advicee-----',adviceDerivativesEntries);
  const debouncedFetchDerivativesSymbols = useCallback(
    debounce((index, value, type) => {
      fetchDerivativesSymbols(index, value, type);
    }, 300),
    []
  );

  const handleDerivativesInputChange = (index, value) => {
    setAdviceDerivativesEntries((prevEntries) =>
      prevEntries.map((entry, i) =>
        i === index
          ? { ...entry, searchSymbol: value, symbol: value, showDropdown: true }
          : entry
      )
    );

    if (value.length >= 3) {
      const currentType = adviceDerivativesEntries[index].foType;
      debouncedFetchDerivativesSymbols(index, value, currentType);
    }
  };

  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const handleDerivativesSymbolSelect = (
    index,
    symbol,
    lotsize,
    strike,
    exchange,
    optionType
  ) => {
   // console.log('symbol i get:',symbol);
    setAdviceDerivativesEntries((prevEntries) =>
      prevEntries.map((entry, i) =>
        i === index
          ? {
              ...entry,
              symbol: symbol.symbol,
              searchSymbol: symbol.searchSymbol,
              strike: strike,
              optionType: optionType, // Set the optionType
              lots: symbol.lotsize,
              exchange: exchange,
              strikes: prevEntries[i].strikes || [], // Preserve the strikes array
              symbols: [],
              showDropdown: false,
            }
          : entry
      )
    );
    setSelectedSymbols((prev) => {
      const filtered = prev.filter((item) => item.index !== index);
      return [
        ...filtered,
        {
          index,
          symbol: symbol.symbol,
          exchange: symbol.exchange,
        },
      ];
    });

    fetchDerivativesSymbols(index, symbol.searchSymbol, "OPTIONS");
  };

  const [symbolfno,setsymbolfno]=useState("");

  const [focusedIndex, setFocusedIndex] = useState(null);
  const addFnoResult = (entry,value) => {
    console.log('entry =---',value);
    const id = `${entry.selectedSymbol}-${entry.strike}-${entry.optionType}`;
    if (!entry.selectedSymbol || !entry.strike || !entry.optionType) return;
  
    const newItem = {
      id,
      name:`${entry.selectedSymbol}-${entry.strike}-${entry.optionType}`,
      symbol: `${symbolfno}`,
      exchange: 'NFO',
    };
  
    setFnoResults(prev => {
      const exists = prev.some(item => item.id === newItem.id);
      return exists ? prev : [...prev, newItem];
    });
  };
  
  return (
    <Presentation
      viewModel={{
        selectedVariant,
        selectedTab,
        searchQuery,
        results,
        loading,
        adviceDerivativesEntries,
        focusedIndex,
        optionType,
        fnoResults,
        currentTab,
        watchlists,
        cePeOptions,
      }}
      actions={{
        onBackPress,
        onQueryChange,
        handleTabSwitch,
        setResults,
        setFocusedIndex,
        setAdviceDerivativesEntries,
        handleDerivativesSymbolSelect,
        setsymbolfno,
        handleDerivativesInputChange,
        addFnoResult,
        setOptionType,
        handleBookmarkPress,
      }}
    />
  );
};

export default WishSearch;
