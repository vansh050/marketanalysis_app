import React, {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useConfig} from '../../context/ConfigContext';
import PortfolioSummaryService from '../../FunctionCall/services/PortfolioSummaryService';
import {useTrade} from '../../screens/TradeContext';
import {useAccountEmail} from '../../utils/accountEmail';
import {useComponent} from '../../design/useDesign';

const PortfolioSummaryCardContainer = ({onViewHoldings}) => {
  const Presentation = useComponent('composites.PortfolioSummaryCard');
  const navigation = useNavigation();
  const config = useConfig();
  const email = useAccountEmail();
  const {
    modelPortfolioStrategyfinal,
    modelPortfolioEntitlementsLoaded,
  } = useTrade();
  const enabled = Boolean(config?.performanceSummaryEnabled);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [realised, setRealised] = useState(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!email) {
      setReady(true);
      return;
    }
    setReady(false);
    // Each read is independent: one unavailable surface must not hide the rest.
    const [nextSummary, nextHistory, nextRealised] = await Promise.all([
      PortfolioSummaryService.getPortfolioSummary(email).catch(() => null),
      PortfolioSummaryService.getValueHistory(email).catch(() => null),
      PortfolioSummaryService.getRealisedPnl(email).catch(() => null),
    ]);
    setSummary(nextSummary);
    setHistory(nextHistory);
    setRealised(nextRealised);
    setReady(true);
  }, [email]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return (
    <Presentation
      viewModel={{
        enabled,
        ready,
        summary,
        history,
        realised,
        modelPortfolioStrategyfinal,
        modelPortfolioEntitlementsLoaded,
      }}
      actions={{
        onRenewPlans: () => navigation?.navigate?.('Plans'),
        onViewHoldings,
      }}
    />
  );
};

export default PortfolioSummaryCardContainer;
