import {publisherOrderLabel} from '../../utils/publisherOrderLabel';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
  Image,
  SafeAreaView,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import Toast from 'react-native-toast-message';
import {
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  ChevronLeft,
  CrossIcon,
  Info,
  InfoIcon,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import {
  isOrderSuccess,
  isOrderRejected,
  isOrderPending,
  isOrderManuallyPlaced,
  summarizeOrderStatuses,
} from '../../utils/orderStatusUtils';
import {
  isCautionaryListingMessage,
  isInsufficientFundsMessage,
} from '../../utils/rebalanceHelpers';
import { designColor, designFont } from '../../design/literalTokens';
const { height: screenHeight } = Dimensions.get('window');
const { width: screenWidth } = Dimensions.get('window');
import { useModal } from '../ModalContext';
import LinearGradient from 'react-native-linear-gradient';
import { useConfig } from '../../context/ConfigContext';
import { resolveResultVariant } from '../../utils/tradeVariant';
import { DEFAULT_TOKENS } from '../../theme/colors';
import useTokens from '../../theme/useTokens';
import portfolioEvents, { PORTFOLIO_EVENTS } from '../../utils/portfolioEvents';
import {refreshSingleOrderStatus} from '../../services/OrderService';
import CustomerExecutionReportModal from '../CustomerExecutionReportModal';

const CheckedIcon = require('../../assets/checked.png');
const FailureIcon = require('../../assets/cross.png');
const PartialIcon = require('../../assets/partial_success.png');

const RecommendationSuccessModal = ({
  openSuccessModal,
  setOpenSucessModal,
  orderPlacementResponse,
  currentBroker,
  // Outgoing trade list captured at submit time by the parent. Used as a
  // fallback source for the per-row trade `variant` lookup when the
  // response item itself doesn't carry it (rebalance/MP lane via
  // ccxt-india's `rebalance/process-trade`, which doesn't echo variant).
  // Optional — when absent, missing variants default to `"REGULAR"` (no
  // pill rendered). See utils/tradeVariant.js § resolveResultVariant.
  originalStockDetails,
  // 2026-05-07: model-portfolio context required for the per-row
  // "Mark as Placed" inline editor on FAILURE rows. The editor lets
  // the user record a manual broker placement (cautionary listing,
  // restricted scrip, low-funds rejections — situations where the
  // automated retry will keep failing and the user has gone to the
  // broker app/web platform directly). The PUT call to
  // `/api/model-portfolio-db-update/manual-placement` requires
  // userEmail + modelId to find the right rebalanceHistory entry.
  // All four are optional — when missing, the inline editor still
  // shows but the Confirm button is disabled with a clear message.
  userEmail,
  modelId,
  modelName,
  uniqueId,
  onContinuePublisherBuys,
}) => {
  // Brand colors via useTokens — variant supplies the fallback, backend
  // config.gradient1 / gradient2 still override through legacy branding.
  const config = useConfig();
  const tokens = useTokens();
  const gradient1 = tokens.colors.brand.gradientStart;
  const gradient2 = tokens.colors.brand.gradientEnd;
  const brandPrimary = tokens.colors.brand.primary;
  const infoColor = tokens.colors.status.info;
  const stepCompletedColor = config?.paymentModal?.stepCompletedColor || designColor('29a400');
  // Status warning tokens — used by the AMO pill on result cards. Sourced
  // from `theme/colors.js § DEFAULT_TOKENS.status`. Tenant overrides via
  // `colorTokens.status.warning(Bg)` are honoured when present (config
  // resolution mirrors `buildColors()`), otherwise we fall back to the
  // default tokens. No new tokens introduced for this feature.
  const warningColor =
    config?.colorTokens?.status?.warning || DEFAULT_TOKENS.status.warning;
  const warningBg =
    config?.colorTokens?.status?.warningBg || DEFAULT_TOKENS.status.warningBg;
  const getProgressBarWidth = (executed, total) => {
    return (executed / total) * 100 + '%';
  };

  // 2026-05-07: removed `console.log("Order Response ----------",
  // orderPlacementResponse)` — this fired on every render and the
  // SDK result array contains 18+ lines per dump, which contributed
  // to a JS-thread starvation / ANR when the parent re-rendered
  // continuously after order placement. Bridge logs are not free.
  const { hideAddToCartModal, successclosemodel, setsuccessclosemodel } =
    useModal();

  const navigation = useNavigation();
  const [orderResponse, setOrderResponse] = useState(orderPlacementResponse);
  const [publisherRecovery, setPublisherRecovery] = useState(null);
  const [showCustomerReport, setShowCustomerReport] = useState(false);
  const [customerReportStatus, setCustomerReportStatus] = useState(null);

  useEffect(() => {
    setOrderResponse(orderPlacementResponse);
  }, [orderPlacementResponse]);

  const publisherAttemptId =
    orderPlacementResponse?.find?.(row => row?.attemptId)?.attemptId ||
    originalStockDetails?.find?.(row => row?.attemptId)?.attemptId;
  const publisherSubmittedSide =
    orderPlacementResponse?.find?.(row => row?.publisherSubmittedSide)
      ?.publisherSubmittedSide || 'SELL';

  useEffect(() => {
    if (
      !openSuccessModal ||
      currentBroker !== 'Zerodha' ||
      !userEmail ||
      !publisherAttemptId
    ) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/attempt-status`,
          {
            userEmail,
            attemptId: publisherAttemptId,
            publisherFinished: true,
            submittedSide: publisherSubmittedSide,
          },
          {
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        if (cancelled) return;
        const state = response?.data;
        if (Array.isArray(state?.legs) && state.legs.length > 0) {
          setOrderResponse(state.legs);
        }
        setPublisherRecovery(state || null);
      } catch (error) {
        if (!cancelled) {
          console.warn('[PublisherAttempt] foreground refresh failed:', error?.message);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [openSuccessModal, currentBroker, userEmail, publisherAttemptId,
      publisherSubmittedSide]);

  const [showStocksDetails, setShowStocksDetails] = useState(false);

  // 2026-05-07: per-row "Mark as Placed" inline editor state for
  // FAILURE rows in the result modal. The user taps the row's
  // "Mark as Placed" button → enters editing mode → can edit qty
  // and price (defaults: qty = original, price = LTP/rebalance
  // price/0) → tap Confirm → PUT
  // /api/model-portfolio-db-update/manual-placement → on success
  // we mutate orderResponse[idx] to flip the row's orderStatus
  // from FAILURE → 'manually_placed' so it renders as success.
  // - manualEditingIdx: index of the row in editor mode, or null
  // - manualEditQty: qty input text (string for TextInput)
  // - manualEditPrice: price input text
  // - submittingManualIdx: which row's request is in flight
  const [manualEditingIdx, setManualEditingIdx] = useState(null);
  const [manualEditQty, setManualEditQty] = useState('');
  const [manualEditPrice, setManualEditPrice] = useState('');
  const [submittingManualIdx, setSubmittingManualIdx] = useState(null);

  // 2026-05-08: per-row "Refresh Status" for OPEN orders (Axis timing
  // race — order.history returns [] immediately after placement, so we
  // return orderStatus='OPEN' and let the user refresh manually or wait
  // for the every-15-min cron to resolve it via the broker order book).
  const [refreshingIdx, setRefreshingIdx] = useState(null);

  const refreshOrderStatus = async (idx, item) => {
    if (refreshingIdx !== null) return;
    const orderId = item?.orderId || item?.uniqueOrderId;
    if (!userEmail || !currentBroker) return;
    setRefreshingIdx(idx);
    try {
      // Publisher can complete before one or more broker rows are visible. In
      // that state there is no orderId for the legacy single-order endpoint;
      // re-run exact attempt correlation against the whole Zerodha order book.
      if (!orderId && currentBroker === 'Zerodha') {
        const publisherStockDetails =
          Array.isArray(originalStockDetails) && originalStockDetails.length > 0
            ? originalStockDetails
            : orderResponse;
        const attemptId =
          item?.attemptId ||
          publisherStockDetails?.find(row => row?.attemptId)?.attemptId ||
          '';
        const headers = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        };
        const recordResponse = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
          {
            stockDetails: publisherStockDetails,
            publisherResults: [{status: 'success', source: 'manual_refresh'}],
            userEmail,
            broker: 'Zerodha',
            attemptId,
            model_id: modelId,
            modelName,
            unique_id: uniqueId,
          },
          {headers, timeout: 30000},
        );
        const refreshed =
          recordResponse?.data?.response || recordResponse?.data?.results || [];
        if (Array.isArray(refreshed) && refreshed.length > 0) {
          setOrderResponse(refreshed);
          if (modelId) {
            await axios.post(
              `${server.server.baseUrl}api/model-portfolio-db-update`,
              {
                modelId,
                orderResults: refreshed,
                modelName,
                userEmail,
                user_broker: currentBroker,
              },
              {headers},
            );
          }
          Toast.show({
            type: refreshed.some(row => row?.orderId) ? 'success' : 'info',
            text1: refreshed.some(row => row?.orderId)
              ? 'Broker status refreshed'
              : 'Still awaiting Zerodha confirmation',
            text2: 'Every basket leg was checked against your latest Kite order book.',
            visibilityTime: 4000,
          });
          return;
        }
        throw new Error('No broker status was returned for this attempt');
      }
      if (!orderId) return;
      const statusResponse = await refreshSingleOrderStatus(
        currentBroker,
        userEmail,
        orderId,
      );
      const newStatus = statusResponse?.orderStatus;
      if (newStatus && newStatus.toUpperCase() !== 'OPEN') {
        setOrderResponse(prev => {
          if (!Array.isArray(prev)) return prev;
          const next = prev.slice();
          if (next[idx]) {
            next[idx] = { ...next[idx], orderStatus: newStatus };
          }
          return next;
        });
        // Persist to DB if the order is now complete
        const terminal = ['COMPLETE', 'COMPLETED', 'TRADED', 'FILLED'];
        if (terminal.includes(newStatus.toUpperCase()) && modelName) {
          axios.post(
            `${server.ccxtServer.baseUrl}rebalance/resolve-single-order`,
            {
              user_email: userEmail,
              orderId,
              user_broker: currentBroker,
              model_name: modelName,
              new_status: newStatus,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getTenantSubdomain(),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            },
          ).catch(() => {}); // fire-and-forget; cron is the safety net
        }
        Toast.show({
          type: 'success',
          text1: 'Status updated',
          text2: `${item?.symbol || item?.tradingSymbol}: ${newStatus}`,
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Still pending',
          text2: 'Order not yet confirmed by broker. Auto-updates after market close.',
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Refresh failed',
        text2: e?.response?.data?.error || e?.message || 'Try again.',
        visibilityTime: 3000,
      });
    } finally {
      setRefreshingIdx(null);
    }
  };

  const startManualEdit = (idx, item) => {
    const defaultQty = String(item?.quantity ?? item?.qty ?? '');
    // Price preference: live LTP (item.lastTradedPrice / item.ltp / item.price) →
    // calculated rebalance_price (set by ccxt at advice generation) → blank.
    const defaultPrice = String(
      item?.lastTradedPrice ||
      item?.ltp ||
      item?.price ||
      item?.rebalance_price ||
      item?.averagePrice ||
      '',
    );
    setManualEditingIdx(idx);
    setManualEditQty(defaultQty);
    setManualEditPrice(defaultPrice);
  };

  const cancelManualEdit = () => {
    setManualEditingIdx(null);
    setManualEditQty('');
    setManualEditPrice('');
  };

  const submitManualPlacement = async (idx, item) => {
    if (submittingManualIdx !== null) return; // prevent double-tap
    if (!userEmail || !modelId) {
      Toast.show({
        type: 'error',
        text1: 'Cannot record placement',
        text2: 'Model context missing — close and reopen the rebalance.',
        visibilityTime: 4000,
      });
      return;
    }
    const qtyNum = Number(manualEditQty);
    const priceNum = Number(manualEditPrice);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid quantity',
        text2: 'Enter a positive number.',
      });
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid price',
        text2: 'Enter the actual average execution price from your broker.',
      });
      return;
    }
    setSubmittingManualIdx(idx);
    try {
      await axios.put(
        `${server.server.baseUrl}api/model-portfolio-db-update/manual-placement`,
        {
          userEmail,
          modelId,
          modelName,
          uniqueId,
          user_broker: currentBroker,
          symbol: item?.symbol || item?.tradingSymbol,
          exchange: item?.exchange,
          transactionType: item?.transactionType,
          actualQty: qtyNum,
          actualPrice: priceNum,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(config),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Mutate the row locally — flip from FAILURE to 'manually_placed'
      // and stamp the actuals so the UI reflects the user's input.
      // 'manually_placed' is in PENDING_STATUSES per orderStatusUtils
      // (added 2026-05-07), which means isOrderPending() returns true
      // → the row now counts toward `successCount` and renders with
      // the success card style.
      setOrderResponse((prev) => {
        if (!Array.isArray(prev)) return prev;
        const next = prev.slice();
        if (next[idx]) {
          next[idx] = {
            ...next[idx],
            orderStatus: 'manually_placed',
            orderPlacement: 'success',
            quantity: qtyNum,
            ...(priceNum !== null ? { price: priceNum } : {}),
            message_aq: 'Manually placed',
            orderStatusMessage: 'Marked as manually placed.',
          };
        }
        return next;
      });
      cancelManualEdit();
      // Notify portfolio listeners — manual placement is a holdings mutation.
      // Use HOLDINGS_REFRESH only (not REBALANCE_EXECUTED — this is a per-row
      // update, not a fresh rebalance).
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName,
        broker: currentBroker,
      });
      Toast.show({
        type: 'success',
        text1: 'Marked as placed',
        text2: `${item?.symbol || item?.tradingSymbol} recorded.`,
        visibilityTime: 3000,
      });
    } catch (e) {
      console.error('[manual-placement] error:', e?.response?.data || e?.message);
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2:
          e?.response?.data?.message ||
          e?.message ||
          'Try again in a moment.',
        visibilityTime: 4000,
      });
    } finally {
      setSubmittingManualIdx(null);
    }
  };

  const getFormattedDate = () => {
    const date = new Date();
    return moment(date).format('Do MMM YYYY');
  };

  const toggleStocksDetails = () => {
    setShowStocksDetails(!showStocksDetails);
  };

  // 2026-05-07: removed second `console.log('Order Response : ---',
  // orderPlacementResponse)` — same ANR-contributing pattern as the
  // one above. If you need to debug result rows, do it from the
  // RebalanceModal SDK callsite, not here on every re-render.

  const {
    totalCount,
    executedCount,
    manualPlacedCount,
    successCount,
    pendingCount,
    failureCount,
    unknownCount,
  } = summarizeOrderStatuses(orderResponse);
  const unconfirmedCount = pendingCount + unknownCount;
  const directReconciliationRow = orderResponse?.find?.(row =>
    row?.reconciliationRequired === true &&
    (row?.directAsyncJobId || row?.directAsyncRequestId),
  );
  const percentageOfTotal = count =>
    totalCount > 0 ? (count / totalCount) * 100 : 0;
  const successPercentage = percentageOfTotal(successCount);
  const pendingPercentage = percentageOfTotal(unconfirmedCount);
  const failurePercentage = percentageOfTotal(failureCount);

  // Classifiers extracted to rebalanceHelpers so RebalanceCard repair-mode
  // and any other surface can use the same matching rules. See
  // src/utils/rebalanceHelpers.js (isCautionaryListingMessage,
  // isInsufficientFundsMessage) and docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6e.
  const cautionaryListingStocks =
    orderResponse?.filter(isCautionaryListingMessage) || [];
  const hasCautionaryListingFailures = cautionaryListingStocks.length > 0;

  const lowFundsStocks =
    orderResponse?.filter(
      item => isOrderRejected(item?.orderStatus) && isInsufficientFundsMessage(item),
    ) || [];
  const hasLowFundsFailures = lowFundsStocks.length > 0;

  // Parse Angel One's "Available funds - Rs. {x} . You require Rs. {y}"
  // pattern. Returns null/null when the broker did not surface numeric values
  // (Zerodha/Upstox typically don't — the banner gracefully omits the summary).
  const parseLowFundsAmounts = (message) => {
    if (!message) return [null, null];
    const availMatch = message.match(
      /available\s+funds?\s*[-:]?\s*Rs\.?\s*(-?[\d,]+\.?\d*)/i,
    );
    const reqMatch = message.match(/(?:require|need)s?\s*Rs\.?\s*(-?[\d,]+\.?\d*)/i);
    const avail = availMatch ? parseFloat(availMatch[1].replace(/,/g, '')) : null;
    const req = reqMatch ? parseFloat(reqMatch[1].replace(/,/g, '')) : null;
    return [
      Number.isFinite(avail) ? avail : null,
      Number.isFinite(req) ? req : null,
    ];
  };

  // Compute aggregate Available + summed Required across all low-funds rows.
  // Available is the same wallet figure on every row in a single batch, so we
  // pick the first non-null we see.
  let lowFundsAvailable = null;
  let lowFundsRequiredTotal = 0;
  let lowFundsSawAnyRequired = false;
  for (const item of lowFundsStocks) {
    const msg =
      item?.orderStatusMessage || item?.message_aq || item?.message || '';
    const [avail, req] = parseLowFundsAmounts(msg);
    if (lowFundsAvailable === null && avail !== null) lowFundsAvailable = avail;
    if (req !== null) {
      lowFundsRequiredTotal += req;
      lowFundsSawAnyRequired = true;
    }
  }

  // Indian-grouping currency formatter (12,34,567.89). Negative renders with a
  // leading minus on the rupee symbol so the banner highlights debit balances.
  const formatINR = (v) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return '';
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    const intPart = Math.trunc(abs);
    const frac = abs - intPart;
    const intStr = String(intPart);
    let body;
    if (intStr.length <= 3) {
      body = intStr;
    } else {
      const last3 = intStr.slice(-3);
      let rest = intStr.slice(0, -3);
      const parts = [];
      while (rest.length > 2) {
        parts.unshift(rest.slice(-2));
        rest = rest.slice(0, -2);
      }
      if (rest.length > 0) parts.unshift(rest);
      body = parts.join(',') + ',' + last3;
    }
    const fracStr =
      frac > 0
        ? '.' + String(Math.round(frac * 100)).padStart(2, '0')
        : '';
    return `${sign}₹${body}${fracStr}`;
  };

  // 2026-05-07: removed `console.log('Log----', failureCount, successCount)`
  // — same render-time logging anti-pattern; not useful in prod.

  const renderOrderItem = ({ item, index }) => {
    const isSuccessStatus =
      isOrderSuccess(item?.orderStatus) ||
      isOrderManuallyPlaced(item?.orderStatus);
    const isPendingStatus =
      isOrderPending(item?.orderStatus) &&
      !isOrderManuallyPlaced(item?.orderStatus);
    const isFailureStatus = isOrderRejected(item?.orderStatus);
    // A rejection the SERVER retries on its own must not invite the customer
    // to place it by hand. moneyman/dgopujkar 2026-09-23: LIQUIDCASE BUY 2801
    // was rejected for insufficient funds at 08:40 and Repair placed 2790 at
    // 08:44; for those four minutes this modal offered "Mark as Placed"
    // pre-filled with 2801. Confirming records a fill that never happened --
    // and placing it at the broker as well leaves the customer holding both.
    // Narrow by design: only the funds class is withheld, because that is the
    // class Repair re-places. A cautionary listing can never be auto-placed,
    // so its escape hatch stays.
    const isRepairRetriableRejection =
      isFailureStatus && isInsufficientFundsMessage(item);
    const isUnconfirmedStatus =
      !isSuccessStatus && !isFailureStatus;

    const cardStyle = isSuccessStatus
      ? styles.successCard
      : isUnconfirmedStatus
        ? styles.pendingCard
      : styles.rejectedCard;

    const failureReason =
      item?.message_aq || item?.message || item?.orderStatusMessage || '';

    // Trade variant for THIS row — three-tier lookup (response → outgoing
    // payload match → 'REGULAR' default). See utils/tradeVariant.js
    // § resolveResultVariant + docs/APP_ARCHITECTURE.md § 4.5.2.
    const variant = resolveResultVariant(item, originalStockDetails);
    const isAmo = variant === 'AMO';

    return (
      <View style={[styles.orderGreenCard, cardStyle]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
          <View style={{ flexDirection: 'row', alignContent: 'center', alignItems: 'center', flex: 1 }}>
            <Text style={styles.orderTitle}>{item.symbol}</Text>
            {(isUnconfirmedStatus || isFailureStatus) && (
              <View style={{
                marginLeft: 8,
                backgroundColor: isUnconfirmedStatus ? designColor('dbeafe') : designColor('fee2e2'),
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
                <Text style={{
                  color: isUnconfirmedStatus ? designColor('1d4ed8') : designColor('dc2626'),
                  fontSize: 10,
                  fontFamily: designFont('Poppins-Medium'),
                }}>
                  {publisherOrderLabel(item?.orderStatus || (isUnconfirmedStatus ? 'Unconfirmed' : 'Rejected'))}
                </Text>
              </View>
            )}
            {/* AMO pill — rendered on every result card whose `variant`
                resolves to "AMO". After-Market Orders are accepted by the
                broker outside 09:15–15:30 IST and queued for execution at
                next market open. The amber color set comes from the
                existing `theme.colors.status.warning(Bg)` tokens — no new
                tokens introduced for this feature. */}
            {isAmo && (
              <View
                style={{
                  marginLeft: 8,
                  backgroundColor: warningBg,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
                accessibilityLabel="After-Market Order">
                <Text
                  style={{
                    color: warningColor,
                    fontSize: 10,
                    fontFamily: designFont('Poppins-Medium'),
                  }}>
                  AMO
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.orderType,
              {
                backgroundColor:
                  item.transactionType.toLowerCase() === 'buy'
                    ? stepCompletedColor
                    : designColor('ff2f2f'),
              },
            ]}>
            <Text style={styles.buyButtonText}>{item?.transactionType}</Text>
          </TouchableOpacity>
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Text style={styles.metaTextMuted}>Qty.</Text>
          <Text style={styles.metaTextStrong}>
            {' '}{item?.requestedQuantity ?? item?.quantity}{' '}
          </Text>
        </View>
        {(item?.remainingQuantity !== undefined || item?.filledShares !== undefined) && (
          <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 1}}>
            <Text style={styles.metaTextMuted}>Filled {item?.filledShares ?? 0}</Text>
            <Text style={styles.metaTextMuted}> · Remaining {item?.remainingQuantity ?? 0}</Text>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
            paddingBottom: 2,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={styles.metaTextMuted}>Ord. Type:</Text>
            <Text style={styles.metaTextStrong}>
              {item.orderType}
              {' |'}
            </Text>
            <Text style={styles.metaTextStrong}>{item?.exchange}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
        </View>
        {/* Broker status detail displayed inline. Pending is informational,
            never styled as a rejection or counted as execution. */}
        {!isSuccessStatus && failureReason ? (
          <View style={{
            marginTop: 6,
            marginBottom: 4,
            padding: 8,
            backgroundColor: isUnconfirmedStatus ? designColor('eff6ff') : designColor('fef2f2'),
            borderWidth: 1,
            borderColor: isUnconfirmedStatus ? designColor('bfdbfe') : designColor('fecaca'),
            borderRadius: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <AlertCircle
                size={14}
                color={isUnconfirmedStatus ? designColor('2563eb') : designColor('dc2626')}
                style={{ marginTop: 1, marginRight: 6 }}
              />
              <Text style={{
                flex: 1,
                color: isUnconfirmedStatus ? designColor('1e40af') : designColor('991b1b'),
                fontSize: 11,
                fontFamily: designFont('Poppins-Regular'),
                lineHeight: 16,
              }}>
                {failureReason}
              </Text>
            </View>
          </View>
        ) : null}
        {/* 2026-05-07: per-row "Mark as Placed" inline editor.
         *
         * Shown for ANY rejection (cautionary listing, restricted
         * scrip, low-funds, broker session expired, etc.) — when
         * automated retry can't help, the user goes to the broker
         * directly, places the trade, comes back here, taps Mark as
         * Placed, edits actual qty/price (defaults populated from
         * the original advice), and confirms. Backend records to
         * adviceEntry.status='executed' + manually_placed_at +
         * actual_quantity + actual_price (see
         * Routes/modalPortfolioOrderPlace.js PUT /manual-placement).
         *
         * Only renders when the row is REJECTED (not pending or
         * success) and not already promoted via local state.
         */}
        {/* Gate the manual-placement UI on `modelId` — this prop is
         * only supplied by MP flows (RebalanceAdvices /
         * RebalanceAdviceContent). The bespoke flow (AddtoCartModal)
         * doesn't pass it, so the inline editor is hidden there
         * (bespoke uses its own /api/recommendation manually_placed
         * pattern in StockAdvices.js).
         */}
        {modelId && isFailureStatus && isRepairRetriableRejection ? (
          <Text
            style={{
              marginTop: 4,
              marginBottom: 4,
              fontSize: 11,
              lineHeight: 15,
              color: designColor('b45309'),
            }}>
            Not enough funds for this order. We retry it for you once your
            sells settle — don't place it at the broker yourself, or you may
            end up buying it twice.
          </Text>
        ) : null}
        {modelId && isFailureStatus && !isRepairRetriableRejection && manualEditingIdx !== index ? (
          <TouchableOpacity
            onPress={() => startManualEdit(index, item)}
            style={{
              marginTop: 4,
              marginBottom: 4,
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: brandPrimary,
              backgroundColor: designColor('eff6ff'),
            }}>
            <Text
              style={{
                color: brandPrimary,
                fontSize: 11,
                fontFamily: designFont('Poppins-Medium'),
              }}>
              Mark as Placed (manual)
            </Text>
          </TouchableOpacity>
        ) : null}
        {/* 2026-05-07: "Refresh Status" inline section for OPEN orders.
         *
         * Shown when the order has orderStatus='OPEN' — meaning it was
         * submitted to the broker but the history API returned empty
         * (timing race on Axis; other brokers may also OPEN-queue AMOs).
         * Tapping Refresh calls /<broker>/v2/single-order-status and
         * updates the row in local state if the broker confirms a new
         * status. If still OPEN, shows a toast. Status also auto-resolves
         * via the 4:30 PM cron (cron_resolve_stale_orders.py).
         */}
        {isPendingStatus && (
          (item?.orderStatus || '').toUpperCase() === 'OPEN' ||
          (!(item?.orderId || item?.uniqueOrderId) && currentBroker === 'Zerodha')
        ) ? (
          <View style={{
            marginTop: 6,
            marginBottom: 4,
            padding: 8,
            backgroundColor: designColor('fffbeb'),
            borderWidth: 1,
            borderColor: designColor('fde68a'),
            borderRadius: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={{
              flex: 1,
              color: designColor('78350f'),
              fontSize: 11,
              fontFamily: designFont('Poppins-Regular'),
              lineHeight: 16,
              marginRight: 8,
            }}>
              {item?.orderId
                ? 'Placed — awaiting broker confirmation'
                : 'Awaiting exact Zerodha basket confirmation'}
            </Text>
            <TouchableOpacity
              onPress={() => refreshOrderStatus(index, item)}
              disabled={refreshingIdx !== null}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: designColor('d97706'),
                backgroundColor: designColor('fef3c7'),
                flexDirection: 'row',
                alignItems: 'center',
                opacity: refreshingIdx !== null ? 0.6 : 1,
              }}>
              {refreshingIdx === index ? (
                <ActivityIndicator size="small" color={designColor('92400e')} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={{ color: designColor('92400e'), fontSize: 11, fontFamily: designFont('Poppins-Medium') }}>
                {refreshingIdx === index ? 'Checking…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {modelId && isFailureStatus && !isRepairRetriableRejection && manualEditingIdx === index ? (
          <View style={{
            marginTop: 6,
            padding: 10,
            backgroundColor: designColor('f0f9ff'),
            borderWidth: 1,
            borderColor: designColor('bfdbfe'),
            borderRadius: 8,
          }}>
            <Text style={{
              color: designColor('0f172a'),
              fontSize: 11,
              fontFamily: designFont('Poppins-Medium'),
              marginBottom: 6,
            }}>
              Confirm what you actually placed at the broker:
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ width: 60, color: designColor('475569'), fontSize: 11, fontFamily: designFont('Poppins-Regular') }}>
                Quantity
              </Text>
              <TextInput
                value={manualEditQty}
                onChangeText={setManualEditQty}
                keyboardType="numeric"
                editable={submittingManualIdx === null}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: designColor('cbd5e1'),
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  fontSize: 12,
                  fontFamily: designFont('Poppins-Regular'),
                  backgroundColor: designColor('fff'),
                  color: designColor('0f172a'),
                }}
                placeholder="e.g. 100"
                placeholderTextColor={designColor('94a3b8')}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ width: 60, color: designColor('475569'), fontSize: 11, fontFamily: designFont('Poppins-Regular') }}>
                Avg. price
              </Text>
              <TextInput
                value={manualEditPrice}
                onChangeText={setManualEditPrice}
                keyboardType="numeric"
                editable={submittingManualIdx === null}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: designColor('cbd5e1'),
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  fontSize: 12,
                  fontFamily: designFont('Poppins-Regular'),
                  backgroundColor: designColor('fff'),
                  color: designColor('0f172a'),
                }}
                placeholder="Actual ₹ per share"
                placeholderTextColor={designColor('94a3b8')}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={cancelManualEdit}
                disabled={submittingManualIdx !== null}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginRight: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: designColor('cbd5e1'),
                  opacity: submittingManualIdx !== null ? 0.5 : 1,
                }}>
                <Text style={{ color: designColor('475569'), fontSize: 11, fontFamily: designFont('Poppins-Medium') }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => submitManualPlacement(index, item)}
                disabled={submittingManualIdx !== null}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: brandPrimary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: submittingManualIdx !== null ? 0.7 : 1,
                }}>
                {submittingManualIdx === index ? (
                  <ActivityIndicator size="small" color={designColor('fff')} style={{ marginRight: 6 }} />
                ) : null}
                <Text style={{ color: designColor('fff'), fontSize: 11, fontFamily: designFont('Poppins-Medium') }}>
                  {submittingManualIdx === index ? 'Saving…' : 'Confirm Placed'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // Get broker display name for cautionary alert
  const brokerDisplayName = currentBroker || 'your broker';

  return (
    <Modal visible={openSuccessModal} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header Section */}
          <LinearGradient
            colors={[gradient1, gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setOpenSucessModal(false);
                  setsuccessclosemodel(true);
                  hideAddToCartModal();
                }}>
                <ChevronLeft size={24} color={designColor('000')} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Trade Details</Text>
              </View>
            </View>
            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeaderText}>All Trade Details</Text>
            </View>
          </LinearGradient>

          {/* Content Section - Scrollable
           *
           * 2026-05-07: replaced the fixed-content View + small
           * inner FlatList layout with a single FlatList that
           * scrolls the banner content + order rows together via
           * ListHeaderComponent. Previously the static banner
           * (success/failure status icon + cautionary-listing alert
           * + "what to do" steps + summary + "Placed On / Status /
           * N of N Executed" row) ate ~70% of the screen and left
           * the order rows squeezed below the fold with no way to
           * scroll the banner out of the way. Reported case (Angel
           * One MP rebalance, 2 of 3 cautionary-list rejections):
           * user could only see the cautionary banner; YESBANK row
           * was below the fold.
           */}
          <FlatList
            data={orderResponse}
            renderItem={renderOrderItem}
            keyExtractor={(item, index) => index.toString()}
            style={styles.ordersList}
            // 2026-05-07: do NOT pass `contentContainerStyle={styles.contentContainer}` —
            // that style has `flex: 1`, designed for a <View>. On a FlatList's
            // contentContainerStyle, `flex: 1` clamps the scrollable content
            // to viewport height, which disables scroll entirely. We want the
            // content to be its natural height (sum of header banner +
            // all rows) and the outer FlatList to flex into available space.
            contentContainerStyle={styles.ordersListContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
            {/* Success/Failure Status */}
            {successCount === totalCount && successCount !== 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: stepCompletedColor }]}>
                  <CheckIcon size={40} color={'white'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    All Orders Placed Successfully
                  </Text>
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below.
                  </Text>
                </View>
              </View>
            )}

            {totalCount === 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: designColor('ef4639') }]}>
                  <XIcon size={40} color={'white'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>No Orders Placed</Text>
                  <Text style={{
                    marginTop: 4, fontFamily: designFont('Poppins-Medium'),
                    color: 'black',
                    fontSize: 10,
                    paddingRight: 10,
                  }}>
                    No trades were sent to the broker. This may be because the rebalance calculation returned no trades. Please go back and try again.
                  </Text>
                </View>
              </View>
            )}

            {failureCount === totalCount && totalCount > 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: designColor('ef4639') }]}>
                  <XIcon size={40} color={'white'} />
                </View>

                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Order Failed</Text>

                  {/* Show the right reason summary based on which banners are
                      showing below. The cautionary + low-funds banners carry
                      the full per-reason explanation, so the header subtitle
                      just needs to point users at them. */}
                  <Text style={{
                    marginTop: 4, fontFamily: designFont('Poppins-Medium'),
                    color: 'black',
                    fontSize: 10,
                    paddingRight: 10,
                  }}>
                    {hasLowFundsFailures && hasCautionaryListingFailures
                      ? `All ${totalCount} orders were rejected. See the alerts below for the reasons.`
                      : hasLowFundsFailures
                        ? 'Your broker rejected every order due to insufficient funds.'
                        : hasCautionaryListingFailures
                          ? 'Every order was blocked by the exchange. See the alert below.'
                          : (orderResponse?.[0]?.message_aq ||
                              orderResponse?.[0]?.message ||
                              'Your order could not be placed. Please contact your manager.')}
                  </Text>

                  {/* Keep link to Orders */}
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below.
                  </Text>
                </View>
              </View>
            )}

            {publisherRecovery?.nextAction === 'CONTINUE_BUYS' && (
              <View style={{marginHorizontal: 16, marginTop: 12, padding: 14,
                borderRadius: 10, backgroundColor: designColor('eaf4ff')}}>
                <Text style={{fontFamily: designFont('Poppins-SemiBold'), color: designColor('073b75')}}>
                  Zerodha sells confirmed
                </Text>
                <Text style={{fontFamily: designFont('Poppins-Regular'), color: designColor('31465c'),
                  fontSize: 11, marginTop: 4}}>
                  The buy order was not sent yet. Continue with the remaining buy-only basket.
                </Text>
                <TouchableOpacity
                  style={{marginTop: 10, backgroundColor: designColor('0b63ce'), borderRadius: 8,
                    paddingVertical: 11, alignItems: 'center'}}
                  onPress={() => onContinuePublisherBuys?.({
                    attemptId: publisherAttemptId,
                    buyLegs: publisherRecovery.legs?.filter(
                      leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
                    ) || [],
                    allLegs: publisherRecovery.legs || [],
                    context: publisherRecovery.context || {},
                  })}>
                  <Text style={{color: 'white', fontFamily: designFont('Poppins-SemiBold')}}>
                    Continue with {publisherRecovery.buySummary?.expected || 1} Buy
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {publisherRecovery?.nextAction === 'REPAIR_REMAINING' && (
              <View style={{padding: 12, marginBottom: 12, backgroundColor: designColor('fffbeb'), borderRadius: 8}}>
                <Text style={{color: designColor('78350f'), fontFamily: designFont('Poppins-Regular')}}>
                  {publisherRecovery.message}
                </Text>
              </View>
            )}
            {publisherRecovery?.nextAction === 'AUTHORIZE_OR_CHECK_ACCOUNT' && (
              <View style={{marginHorizontal: 16, marginTop: 12, padding: 14,
                borderRadius: 10, backgroundColor: designColor('fff4e5')}}>
                <Text style={{fontFamily: designFont('Poppins-SemiBold'), color: designColor('8a4b00')}}>
                  Zerodha orders were not found
                </Text>
                <Text style={{fontFamily: designFont('Poppins-Regular'), color: designColor('5b4630'),
                  fontSize: 11, marginTop: 4}}>
                  {publisherRecovery.message}
                </Text>
              </View>
            )}

            {unconfirmedCount > 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: infoColor }]}>
                  <Info size={40} color={'white'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    Awaiting Broker Confirmation
                  </Text>
                  <Text style={styles.statusDescription}>
                    {unconfirmedCount} of {totalCount} order
                    {unconfirmedCount === 1 ? ' is' : 's are'} not confirmed by{' '}
                    {currentBroker || 'the broker'} yet. Check the broker order
                    book before retrying.
                  </Text>
                  {directReconciliationRow ? (
                    <TouchableOpacity
                      onPress={() => setShowCustomerReport(true)}
                      style={{marginTop: 10, alignSelf: 'flex-start', backgroundColor: designColor('2563eb'),
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7}}>
                      <Text style={{color: designColor('fff'), fontFamily: designFont('Poppins-SemiBold'), fontSize: 11}}>
                        {customerReportStatus ? 'Update what happened' : 'Tell us what happened'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {customerReportStatus ? (
                    <Text style={{fontSize: 10, color: designColor('1e40af'), marginTop: 6}}>
                      Report received; verification is pending. Retry remains blocked.
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {successCount > 0 &&
              successCount !== totalCount &&
              unconfirmedCount === 0 && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIcon, { backgroundColor: designColor('ffcd28') }]}>
                  <AlertCircle size={40} color={'black'} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    Some orders are not placed
                  </Text>
                  <Text style={styles.statusDescription}>
                    Please review the{' '}
                    <Text
                      onPress={() => {
                        navigation.navigate('Orders');
                        setOpenSucessModal(false);
                      }}
                      style={styles.linkText}>
                      Order details
                    </Text>{' '}
                    below and contact your manager for next steps.
                  </Text>
                </View>
              </View>
            )}

            {/* Cautionary Listing Alert */}
            {hasCautionaryListingFailures && (
              <View style={cautionaryStyles.alertContainer}>
                {/* Header with icon */}
                <View style={cautionaryStyles.headerRow}>
                  <View style={cautionaryStyles.iconCircle}>
                    <AlertTriangle size={20} color={designColor('d97706')} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={cautionaryStyles.alertTitle}>
                      Cautionary Listing Restriction
                    </Text>
                  </View>
                </View>

                {/* Explanation */}
                <Text style={cautionaryStyles.alertDescription}>
                  {brokerDisplayName} does not allow stocks under{' '}
                  <Text style={{ fontFamily: designFont('Poppins-SemiBold') }}>
                    Exchange Cautionary Listing
                  </Text>{' '}
                  to be placed through the broker API connection. The following
                  stocks need to be traded directly:
                </Text>

                {/* Affected stocks badges */}
                <View style={cautionaryStyles.stockBadgeContainer}>
                  {cautionaryListingStocks.map((stock, idx) => (
                    <View key={idx} style={cautionaryStyles.stockBadge}>
                      <Text style={cautionaryStyles.stockBadgeText}>
                        {stock?.symbol || stock?.searchSymbol || 'Unknown'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Instructions box */}
                <View style={cautionaryStyles.instructionsBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Info size={14} color={infoColor} style={{ marginTop: 2, marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={cautionaryStyles.instructionsTitle}>
                        What you need to do:
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        1. Open your {brokerDisplayName} app or web platform directly
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        2. Place the order for the above stock(s) manually
                      </Text>
                      <Text style={cautionaryStyles.instructionStep}>
                        3. This is a default restriction by {brokerDisplayName} for cautionary listed stocks
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Show success count if some orders went through */}
                {successCount > 0 && (
                  <Text style={cautionaryStyles.partialSuccessNote}>
                    {successCount} of {totalCount} order(s) were placed successfully. Only the above stock(s) require manual placement.
                  </Text>
                )}
              </View>
            )}

            {/* Insufficient Funds Alert — coexists with cautionary banner when
                a batch hits both reasons (Angel One 2026-04-29: 7 cautionary +
                19 LOW_FUNDS). Mirrors the cautionary block visually but in red
                and with parsed Available/Required amounts when the broker
                ships them in the rejection message. */}
            {hasLowFundsFailures && (
              <View style={lowFundsStyles.alertContainer}>
                <View style={lowFundsStyles.headerRow}>
                  <View style={lowFundsStyles.iconCircle}>
                    <AlertCircle size={20} color={designColor('b91c1c')} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={lowFundsStyles.alertTitle}>
                      Insufficient Funds
                    </Text>
                  </View>
                </View>

                <Text style={lowFundsStyles.alertDescription}>
                  {brokerDisplayName} rejected the orders below because available
                  funds are below the required amount. These quantities remain unfilled
                  in Repair. If this rebalance included sells, some proceeds may
                  not yet be usable.
                </Text>

                {(lowFundsAvailable !== null || lowFundsSawAnyRequired) && (
                  <View style={lowFundsStyles.amountsBox}>
                    {lowFundsAvailable !== null && (
                      <View style={{ flex: 1 }}>
                        <Text style={lowFundsStyles.amountLabel}>Available</Text>
                        <Text
                          style={[
                            lowFundsStyles.amountValue,
                            lowFundsAvailable < 0 && { color: designColor('b91c1c') },
                          ]}>
                          {formatINR(lowFundsAvailable)}
                        </Text>
                      </View>
                    )}
                    {lowFundsSawAnyRequired && (
                      <View style={{ flex: 1 }}>
                        <Text style={lowFundsStyles.amountLabel}>
                          Required (sum)
                        </Text>
                        <Text style={lowFundsStyles.amountValue}>
                          {formatINR(lowFundsRequiredTotal)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={lowFundsStyles.stockBadgeContainer}>
                  {lowFundsStocks.map((stock, idx) => (
                    <View key={idx} style={lowFundsStyles.stockBadge}>
                      <Text style={lowFundsStyles.stockBadgeText}>
                        {stock?.symbol || stock?.searchSymbol || 'Unknown'}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={lowFundsStyles.instructionsBox}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Info
                      size={14}
                      color={infoColor}
                      style={{ marginTop: 2, marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={lowFundsStyles.instructionsTitle}>
                        What you need to do:
                      </Text>
                      <Text style={lowFundsStyles.instructionStep}>
                        1. Check available funds in your {brokerDisplayName} account
                      </Text>
                      <Text style={lowFundsStyles.instructionStep}>
                        2. If sale proceeds are pending, try Repair the next trading
                        day after your broker credits them
                      </Text>
                      <Text style={lowFundsStyles.instructionStep}>
                        3. If funds are still insufficient, review your broker
                        balance before retrying the unfilled quantities
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoTitle}>
                  {successCount > 0 ? 'Placed On' : 'Attempted On'}
                </Text>
                <Text style={styles.infoValue}>{getFormattedDate()}</Text>
              </View>
              <View style={styles.infoItem1}>
                <Text style={styles.infoTitle}>Status</Text>
                <Text style={styles.infoValue}>
                  {totalCount === 0
                    ? 'No Orders'
                    : unconfirmedCount > 0
                    ? 'Pending'
                    : successCount === totalCount
                    ? 'Placed'
                    : successCount > 0
                      ? 'Partially Placed'
                      : 'Failed'}
                </Text>

              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoTitle}>
                  {unconfirmedCount > 0
                    ? `${unconfirmedCount} of ${totalCount} Pending`
                    : manualPlacedCount > 0 && executedCount !== totalCount
                      ? `${successCount} of ${totalCount} Placement Confirmed`
                      : `${executedCount} of ${totalCount} Executed`}
                </Text>
                <View style={styles.progressBarContainer}>
                  {successCount > 0 && (
                    <View
                      style={[
                        styles.successBar,
                        { width: `${successPercentage}%` },
                      ]}
                    />
                  )}

                  {unconfirmedCount > 0 && (
                    <View
                      style={[
                        styles.pendingBar,
                        { width: `${pendingPercentage}%` },
                      ]}
                    />
                  )}

                  {failureCount > 0 && (
                    <View
                      style={[
                        styles.failureBar,
                        { width: `${failurePercentage}%` },
                      ]}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* end of ListHeaderComponent banner content */}
              </View>
            }
          />
          <CustomerExecutionReportModal
            visible={showCustomerReport}
            onClose={() => setShowCustomerReport(false)}
            jobId={directReconciliationRow?.directAsyncJobId}
            requestId={directReconciliationRow?.directAsyncRequestId}
            tradeId={directReconciliationRow?.directAsyncTradeId}
            configData={config}
            onSubmitted={setCustomerReportStatus}
          />
        </View>

        {/* Bottom safe area for iOS home indicator */}
        {Platform.OS === 'ios' && <View style={styles.bottomSafeArea} />}
      </SafeAreaView>
    </Modal>
  );
};

// Cautionary listing alert styles
const cautionaryStyles = StyleSheet.create({
  alertContainer: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    backgroundColor: designColor('fffbeb'),
    borderWidth: 1,
    borderColor: designColor('fcd34d'),
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: designColor('fef3c7'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('92400e'),
  },
  alertDescription: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('b45309'),
    lineHeight: 18,
    marginBottom: 10,
  },
  stockBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stockBadge: {
    backgroundColor: designColor('fef3c7'),
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  stockBadgeText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('92400e'),
  },
  instructionsBox: {
    backgroundColor: designColor('eff6ff'),
    borderWidth: 1,
    borderColor: designColor('bfdbfe'),
    borderRadius: 8,
    padding: 10,
  },
  instructionsTitle: {
    fontSize: 12,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('1e40af'),
    marginBottom: 4,
  },
  instructionStep: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('1d4ed8'),
    lineHeight: 18,
    marginLeft: 2,
  },
  partialSuccessNote: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('166534'),
    marginTop: 10,
    backgroundColor: designColor('f0fdf4'),
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: designColor('bbf7d0'),
  },
});

// Insufficient-funds alert styles — red callout matching the cautionary
// block's structure so the two banners read as a related family when both
// render in the same batch.
const lowFundsStyles = StyleSheet.create({
  alertContainer: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    backgroundColor: designColor('fef2f2'),
    borderWidth: 1,
    borderColor: designColor('fecaca'),
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: designColor('fee2e2'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('991b1b'),
  },
  alertDescription: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('991b1b'),
    lineHeight: 18,
  },
  amountsBox: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: designColor('ffffff'),
    borderWidth: 1,
    borderColor: designColor('fecaca'),
    borderRadius: 8,
  },
  amountLabel: {
    fontSize: 10,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('7f1d1d'),
  },
  amountValue: {
    fontSize: 13,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('111827'),
    marginTop: 2,
  },
  stockBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  stockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: designColor('fee2e2'),
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  stockBadgeText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('991b1b'),
  },
  instructionsBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: designColor('eff6ff'),
    borderWidth: 1,
    borderColor: designColor('bfdbfe'),
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 12,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('1e40af'),
    marginBottom: 4,
  },
  instructionStep: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('1d4ed8'),
    lineHeight: 18,
  },
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: designColor('fff'),
  },
  modalContent: {
    flex: 1,
    backgroundColor: designColor('fff'),
  },

  headerGradient: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 0 : 10,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('fff'),
  },
  subHeaderContainer: {
    marginLeft: 45,
    marginTop: 2,
  },
  subHeaderText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('f0f0f0'),
  },

  contentContainer: {
    flex: 1,
  },

  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIcon: {
    padding: 10,
    borderRadius: 40,
  },
  statusTextContainer: {
    flexDirection: 'column',
    marginLeft: 10,
    flex: 1,
  },
  statusTitle: {
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
    fontSize: 18,
  },
  statusDescription: {
    fontFamily: designFont('Poppins-Regular'),
    color: 'black',
    fontSize: 10,
    paddingRight: 10,
  },

  ordersList: {
    flex: 1,
  },
  // 2026-05-07: contentContainerStyle for the FlatList. Bottom
  // padding gives breathing room so the last row isn't flush
  // against the safe-area edge. NO `flex: 1` — that would clamp
  // content to viewport height and disable scrolling.
  ordersListContent: {
    paddingBottom: 24,
  },

  bottomSafeArea: {
    height: Platform.OS === 'ios' ? 34 : 0,
    backgroundColor: designColor('fff'),
  },

  successCard: {
    backgroundColor: designColor('b6ff92'),
  },
  pendingCard: {
    backgroundColor: designColor('eff6ff'),
  },
  rejectedCard: {
    backgroundColor: 'rgba(255, 0, 0, 0.10)',
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: designColor('fff'),
    marginRight: 10,
  },
  linkText: {
    fontSize: 10,
    color: 'blue',
    marginTop: 6,
    fontFamily: designFont('Poppins-Regular'),
    textDecorationLine: 'underline',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: designColor('ccc'),
  },
  infoItem: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  infoItem1: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
    borderRightWidth: 0.5,
    borderLeftWidth: 0.5,
  },
  infoTitle: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('888'),
  },
  infoValue: {
    color: designColor('464646'),
    fontSize: 12,
    fontFamily: designFont('Satoshi-Bold'),
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 5,
    marginVertical: 10,
    marginRight: 15,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: designColor('d9d9d9'),
    borderRadius: 8,
  },
  successBar: {
    backgroundColor: designColor('338d72'),
    height: 5,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  pendingBar: {
    backgroundColor: designColor('3b82f6'),
    height: 5,
  },
  failureBar: {
    backgroundColor: designColor('ef344a'),
    height: 5,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  orderGreenCard: {
    backgroundColor: designColor('b6ff92'),
    paddingTop: 10,
    paddingHorizontal: 10,
    borderRadius: 0,
    width: '100%',
    borderColor: designColor('c8c8c8'),
    borderBottomWidth: 0.5,
  },
  orderTitle: {
    fontSize: 12,
    color: designColor('161917'),
    fontWeight: '500',
    letterSpacing: 0.5,
    fontFamily: designFont('Poppins-Medium'),
  },
  orderType: {
    color: designColor('fff'),
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 10,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  buyButtonText: {
    color: designColor('fff'),
    fontSize: 12,
    fontWeight: '400',
    fontFamily: designFont('Poppins-Regular'),
  },
  metaTextMuted: {
    color: designColor('888b8c'),
    fontSize: 12,
    fontWeight: '400',
    fontFamily: designFont('Poppins-Regular'),
    marginRight: 2,
  },
  metaTextStrong: {
    color: designColor('15171a'),
    fontSize: 12,
    fontWeight: '500',
    fontFamily: designFont('Poppins-Medium'),
    marginRight: 6,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dateText: {
    color: designColor('4a4a4a'),
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
  },
});

export default RecommendationSuccessModal;
