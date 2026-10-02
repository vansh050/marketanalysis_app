import {
  annotateSettlementRiskResults,
  canOfferSettlementProceed,
  estimateProtectedBuyCost,
  evaluateSellBatchOrders,
  extractAvailableCash,
  normalizePublisherSymbol,
} from '../../utils/zerodhaSellFundingGate';
import fs from 'fs';
import path from 'path';

describe('zerodhaSellFundingGate', () => {
  const sellLegs = [
    {transaction_type: 'SELL', tradingsymbol: 'AZAD', quantity: 9},
    {transaction_type: 'SELL', tradingsymbol: 'KIMS', quantity: 52},
  ];

  test('does not unlock buys merely because sell orders were detected', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, status: 'OPEN'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, status: 'PENDING'},
    ]);
    expect(result.ready).toBe(false);
    expect(result.state).toBe('pending');
    expect(result.pending).toEqual(expect.arrayContaining(['AZAD', 'KIMS']));
  });

  // ── Three-state gate (2026-08-13) ───────────────────────────────────────
  // "Some sells failed" and "a sell is still working" are different situations
  // and must not share an outcome. Holding the buys in the first case leaves
  // the customer entirely un-rebalanced while most of their money is sitting
  // ready; releasing them in the second risks trimming for a condition that
  // resolves seconds later.
  test('allTerminal is true when failures are final and nothing is in flight', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, filledQuantity: 9, status: 'COMPLETE'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, status: 'REJECTED'},
    ]);
    expect(result.ready).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.allTerminal).toBe(true);   // → buys may proceed, trimmed
    expect(result.failed).toContain('KIMS');
  });

  test('allTerminal is false while any sell is still resting', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, status: 'REJECTED'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, status: 'OPEN'},
    ]);
    expect(result.state).toBe('failed');
    expect(result.allTerminal).toBe(false);  // → keep buys locked, keep polling
  });

  test('allTerminal is false when an expected sell never appeared', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, status: 'REJECTED'},
    ]);
    expect(result.allTerminal).toBe(false);  // KIMS unseen — not proof it is done
  });

  test('a fully complete batch is terminal and ready', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, filledQuantity: 9, status: 'COMPLETE'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, filledQuantity: 52, status: 'COMPLETE'},
    ]);
    expect(result.ready).toBe(true);
    expect(result.allTerminal).toBe(true);
  });

  test('unlocks only after every expected sell quantity is complete', () => {
    const result = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD-EQ', quantity: 9, filledQuantity: 9, status: 'COMPLETE'},
      {transactionType: 'SELL', symbol: 'KIMS-BE', quantity: 52, filledQuantity: 52, status: 'TRADED'},
    ]);
    expect(result).toMatchObject({ready: true, state: 'complete'});
  });

  test('keeps partial quantities locked and fails closed on rejection', () => {
    const partial = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD', quantity: 9, filledQuantity: 4, status: 'PARTIALLY FILLED'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, filledQuantity: 52, status: 'COMPLETE'},
    ]);
    expect(partial.ready).toBe(false);
    expect(partial.pending).toContain('AZAD');

    const rejected = evaluateSellBatchOrders(sellLegs, [
      {transactionType: 'SELL', symbol: 'AZAD', quantity: 9, status: 'REJECTED'},
      {transactionType: 'SELL', symbol: 'KIMS', quantity: 52, status: 'COMPLETE'},
    ]);
    expect(rejected).toMatchObject({ready: false, state: 'failed'});
    expect(rejected.failed).toContain('AZAD');
  });

  test('extracts normalized live available margin', () => {
    expect(extractAvailableCash({data: {availablecash: '212265.40'}})).toBe(212265.4);
    expect(extractAvailableCash({availableMargin: 535658})).toBe(535658);
    expect(extractAvailableCash({status: 2, message: 'expired'})).toBeNull();
  });

  test('prices every remaining protected buy basket', () => {
    expect(
      estimateProtectedBuyCost([
        [{transaction_type: 'BUY', quantity: 10, price: 101}],
        [
          {transaction_type: 'BUY', quantity: 2, price: 500},
          {transaction_type: 'SELL', quantity: 1, price: 200},
        ],
      ]),
    ).toBe(2010);
  });

  test('offers proceed only for a verified post-sell settlement shortfall', () => {
    expect(canOfferSettlementProceed({
      status: 'margin-timeout',
      availableCash: 125000,
      requiredBuyingPower: 207000,
    })).toBe(true);
    expect(canOfferSettlementProceed({
      status: 'broker-session',
      availableCash: 125000,
      requiredBuyingPower: 207000,
    })).toBe(false);
    expect(canOfferSettlementProceed({
      status: 'funds-unverified',
      availableCash: null,
      requiredBuyingPower: 207000,
    })).toBe(false);
    expect(canOfferSettlementProceed({
      status: 'margin-timeout',
      availableCash: 212000,
      requiredBuyingPower: 207000,
    })).toBe(false);
  });

  test('explains Repair only on insufficient-funds buys after risk acceptance', () => {
    const input = [
      {
        transactionType: 'BUY',
        orderStatus: 'REJECTED',
        orderStatusMessage: 'Insufficient funds',
      },
      {
        transactionType: 'SELL',
        orderStatus: 'REJECTED',
        orderStatusMessage: 'Insufficient holdings',
      },
    ];
    const annotated = annotateSettlementRiskResults(input, true);
    expect(annotated[0]).toMatchObject({settlementRiskAccepted: true});
    expect(annotated[0].orderStatusMessage).toContain('Repair after the margin is released');
    expect(annotated[1]).toBe(input[1]);
    expect(annotateSettlementRiskResults(input, false)).toBe(input);
  });

  test('normalizes common NSE series suffixes for order matching', () => {
    expect(normalizePublisherSymbol('KIMS-EQ')).toBe('KIMS');
    expect(normalizePublisherSymbol('kims-be')).toBe('KIMS');
  });

  test('both model-portfolio publisher surfaces enforce the gate', () => {
    [
      'AdviceScreenComponents/RebalanceModal.js',
      'ModelPortfolioComponents/MPReviewTradeModal.js',
    ].forEach(relativeFile => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../components', relativeFile),
        'utf8',
      );
      expect(source).toContain('evaluateSellBatchOrders');
      expect(source).toContain('getNewPublisherOrders');
      expect(source).toContain("fetchFunds(\n        'Zerodha'");
      expect(source).toContain('Buy baskets wait for Zerodha to fill the sells');
      expect(source).toContain("actions.push({text: 'Continue with buys'");
      expect(source).toContain('canOfferSettlementProceed(gateResult)');
      expect(source).toMatch(
        /if \(broker === 'Zerodha'\)[\s\S]{0,180}handleZerodhaRedirect\(\)/,
      );
    });
  });

  test('alternate execution screen cannot bypass the guarded mixed-basket flow', () => {
    const controller = fs.readFileSync(
      path.resolve(__dirname, '../../screens/Rebalance/ExecutionStatusScreen.js'),
      'utf8',
    );
    const presentation = fs.readFileSync(
      path.resolve(__dirname, '../../../designs/default/screens/ExecutionStatusScreen.js'),
      'utf8',
    );
    expect(controller).toContain("broker === 'Zerodha' && hasSell && hasBuy");
    expect(controller).toContain('use its Rebalance action so buys remain locked');
    expect(presentation).toContain('Go Back to Rebalance');
  });
});
