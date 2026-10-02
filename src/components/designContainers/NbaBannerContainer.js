import React, {useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useConfig} from '../../context/ConfigContext';
import {useTrade} from '../../screens/TradeContext';
import {useComponent} from '../../design/useDesign';
import {rankActions, NBA_KIND} from '../../utils/nba/nbaRanking';
import {BROKER_STATUS} from '../../utils/nba/brokerStatus';
import {brokerConnectionPill} from '../../utils/nba/brokerConnectionPill';
import {computeHealthSubScores, DEFAULT_ENABLED} from '../../utils/nba/portfolioHealth';

const deriveBrokerState = ({broker, brokerStatus, isBrokerConnected, userDetails}) => {
  const currentBroker = String(userDetails?.user_broker || broker || '').toLowerCase();
  const connection = String(userDetails?.connect_broker_status || '').toLowerCase();
  if (currentBroker.includes('dummy') || connection === 'manual' || connection === 'no_broker') {
    return BROKER_STATUS.MANUAL;
  }
  const status = String(brokerStatus || '').toLowerCase();
  if (status.includes('expire')) return BROKER_STATUS.TOKEN_EXPIRED;
  if (isBrokerConnected || status === 'connected') return BROKER_STATUS.OK;
  const connectedBrokers = Array.isArray(userDetails?.connected_brokers)
    ? userDetails.connected_brokers
    : [];
  const expired = connectedBrokers.some(item => {
    const itemStatus = String(item?.status || '').toLowerCase();
    const expiredByDate = item?.token_expire
      ? new Date(item.token_expire).getTime() < Date.now()
      : false;
    return itemStatus === 'expired' || itemStatus === 'disconnected' || expiredByDate;
  });
  return expired ? BROKER_STATUS.TOKEN_EXPIRED : BROKER_STATUS.NOT_CONNECTED;
};

const extractHoldings = blob => {
  if (!blob) return [];
  const rows =
    (Array.isArray(blob) && blob) || blob.holding || blob.data || blob.holdings ||
    blob.stocks || blob.stockData || blob.allStocks || blob.totalHoldings || [];
  if (!Array.isArray(rows)) return [];
  return rows.map(item => ({
    symbol: item.symbol || item.tradingSymbol || item.tradingsymbol || item.symbolName || '',
    quantity: Number(item.quantity || item.qty || 0),
    ltp: Number(item.ltp || item.lastPrice || item.last_price || 0),
    value: Number(item.value || item.currentValue || item.holdingvalue || 0),
    avgPrice: Number(item.averagePrice || item.avgPrice || 0),
  })).filter(item => item.symbol);
};

const NbaBannerContainer = ({onReviewTrades}) => {
  const Presentation = useComponent('composites.NbaBanner');
  const config = useConfig();
  const navigation = useNavigation();
  const trade = useTrade() || {};
  const {
    broker, brokerStatus, isBrokerConnected, userDetails, userEmail,
    modelPortfolioRepairTrades, repairReconciliation,
    stockRecoNotExecutedfinal, allHoldingsData, confirmedFunds, fundsError,
  } = trade;
  const accountRecovery = repairReconciliation?.accountRecovery || null;

  const brokerState = deriveBrokerState({broker, brokerStatus, isBrokerConnected, userDetails});
  const currentBroker = userDetails?.user_broker || broker || '';
  const expectedFundsKey = `${userEmail || ''}:${currentBroker}`.toLowerCase();
  const liveVerified = Boolean(
    confirmedFunds?.requestKey &&
    String(confirmedFunds.requestKey).toLowerCase() === expectedFundsKey &&
    Number.isFinite(confirmedFunds.verifiedAt) &&
    Date.now() - confirmedFunds.verifiedAt <= 5 * 60 * 1000,
  );
  const focal = useMemo(() => rankActions({
    brokerState,
    accountRecovery,
    repairTradesCount: Array.isArray(modelPortfolioRepairTrades)
      ? modelPortfolioRepairTrades.length : 0,
    newRecommendationsCount: Array.isArray(stockRecoNotExecutedfinal)
      ? stockRecoNotExecutedfinal.length : 0,
  })[0] || null, [brokerState, accountRecovery, modelPortfolioRepairTrades, stockRecoNotExecutedfinal]);

  const healthGap = useMemo(() => {
    if (!config?.portfolioHealthEnabled) return null;
    const holdings = extractHoldings(allHoldingsData);
    if (holdings.length === 0) return null;
    return computeHealthSubScores(holdings, {
      enabled: config?.portfolioHealth?.enabled || DEFAULT_ENABLED,
      thresholds: config?.portfolioHealth?.thresholds,
    }).gapCount;
  }, [config, allHoldingsData]);

  const brokerPill = brokerConnectionPill({
    brokerState, liveVerified, fundsError, accountRecovery,
  });

  const onAct = () => {
    if (!focal) return;
    if (focal.kind === NBA_KIND.RECONNECT_BROKER || focal.kind === NBA_KIND.CONNECT_BROKER) {
      try { navigation.navigate('Broker Setting'); } catch (error) { /* informational fallback */ }
      return;
    }
    if (focal.kind === NBA_KIND.ACCOUNT_RECOVERY ||
        focal.kind === NBA_KIND.REVIEW_REPAIR_TRADES ||
        focal.kind === NBA_KIND.ACCEPT_REBALANCE) {
      onReviewTrades?.();
    }
  };

  return <Presentation
    viewModel={{
      visible: Boolean(config?.nbaHomeEnabled), focal, brokerPill,
      kycDone: userDetails?.digio_verification === true, healthGap,
    }}
    actions={{onAct}}
  />;
};

export default NbaBannerContainer;
