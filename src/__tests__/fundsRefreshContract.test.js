const fs = require('fs');
const path = require('path');
const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('broker funds refresh contract', () => {
  test('missing cash is never rendered as zero and refresh is screen-scoped', () => {
    const screen = read('src/screens/Home/SubscriptionScreen.js');
    expect(screen).not.toContain('funds?.data?.availablecash || 0');
    expect(screen).toContain('getAllFunds({maxAgeMs: 30000})');
  });

  test('context single-flights only matching credentials and separates probe from display state', () => {
    const context = read('src/screens/TradeContext.js');
    expect(context).toContain('fundsInFlightRef.current?.requestKey === requestKey');
    expect(context).toContain('fundsInFlightRef.current?.credentialsKey === credentialsKey');
    expect(context).toContain('fundsInFlightRef.current = {requestKey, credentialsKey, promise}');
    expect(context).toContain('confirmedFundsSnapshot(fetchedFunds)');
  });

  test('broker switch and order completion invalidate account cash', () => {
    const screen = read('src/screens/Home/SubscriptionScreen.js');
    const context = read('src/screens/TradeContext.js');
    expect(screen).toContain('userDetailsOverride: updatedUser');
    expect(screen).toContain("source: 'primary-broker-switch'");
    expect(context).toContain("eventEmitter.on('OrderPlacedReferesh', refreshAccountState)");
    expect(context).toContain('force: true');
  });

  test('direct broker funds probes are bounded and return a transient timeout', () => {
    const fetchFunds = read('src/FunctionCall/fetchFunds.js');
    expect(fetchFunds).toContain('const BROKER_FUNDS_TIMEOUT_MS = 10000');
    expect(fetchFunds).toContain('timeout: BROKER_FUNDS_TIMEOUT_MS');
    expect(fetchFunds).toContain("error_code: 'BROKER_TIMEOUT'");
    expect(fetchFunds).toContain('is temporarily unavailable. Please try again.');
  });

  test('post-OAuth refresh retries funds when the token changed without a broker change', () => {
    const hook = read('src/hooks/useRefreshBrokerStatus.js');
    const context = read('src/screens/TradeContext.js');
    expect(hook).toContain('credentialsChangedMidFlight');
    expect(hook).toContain('freshUserDetails.jwtToken !== userDetails?.jwtToken');
    expect(hook).toContain('brokerChangedMidFlight || credentialsChangedMidFlight');
    expect(context).toContain('let refreshedFunds = null');
    expect(context).toContain('funds: refreshedFunds');
  });

  test('repair verification is single-flight and silent polling skips it', () => {
    const context = read('src/screens/TradeContext.js');
    expect(context).toContain('const repairRequestInFlightRef = useRef(null)');
    expect(context).toContain('activeRequest.controller.abort()');
    expect(context).toContain('!options?.skipRepair &&');
    expect(context).toContain('(!silent || options?.refreshRepair === true)');
    expect(context).toContain('signal: controller.signal');
    expect(context).toContain('timeout: 10000');
  });
});
