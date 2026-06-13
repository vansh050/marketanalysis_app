/**
 * WatchlistScreen — container (Phase G batch 4, 2026-05-02)
 *
 * Owns: useConfig, useTrade, useRoute, useFocusEffect, useLTPStore
 * (via WatchlistRow), WebSocketManager, axios symbol search,
 * AsyncStorage persistence, watchlist CRUD, toast notifications.
 *
 * Renders presentation resolved from `screens.WatchlistScreen`.
 * WatchlistRow is passed as a slot renderer since it uses useLTPStore.
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import {useRoute} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import axios from 'axios';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import server from '../../utils/serverConfig';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {useComponent} from '../../design/useDesign';

// WatchlistRow uses useLTPStore (Zustand) for live prices — must stay in container
const WatchlistRow = ({item}) => {
  const livePriceRaw = useLTPStore(state => state.ltps[item.symbol]);
  const livePrice = Number(livePriceRaw) || 0;
  const cmp = Number(livePrice) || 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        minHeight: 48,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#c8c8c8',
        borderBottomColor: '#ECECEC',
      }}>
      <View>
        <Text
          style={{
            color: '#222',
            fontSize: 14,
            fontFamily: 'Poppins-Medium',
            marginBottom: 2,
          }}
          numberOfLines={1}
          ellipsizeMode="tail">
          {item.name || item.symbol}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: '#888',
            fontFamily: 'HelveticaNeue',
            marginTop: 2,
            maxWidth: 170,
          }}>
          {item?.exchange}{' '}
          <Text
            style={{
              fontSize: 8,
              color: '#888',
              fontFamily: 'HelveticaNeue',
              marginHorizontal: 4,
              marginTop: -2,
            }}>
            {'• '}
          </Text>
          {item.companyName}
        </Text>
      </View>
      <View style={{flex: 1, alignItems: 'flex-end'}}>
        <Text
          style={{
            color: '#222',
            fontSize: 14,
            fontFamily: 'Poppins-Medium',
            letterSpacing: 0.25,
            marginBottom: 10,
          }}>
          {cmp > 0 ? `₹${cmp.toFixed(2)}` : '--'}
        </Text>
      </View>
    </View>
  );
};

const WatchlistScreen = props => {
  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';
  const {configData} = useTrade();
  const route = useRoute();
  const navigation = props.navigation;
  const fullScreen = route.params?.fullScreen ?? props.fullScreen ?? false;
  const webSocket = useRef(WebSocketManager.getInstance());
  const [activeTab, setActiveTab] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [watchlists, setWatchlists] = useState({
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  });

  const [toastvisible, settoastvisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Load watchlist data from AsyncStorage when the component mounts
  useEffect(() => {
    const loadWatchlistData = async () => {
      try {
        const storedWatchlists = await AsyncStorage.getItem('watchlists');
        if (storedWatchlists) {
          setWatchlists(JSON.parse(storedWatchlists));
        }
      } catch (error) {}
    };

    loadWatchlistData();
  }, []);

  // Reload watchlist data whenever the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadWatchlistData = async () => {
        try {
          const storedWatchlists = await AsyncStorage.getItem('watchlists');
          if (storedWatchlists) {
            setWatchlists(JSON.parse(storedWatchlists));
          }
        } catch (error) {}
      };
      loadWatchlistData();
    }, []),
  );

  // Save watchlist data to AsyncStorage whenever it changes
  useEffect(() => {
    const saveWatchlistData = async () => {
      try {
        await AsyncStorage.setItem('watchlists', JSON.stringify(watchlists));
      } catch (error) {}
    };

    saveWatchlistData();
  }, [watchlists]);

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      position: 'bottom',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
      bottomOffset: 100,
      text1Style: {
        color: 'black',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
      },
      text2Style: {
        color: 'black',
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
      },
    });
  };

  const addStockToWatchlist = stock => {
    setWatchlists(prevWatchlists => {
      const currentWatchlist = prevWatchlists[activeTab];

      if (currentWatchlist.some(item => item.symbol === stock.symbol)) {
        const updatedWatchlist = currentWatchlist.filter(
          item => item.id !== stock.id,
        );
        showToast(`Removed from Watchlist ${activeTab}`, 'error', stock.name);
        setToastMessage(`Removed from Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('fail');
        return {...prevWatchlists, [activeTab]: updatedWatchlist};
      } else {
        const updatedWatchlist = [...currentWatchlist, stock];
        showToast(`Added to Watchlist ${activeTab}`, 'success', stock.name);
        setToastMessage(`Added to Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('success');
        return {...prevWatchlists, [activeTab]: updatedWatchlist};
      }
    });
  };

  const deleteStock = (rowKey, stockname) => {
    setWatchlists(prevWatchlists => {
      const currentWatchlist = prevWatchlists[activeTab];
      const updatedWatchlist = currentWatchlist.filter(
        item => item.id !== rowKey,
      );
      showToast(`Removed from Watchlist ${activeTab}`, 'error', stockname);
      return {...prevWatchlists, [activeTab]: updatedWatchlist};
    });
  };

  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();
    await wsManager.subscribeToAllSymbols(watchlists[activeTab]);
  };

  useEffect(() => {
    subscribeToSymbols();
  }, [watchlists[activeTab]]);

  const watchlistOptions = [
    {label: 'Watchlist 1', value: 1},
    {label: 'Watchlist 2', value: 2},
    {label: 'Watchlist 3', value: 3},
    {label: 'Watchlist 4', value: 4},
    {label: 'Watchlist 5', value: 5},
  ];

  const [editMode, setEditMode] = useState(false);
  const [isWatchlistPickerVisible, setIsWatchlistPickerVisible] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Symbol search API call
  const fetchSymbolSuggestions = async query => {
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/equity/symbol-search`,
        {symbol: query},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      setSearchSuggestions(response.data.match || []);
    } catch (error) {
      setSearchSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchSymbolSuggestions(searchQuery);
  }, [searchQuery]);

  const handleSaveEditWatchlist = async () => {
    try {
      await AsyncStorage.setItem('watchlists', JSON.stringify(watchlists));
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save watchlist:', error);
    }
  };

  // ---------- presentation delegation ----------
  const WatchlistPresentation = useComponent('screens.WatchlistScreen');

  const viewModel = {
    themeColor,
    gradient1,
    gradient2,
    editMode,
    activeTab,
    searchQuery,
    watchlistOptions,
    currentWatchlist: watchlists[activeTab] || [],
    currentWatchlistCount: watchlists[activeTab]?.length || 0,
    searchSuggestions,
    searchLoading,
    isWatchlistPickerVisible,
  };

  const actions = {
    onGoBack: () => navigation.goBack(),
    onSetActiveTab: setActiveTab,
    onSetSearchQuery: setSearchQuery,
    onSetEditMode: setEditMode,
    onSaveEditWatchlist: handleSaveEditWatchlist,
    onSetIsWatchlistPickerVisible: setIsWatchlistPickerVisible,
    onDeleteStock: deleteStock,
    onAddStockToWatchlist: addStockToWatchlist,
  };

  const slots = {
    WatchlistRowRenderer: (item) => <WatchlistRow item={item} />,
  };

  return <WatchlistPresentation viewModel={viewModel} actions={actions} slots={slots} />;
};

export default WatchlistScreen;
