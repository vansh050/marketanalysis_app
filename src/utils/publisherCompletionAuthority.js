// Publisher callbacks are notifications, not proof that the frozen plan filled.
export function isPublisherExecutionComplete(body) {
  const life = body?.intentLifecycle;
  return body?.status === 0 && Number(life?.total) > 0 &&
    life?.all_terminal === true && Number(life.successful) === Number(life.total) &&
    Number(life.unresolved || 0) === 0 && Number(life.failed || 0) === 0;
}

export function includeUnconfirmedPublisherLegs(rows = [], approved = [], body) {
  if (isPublisherExecutionComplete(body)) return rows;
  const symbolSide = row => [
    String(row.tradingSymbol || row.symbol || '').toUpperCase().replace(/-(EQ|BE|BZ)$/, ''),
    String(row.transactionType || '').toUpperCase(),
  ].join(':');
  const identity = row => `${symbolSide(row)}:${String(row.exchange || 'NSE').toUpperCase()}`;
  const observed = new Set(rows.map(identity));
  // The broker may report the order on the other exchange (Fyers 2026-10-05:
  // plan PATELENG NSE, order book PATELENG BSE). Match on stock + side unless
  // the plan itself has that stock + side on more than one exchange.
  const observedBySide = new Set(rows.map(symbolSide));
  const legsPerSide = approved.reduce((m, leg) => m.set(symbolSide(leg), (m.get(symbolSide(leg)) || 0) + 1), new Map());
  const isObserved = leg =>
    observed.has(identity(leg)) ||
    (legsPerSide.get(symbolSide(leg)) === 1 && observedBySide.has(symbolSide(leg)));
  return [...rows, ...approved.filter(leg => !isObserved(leg)).map(leg => ({
    ...leg,
    symbol: leg.symbol || leg.tradingSymbol,
    orderStatus: 'PENDING_CONFIRMATION',
    executionState: 'waiting_for_broker',
    orderStatusMessage: 'Submission is not yet verified. Backend reconciliation will determine whether this leg needs Repair.',
  }))];
}
