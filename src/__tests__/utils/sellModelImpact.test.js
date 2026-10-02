import { applySellChoice, canonicalSymbol, modelReductionPlan } from "../../utils/sellModelImpact";

const notice = {
  symbol: "ABC-EQ", requested: 45, freeQuantity: 40, fromModels: 5,
  models: [{ modelName: "Model A", savedQuantity: 40 }, { modelName: "Model B", savedQuantity: 30 }],
};
const base = [
  { tradingSymbol: "XYZ-EQ", transactionType: "BUY", quantity: 3 },
  { tradingSymbol: "ABC-EQ", transactionType: "SELL", quantity: 45, tradeId: "t1" },
];

describe("sell model impact (warn mode)", () => {
  it("canonicalises symbols across series and exchange spellings", () => {
    expect(canonicalSymbol("NSE:ABC-EQ")).toBe("ABC");
    expect(canonicalSymbol("abc")).toBe("ABC");
  });

  it("free: sells only the shares outside every model", () => {
    const out = applySellChoice(base, base, notice, "free", "Model B");
    expect(out.find((r) => r.tradingSymbol === "ABC-EQ").quantity).toBe(40);
    expect(out.find((r) => r.tradingSymbol === "ABC-EQ").modelAuthorization).toBeUndefined();
    expect(out[0]).toEqual(base[0]); // other rows untouched, order kept
  });

  it("free with zero free shares drops the leg; switching back restores it", () => {
    const none = { ...notice, freeQuantity: 0, fromModels: 45 };
    const dropped = applySellChoice(base, base, none, "free", "Model A");
    expect(dropped.some((r) => r.tradingSymbol === "ABC-EQ")).toBe(false);
    const restored = applySellChoice(dropped, base, none, "all", "Model A");
    expect(restored.find((r) => r.tradingSymbol === "ABC-EQ").quantity).toBe(45);
  });

  it("all: keeps the quantity and authorizes only the chosen model", () => {
    const out = applySellChoice(base, base, notice, "all", "Model B");
    const leg = out.find((r) => r.tradingSymbol === "ABC-EQ");
    expect(leg.quantity).toBe(45);
    expect(leg.modelAuthorization).toEqual({ "Model B": 5 });
  });

  it("spills to the next model only when the chosen one holds too few", () => {
    const plan = modelReductionPlan({ ...notice, fromModels: 35 }, "Model B");
    expect(plan).toEqual([
      { modelName: "Model B", from: 30, to: 0, take: 30 },
      { modelName: "Model A", from: 40, to: 35, take: 5 },
    ]);
  });

  it("customer edits to other rows survive a choice", () => {
    const edited = [{ ...base[0], quantity: 9 }, base[1]];
    const out = applySellChoice(edited, base, notice, "free", "Model B");
    expect(out[0].quantity).toBe(9);
  });
});

jest.mock('axios');
const axios = require('axios');
const {fetchSellImpactNotices, reserveSellHolds, sellSignature} = require('../../utils/sellModelImpact');

describe('sell model impact network (fail-open)', () => {
  beforeEach(() => jest.resetAllMocks());
  const rows = [{tradingSymbol: 'ABC-EQ', transactionType: 'SELL', quantity: 45}];

  it('skips BUY-only carts and DummyBroker without a request', async () => {
    expect(await fetchSellImpactNotices({baseUrl: 'x/', broker: 'Zerodha', rows: [{transactionType: 'BUY'}]})).toEqual([]);
    expect(await fetchSellImpactNotices({baseUrl: 'x/', broker: 'DummyBroker', rows})).toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('returns notices, and [] / null on any failure', async () => {
    axios.post.mockResolvedValueOnce({data: {notices: [{symbol: 'ABC-EQ'}]}});
    expect(await fetchSellImpactNotices({baseUrl: 'x/', broker: 'Zerodha', rows})).toHaveLength(1);
    axios.post.mockRejectedValueOnce(new Error('down'));
    expect(await fetchSellImpactNotices({baseUrl: 'x/', broker: 'Zerodha', rows})).toEqual([]);
    axios.post.mockRejectedValueOnce(new Error('down'));
    expect(await reserveSellHolds({baseUrl: 'x/', broker: 'Zerodha', rows})).toBeNull();
  });

  it('sends the customer choice with the hold', async () => {
    axios.post.mockResolvedValueOnce({data: {reservationRef: 'r1'}});
    const ref = await reserveSellHolds({
      baseUrl: 'x/', broker: 'Zerodha',
      rows: [{...rows[0], modelAuthorization: {'Model B': 5}}],
    });
    expect(ref).toBe('r1');
    expect(axios.post.mock.calls[0][1].trades[0].modelAuthorization).toEqual({'Model B': 5});
  });

  it('signature ignores BUY rows and order', () => {
    expect(sellSignature([{tradingSymbol: 'B', transactionType: 'SELL', quantity: 1}, {tradingSymbol: 'A-EQ', transactionType: 'SELL', quantity: 2}, {transactionType: 'BUY'}]))
      .toBe('A:2|B:1');
  });
});
