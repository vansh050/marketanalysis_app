const normalizeSymbol = value =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BZ|BL|SM|ST)$/i, '');

const normalizeExchange = value => String(value || '').trim().toUpperCase();

const readTradeSide = trade =>
  String(
    trade?.transactionType ||
      trade?.TransactionType ||
      trade?.type ||
      trade?.Type ||
      '',
  ).toUpperCase();

const readTradeQuantity = trade =>
  Number(
    trade?.quantity ??
      trade?.Quantity ??
      trade?.qty ??
      trade?.Qty ??
      0,
  );

export const getDhanSellTrades = (...tradeCollections) =>
  tradeCollections
    .flatMap(collection => (Array.isArray(collection) ? collection : collection ? [collection] : []))
    .filter(trade => readTradeSide(trade) === 'SELL');

export const isDhanSellAuthorizationReady = (edisResponse, trades) => {
  const sellTrades = getDhanSellTrades(trades);
  const holdings = Array.isArray(edisResponse?.data) ? edisResponse.data : [];

  if (sellTrades.length === 0 || holdings.length === 0) return false;

  const requirements = Array.from(
    sellTrades.reduce((grouped, trade) => {
      const isin = String(trade?.isin || trade?.ISIN || '').trim().toUpperCase();
      const symbol = normalizeSymbol(
        trade?.tradingSymbol || trade?.TradingSymbol || trade?.symbol || trade?.Symbol,
      );
      const exchange = normalizeExchange(trade?.exchange || trade?.Exchange);
      const key = isin ? `isin:${isin}` : `symbol:${symbol}:${exchange}`;
      const existing = grouped.get(key);
      grouped.set(key, {
        trade,
        requiredQuantity:
          (existing?.requiredQuantity || 0) + Math.max(0, readTradeQuantity(trade)),
      });
      return grouped;
    }, new Map()).values(),
  );

  return requirements.every(({trade, requiredQuantity}) => {
    const tradeIsin = String(trade?.isin || trade?.ISIN || '').trim().toUpperCase();
    const tradeSymbol = normalizeSymbol(
      trade?.tradingSymbol || trade?.TradingSymbol || trade?.symbol || trade?.Symbol,
    );
    const tradeExchange = normalizeExchange(trade?.exchange || trade?.Exchange);

    const candidates = holdings.filter(holding => {
      const holdingIsin = String(holding?.isin || '').trim().toUpperCase();
      if (tradeIsin && holdingIsin) return tradeIsin === holdingIsin;

      if (!tradeSymbol || normalizeSymbol(holding?.symbol) !== tradeSymbol) return false;
      const holdingExchange = normalizeExchange(holding?.exchange);
      return !tradeExchange || !holdingExchange || holdingExchange === tradeExchange;
    });

    const authorizedCandidates = candidates.filter(holding => holding?.edis === true);
    if (authorizedCandidates.length === 0) return false;

    // Dhan can return the same ISIN once per exchange. Those rows describe the
    // same depository approval, so use the largest approved quantity rather
    // than summing duplicates. Requested quantities, however, are aggregated.
    const approvedQuantity = Math.max(
      ...authorizedCandidates.map(holding =>
        Number(holding?.aprvdQty ?? holding?.approvedQty ?? 0),
      ),
    );
    return requiredQuantity <= 0 || approvedQuantity >= requiredQuantity;
  });
};
