// src/components/MPStatusModalRN.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  FlatList,
  UIManager,
  LayoutAnimation,
  Dimensions,
  Pressable,
  SafeAreaView,
  Alert,
  NativeModules,
  Keyboard,
  findNodeHandle,
} from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { Picker } from '@react-native-picker/picker';
import { debounce } from 'lodash';
import { generateToken } from '../../utils/SecurityTokenManager';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import { isOrderRejected, isOrderSuccess, isOrderPending } from '../../utils/orderStatusUtils';
import { designColor, designFont } from '../../design/literalTokens';
const { height: screenHeight } = Dimensions.get('window');
const { width: screenWidth } = Dimensions.get('window');
import StepProgressBar from '../../UIComponents/RebalanceAdvicesUI/StepProgressBar';

import {
  X,
  CheckSquare,
  Edit2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Trash,
  PlusCircle,
  ArrowLeft,
  ChevronLeft,
  Plus,
} from 'lucide-react-native';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';

const Icon = ({ name, size = 24, color = designColor('000') }) => {
  switch (name) {
    case 'x':
      return <X size={size} color={color} />;
    case 'check-square':
      return <CheckSquare size={size} color={color} />;
    case 'edit-2':
      return <Edit2 size={size} color={color} />;
    case 'alert-triangle':
      return <AlertTriangle size={size} color={color} />;
    case 'trending-up':
      return <TrendingUp size={size} color={color} />;
    case 'trending-down':
      return <TrendingDown size={size} color={color} />;
    case 'trash':
      return <Trash size={size} color={color} />;
    case 'plus-circle':
      return <PlusCircle size={size} color={color} />;
    case 'arrow-left':
      return <ArrowLeft size={size} color={color} />;
    default:
      return null;
  }
};

const formatPrice = price => {
  const num = Number.parseFloat(price);
  return isNaN(num) ? 'N/A' : `₹${num.toFixed(2)}`;
};

const cleanPriceInput = value => {
  const raw = typeof value === 'object' && value !== null
    ? value.last_traded_price ?? value.ltp ?? value.price
    : value;
  const normalized = String(raw ?? '').replace(/[₹,]/g, '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : '';
};

const extractPortfolioDocumentId = document => {
  const rawId = document?._id;
  if (typeof rawId === 'string' && rawId.trim()) {
    return rawId;
  }
  return rawId?.$oid || rawId?.oid || null;
};

const isStockFailed = stock => {
  // If orderStatus indicates the order was actually placed/executed (OPEN, TRANSIT,
  // TRADED, COMPLETE, etc.), it is NOT failed — even if rebalance_status says "failure"
  // due to stale data from backend missing OPEN/TRANSIT in SUCCESS_ORDER_MAPPING.
  if (isOrderSuccess(stock.orderStatus) || isOrderPending(stock.orderStatus)) {
    return false;
  }
  return (
    isOrderRejected(stock.orderStatus) ||
    stock.rebalance_status === 'failed' ||
    stock.rebalance_status === 'failure'
  );
};

const configureAndroidModalKeyboard = async modalRef => {
  if (Platform.OS !== 'android') return true;

  const modalSoftInput = NativeModules.ModalSoftInput;
  const modalTag = modalRef?.current
    ? findNodeHandle(modalRef.current)
    : null;

  try {
    if (Number.isInteger(modalTag) && modalSoftInput?.setAdjustPanForTag) {
      const configuredByTag = await modalSoftInput.setAdjustPanForTag(modalTag);
      if (configuredByTag) return true;
    }
    return modalSoftInput?.setAdjustPan
      ? await modalSoftInput.setAdjustPan('holdings-editor-modal')
      : false;
  } catch (error) {
    console.warn('[MPStatusModal] Could not configure keyboard window:', error);
    return false;
  }
};

const MPStatusModal = ({
  modelObjectId,
  portfolioDocumentId,
  isOpen,
  onClose,
  stockData = [],
  onUpdateStockList,
  userbroker,
  handleAcceptRebalance,
  userEmail,
  modelName,
  openedFromEdit = false,
  isConfirmingFailed = false,
  currentStep = 2,
  stepsData = [],
  setCurrentStep,
  GoBack,
  setgoBack,
  handlefirstBack,
  brokerStatus,
  isRetryRebalance = false,
}) => {
  const { configData, marketPrices, fetchMarketPrices } = useTrade();
  const config = useConfig();
  const gradient2 = config?.gradient2 || designColor('0076fb');
  const [viewMode, setViewMode] = useState('viewing');
  const [localStockList, setLocalStockList] = useState([]);
  const holdingsVersionRef = useRef(null);
  const [pendingReclassifications, setPendingReclassifications] = useState([]);
  const pendingReclassificationsRef = useRef([]);
  const updatePendingReclassifications = useCallback(nextOrUpdater => {
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(pendingReclassificationsRef.current)
      : nextOrUpdater;
    pendingReclassificationsRef.current = next;
    setPendingReclassifications(next);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmedStocks, setConfirmedStocks] = useState({});
  const [isContinueLoading, setIsContinueLoading] = useState(false);
  const [showTransitionLoader, setShowTransitionLoader] = useState(false);
  const [showSuccessLoader, setShowSuccessLoader] = useState(false);

  const initialProcessDone = useRef(false);
  const hasDataBeenFetched = useRef(false);
  const modalOpenCount = useRef(0);
  const holdingsModalRef = useRef(null);
  const newSymbolInputRef = useRef(null);
  const addFormRequestedFocusRef = useRef(false);

  const [newSymbol, setNewSymbol] = useState('');
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [symbolResults, setSymbolResults] = useState([]);
  const [isSymbolLoading, setIsSymbolLoading] = useState(false);
  const [newQuantity, setNewQuantity] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('BUY');
  const [newPrice, setNewPrice] = useState('');
  const [newExchange, setNewExchange] = useState('NSE');
  const [showExchange, setShowExchangePicker] = useState();
  const allSymbols = React.useMemo(() => {
    const symbols = [
      ...stockData.map(stock => stock?.symbol).filter(Boolean),
      ...localStockList.map(stock => stock?.symbol).filter(Boolean)
    ];
    return Array.from(new Set(symbols));
  }, [stockData, localStockList]);

  const { getLTPForSymbol } = useWebSocketCurrentPrice(allSymbols);
  const [portfolioDocId, setPortfolioDocId] = useState(
    () => portfolioDocumentId || null,
  );
  const [userInitiatedAction, setUserInitiatedAction] = useState(false);
  const [showFormAdd, setShowAddForm] = useState(false);

  const [isLtpLoading, setIsLtpLoading] = useState(false);

  const [displayText, setDisplayText] = useState('');
  // When newSymbol changes, fetch its market price
  useEffect(() => {
    if (!newSymbol) {
      setNewPrice('');
      return;
    }
    const fetchPrice = async () => {
      setIsLtpLoading(true);
      try {
        await fetchMarketPrices([newSymbol]);
      } finally {
        setIsLtpLoading(false);
      }
    };
    fetchPrice();
  }, [newSymbol]);

  useEffect(() => {
    if (allSymbols.length > 0 && isOpen) {
      console.log('Fetching prices for symbols:', allSymbols);
      fetchMarketPrices(allSymbols);
    }
  }, [allSymbols, isOpen]);

  // Update newPrice when marketPrices change
  useEffect(() => {
    if (newSymbol && marketPrices[newSymbol]) {
      const normalizedPrice = cleanPriceInput(marketPrices[newSymbol]);
      if (normalizedPrice) {
        setNewPrice(normalizedPrice);
      }
    }
  }, [marketPrices, newSymbol]);

  useEffect(() => {
    if (isOpen) {
      modalOpenCount.current += 1;
      // The parent already fetched the exact broker-scoped portfolio used to
      // populate this screen. Preserve that document identity instead of
      // forcing the editor to rediscover it after the customer makes changes.
      setPortfolioDocId(portfolioDocumentId || null);
    } else {
      hasDataBeenFetched.current = false;
      setPortfolioDocId(null);
    }
  }, [isOpen, portfolioDocumentId, userEmail, modelName, userbroker]);

  const hasFailedOrders = useCallback(() => {
    return localStockList.some(item => isStockFailed(item));
  }, [localStockList]);

  const areAllFailStocksConfirmed = useCallback(() => {
    const failedStocks = localStockList.filter(stock => isStockFailed(stock));
    if (failedStocks.length === 0) return false;
    return failedStocks.some((stock, i) => {
      const stockIndex = localStockList.findIndex(item => item === stock);
      return confirmedStocks[stockIndex] === true;
    });
  }, [localStockList, confirmedStocks]);

  const countConfirmedFailStocks = () => {
    const failedStocks = localStockList.filter(stock => isStockFailed(stock));
    const confirmedCount = failedStocks.filter((_, index) => {
      const stockIndex = localStockList.findIndex(
        localStock => localStock === failedStocks[index],
      );
      return confirmedStocks[stockIndex] === true;
    }).length;
    return `${confirmedCount} of ${failedStocks.length} confirmed`;
  };

  const processStockDataDirectly = () => {
    if (stockData.length > 0) {
      const mappedData = stockData.map(order => {
        const priceForEdit =
          Number.parseFloat(order.averagePrice) ||
          Number.parseFloat(order.averageEntryPrice) ||
          0;

        return {
          ...order,
          quantity: String(Number.parseInt(order.quantity, 10) || ''),
          averageEntryPrice: priceForEdit.toFixed(2),
          averagePrice: priceForEdit.toFixed(2),
          reactKey:
            order.uniqueOrderId ||
            `${order.symbol}_${order.orderId || Date.now()}`,
        };
      });
      updatePendingReclassifications(
        mappedData
          .filter(row => row.holdingRemovalAction === 'sell_and_remove')
          .map(row => ({
            symbol: row.symbol,
            exchange: row.exchange,
            action: 'sell_and_remove',
          })),
      );

      if (isConfirmingFailed) {
        setLocalStockList(mappedData);
        const newConfirmedStocks = {};
        mappedData.forEach((stock, index) => {
          const isFailed = isStockFailed(stock);
          if (isFailed) {
            newConfirmedStocks[index] = false;
          }
        });
        setConfirmedStocks(newConfirmedStocks);
      } else if (openedFromEdit) {
        setLocalStockList(mappedData);
      } else {
        const successfulStocks = mappedData.filter(
          stock => !isStockFailed(stock),
        );
        setLocalStockList(successfulStocks);
      }
    } else {
      setLocalStockList([]);
    }
  };

  const fetchUserPortfolio = async () => {
    if (hasDataBeenFetched.current) {
      return;
    }

    if (isConfirmingFailed) {
      processStockDataDirectly();
      hasDataBeenFetched.current = true;
      return;
    }

    // Use stockData from parent if already provided (avoids duplicate API call)


    if (!userEmail || !modelName) {
      return;
    }

    setIsLoading(true);
    setError(null);

      try {
        console.log('Fetching portfolio for:', { userEmail, modelName, userbroker });

        holdingsVersionRef.current = null;
        const response = await axios.get(
          `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}?broker=${encodeURIComponent(userbroker || 'DummyBroker')}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
            timeout: 15000,
          },
        );

        holdingsVersionRef.current = response.data?.data?.holdings_version || null;
        hasDataBeenFetched.current = true;

        if (
          response.data &&
          response.data.data &&
          extractPortfolioDocumentId(response.data.data)
        ) {
          setPortfolioDocId(extractPortfolioDocumentId(response.data.data));
        }

        // Broker-mismatch guard — defence against showing a stale
        // previously-connected broker's portfolio snapshot after the
        // user has switched brokers. The server returns whatever
        // broker built the latest snapshot; if that broker isn't the
        // user's currently-connected broker, the order_results belong
        // to a different account and rendering them here would surface
        // the wrong trades in the rebalance flow. Removed in 00fc0ce
        // under the assumption that HoldingsMigrationModal fully
        // covers this class of stale-data risk — but that modal only
        // fires on the post-broker-connect path (TradeContext.
        // fetchBrokerStatusModal), not on direct navigation into MP
        // from Home/Portfolio. Restored here as a cheap belt-and-
        // braces guard. If the migration modal later fully replaces
        // this guard's scope (check every entry-path into MPStatusModal
        // goes through migrationSummary first), this block can be
        // safely removed.
        const portfolioBroker = response.data?.data?.user_broker;
        if (portfolioBroker && portfolioBroker !== userbroker) {
          console.warn(
            `[MPStatusModal] Broker mismatch — snapshot=${portfolioBroker}, current=${userbroker}. Clearing stale data.`,
          );
          setLocalStockList([]);
          onUpdateStockList([]);
          setIsLoading(false);
          return;
        }

        // Read order_results from user_net_pf_model OR fall back to
        // advice_executed.order_results when user_net_pf_model is empty.
        // ccxt-india's `_save_successful_trades` returns early when
        // there are no successes (rebalancing.py:1453), leaving
        // user_net_pf_model empty even though advice_executed has the
        // full record. Production 2026-04-26: 26 AliceBlue orders
        // rejected for margin shortfall, frontend showed "Execution
        // Failed" with no per-order detail because it only read
        // user_net_pf_model. Same fix landed in tidi_new
        // ExecutionStatusPage.dart.
        const _userNetPfOR =
          response?.data?.data?.user_net_pf_model?.order_results;
        const _adviceExecutedRaw = response?.data?.data?.advice_executed;
        const _adviceExecutedOR = Array.isArray(_adviceExecutedRaw)
          ? _adviceExecutedRaw[_adviceExecutedRaw.length - 1]?.order_results
          : _adviceExecutedRaw?.order_results;
        const _resolvedOR =
          (Array.isArray(_userNetPfOR) && _userNetPfOR.length > 0)
            ? _userNetPfOR
            : (isConfirmingFailed ? _adviceExecutedOR : []);
        if (Array.isArray(_resolvedOR)) {
          const orderResults = _resolvedOR;

          if (orderResults.length > 0) {
            const pendingRemovalSymbols = new Set(
              (response?.data?.data?.user_net_pf_model?.pending_holding_removals || [])
                .map(row => row?.symbol)
                .filter(Boolean),
            );
            const mappedData = orderResults.map(item => ({
              ...item,
              _edited: false,
              _isNew: false,
              ...(pendingRemovalSymbols.has(item.symbol)
                ? {holdingRemovalAction: 'sell_and_remove'}
                : {}),
              quantity: String(Number.parseInt(item.quantity, 10) || ''),
              averageEntryPrice: cleanPriceInput(item.averagePrice || item.averageEntryPrice),
              averagePrice: cleanPriceInput(item.averagePrice || item.averageEntryPrice),
              reactKey:
                item.uniqueOrderId ||
                `${item.symbol}_${item.orderId || Date.now()}`,
            }));
            updatePendingReclassifications(
              mappedData
                .filter(row => row.holdingRemovalAction === 'sell_and_remove')
                .map(row => ({
                  symbol: row.symbol,
                  exchange: row.exchange,
                  action: 'sell_and_remove',
                })),
            );

            if (!isConfirmingFailed && !openedFromEdit) {
              const successfulStocks = mappedData.filter(
                stock => !isStockFailed(stock),
              );
              setLocalStockList(successfulStocks);
              onUpdateStockList(successfulStocks);
            } else {
              setLocalStockList(mappedData);
              onUpdateStockList(orderResults);
            }
          } else {
            console.log('No portfolio data found for current broker');
            setLocalStockList([]);
            onUpdateStockList([]);
          }
        } else if (response.data && (response.data.status === 0 || response.data.status === 1)) {
          console.log('Empty portfolio for current broker');
          setLocalStockList([]);
          onUpdateStockList([]);
        } else {
          console.error('Invalid response format:', response.data);
          setError('Failed to fetch portfolio data. Invalid response format.');
          setLocalStockList([]);
        }
      } catch (err) {
        console.error('Error fetching user portfolio:', err);

        if (err.response && err.response.status === 404) {
          console.log('No portfolio found for current broker - starting fresh');
          setLocalStockList([]);
          onUpdateStockList([]);
        } else {
          setError('Failed to fetch portfolio data. Please try again.');
          setLocalStockList([]);
        }

        hasDataBeenFetched.current = false;
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (isOpen && userEmail && modelName && !hasDataBeenFetched.current) {
      fetchUserPortfolio();
    }
  }, [isOpen, userEmail, modelName]);

  useEffect(() => {
    if (isOpen) {
      setUserInitiatedAction(false);
      if (isConfirmingFailed) {
        setViewMode('confirmFailed');
      } else if (openedFromEdit) {
        setViewMode('editing');
      } else {
        setViewMode('viewing');
      }
    } else {
      const timer = setTimeout(() => {
        setViewMode('viewing');
        setLocalStockList([]);
        setNewSymbol('');
        setNewQuantity('');
        setNewTransactionType('BUY');
        setNewPrice('');
        setNewExchange('NSE');
        setConfirmedStocks({});
        initialProcessDone.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isConfirmingFailed, openedFromEdit]);

  useEffect(() => {
    if (isOpen) return;
    Keyboard.dismiss();
  }, [isOpen]);

  useEffect(() => {
    if (
      !showFormAdd ||
      viewMode !== 'editing' ||
      !addFormRequestedFocusRef.current
    ) {
      return undefined;
    }

    let cancelled = false;
    let focusTimer;
    const focusSymbolAfterFormMount = async () => {
      // The holdings Modal is already on screen when + Add is pressed. Apply
      // adjustPan to that exact Dialog first, then focus after the add form has
      // completed its own layout. This avoids the old Modal-mount/IME race while
      // still opening the keyboard in direct response to the customer's tap.
      await configureAndroidModalKeyboard(holdingsModalRef);
      if (cancelled) return;
      focusTimer = setTimeout(() => {
        if (cancelled) return;
        addFormRequestedFocusRef.current = false;
        newSymbolInputRef.current?.focus();
      }, 100);
    };
    focusSymbolAfterFormMount();

    return () => {
      cancelled = true;
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [showFormAdd, viewMode]);

  const fetchSymbols = async query => {
    if (query.length < 3) return setSymbolResults([]);
    setIsSymbolLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/get-symbol-name-exchange`,
        { symbol: query },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const filteredResults = (response.data.match || []).filter(
        item => item.segment === 'NSE' || item.segment === 'BSE',
      );

      const resultsWithIds = filteredResults.map((item, index) => ({
        ...item,
              _edited: false,
              _isNew: false,
        exchange: item.segment,
        id: `${item.name}-${item.segment}-${index}`,
      }));

      resultsWithIds.forEach(item => delete item.segment);

      setSymbolResults(resultsWithIds);
    } catch (error) {
      console.error('Error fetching symbols:', error);
    } finally {
      setIsSymbolLoading(false);
    }
  };

  const debouncedFetchSymbols = useCallback(debounce(fetchSymbols, 300), []);

  useEffect(() => {
    if (newSymbol.length > 2) {
      debouncedFetchSymbols(newSymbol);
    } else {
      setSymbolResults([]);
    }
    return () => debouncedFetchSymbols.cancel();
  }, [newSymbol, debouncedFetchSymbols]);

  useEffect(() => {
    if (
      selectedInstrument &&
      symbolResults.some(result => result.symbol === selectedInstrument.symbol)
    ) {
      setSymbolResults([]);
    }
  }, [selectedInstrument, symbolResults]);

  const handleClose = async () => {
    setShowTransitionLoader(true);
    setError(null);

    try {
      if (handleAcceptRebalance) {
        const advanced = await handleAcceptRebalance();
        if (advanced !== true) {
          return;
        }
      } else {
        throw new Error('Unable to open the rebalance review. Please try again.');
      }

      // Advance the progress indicator only after calculation produced a real
      // Step-3 plan. Setting this before awaiting the parent handler allowed a
      // failed calculate to close Step 2 and silently return to Home.
      if (setCurrentStep) {
        setCurrentStep(3);
      }

      // Brief delay to let RebalanceModal render before closing this modal
      await new Promise(resolve => setTimeout(resolve, 300));

      onClose();

    } catch (error) {
      console.error('Error in handleClose:', error);
      setError(
        error?.response?.data?.message ||
        error?.message ||
        'Could not prepare the rebalance. Please try again.',
      );
    } finally {
      setShowTransitionLoader(false);
    }
  };

  const handleBack = () => {
    if (setCurrentStep) {
      setCurrentStep(1);
    }
    onClose();
  };

  const handleConfirmStock = index => {
    setUserInitiatedAction(true);
    const updatedConfirmed = { ...confirmedStocks };
    updatedConfirmed[index] = !updatedConfirmed[index];
    setConfirmedStocks(updatedConfirmed);
  };

  useEffect(() => {
    if (isConfirmingFailed && initialProcessDone.current) {
      // console.log("Confirmation state updated:", confirmedStocks);
    }
  }, [confirmedStocks, isConfirmingFailed]);

  const hasAnyConfirmedStock = () => {
    return Object.values(confirmedStocks).some(value => value === true);
  };

  const handleDone = async () => {
    if (!userInitiatedAction && isConfirmingFailed) {
      return;
    }
    if (viewMode === 'editing') {
      Keyboard.dismiss();
    }
    setIsUpdating(true);
    setError(null);

    try {
      if (viewMode === 'confirmFailed') {
        await confirmManualOrders();
      } else {
        if (!portfolioDocId) {
          console.error(
            'Portfolio Doc ID is missing when trying to update portfolio',
          );

          try {
            const response = await axios.get(
              `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}?broker=${encodeURIComponent(userbroker || 'DummyBroker')}`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Advisor-Subdomain':
                    configData?.config?.REACT_APP_HEADER_NAME,
                  'aq-encrypted-key': generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET,
                  ),
                },
              },
            );

            const docId = extractPortfolioDocumentId(response.data?.data);
            if (!docId) {
              throw new Error('Could not retrieve portfolio document ID');
            }
            setPortfolioDocId(docId);
            await updatePortfolio(docId);
          } catch (fetchErr) {
            console.error('Error fetching portfolio document ID:', fetchErr);
            if (fetchErr?.response?.config?.method?.toLowerCase() === 'put') {
              throw fetchErr;
            }
            throw new Error('Portfolio record could not be retrieved. Please refresh and try again.');
          }
        } else {
          await updatePortfolio(portfolioDocId);
        }
      }
    } catch (err) {
      console.error('Error in handleDone:', err, err.response);
      setError(
        err?.response?.data?.error || err?.response?.data?.message ||
        err.message || 'Failed to update portfolio. Please try again.',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const updatePortfolio = async docId => {
    const hasInvalidHolding = localStockList.some(item =>
      !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 ||
      !Number.isFinite(Number(item.averagePrice)) || Number(item.averagePrice) <= 0,
    );
    if (hasInvalidHolding) {
      throw new Error('Enter a valid quantity and price for every holding.');
    }
    const filteredStockList = localStockList;
    console.log('🔄 Starting portfolio update...', {
      docId,
      itemCount: filteredStockList.length,
    });

    const updatedPortfolio = {
      data: {
        _id: {
          $oid: docId,
        },
        model_name: modelName,
        user_email: userEmail,
        holdings_version: holdingsVersionRef.current,
        holding_change_mode: viewMode === 'editing' ? 'edit' : 'confirm',
        user_net_pf_model: {
          order_results: filteredStockList.map(item => {
            const { reactKey, ...rest } = item;
            return {
              ...rest,
              tradingSymbol:
                item.tradingSymbol || item.symbol || rest.tradingSymbol || rest.symbol,
              quantity: String(item.quantity),
              // netpf UNIT RULE: quantity = cumulative net holding; filledShares
              // = that rebalance's increment only. A manual Edit Portfolio
              // Holdings snapshot asserts the CURRENT holding — it carries no
              // rebalance increment, so filledShares must be 0, never quantity.
              filledShares: '0',
              transactionType: 'BUY',
              averageEntryPrice: Number.parseFloat(item.averageEntryPrice) || 0,
              averagePrice: Number.parseFloat(item.averagePrice) || 0,
            };
          }),
          user_broker: userbroker ? userbroker : 'DummyBroker',
        },
        holding_removal_actions: pendingReclassificationsRef.current,
      },
    };

    const response = await axios.put(
      `${server.ccxtServer.baseUrl}rebalance/update/user-portfolio/latest`,
      updatedPortfolio,
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

    console.log('✅ Portfolio update response:', response.data);

    if (response.data && response.data.status === 0) {
      onUpdateStockList(filteredStockList);
      updatePendingReclassifications([]);
      setSuccessMessage('Portfolio updated successfully!');
      setShowSuccessLoader(true);

      try {
        if (!handleAcceptRebalance) {
          throw new Error('Unable to open the rebalance review. Please try again.');
        }
        const advanced = await handleAcceptRebalance();
        if (advanced !== true) {
          setSuccessMessage(null);
          setShowSuccessLoader(false);
          return;
        }
        if (setCurrentStep) {
          setCurrentStep(3);
        }
        setSuccessMessage(null);
        setShowSuccessLoader(false);
        onClose();
      } catch (error) {
        setSuccessMessage(null);
        setShowSuccessLoader(false);
        throw error;
      }
    } else {
      throw new Error(
        response.data?.error || response.data?.message || 'Failed to update portfolio',
      );
    }
  };

  const confirmManualOrders = async () => {
    const confirmedFailedStocks = localStockList.filter((stock, index) => {
      const isFailed = isStockFailed(stock);
      return isFailed && confirmedStocks[index] === true;
    });

    if (confirmedFailedStocks.length === 0) {
      setSuccessMessage('No failed orders to confirm');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 3000);
      return;
    }

    let modelUserObjectId = portfolioDocId;

    if (!modelObjectId || !modelUserObjectId) {
      try {
        const response = await axios.get(
          `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}?broker=${encodeURIComponent(userbroker || 'DummyBroker')}`,
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

        if (
          response.data &&
          response.data.data &&
          extractPortfolioDocumentId(response.data.data)
        ) {
          modelUserObjectId = extractPortfolioDocumentId(response.data.data);
          setPortfolioDocId(modelUserObjectId);
        } else {
          throw new Error('Could not retrieve portfolio document ID');
        }
      } catch (fetchErr) {
        console.error('Error fetching portfolio document ID:', fetchErr);
        setError(
          'Failed to confirm orders. Could not retrieve portfolio document ID.',
        );
        setIsUpdating(false);
        return;
      }
    }

    const payload = {
      userEmail: userEmail,
      modelObjectId: modelObjectId,
      modelUserObjectId: modelUserObjectId,
      updatedPortfolio: confirmedFailedStocks.map(stock => ({
        symbol: stock.symbol,
        exchange: stock.exchange,
        transactionType: stock.transactionType,
        filledShares: Number(stock.quantity),
        averagePrice: Number.parseFloat(stock.averagePrice) || 0,
      })),
      advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
      modelName: modelName,
      userBroker: userbroker,
    };

    const response = await axios.put(
      `${server.ccxtServer.baseUrl}rebalance/update/user-portfolio/latest/keys`,
      payload,
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

    if (response.data && response.data.status === 0) {
      const updatedStockList = stockData.filter(stock => {
        if (!isStockFailed(stock)) return true;

        const stockIndex = localStockList.findIndex(
          localStock =>
            localStock.symbol === stock.symbol &&
            localStock.transactionType === stock.transactionType &&
            localStock.quantity.toString() === stock.quantity.toString(),
        );

        return stockIndex === -1 || !confirmedStocks[stockIndex];
      });

      onUpdateStockList(updatedStockList);
      setSuccessMessage('Failed orders confirmed successfully!');

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 3000);
    } else {
      throw new Error('Failed to confirm manual orders');
    }
  };

  const handleSwitchToEdit = () => {
    setViewMode('editing');
  };

  const handleExitEditMode = () => {
    Keyboard.dismiss();
    setShowAddForm(false);
    setViewMode('viewing');
  };

  const handleOpenAddForm = () => {
    addFormRequestedFocusRef.current = true;
    setShowAddForm(true);
  };

  const handleCloseAddForm = () => {
    addFormRequestedFocusRef.current = false;
    Keyboard.dismiss();
    setShowAddForm(false);
  };

  const notifyParent = updatedList => {
    if (updatedList) {
      const originalStructureList = updatedList.map(item => {
        const { averageEntryPrice, averagePrice, reactKey, ...rest } = item;

        const updatedItem = {
          ...rest,
          quantity: String(item.quantity),
          filledShares: '0',
        };

        if (item.transactionType === 'BUY' || item.transactionType === 'SELL') {
          updatedItem.averageEntryPrice = averageEntryPrice;
          updatedItem.averagePrice = averagePrice;
        } else {
          updatedItem.averagePrice = averagePrice;
        }
        return updatedItem;
      });
      onUpdateStockList(originalStructureList);
    }
  };

  const handleQuantityChange = (index, value) => {
    const quantity = String(value || '').replace(/[^0-9]/g, '');
    const updatedList = localStockList.map((item, i) =>
      i === index ? { ...item, quantity: quantity } : item,
    );
    setLocalStockList(updatedList);
    notifyParent(updatedList);
  };

  const handlePriceChange = (index, value) => {
    const price = String(value || '').replace(/[^0-9.]/g, '');
    if (!/^\d*(?:\.\d{0,2})?$/.test(price)) return;
    const updatedList = localStockList.map((item, i) =>
      i === index
        ? { ...item, averagePrice: price, averageEntryPrice: price }
        : item,
    );
    setLocalStockList(updatedList);
    notifyParent(updatedList);
  };

  const handleDeleteStock = (item, index) => {
    const pendingSale = item.holdingRemovalAction === 'sell_and_remove' ||
      pendingReclassifications.some(row =>
        row.symbol === item.symbol && row.action === 'sell_and_remove',
      );
    if (pendingSale) {
      Alert.alert(
        'Sale removal is pending',
        `${item.symbol} stays in this plan until the broker confirms the full sale.`,
        [
          {text: 'Keep pending', style: 'cancel'},
          {
            text: 'Cancel instruction',
            onPress: () => {
              updatePendingReclassifications(current => [
                ...current.filter(row => row.symbol !== item.symbol),
                {
                  symbol: item.symbol,
                  exchange: item.exchange,
                  action: 'cancel_sell_and_remove',
                },
              ]);
              setLocalStockList(current => current.map((row, rowIndex) => {
                if (rowIndex !== index) return row;
                const {holdingRemovalAction, ...rest} = row;
                return rest;
              }));
            },
          },
        ],
      );
      return;
    }
    Alert.alert(
      'Remove from this model?',
      `${item.symbol} will remain in your ${userbroker || 'broker'} account but will no longer be assigned to this model. A future model rebalance may buy it again.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Keep at broker',
          onPress: () => {
            const updatedList = localStockList.filter((_, i) => i !== index);
            setLocalStockList(updatedList);
            updatePendingReclassifications(current => [
              ...current.filter(row => row.symbol !== item.symbol),
              {
                symbol: item.symbol,
                exchange: item.exchange,
                action: 'keep_outside_plan',
              },
            ]);
          },
        },
      ],
    );
  };

  const clearFormFields = () => {
    // Clear all symbol-related fields
    setNewSymbol('');
    setSelectedInstrument(null);
    setDisplayText('');

    // Clear price and quantity fields
    setNewPrice('');
    setNewQuantity('');

    // Reset transaction type to default
    setNewTransactionType('BUY');

    // Reset exchange to default
    setNewExchange('NSE');

    // Clear any search results
    setSymbolResults([]);

    // Clear any loading states
    setIsSymbolLoading(false);

    console.log('Form fields cleared after successful addition');
  };

  const handleAddNewStock = async () => {
    // Store current values before clearing
    // Persist only an instrument selected from the server-backed scrip master.
    // Accepting free text previously allowed "YES" to be stored when the
    // customer intended YESBANK-EQ, creating a different holding identity.
    const currentSymbol = selectedInstrument?.symbol?.trim().toUpperCase() || '';
    const currentQuantity = Number.parseInt(newQuantity, 10);
    const currentPrice = Number.parseFloat(newPrice);
    const currentExchange =
      selectedInstrument?.exchange?.trim().toUpperCase() || '';

    // Validate inputs
    if (
      !currentSymbol ||
      !selectedInstrument ||
      !currentExchange ||
      isNaN(currentQuantity) ||
      currentQuantity <= 0 ||
      isNaN(currentPrice) ||
      currentPrice < 0
    ) {
      alert(
        'Please select a stock from the search results and enter a positive quantity and valid price.',
      );
      return;
    }

    setIsUpdating(true);

    try {
      const newItem = {
        symbol: currentSymbol,
        exchange: currentExchange,
        quantity: currentQuantity,
        transactionType: newTransactionType,
        averagePrice: currentPrice,
        averageEntryPrice: currentPrice,
        uniqueOrderId: ``,
        orderId: ``,
        orderStatus: 'complete',
        filledShares: currentQuantity,
        unfilledShares: '0',
        productType: 'DELIVERY',
        orderType: 'MARKET',
        lotsize: '1',
        message: 'Manually Added',
        message_aq: 'Complete',
        status: 0,
        disclosedQuantity: '0',
        duration: 'DAY',
        instrumentType: '',
        optionType: '',
        orderStatusMessage: '',
        orderUpdateTime: new Date().toISOString(),
        price: 0.0,
        rebalance_status: 'success',
        tradeId: 'not in trade/payload',
        user_broker: userbroker,
        variety: 'NORMAL',
      };

      const updatedList = [...localStockList, newItem];
      setLocalStockList(updatedList);
      updatePendingReclassifications(current =>
        current.filter(row => row.symbol !== currentSymbol),
      );
      notifyParent(updatedList);

      // Clear form only after successful addition
      clearFormFields();
      setShowAddForm(false);
      console.log('Position added successfully:', currentSymbol);
    } catch (error) {
      console.error('Error adding stock:', error);
      alert('Failed to add position. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const isEditing = viewMode === 'editing';
  const isConfirmingFailedLocal = viewMode === 'confirmFailed';

  const renderStockItem = ({ item, index }) => {
  const isBuy = item.transactionType === 'BUY';
  const isFailed = isStockFailed(item);
  const ltp = getLTPForSymbol(item?.symbol) || formatPrice(item.averagePrice);
  const ltpValue = typeof ltp === 'object' ? ltp.last_traded_price : ltp; // Ensure valid value

  return (
    <Pressable
      key={item.reactKey}
      style={[styles.card, isFailed && styles.failedCard]}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.symbolText}>{item.symbol}</Text>
          {item.holdingRemovalAction === 'sell_and_remove' && (
            <Text style={styles.pendingRemovalText}>
              Sell pending — kept in plan until broker confirms
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
          {isEditing && (
            <TouchableOpacity onPress={() => handleDeleteStock(item, index)}>
              <Trash size={18} color={designColor('959595')} />
            </TouchableOpacity>
          )}
          {isFailed && <Text style={styles.failedText}>(Failed)</Text>}
        </View>
      </View>
      {isFailed && item.orderStatusMessage && (
        <Text style={styles.failedReasonText}>
          {item.orderStatusMessage}
        </Text>
      )}
      {true && (
        <View style={[styles.editRow, styles.topSpacing]}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              {/* Price */}
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text style={styles.inputLabel}>Price</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="decimal-pad"
                    value={String(item.averagePrice)}
                    onChangeText={value => handlePriceChange(index, value)}
                    placeholder={isBuy ? 'Entry' : 'Exit'}
                    placeholderTextColor={designColor('9ca3af')}
                    editable={isEditing}
                  />
                  {isEditing && (
                    <TouchableOpacity
                      style={[styles.ltpButton, {backgroundColor: gradient2}]}
                      onPress={() => {
                        const ltpValue = getLTPForSymbol(item.symbol);
                        if (ltpValue && ltpValue !== 'N/A') {
                          handlePriceChange(index, cleanPriceInput(ltpValue));
                        }
                      }}>
                      <Text style={styles.ltpButtonText}>LTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Quantity */}
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(item.quantity)}
                  onChangeText={value => handleQuantityChange(index, value)}
                  placeholder="Qty"
                  placeholderTextColor={designColor('9ca3af')}
                  editable={isEditing}
                />
              </View>

              {/* Exchange (Dropdown) */}
              <View
                style={{ flex: 1, alignItems: 'flex-start', marginLeft: 5 }}>
                <Text style={styles.inputLabel}>Exchange</Text>
                <TouchableOpacity
                  style={[styles.input, { flex: 1 }]}
                  onPress={() => setShowExchangePicker(index)} // open modal for this row
                >
                  <Text
                    style={{ color: item.exchange ? designColor('111827') : designColor('9ca3af') }}>
                    {item.exchange || 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
  };

  const formatSymbolDisplay = (symbol, exchange) => {
    if (symbol && exchange) {
      return `${symbol} (${exchange})`;
    }
    return symbol || '';
  };

  // Function to extract just the symbol from formatted text
  const extractSymbolFromDisplay = displayText => {
    const match = displayText.match(/^([A-Z0-9-]+)/);
    return match ? match[1] : displayText;
  };

  // console.log('symbolResults', symbolResults);
  return (
    <Modal
      ref={holdingsModalRef}
      animationType="fade"
      transparent={false}
      visible={isOpen}
      testID="holdings-editor-modal"
      onShow={() => configureAndroidModalKeyboard(holdingsModalRef)}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={{ backgroundColor: designColor('fff'), flex: 1 }}>
            <ScrollView
              style={styles.modalContainer}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingTop: 20,
                }}>
                <Text></Text>
              </View>

              {true && (
                <View style={[styles.progressBarContainer]}>
                  <StepProgressBar steps={stepsData} currentStep={2} />
                </View>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={isUpdating}
                accessibilityLabel="Close modal">
                <Icon name="x" size={24} color={designColor('6b7280')} />
              </TouchableOpacity>

              <View style={styles.content}>
                <View style={styles.header}>
                  <View style={styles.headerTitle}>
                    {isConfirmingFailedLocal ? (
                      <View style={styles.headerIconText}>
                        <Icon name="check-square" size={20} color={designColor('10b981')} />
                        <Text style={styles.titleText}>
                          Confirm Failed Orders
                        </Text>
                      </View>
                    ) : isEditing ? (
                      <View></View>
                    ) : (
                      <View style={styles.titleText1}>
                        <View>
                          <Text style={styles.titleText}>
                            {isRetryRebalance
                              ? `Review your current holdings in ${modelName} Portfolio`
                              : `YOUR PORTFOLIO balance in current \nmodel portfolio (before the update)`}
                          </Text>
                          <Text style={styles.titleText2}>
                            {isRetryRebalance
                              ? "These will be used to generate the remaining rebalance instructions. Click 'Continue' to proceed."
                              : "(ONLY specific to this portfolio - as recorded before this update "}
                          </Text>
                        </View>

                        {!isRetryRebalance && (
                          <TouchableOpacity
                            onPress={handleSwitchToEdit}
                            style={[styles.editPortfolioButton, { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: gradient2 }]}
                            disabled={isUpdating}
                          >
                            <Plus size={8} color={designColor('fff')} />
                            <Text style={[styles.editPortfolioButtonText, { fontSize: 10 }]}>
                              Add or Edit stocks
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                  {!isEditing && isConfirmingFailedLocal && (
                    <View style={[styles.alert, styles.alertAmber]}>
                      <Icon
                        name="alert-triangle"
                        size={18}
                        color={designColor('f59e0b')}
                        style={styles.alertIcon}
                      />
                      <Text style={styles.alertText}>
                        Please confirm the orders that have failed and you've
                        manually placed. Click the "Confirm" button for each
                        failed order. The "Done" button will be enabled once all
                        failed orders are confirmed.
                      </Text>
                    </View>
                  )}

                  {isEditing && (
                    <View style={styles.headerIconText}>
                      <Icon name="edit-2" size={20} color={gradient2} />
                      <Text style={styles.titleText}>
                        Edit Portfolio Holdings
                      </Text>
                    </View>
                  )}
                  {isEditing && (
                    <Text style={styles.headerSubtitle}>
                      Adjust Quantity or Entry/Exit Price. Add or remove
                      positions as needed.
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.listContainer,
                    isEditing
                      ? styles.listBorderBlue
                      : isConfirmingFailedLocal
                        ? styles.listBorderAmber
                        : styles.listBorderSlate,
                  ]}>
                  {error && (
                    <View style={styles.centeredMessage}>
                      <View style={styles.errorBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon
                            name="alert-triangle"
                            size={18}
                            color={designColor('ef4444')}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.errorText}>{error}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {isLoading ? (
                    <View style={styles.centeredMessage}>
                      <ActivityIndicator size="large" color={gradient2} />
                      <Text style={styles.loadingText}>
                        Loading portfolio data...
                      </Text>
                    </View>
                  ) : localStockList.length > 0 ? (
                    <FlatList
                      data={localStockList}
                      extraData={isEditing}
                      keyExtractor={(item, index) => item.reactKey || item.symbol || index.toString()}
                      renderItem={({ item, index }) => renderStockItem({ item, index })}
                      contentContainerStyle={styles.scrollViewContent}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    />
                  ) : (
                    <View style={styles.centeredMessage}>
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateTitle}>
                          {isConfirmingFailedLocal
                            ? 'No failed orders to confirm'
                            : 'You do not have holdings associated with THIS model portfolio'}
                        </Text>
                        <Text style={styles.emptyStateText}>
                          {isEditing
                            ? "Click the 'Add' button below to add positions."
                            : isConfirmingFailedLocal
                              ? 'There are no failed orders that need confirmation.'
                              : 'This is only for this model portfolio, it is not supposed to contain data for your entire portfolio'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {isConfirmingFailedLocal ? (
                <>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={[styles.nextStepButton, {backgroundColor: gradient2}]}
                    disabled={isUpdating || showTransitionLoader}>
                    <Text style={styles.nextStepButtonText}>Continue</Text>
                  </TouchableOpacity>
                  {countConfirmedFailStocks && (
                    <View style={styles.confirmCountContainer}>
                      <Text style={styles.confirmCountText}>
                        {countConfirmedFailStocks()}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={handleSwitchToEdit}
                    style={[styles.editButton, {backgroundColor: gradient2}]}
                    disabled={isUpdating}>
                    <Icon
                      name="edit-2"
                      size={16}
                      color={designColor('fff')}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDone}
                    style={[
                      styles.doneButton,
                      (!areAllFailStocksConfirmed() || isUpdating) &&
                      styles.doneButtonDisabled,
                    ]}
                    disabled={!areAllFailStocksConfirmed() || isUpdating}>
                    {isUpdating ? (
                      <ActivityIndicator
                        color={designColor('fff')}
                        size="small"
                        style={{ marginRight: 6 }}
                      />
                    ) : (
                      <Icon
                        name="check-square"
                        size={16}
                        color={designColor('fff')}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : !isEditing ? (
                <>
                  <View style={[styles.buttonRowContainer, {flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 20}]}>
                    <TouchableOpacity
                      onPress={handleSwitchToEdit}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: designColor('fff'),
                        borderWidth: 1,
                        borderColor: gradient2,
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        flex: 1,
                      }}
                      disabled={isUpdating}>
                      <Icon name="edit-2" size={14} color={gradient2} style={{marginRight: 6}} />
                      <Text style={{fontFamily: designFont('Poppins-Medium'), fontSize: 13, color: gradient2}}>Edit Holdings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={[styles.nextStepButton, {backgroundColor: gradient2, flex: 1}]}
                      disabled={isUpdating || showTransitionLoader}>
                      <Text style={styles.nextStepButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    justifyContent: 'space-between',
                    marginHorizontal: 20,
                    marginTop: 10,
                  }}>
                  <TouchableOpacity
                    onPress={handleExitEditMode}
                    style={[styles.backButton, { height: 40 }]}
                    disabled={isUpdating}>
                    <Icon
                      name="arrow-left"
                      size={16}
                      color={designColor('fff')}
                      style={{ marginRight: 6 }}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleOpenAddForm}
                    style={{
                      backgroundColor: gradient2,
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      borderRadius: 8,
                      height: 40,
                      alignSelf: 'center',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: designColor('000'),
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3.84,
                      elevation: 5,
                    }}
                    disabled={isUpdating}>
                    <Text style={styles.doneEditButtonText}>+ Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDone}
                    style={[
                      styles.doneEditButton,
                      isUpdating && styles.doneEditButtonDisabled,
                    ]}
                    disabled={isUpdating}>
                    {isUpdating ? (
                      <ActivityIndicator
                        color={designColor('fff')}
                        size="small"
                        style={{ marginRight: 6 }}
                      />
                    ) : null}
                    <Text style={styles.doneEditButtonText}>Done Editing</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {successMessage && (
              <View style={styles.successOverlay}>
                <View style={styles.successContainer}>
                  <View style={styles.successIconContainer}>
                    <Icon name="check-square" size={24} color={designColor('10b981')} />
                  </View>
                  <View style={styles.successTextContainer}>
                    <Text style={styles.successTitle}>Success!</Text>
                    <Text style={styles.successMessageText}>
                      {successMessage}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {showSuccessLoader && (
              <View style={styles.transitionLoaderOverlay}>
                <View style={styles.transitionLoaderContainer}>
                  <ActivityIndicator size="large" color={gradient2} />
                  <Text style={styles.transitionLoaderText}>Processing...</Text>
                </View>
              </View>
            )}
            {showFormAdd && (
              <View style={styles.overlayContainer}>
                <View style={styles.addNewForm}>
                  <Text style={styles.addNewFormTitle}>Add New Position</Text>

                  <View style={styles.formGrid}>
                    <View style={styles.formGroup}>
                      <View style={styles.formLabelRow}>
                        <Text style={styles.formLabel}>Symbol</Text>
                        {newSymbol &&
                          symbolResults.length === 0 &&
                          getLTPForSymbol(newSymbol) &&
                          getLTPForSymbol(newSymbol) !== 'N/A' && (
                            <Text style={styles.formLTP}>
                              LTP:{' '}
                              <Text style={styles.formLTPValue}>
                                {getLTPForSymbol(newSymbol)}
                              </Text>
                            </Text>
                          )}
                      </View>

                      <TextInput
                        ref={newSymbolInputRef}
                        style={styles.textInput}
                        value={displayText || newSymbol}
                        onChangeText={text => {
                          if (displayText && text !== displayText) {
                            setDisplayText('');
                            setSelectedInstrument(null);
                            setNewExchange('NSE');
                            setNewSymbol(text);
                          } else if (!displayText) {
                            setNewSymbol(text);
                          }
                        }}
                        placeholder="e.g., YESBANK-EQ"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        onFocus={() => {
                          if (displayText) {
                            const extractedSymbol =
                              extractSymbolFromDisplay(displayText);
                            setNewSymbol(extractedSymbol);
                            setDisplayText('');
                          }
                        }}
                        returnKeyType="next"
                      />

                      {isSymbolLoading && (
                        <ActivityIndicator
                          size="small"
                          color={designColor('9ca3af')}
                          style={styles.symbolLoading}
                        />
                      )}

                      {symbolResults?.map(symbol => (
                        <TouchableOpacity
                          key={symbol.id}
                          onPress={() => {
                            setSelectedInstrument({
                              symbol: symbol.symbol,
                              exchange: symbol.exchange,
                            });
                            setNewExchange(symbol.exchange);

                            const formattedDisplay = formatSymbolDisplay(
                              symbol.symbol,
                              symbol.exchange,
                            );
                            setDisplayText(formattedDisplay);
                            setNewSymbol(symbol?.symbol);
                            setSymbolResults([]);
                            const cachedPrice = cleanPriceInput(
                              marketPrices[symbol?.symbol],
                            );
                            if (cachedPrice) {
                              setNewPrice(cachedPrice);
                            } else {
                              fetchMarketPrices([symbol?.symbol]);
                            }

                            const ltp = getLTPForSymbol(symbol.symbol);
                            const livePrice = cleanPriceInput(ltp);
                            if (livePrice) {
                              setNewPrice(livePrice);
                            }
                          }}
                          style={styles.symbolResultItem}>
                          <Text style={styles.symbolResultText}>
                            {symbol.symbol}{' '}
                            <Text style={styles.symbolResultExchange}>
                              ({symbol.exchange})
                            </Text>
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.formGroupHalf}>
                        <Text style={styles.formLabel}>
                          {newTransactionType === 'BUY'
                            ? 'Entry Price'
                            : 'Exit Price'}
                        </Text>
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TextInput
                            style={[styles.textInput, { flex: 1 }]}
                            value={newPrice}
                            onChangeText={setNewPrice}
                            placeholder="0.00"
                            keyboardType="decimal-pad"
                            maxLength={10}
                            returnKeyType="next"
                          />
                          <TouchableOpacity
                            style={[styles.ltpButton, {backgroundColor: gradient2}]}
                            onPress={() => {
                              const ltpValue = getLTPForSymbol(newSymbol);
                              const normalizedPrice = cleanPriceInput(ltpValue);
                              if (normalizedPrice) {
                                setNewPrice(normalizedPrice);
                              }
                            }}>
                            <Text style={styles.ltpButtonText}>LTP</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.formGroupHalf}>
                        <Text style={styles.formLabel}>Quantity</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newQuantity}
                          onChangeText={setNewQuantity}
                          placeholder="0"
                          keyboardType="numeric"
                          maxLength={10}
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    <View style={styles.addButtonWrapper}>
                      <TouchableOpacity
                        onPress={handleAddNewStock}
                        style={[
                          styles.addButton,
                          {backgroundColor: gradient2},
                          (!selectedInstrument ||
                            !newQuantity ||
                            !newPrice ||
                            Number.parseFloat(newQuantity) <= 0 ||
                            isUpdating) &&
                          styles.addButtonDisabled,
                        ]}
                        disabled={
                          !selectedInstrument ||
                          !newQuantity ||
                          !newPrice ||
                          Number.parseFloat(newQuantity) <= 0 ||
                          isUpdating
                        }>
                        {isUpdating ? (
                          <ActivityIndicator
                            color={designColor('fff')}
                            size="small"
                            style={{ marginRight: 6 }}
                          />
                        ) : (
                          <Icon
                            name="plus-circle"
                            size={16}
                            color={designColor('fff')}
                            style={{ marginRight: 6 }}
                          />
                        )}
                        <Text style={styles.addButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleCloseAddForm}
                    style={styles.closeButtonModal}>
                    <Text style={styles.closeButtonTextModal}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {showTransitionLoader && (
              <View style={styles.transitionLoaderOverlay}>
                <View style={styles.transitionLoaderContainer}>
                  <ActivityIndicator size="large" color={gradient2} />
                  <Text style={styles.transitionLoaderText}>Loading...</Text>
                </View>
              </View>
            )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: designColor('fff'),
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    flexDirection: 'column',
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  progressBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: designColor('e5e7eb'),
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    padding: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    padding: 20,
    width: screenWidth,
  },
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIconText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 16,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('1e293b'),
  },
  titleText2: {
    fontSize: 10,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('1e293b'),
  },
  alert: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertWarning: {
    backgroundColor: designColor('fffbeb'),
    borderColor: designColor('fde68a'),
  },
  alertAmber: {
    backgroundColor: designColor('fff7ed'),
    borderColor: designColor('fed7aa'),
  },
  alertIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  alertText: {
    fontSize: 14,
    color: designColor('a16207'),
    flexShrink: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: designColor('475569'),
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: designColor('f8fafc'),
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e2e8f0'),
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: designColor('475569'),
    textTransform: 'uppercase',
  },
  listContainer: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listBorderBlue: {
    borderColor: designColor('bfdbfe'),
  },
  listBorderAmber: {
    borderColor: designColor('fed7aa'),
  },
  listBorderSlate: {
    borderColor: designColor('e2e8f0'),
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 160,
  },
  loadingText: {
    marginTop: 8,
    color: designColor('475569'),
    fontSize: 14,
  },
  errorBox: {
    padding: 16,
    backgroundColor: designColor('fee2e2'),
    borderColor: designColor('fca5a5'),
    borderWidth: 1,
    borderRadius: 6,
  },
  errorText: {
    color: designColor('b91c1c'),
    fontSize: 14,
    flexShrink: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
    color: designColor('334155'),
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: designColor('64748b'),
    textAlign: 'center',
  },
  card: {
  backgroundColor: designColor('ffffff'),
  borderRadius: 8,
  padding: 12,
  marginVertical: 4,
  marginHorizontal: 16,
  shadowColor: designColor('000'),
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
  borderWidth: 1,
  borderColor: designColor('f0f0f0'),
},
  failedCard: {
    borderColor: designColor('dc2626'),
    borderWidth: 1,
    backgroundColor: designColor('fef2f2'),
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topSpacing: {
    marginTop: 10,
  },
  symbolText: {
  fontSize: 14,
  fontFamily: designFont('Satoshi-Medium'),
  color: designColor('111827'),
  marginBottom: 4,
},
  failedText: {
    fontSize: 14,
    color: designColor('dc2626'),
    fontWeight: '500',
  },
  failedReasonText: {
    fontSize: 10,
    color: designColor('dc2626'),
    marginTop: 2,
    lineHeight: 14,
  },
  pendingRemovalText: {
    color: designColor('b45309'),
    fontSize: 10,
    marginTop: 2,
  },
  exchangeText: {
    fontSize: 12,
    color: designColor('6b7280'),
    fontFamily: designFont('Satoshi-Medium'),
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  buyBadge: {
    backgroundColor: designColor('d1fae5'),
  },
  sellBadge: {
    backgroundColor: designColor('fee2e2'),
  },
  badgeText: {
    fontSize: 11,
    marginLeft: 4,
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('111827'),
  },
  priceText: {
    fontSize: 12,
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('959595'),
  },
  input: {
    marginRight: 10,
    height: 25,
    padding: 0,
    color: designColor('0d0c22'),
    fontSize: 12,
    flex: 1,
    paddingHorizontal: 0,
    fontFamily: designFont('Satoshi-Bold'),
    textAlign: 'center',
    alignContent: 'center',
    borderColor: designColor('c8c8c8'),
    borderWidth: 0.1,
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 4,
  },
  editRow: {},
  addNewForm: {
    marginTop: 16,
    backgroundColor: designColor('fff'),
    borderRadius: 12,
    padding: 16,
    shadowColor: designColor('000'),
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '90%',
    position: 'relative',
  },
  addNewFormTitle: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('111827'),
    textAlign: 'center',
  },
  formGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  formGroup: {},
  formGroupHalf: {
    flex: 1,
    marginRight: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  formLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formLabel: {
    fontSize: 14,
    color: designColor('374151'),
  },
  formLTP: {
    fontSize: 13,
    color: designColor('6b7280'),
  },
  formLTPValue: {
    fontWeight: 'bold',
    color: designColor('16a34a'),
  },
  textInput: {
    height: 30,
    padding: 0,
    color: designColor('0d0c22'),
    fontSize: 12,
    paddingHorizontal: 10,
    fontFamily: designFont('Satoshi-Bold'),
    alignContent: 'center',
    borderColor: designColor('c8c8c8'),
    borderWidth: 0.5,
    borderRadius: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: designColor('f9fafb'),
    height: 25,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  picker: {
    flex: 1,
    color: designColor('111827'),
    fontSize: 13,
    lineHeight: 16,
  },
  symbolLoading: {
    marginTop: 8,
  },
  symbolResultsContainer: {
    maxHeight: 120,
    marginTop: 8,
    backgroundColor: designColor('f3f4f6'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
  },
  symbolResultsScroll: {
    paddingHorizontal: 8,
  },
  symbolResultItem: {
    paddingVertical: 8,
  },
  symbolResultText: {
    fontSize: 14,
    color: designColor('111827'),
  },
  symbolResultExchange: {
    fontSize: 12,
    color: designColor('6b7280'),
  },
  addButtonWrapper: {},
  addButton: {
    flexDirection: 'row',
    backgroundColor: designColor('2563eb'),
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: designColor('9ca3af'),
  },
  addButtonText: {
    color: designColor('fff'),
    fontWeight: '600',
    fontSize: 12,
  },
  buttonRowContainer: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designColor('4b5563'),
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 2,
    minWidth: 80,
  },
  backButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  iconOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designColor('f2f3f4'),
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 42,
  },
  editPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('0056b7'),
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  editPortfolioButtonText: {
    color: designColor('fff'),
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    textAlign: 'center',
  },
  nextStepButton: {
    backgroundColor: designColor('0056b7'),
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  nextStepButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
  },
  cancelButton: {
    paddingHorizontal: 24,
    backgroundColor: designColor('e2e8f0'),
    borderRadius: 8,
  },
  cancelButtonText: {
    color: designColor('334155'),
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    marginTop: 0,
    flexShrink: 0,
    marginBottom: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designColor('3b82f6'),
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designColor('10b981'),
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 2,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  doneButtonDisabled: {
    backgroundColor: designColor('a7f3d0'),
    opacity: 0.7,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
  },
  doneEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    backgroundColor: designColor('4f46e5'),
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  doneEditButtonDisabled: {
    backgroundColor: designColor('a5b4fc'),
    opacity: 0.7,
  },
  doneEditButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 50,
  },
  successContainer: {
    backgroundColor: 'white',
    borderLeftWidth: 4,
    borderLeftColor: designColor('22c55e'),
    borderRadius: 8,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    padding: 24,
    maxWidth: 400,
    width: '90%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  successIconContainer: {
    flexShrink: 0,
  },
  successTextContainer: {
    marginLeft: 12,
    flex: 1,
    paddingTop: 2,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: designColor('1f2937'),
  },
  successMessageText: {
    marginTop: 4,
    fontSize: 14,
    color: designColor('6b7280'),
  },
  inputLabel: {
  fontSize: 12,
  fontWeight: '500',
  color: designColor('374151'),
  marginBottom: 4,
},
  ltpButton: {
    marginLeft: 6,
    backgroundColor: designColor('2563eb'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ltpButtonText: {
    color: designColor('fff'),
    fontSize: 11,
    fontWeight: '600',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  closeButtonModal: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: designColor('ef4444'),
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonTextModal: {
    color: designColor('fff'),
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -2,
  },
  nextStepButtonDisabled: {
    opacity: 0.6,
  },
  transitionLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 9999,
  },
  transitionLoaderContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  transitionLoaderText: {
    marginTop: 16,
    fontSize: 16,
    color: designColor('1f2937'),
    fontFamily: designFont('Satoshi-Medium'),
  },
});

export default MPStatusModal;
