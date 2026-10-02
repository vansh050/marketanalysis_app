const asOne = entries => {
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return [...list].sort((left, right) => {
    const leftDate = new Date(left?.execDate || left?.executionDate || 0).getTime();
    const rightDate = new Date(right?.execDate || right?.executionDate || 0).getTime();
    return rightDate - leftDate;
  })[0] || null;
};

const timeOf = entry => {
  const raw = entry?.created_at || entry?.createdAt || entry?.execDate ||
    entry?.executionDate || entry?.updated_at || 0;
  const value = raw && typeof raw === 'object' && raw.$date ? raw.$date : raw;
  const parsed = new Date(
    value,
  ).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const publisherStatus = claim => {
  if (claim?.broker_status) return claim.broker_status;
  const state = String(claim?.state || '').toLowerCase();
  if (state === 'complete') return 'COMPLETE';
  if (state === 'failed') return 'REJECTED';
  if (state === 'prepared') return 'READY TO SUBMIT';
  if (claim?.broker_order_id) return 'PENDING';
  return 'NOT SENT';
};

const publisherOrders = attempt => {
  const claims = Array.isArray(attempt?.orders) ? attempt.orders : [];
  const legs = Array.isArray(attempt?.legs) ? attempt.legs : [];
  const asOrder = claim => ({
      tradingSymbol: claim.symbol,
      symbol: claim.symbol,
      transactionType: claim.transaction_type || claim.type || claim.side,
      quantity: claim.requested_quantity,
      orderId: claim.broker_order_id,
      orderStatus: publisherStatus(claim),
      publisherState: claim.state,
      legIndex: claim.leg_index,
      averagePrice: claim.average_price,
      orderStatusMessage:
        publisherStatus(claim) === 'NOT SENT'
          ? 'No matching broker order was found for this approved leg.'
          : publisherStatus(claim) === 'READY TO SUBMIT'
            ? 'This frozen buy is ready to open in Zerodha.'
          : undefined,
    });
  if (legs.length > 0) {
    return legs.map((leg, index) => {
      const claim = claims.find(item => Number(item?.leg_index) === index) ||
        claims.find(item =>
          String(item?.symbol || '').toUpperCase() === String(leg?.symbol || leg?.tradingSymbol || '').toUpperCase() &&
          String(item?.transaction_type || item?.type || item?.side || '').toUpperCase() === String(leg?.transactionType || leg?.type || '').toUpperCase(),
        );
      return claim ? asOrder(claim) : {
        tradingSymbol: leg.symbol || leg.tradingSymbol,
        symbol: leg.symbol || leg.tradingSymbol,
        transactionType: leg.transactionType || leg.type,
        quantity: leg.quantity,
        orderId: null,
        orderStatus: 'NOT SENT',
        orderStatusMessage: 'This approved leg was not found in the linked broker account.',
      };
    });
  }
  if (claims.length > 0) {
    return claims.map(asOrder);
  }
  return [];
};

const publicDate = value => value && typeof value === 'object' && value.$date
  ? value.$date
  : value;

const publisherContinuation = attempt => {
  const claims = Array.isArray(attempt?.orders) ? attempt.orders : [];
  const legs = Array.isArray(attempt?.legs) ? attempt.legs : [];
  const claimForLeg = (leg, index) => claims.find(
    claim => Number(claim?.leg_index) === index,
  ) || claims.find(claim =>
    String(claim?.symbol || '').toUpperCase() ===
      String(leg?.symbol || leg?.tradingSymbol || '').replace(/-(EQ|BE|BZ)$/i, '').toUpperCase() &&
    String(claim?.transaction_type || claim?.type || claim?.side || '').toUpperCase() ===
      String(leg?.transactionType || leg?.type || '').toUpperCase(),
  );
  const allSellsComplete = legs
    .map((leg, index) => ({leg, claim: claimForLeg(leg, index)}))
    .filter(({leg}) => String(leg?.transactionType || leg?.type || '').toUpperCase() === 'SELL')
    .every(({claim}) => String(claim?.state || '').toLowerCase() === 'complete');
  const buyLegs = legs.filter((leg, index) => {
    if (String(leg?.transactionType || leg?.type || '').toUpperCase() !== 'BUY') return false;
    const claim = claimForLeg(leg, index);
    return String(claim?.state || '').toLowerCase() === 'prepared' &&
      !claim?.broker_order_id;
  });
  const attemptId = attempt?.attempt_id || attempt?.attempt;
  if (!attemptId || !allSellsComplete || buyLegs.length === 0) return null;
  return {
    attemptId,
    buyLegs,
    allLegs: legs,
    context: {
      uniqueId: attempt?.unique_id || null,
      planId: attempt?.plan_id || null,
    },
  };
};

export const extractLatestModelPortfolioOrderAttempt = (
  payload,
  recommendationId = null,
) => {
  const data = payload?.data?.data || payload?.data || payload || {};
  const adviceEntries = Array.isArray(data.advice_executed)
    ? data.advice_executed
    : data.advice_executed
      ? [data.advice_executed]
      : [];
  const advice = asOne(
    recommendationId
      ? adviceEntries.filter(entry =>
          String(entry?.model_id || entry?.modelId || '') ===
          String(recommendationId),
        )
      : adviceEntries,
  );
  const publisher = data.publisherAttempt || null;
  const continuation = publisher ? publisherContinuation(publisher) : null;
  const publisherIdentity = publisher && (
    publisher.unique_id || publisher.plan_id || publisher.attempt_id ||
    publisher.attempt
  ) ? {
      uniqueId: publisher.unique_id || undefined,
      planId: publisher.plan_id || undefined,
      attemptId: publisher.attempt_id || publisher.attempt || undefined,
    } : null;
  const adviceIdentity = advice?.uniqueId || advice?.planId || advice?.attemptId
    ? {
        uniqueId: advice.uniqueId || undefined,
        planId: advice.planId || undefined,
        attemptId: advice.attemptId || undefined,
      }
    : null;
  const candidates = [
    advice && {
      source: 'execution',
      attemptedAt: advice.execDate || advice.executionDate,
      attemptId: advice.uniqueId || advice.attemptId,
      queueIdentity: adviceIdentity,
      orders: Array.isArray(advice.order_results) ? advice.order_results : [],
      time: timeOf(advice),
    },
    publisher && {
      source: 'publisher',
      attemptedAt: publicDate(publisher.created_at || publisher.updated_at),
      attemptId: publisher.attempt_id || publisher.attempt || publisher.plan_id || publisher.unique_id,
      uniqueId: publisher.unique_id || null,
      planId: publisher.plan_id || null,
      state: publisher.state,
      continuation,
      queueIdentity: publisherIdentity,
      orders: publisherOrders(publisher),
      time: timeOf(publisher),
    },
  ].filter(Boolean).sort((left, right) => {
    const byTime = right.time - left.time;
    if (byTime) return byTime;
    const priority = {publisher: 3, execution: 2, holdings: 1};
    return (priority[right.source] || 0) - (priority[left.source] || 0);
  });

  // The server attaches `publisherAttempt` ONLY while the attempt is in a
  // state that still needs verification or Repair (intent_open,
  // intent_partial, server_recorded_pending, recorded_partial) — it is the
  // current-action projection, not history. When it is present it is the
  // truth, whatever the timestamps say: the record-back writes advice_executed
  // seconds AFTER the intent's created_at, with only the legs Kite accepted,
  // so a newest-wins sort hid the leg Kite never took. prod/testaccount
  // 2026-09-18: TAPARIA never reached Kite, ZEELEARN did; the modal read the
  // advice row and said "1 completed · 0 need action" while the card,
  // correctly, held at Awaiting Broker Confirmation.
  const attachedPublisher = candidates.find(
    candidate => candidate.source === 'publisher',
  );
  return attachedPublisher || candidates[0] || {
    source: 'none', attemptedAt: null, attemptId: null,
    queueIdentity: null, orders: [], time: 0,
  };
};

export const extractLatestModelPortfolioOrderResults = payload =>
  extractLatestModelPortfolioOrderAttempt(payload).orders;

// Current-holdings confirmation must never use the newest publisher/execution
// attempt. Those rows describe proposed/attempted trades, not what the model
// portfolio owns. Keep the status helper above for Order Status; use this
// snapshot-only selector for the holdings confirmation step.
export const extractCurrentModelPortfolioHoldings = payload => {
  const data = payload?.data?.data || payload?.data || payload || {};
  const holdings = asOne(data.user_net_pf_model);
  return Array.isArray(holdings?.order_results) ? holdings.order_results : [];
};
