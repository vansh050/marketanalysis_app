const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('periodic background refresh — web F-10 parity', () => {
  test('getAllTrades accepts a silent option that never flips the loading flag', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('const fetchAllTrades = async (options = {}) => {');
    expect(ctx).toContain('const getAllTrades = (options = {}) => {');
    expect(ctx).toContain('if (tradesInFlightRef.current?.key === requestKey)');
    expect(ctx).toContain('return tradesInFlightRef.current.promise;');
    expect(ctx).toContain('const silent = options?.silent === true;');
    expect(ctx).toContain("if (!silent) setIsDatafetching(true);");
    expect(ctx).toContain("if (!silent) setIsDatafetching(false);");
  });

  test('recommendation history is bounded at the API and stale account responses are discarded', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('const tradesRequestGenerationRef = useRef(0);');
    expect(ctx).toContain(
      'Math.min(365, Math.max(1, Math.trunc(Number(adviceShowDays))))',
    );
    expect(ctx).toContain('&days=${recommendationHistoryDays}');
    expect(ctx).toContain(
      'if (requestGeneration !== tradesRequestGenerationRef.current) return;',
    );
    expect(ctx).toContain(
      'const requestGeneration = ++tradesRequestGenerationRef.current;',
    );
    expect(ctx).toContain('setstockRecoNotExecutedfinal([]);');
    expect(ctx).toContain(
      '[userEmail, configData?.config?.REACT_APP_HEADER_NAME]',
    );
  });

  test('getModelPortfolioStrategyDetails accepts a silent option too', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('const getModelPortfolioStrategyDetails = async (options = {}) => {');
    expect(ctx).toContain("if (!silent) setIsDatafetchingMP(true);");
    expect(ctx).toContain('!silent &&');
    expect(ctx).toContain('setIsDatafetchingMP(false);');
  });

  test('user and notification startup reads are single-flight', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('userDetailsInFlightRef.current?.requestKey === requestKey');
    expect(ctx).toContain('return userDetailsInFlightRef.current.promise');
    expect(ctx).toContain('notificationsInFlightRef.current?.requestKey === requestKey');
    expect(ctx).toContain('return notificationsInFlightRef.current.promise');
  });

  test('model portfolio refresh coalesces requests and never clears confirmed data on error', () => {
    const ctx = read('src/screens/TradeContext.js');
    const start = ctx.indexOf('const getModelPortfolioStrategyDetails = async');
    const end = ctx.indexOf('// Fetch repair-trades for the requested MP strategies');
    const method = ctx.slice(start, end);
    expect(method).toContain('modelPortfolioRequestRef.current');
    expect(method).toContain('const response = await requestEntry.promise');
    expect(method).toContain("throw new Error('Malformed subscribed-strategies response')");
    expect(method).toContain("subscribedPortfolios.length > 0 ? 'ready' : 'confirmedEmpty'");
    expect(method).not.toContain('setModelPortfolioStrategyfinal([])');
  });

  test('Home shows the model catalogue only after a confirmed empty response', () => {
    const home = read('src/screens/Home/HomeScreen.js');
    expect(home).toContain("modelPortfolioEntitlementsStatus === 'confirmedEmpty'");
    expect(home).toContain('hasConfirmedNoModelPortfolio &&');
    expect(home).toContain("key: 'ModelPortfolioEntitlementStatus'");
    expect(home).toContain('await Promise.allSettled([');
  });

  test('cold-start auth waits for one token and retries a protected GET once on 401', () => {
    const auth = read('src/utils/authTokenInterceptor.js');
    expect(auth).toContain('if (tokenRequest) return tokenRequest;');
    expect(auth).toContain('const token = await resolveFirebaseToken(false);');
    expect(auth).toContain("error?.response?.status === 401");
    expect(auth).toContain("method === 'get'");
    expect(auth).toContain('!config?.__firebaseAuthRetried');
    expect(auth).toContain('const token = await resolveFirebaseToken(true);');
  });

  test('model portfolio entitlement readiness cannot remain stuck forever', () => {
    const ctx = read('src/screens/TradeContext.js');
    const start = ctx.indexOf('const getModelPortfolioStrategyDetails = async');
    const end = ctx.indexOf('// Fetch repair-trades for all subscribed MP strategies');
    const method = ctx.slice(start, end);
    expect(method).toContain('timeout: 10000');
    expect(method.match(/setModelPortfolioEntitlementsLoaded\(true\)/g)?.length)
      .toBeGreaterThanOrEqual(3);
  });

  test('market indices do not depend on hydrated advisor config', () => {
    const indices = read('src/components/HomeScreenComponents/MarketIndices.js');
    expect(indices).toContain('Config.REACT_APP_HEADER_NAME');
    expect(indices).not.toContain('if (!configData) return;');
    expect(indices).not.toContain("if (!configData) {\n      return;\n    }");
  });

  test('market indices do not force unused clock renders', () => {
    const indices = read('src/components/HomeScreenComponents/MarketIndices.js');
    expect(indices).not.toContain('setTime(new Date())');
    expect(indices).not.toContain('const [time, setTime]');
  });

  test('stock advice screen polls getAllTrades silently on a 30s cadence', () => {
    const content = read('src/components/AdviceScreenComponents/StockAdviceContent.js');
    expect(content).toContain("import usePeriodicRefresh from '../../utils/usePeriodicRefresh';");
    expect(content).toContain("usePeriodicRefresh(() => getAllTrades({silent: true}));");
  });

  test('model portfolio screen polls strategies silently, paused while the rebalance modal is open', () => {
    const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    expect(advices).toContain("import usePeriodicRefresh from '../../utils/usePeriodicRefresh';");
    expect(advices).toContain("getModelPortfolioStrategyDetails({silent: true})");
    expect(advices).toContain('{enabled: !openRebalanceModal}');
  });

  test('card-level limit price / qty edits survive the poll via tradeId overrides', () => {
    const advices = read('src/components/AdviceScreenComponents/StockAdvices.js');
    expect(advices).toContain(
      'const [cardInputOverrides, setCardInputOverrides] = useState({});',
    );
    expect(advices).toContain('[tradeId]: {...prev[tradeId], Price: formattedValue}');
    expect(advices).toContain('[tradeId]: {...prev[tradeId], Quantity: parseInt(value)}');
    expect(advices).toContain('const applyCardOverrides = trades =>');
    // The re-derivation effect re-applies overrides and re-runs when they change.
    expect(advices).toContain('setStockRecoNotExecuted(applyCardOverrides(transformedData));');
    expect(advices).toContain('cardInputOverrides,');
  });

  test('manager-closed zero-fill baskets stay in the feed as Closed by manager', () => {
    const ctx = read('src/screens/TradeContext.js');
    // The auto-cancel zero-fill closure (ccxt) stamps cancel:true on every leg
    // with zero fills. Those baskets must NOT be dropped by the customer-Reject
    // gate (which targets parent-level basketCancelled) — they render as a
    // terminal "Closed by manager" card instead of vanishing.
    expect(ctx).toContain("const managerClosed =");
    expect(ctx).toContain("lifecycleStatus === 'CLOSED' &&");
    expect(ctx).toContain("reason === 'MANAGER_CLOSED_ZERO_FILL'");
    expect(ctx).toContain("if (!managerClosed && (trade?.cancel === true || trade?.basketCancelled === true)) return acc;");
    // The card label comes from the lifecycle reason, threaded to the composite.
    const card = read('src/UIComponents/StockAdvicesUI/BasketCard.js');
    expect(card).toContain("reason === 'MANAGER_CLOSED_ZERO_FILL'");
    const composite = read('designs/default/composites/BasketCard.js');
    expect(composite).toContain("closedByManager");
    expect(composite).toContain("'Closed by manager'");
  });

  test('closed records stay visible until max(entry+window, closure+terminal days)', () => {
    const ctx = read('src/screens/TradeContext.js');
    // Config-driven terminal window (Admin Settings), like adviceShowLatestDays.
    expect(ctx).toContain('const [terminalClosedExtraDays, setTerminalClosedExtraDays] = useState(7);');
    expect(ctx).toContain("response.data?.data?.terminalClosedExtraDays");
    expect(ctx).toContain("setTerminalClosedExtraDays(terminalDays)");
    // Basket path: manager-closed baskets use closure (lifecycle closedAt)
    // + terminal days, vs entry + advice window — whichever is LATER.
    expect(ctx).toContain("item?.basketLifecycle?.closedAt");
    expect(ctx).toContain("trade?.basketLifecycle?.closedAt");
    expect(ctx).toContain("terminalClosedExtraDays * 24 * 60 * 60 * 1000");
    expect(ctx).toContain("const effectiveCutoff = closureCutoff > entryCutoff");
    // Single-stock path: same max() rule.
    expect(ctx).toContain('const isTerminalSingleStock =');
    expect(ctx).toContain('const stockWithinWindow = isTerminalSingleStock');
  });

  test('a pending single-stock SELL close stays visible even at zero quantity', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('const isPendingSingleStockExit =');
    expect(ctx).toContain("stockStatus === 'recommend'");
    expect(ctx).toContain("String(trade?.Type || '').toUpperCase() === 'SELL'");
    expect(ctx).toContain("['fullclose', 'partialclose'].includes(stockClosureStatus)");
    expect(ctx).toContain('(!isPendingSingleStockExit &&');
  });

  test('duplicate or already-completed full exits do not reappear as actions', () => {
    const ctx = read('src/screens/TradeContext.js');
    expect(ctx).toContain('const latestPendingExit = new Map();');
    expect(ctx).toContain('const latestCompletedExitAt = new Map();');
    expect(ctx).toContain('if (latestPendingExit.get(key) !== trade) return acc;');
    expect(ctx).toContain('if (completedExitAt > 0 && completedExitAt >= completedEntryAt) return acc;');
  });
});
