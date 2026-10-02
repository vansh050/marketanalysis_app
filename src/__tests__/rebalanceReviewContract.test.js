const fs = require('fs');
const path = require('path');
const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const readAndroidSource = fileName => {
  const find = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = find(absolute);
        if (nested) return nested;
      } else if (entry.name === fileName) {
        return absolute;
      }
    }
    return null;
  };
  const file = find(path.join(process.cwd(), 'android/app/src/main/java'));
  if (!file) throw new Error(`Could not find Android source ${fileName}`);
  return fs.readFileSync(file, 'utf8');
};

describe('rebalance review navigation and copy contract', () => {
  test('verified Repair opens without repeating broker funds verification', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain('if (hasRepairTrades && matchingFailedTrades)');
    expect(card).toContain('await handleAcceptClick(matchingFailedTrades)');
    expect(card).toContain('forceNetwork: !openRepairDirectly');
    expect(card).toContain('openRepairDirectly\n          ? {ok: true}');
  });
  test('repair card has no unsolicited funding banner or dormant native windows', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    const information = read('src/components/AdviceScreenComponents/RepairConfimationModal.js');
    expect(card).not.toContain('Some orders need attention — open Repair');
    expect(card).toContain('{modalVisible && <Modal');
    expect(card).toContain('{modalVisibleDetails && <RebalanceDetailsModal');
    expect(information).toContain('if (!openModal) return null');
  });

  test('repair bypasses preference and holdings screens', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    const modal = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    expect(card).not.toContain("import RebalancePreferenceModal from './RebalancePreferenceModal'");
    expect(card).toContain('await handleCheckBroker(true)');
    expect(card).toContain('setOpenRebalanceModal(true)');
    expect(modal).toContain('const isRepairMode = repairStatus;');
    expect(modal).not.toContain('repairStatus && !!rebalanceExecutionStatus');
  });

  test('fresh review can bypass holdings while the explicit editor remains available', () => {
    const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    const comparison = read('src/components/RebalanceChangeDetailModal.js');
    expect(comparison).toContain('Expected vs Current Holdings');
    expect(comparison).toContain('View and act');
    expect(advices).toContain('await fetchHoldingsAndShowStatus()');
    expect(advices).toContain('if (currentStep === 2 || options.directReview)');
    expect(advices).toContain('setOpenRebalanceModal(true)');
  });

  test('accept actions are guarded before React can render the loading state', () => {
    const modal = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    const execution = read('src/screens/Rebalance/ExecutionStatusScreen.js');
    expect(modal).toContain('if (orderActionInFlightRef.current) return;');
    expect(modal).toContain('orderActionInFlightRef.current = true;');
    expect(modal).toContain('orderActionInFlightRef.current = false;');
    expect(execution).toContain('if (executionInFlightRef.current) return;');
    expect(execution).toContain('executionInFlightRef.current = false;');
  });

  test('partial retries cannot fall through to Calculate before repair discovery', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain('needsRepairDiscovery');
    expect(card).toContain('handleRepairDiscovery');
    expect(card).toContain("'Review Allocation'");
    expect(card).toContain('selectedRepairPortfolios');
    expect(card).toContain('await handleAcceptClick(verifiedRepair)');
    expect(card).toContain('handleRepairDiscovery()');
    expect(card).toContain("isSellRetryPhase ? 'Review Failed Orders' : 'Repair Portfolio'");
    expect(card).toContain("`${broker || 'Broker'} temporarily slow`");
  });

  test('a manual retry advances account reconciliation without reenrolling a pending attempt', () => {
    const context = read('src/screens/TradeContext.js');
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(context).toContain('refreshAccount: options.manual === true');
    expect(context).toContain('timeout: options.manual === true ? 45000 : 10000');
    expect(card).toContain('Broker order status is pending');
    expect(card).toContain('Checking broker...');
    expect(card).toContain('if (!selectedAttempt.queueIdentity)');
    expect(card).toContain('...selectedAttempt.queueIdentity');
  });

  test('broker preflight is reused instead of fetched twice', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain('const handleCheckStatus = async freshStatusOverride =>');
    expect(card).toContain('await handleCheckStatus(freshStatus)');
  });

  test('a broker-resolved partial card becomes executed immediately', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain('const [locallyResolvedAligned, setLocallyResolvedAligned]');
    expect(card).toContain('setLocallyResolvedAligned(true)');
    expect(card).toContain('await Promise.all([');
    expect(card).toContain('!locallyResolvedAligned &&');
  });

  test('review list owns the available height and funding detail is not a fixed footer', () => {
    const modal = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    const funding = read('src/components/LowFundsRebalanceWarning.js');
    expect(modal).toContain('Scroll to see all ↓');
    expect(modal).toContain('style={styles.orderList}');
    expect(modal).toContain('ListFooterComponent={dataArray.length > 0 ? (');
    expect(modal).toContain('{renderFundingConsentPanel()}');
    expect(modal).toContain('{dataArray.length === 0 && renderFundingConsentPanel()}');
    expect(modal).not.toContain('Funding used for this calculation');
    expect(modal).not.toContain('Additional funds needed for the complete plan:');
    expect(funding).toContain("expanded ? 'Hide details' : 'View details'");
    expect(modal).toContain("allocationExplanation?.code === 'TARGET_SHARES_UNAFFORDABLE'");
    expect(modal).toContain('Why there are no buy orders');
    expect(modal).toContain('This does not mean the portfolio is already in the correct state.');
    expect(modal).toContain('!showUnaffordableTargetsExplanation &&');
    expect(modal).toContain('Target Allocation Is Not Yet Reachable');
    expect(modal).toContain('No orders were placed, so this portfolio is not aligned yet.');
    expect(modal).not.toContain('Possible unverified model cash');
  });

  test('background repair verification is silent until actionable', () => {
    const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    expect(advices).not.toContain('Could not verify previous execution');
    expect(advices).not.toContain('Verifying broker orders…');
  });

  test('the terminal card label reflects completed execution', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    expect(card).toContain("? 'Rebalance Executed'");
    expect(card).not.toContain("? 'Rebalance Accepted'");
  });

  test('holdings editor keeps document identity and awaits Step 3', () => {
    const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    const holdings = read('src/components/AdviceScreenComponents/MPStatusModal.js');
    const modalSoftInput = readAndroidSource('ModalSoftInputModule.kt');
    expect(advices).toContain('portfolioDocumentId={portfolioDocumentIdForModal}');
    // Both the rebalance-fetch and the mode-select/Edit Holdings re-fetch must
    // scope to the effective broker; a broker-less GET returns the default/Dummy
    // document and can null the doc id, stranding the editor on save.
    expect(advices.match(/params: \{broker: broker \|\| 'DummyBroker'\}/g) || []).toHaveLength(2);
    expect(advices).toContain("if (error?.response?.status === 404)");
    expect(holdings).toContain('setPortfolioDocId(portfolioDocumentId || null)');
    expect(holdings).toContain('const advanced = await handleAcceptRebalance()');
    expect(holdings).toContain('if (advanced !== true)');
    expect(holdings).toContain("fetchErr?.response?.config?.method?.toLowerCase() === 'put'");
    // edit-mode rows must re-render when the view flips so inputs/trash enable.
    expect(holdings).toContain('extraData={isEditing}');
    // No modal-wide dismiss handler may close a freshly opened IME.
    expect(holdings).not.toContain(
      '<TouchableWithoutFeedback onPress={Keyboard.dismiss}>',
    );
    // Preserve the full-screen native presentation while opting this one
    // Android dialog out of the Fabric/IME adjustResize focus race.
    expect(holdings).toContain('<Modal');
    expect(holdings).toContain('testID="holdings-editor-modal"');
    expect(holdings).toContain(
      'onShow={() => configureAndroidModalKeyboard(holdingsModalRef)}',
    );
    expect(holdings).not.toContain('onShow={handleHoldingsModalShow}');
    // + Add is already a customer gesture on a settled full-screen Modal. The
    // Symbol field must focus once after the form mounts; opening the holdings
    // screen itself must not focus an existing price/quantity field.
    expect(holdings).toContain('addFormRequestedFocusRef.current = true');
    expect(holdings).toContain('newSymbolInputRef.current?.focus()');
    expect(holdings).toContain('ref={newSymbolInputRef}');
    expect(holdings).not.toContain('priceInputRefs');
    expect(holdings).toContain('const handleOpenAddForm = () =>');
    expect(holdings).not.toContain('CrossPlatformOverlay');
    expect(holdings).not.toContain('<SquarePen');
    expect(holdings).toContain("'Remove from this model?'");
    expect(holdings).toContain("text: 'Keep at broker'");
    expect(holdings).not.toContain("text: 'Sell & remove'");
    expect(holdings).toContain("transparent={false}");
    expect(holdings).toContain("setAdjustPan('holdings-editor-modal')");
    expect(holdings).toContain('findNodeHandle');
    expect(modalSoftInput).toContain(
      'view.getTag(com.facebook.react.R.id.react_test_id) == testId',
    );
    expect(modalSoftInput).toContain('SOFT_INPUT_ADJUST_PAN');
    expect(modalSoftInput).not.toContain('SOFT_INPUT_ADJUST_RESIZE');
    expect(holdings).toContain('ref={holdingsModalRef}');
    expect(modalSoftInput).toContain('setAdjustPanForTag');
    expect(modalSoftInput).toContain('getUIManagerForReactTag');
    expect(holdings).not.toContain(
      "setTimeout(async () => {\\n        try {\\n          setSuccessMessage(null)",
    );
  });

  test('holding comparison uses the selected card snapshot before fallback fetch', () => {
    const comparison = read('src/components/RebalanceChangeDetailModal.js');
    expect(comparison).toContain('rebalanceDetails');
    expect(comparison).toContain(
      'const selectedHistory = rebalanceDetails?.model?.rebalanceHistory',
    );
    expect(comparison).toContain('processTableData(selectedHistory)');
    expect(comparison).toContain('Allocation details are temporarily unavailable');
    expect(comparison).toContain('disabled={tableData.length === 0}');
  });

  test('cash reservation race is explained without a generic editor error', () => {
    const advices = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    expect(advices).toContain("calculationFailure?.code === 'CAPITAL_CASH_ALREADY_RESERVED'");
    expect(advices).toContain("'Funds already assigned'");
    expect(advices).toContain('return false;');
  });

  test('active rebalance owns durable Zerodha sell-to-buy recovery', () => {
    const modal = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    const content = read('src/components/AdviceScreenComponents/RebalanceAdviceContent.js');
    const parent = read('src/components/AdviceScreenComponents/RebalanceAdvices.js');
    const result = read('src/components/ModelPortfolioComponents/RecommendationSuccessModal.js');
    expect(modal).toContain('createZerodhaPublisherAttempt');
    expect(modal).toContain('api/process-trades/execution-intent');
    expect(modal).toContain('api/zerodha/publisher/attempt-status');
    expect(modal).toContain('attempt_id: zerodhaAdditionalPayload.attemptId');
    expect(modal).toContain("isPublisherExecutionComplete");
    expect(modal).not.toContain("executionStatus = isTerminalPublisherBatch ? 'executed' : 'pending'");
    expect(modal).toContain('isZerodhaSellAuthorized(liveUserDetails)');
    expect(result).toContain('Continue with the remaining buy-only basket');
    expect(result).toContain('AUTHORIZE_OR_CHECK_ACCOUNT');
    expect(modal).toContain('publisherContinuationLaunchRef.current === attemptId');
    expect(modal).toContain('await resumeZerodhaBuyPublisher(publisherBuyContinuation)');
    expect(modal).toContain('Number.isFinite(freshLtp) && freshLtp > 0');
    expect(modal).toContain('!publisherBuyContinuation?.attemptId');
    expect(content).not.toContain('<RecommendationSuccessModal');
    expect(parent).toContain('onContinuePublisherBuys={continuation =>');
  });

  test('CDSL authorization shares the app-root broker browser session', () => {
    const ddpi = read('src/components/DdpiModal.js');
    expect(ddpi).toContain("import PublisherWebViewOverlay from './PublisherWebViewOverlay'");
    expect(ddpi).toContain('authUrl ? (');
    expect(ddpi).toContain('<PublisherWebViewOverlay');
    expect(ddpi).toContain('visible={isOpen && !authUrl}');
    expect(ddpi).not.toContain('visible={!!authUrl}');
  });

  test('manual model-portfolio recording requires actual quantity and average price only', () => {
    const result = read('src/components/ModelPortfolioComponents/RecommendationSuccessModal.js');
    expect(result).toContain('Mark as Placed (manual)');
    expect(result).toContain('Enter the actual average execution price from your broker.');
    expect(result).toContain('placeholder="Actual ₹ per share"');
    expect(result).toContain('actualQty: qtyNum');
    expect(result).toContain('actualPrice: priceNum');
    expect(result).not.toContain('₹ per share (optional)');
  });

  test('cleared Publisher attempts continue into Repair and the broker login remains interactive', () => {
    const card = read('src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js');
    const modal = read('src/components/AdviceScreenComponents/RebalanceModal.js');
    expect(card).toContain("await getModelPortfolioStrategyDetails?.({silent: true})");
    expect(card).toContain("text: 'Open Repair'");
    expect(card).toContain("repairDiscoveryRef.current?.({allowFresh: false})");
    expect(modal).toContain('<PublisherWebViewOverlay');
  });

  test('every Kite Publisher WebView keeps Android login focus during live-price renders', () => {
    const overlay = read('src/components/PublisherWebViewOverlay.js');
    const app = read('App.js');
    const publisherModals = [
      read('src/components/AdviceScreenComponents/RebalanceModal.js'),
      read('src/components/ModelPortfolioComponents/MPReviewTradeModal.js'),
      read('src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js'),
      read('src/components/ReviewZerodhaTradeModal.js'),
    ];

    publisherModals.forEach(modal => {
      expect(modal).toContain('const publisherWebViewSource = useMemo(');
      expect(modal).toContain('source={publisherWebViewSource}');
      expect(modal).toContain('<PublisherWebViewOverlay');
      expect(modal.indexOf('<PublisherWebViewOverlay')).toBeLessThan(
        modal.indexOf('<Modal'),
      );
    });

    expect(overlay).not.toContain('Modal,');
    expect(overlay).toContain('...StyleSheet.absoluteFillObject');
    expect(overlay).toContain('testID="publisher-webview-host"');
    expect(overlay).toContain('return null;');
    expect(overlay).toContain('const sessionConfigRef = useRef(null)');
    expect(overlay).toContain('open(owner, sessionConfigRef.current)');
    expect(overlay).toContain('PublisherWebViewHost = React.memo');
    expect(overlay).not.toContain('update(ownerRef.current, props)');
    expect(overlay).toContain('keyboardDisplayRequiresUserAction={false}');
    expect(overlay).toContain('setSupportMultipleWindows={false}');
    expect(app.match(/<PublisherWebViewHost \/>/g)).toHaveLength(2);
  });
});
