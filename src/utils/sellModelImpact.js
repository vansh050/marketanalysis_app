// SELL review screen (warn mode): what to do when a SELL would use shares a
// model portfolio owns. Mirrors the web (prod-alphaquark-github
// src/utils/sellModelImpact.js) — keep the choice logic identical.
//
// A notice (from POST api/process-trades/sell-impact-preview) looks like:
//   { symbol, requested, freeQuantity, fromModels,
//     models: [{ modelName, savedQuantity }] }
// Choices per symbol:
//   "free" — sell only the shares outside every model (freeQuantity)
//   "all"  — sell the full quantity and lower the chosen model's saved
//            quantity by the shortfall (sent as `modelAuthorization`)
//   none   — the order goes ahead exactly as the customer entered it
// Never blocks; every network call fails open.
import axios from 'axios';

const SERIES = /(?:[-_.](?:EQ|BE|BZ|SM|ST|IQ|GB|GS|RR|MF|AF|BL|BT|IL|IT|N1|N2|NB|NC|ND|NE|NF))+$/i;

export const canonicalSymbol = (symbol) =>
  String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/^(NSE|BSE|NFO|BFO)[:|]/, "")
    .replace(SERIES, "")
    .replace(/[^A-Z0-9]/g, "");

export const isSellLeg = (stock) =>
  String(stock?.transactionType || stock?.Type || "").toUpperCase() === "SELL";

// Which models lose shares, and how many, when the customer picks "all".
// The chosen model goes first; if it holds fewer than the shortfall the
// rest comes from the other models in the order the server listed them.
export const modelReductionPlan = (notice, chosenModel) => {
  const models = [...(notice?.models || [])];
  const first = models.findIndex((m) => m.modelName === chosenModel);
  if (first > 0) models.unshift(...models.splice(first, 1));
  let remaining = Math.max(0, Number(notice?.fromModels) || 0);
  const plan = [];
  for (const m of models) {
    if (remaining <= 0) break;
    const saved = Math.max(0, Number(m.savedQuantity) || 0);
    const take = Math.min(saved, remaining);
    if (take > 0) {
      plan.push({ modelName: m.modelName, from: saved, to: saved - take, take });
      remaining -= take;
    }
  }
  return plan;
};

// Apply one symbol's choice. `baseRows` is the review snapshot taken when the
// screen opened; that symbol's SELL rows are rebuilt from it (so switching
// choices back and forth is lossless) and every other row is left exactly as
// the customer has it now.
export const applySellChoice = (currentRows, baseRows, notice, choice, chosenModel) => {
  const key = canonicalSymbol(notice?.symbol);
  const matches = (s) => isSellLeg(s) && canonicalSymbol(s.tradingSymbol || s.Symbol) === key;
  const rebuilt = (baseRows || []).filter(matches).map((s) => {
    const row = { ...s };
    delete row.modelAuthorization;
    return row;
  });
  if (!rebuilt.length) return currentRows;

  if (choice === "free") {
    // Trim from the last leg backwards until the symbol totals freeQuantity.
    let excess = rebuilt.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
      - Math.max(0, Math.floor(Number(notice.freeQuantity) || 0));
    for (const row of [...rebuilt].reverse()) {
      if (excess <= 0) break;
      const cut = Math.min(Number(row.quantity) || 0, excess);
      row.quantity = (Number(row.quantity) || 0) - cut;
      excess -= cut;
    }
  } else if (choice === "all") {
    const authorization = {};
    for (const step of modelReductionPlan(notice, chosenModel)) {
      authorization[step.modelName] = step.take;
    }
    if (Object.keys(authorization).length) rebuilt[0].modelAuthorization = authorization;
  }
  const kept = rebuilt.filter((r) => (Number(r.quantity) || 0) > 0);

  const current = currentRows || [];
  const at = current.findIndex(matches);
  const others = current.filter((s) => !matches(s));
  const position = at < 0 ? others.length : current.slice(0, at).filter((s) => !matches(s)).length;
  return [...others.slice(0, position), ...kept, ...others.slice(position)];
};

const sellPayload = rows =>
  (rows || []).filter(isSellLeg).map(s => ({
    tradingSymbol: s.tradingSymbol || s.Symbol || s.symbol,
    transactionType: 'SELL',
    exchange: s.exchange || s.Exchange,
    quantity: Number(s.quantity) || 0,
    productType: s.productType || s.ProductType,
    ...(s.modelAuthorization ? {modelAuthorization: s.modelAuthorization} : {}),
  }));

// Review-screen notices. [] on any failure (the screen stays as it was).
export const fetchSellImpactNotices = async ({baseUrl, broker, rows, headers}) => {
  const trades = sellPayload(rows);
  if (!broker || broker === 'DummyBroker' || !trades.length) return [];
  try {
    const response = await axios.post(
      `${baseUrl}api/process-trades/sell-impact-preview`,
      {user_broker: broker, trades},
      {headers, timeout: 8000},
    );
    return Array.isArray(response?.data?.notices) ? response.data.notices : [];
  } catch (error) {
    console.warn('[sell-impact] preview skipped:', error?.message);
    return [];
  }
};

// Publisher brokers place from the Kite window, so the SELL hold (with any
// model choice) is written just before it opens. Returns the ref for
// publisher/record-orders, or null (placement proceeds as before).
export const reserveSellHolds = async ({baseUrl, broker, rows, headers, requestId}) => {
  const trades = sellPayload(rows);
  if (!trades.length) return null;
  try {
    const response = await axios.post(
      `${baseUrl}api/process-trades/sell-impact-reserve`,
      {user_broker: broker, trades, requestId},
      {headers, timeout: 8000},
    );
    return response?.data?.reservationRef || null;
  } catch (error) {
    console.warn('[sell-impact] hold skipped:', error?.message);
    return null;
  }
};

export const sellSignature = rows =>
  (rows || [])
    .filter(isSellLeg)
    .map(s => `${canonicalSymbol(s.tradingSymbol || s.Symbol || s.symbol)}:${Number(s.quantity) || 0}`)
    .sort()
    .join('|');
