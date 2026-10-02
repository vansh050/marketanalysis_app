// Publisher callbacks are notifications, not proof that the frozen plan filled.
export function isPublisherExecutionComplete(body) {
  const life = body?.intentLifecycle;
  return body?.status === 0 && Number(life?.total) > 0 &&
    life?.all_terminal === true && Number(life.successful) === Number(life.total) &&
    Number(life.unresolved || 0) === 0 && Number(life.failed || 0) === 0;
}

export function includeUnconfirmedPublisherLegs(rows = [], approved = [], body) {
  if (isPublisherExecutionComplete(body)) return rows;
  const identity = row => [
    String(row.tradingSymbol || row.symbol || '').toUpperCase().replace(/-EQ$/, ''),
    String(row.transactionType || '').toUpperCase(),
    String(row.exchange || 'NSE').toUpperCase(),
  ].join(':');
  const observed = new Set(rows.map(identity));
  return [...rows, ...approved.filter(leg => !observed.has(identity(leg))).map(leg => ({
    ...leg,
    symbol: leg.symbol || leg.tradingSymbol,
    orderStatus: 'PENDING_CONFIRMATION',
    executionState: 'waiting_for_broker',
    orderStatusMessage: 'Submission is not yet verified. Backend reconciliation will determine whether this leg needs Repair.',
  }))];
}
