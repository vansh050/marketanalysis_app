/**
 * orderPlaceRows — the broker result rows from a Node
 * `POST /api/process-trades/order-place` reply.
 *
 * Node has always returned the rows as `response`; the apps read `results`
 * (the key ccxt `orders/process-trade` uses). When app 9f3319f2 (2026-09-14)
 * moved single-stock trades onto Node, every placed order came back as an
 * empty list and the result screen said "No Orders Placed… try again" even
 * when the broker had filled it (Markup DefinEdge, 2026-10-12). Node now sends
 * both keys (aq_backend 2fcca2eb); reading both here keeps the app correct
 * against older servers too.
 */
export const orderPlaceRows = data => {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.response)) return data.response;
  return [];
};

/** Same reply with `results` guaranteed (for callers that read `.results`). */
export const withOrderPlaceResults = data =>
  data && typeof data === 'object' && !Array.isArray(data)
    ? {...data, results: orderPlaceRows(data)}
    : data;
