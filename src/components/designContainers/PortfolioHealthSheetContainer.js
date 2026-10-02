import React, {useCallback, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useConfig} from '../../context/ConfigContext';
import {useTrade} from '../../screens/TradeContext';
import {computeHealthSubScores, DEFAULT_ENABLED} from '../../utils/nba/portfolioHealth';
import {useAccountEmail} from '../../utils/accountEmail';
import {useComponent} from '../../design/useDesign';

const CONSENT_KEY = 'aq_health_holdings_consent';

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
    value: Number(item.value || item.currentValue || item.holdingvalue || item.marketValue || 0),
    avgPrice: Number(item.averagePrice || item.avgPrice || item.average_price || 0),
  })).filter(item => item.symbol);
};

const PortfolioHealthSheetContainer = () => {
  const Presentation = useComponent('composites.PortfolioHealthSheet');
  const config = useConfig();
  const {allHoldingsData, configData, getAllHoldings} = useTrade();
  const email = useAccountEmail();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);

  const healthConfig = config?.portfolioHealth || {};
  const enabled = healthConfig.enabled || DEFAULT_ENABLED;
  const thresholds = healthConfig.thresholds || undefined;

  const reconcile = useCallback((holdings, clientResult) => {
    axios.post(
      `${server.server.baseUrl}api/model-portfolio/portfolio-health`,
      {holdings, enabled, thresholds, email},
      {headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      }},
    ).catch(() => {});
    return clientResult;
  }, [enabled, thresholds, email, configData]);

  const runAnalysis = useCallback(async () => {
    setPhase('analyzing');
    let source = allHoldingsData;
    if (extractHoldings(source).length === 0 && getAllHoldings) {
      source = await getAllHoldings();
    }
    const holdings = extractHoldings(source);
    if (holdings.length === 0) {
      setPhase('empty');
      return;
    }
    const nextResult = computeHealthSubScores(holdings, {enabled, thresholds});
    setResult(nextResult);
    reconcile(holdings, nextResult);
    setPhase('done');
  }, [allHoldingsData, enabled, thresholds, reconcile, getAllHoldings]);

  const onLaunch = useCallback(async () => {
    setOpen(true);
    try {
      const consent = await AsyncStorage.getItem(CONSENT_KEY);
      if (consent === 'true') await runAnalysis();
      else setPhase('consent');
    } catch (error) {
      setPhase('consent');
    }
  }, [runAnalysis]);

  const onAllow = useCallback(async () => {
    try { await AsyncStorage.setItem(CONSENT_KEY, 'true'); } catch (error) { /* non-fatal */ }
    await runAnalysis();
  }, [runAnalysis]);

  const onClose = () => {
    setOpen(false);
    setPhase('idle');
  };

  return <Presentation
    viewModel={{visible: Boolean(config?.portfolioHealthEnabled), open, phase, result}}
    actions={{onLaunch, onAllow, onClose}}
  />;
};

export default PortfolioHealthSheetContainer;
