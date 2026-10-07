import {availableFundsOptions, availableFundsPayload, fundingPanelCopy, getFundingReview, insufficientFundsAttemptOptions} from '../../utils/fundingContinuation';

const contract = {
  customerAction: {code: 'EXECUTE', blocking: false},
  fundingConsent: {required: true, desiredAmount: 1000000, fundedAmount: 689370, shortfall: 310630, options: ['reduce_to_funding', 'keep_intent']},
  fundingContinuation: {selected: true, targetAmount: 1000000, calculationBudget: 689370, remainingFundingRequired: 310630},
};

test('continuation refreshes only the calculation without resubmitting a cash instruction', () => {
  const options = availableFundsOptions();
  expect(availableFundsPayload(options)).toEqual({continueWithAvailableFunds: true, forceRefresh: true, userFund: '0'});
  expect(options).toEqual({continueWithAvailableFunds: true, forceRefresh: true});
  expect(availableFundsPayload({continueWithAvailableFunds: 'true'})).toEqual({});
  expect(availableFundsPayload({forceRefresh: true})).toEqual({});
});

test('insufficient-funds attempt is an explicit calculation-scoped payload', () => {
  const options = insufficientFundsAttemptOptions();
  expect(options).toEqual({attemptWithInsufficientFunds: true, forceRefresh: true});
  expect(availableFundsPayload(options)).toEqual({
    attemptWithInsufficientFunds: true,
    forceRefresh: true,
    userFund: '0',
  });
  expect(availableFundsPayload({attemptWithInsufficientFunds: 'true'})).toEqual({});
});

test('server-authorized affordable basket stops blocking Accept while preserving target and visible gap', () => {
  expect(getFundingReview(contract)).toMatchObject({required: false, show: true, desiredAmount: 1000000, fundedAmount: 689370, shortfall: 310630});
  expect(contract.fundingConsent.required).toBe(true);
});

test.each(['RECONNECT_BROKER', 'MODIFY_INVESTMENT', 'RECONCILE', undefined])('selection cannot bypass server refusal %s', code => {
  expect(getFundingReview({...contract, customerAction: {code, blocking: true}}).required).toBe(true);
});

test('unselected or old server funding decisions remain blocked', () => {
  expect(getFundingReview({...contract, fundingContinuation: undefined}).required).toBe(true);
  expect(getFundingReview({...contract, fundingContinuation: {...contract.fundingContinuation, selected: false}}).required).toBe(true);
});

test('verified zero balance offers an explicit broker attempt but never a zero-budget continuation', () => {
  const review = getFundingReview({
    customerAction: {code: 'ADD_FUNDS', blocking: true},
    fundingConsent: {
      required: true,
      desiredAmount: 82.23,
      fundedAmount: 0,
      shortfall: 82.23,
      options: ['add_funds', 'attempt_broker'],
    },
    fundingContinuation: {
      selected: false,
      targetAmount: 82.23,
      calculationBudget: 0,
      remainingFundingRequired: 82.23,
    },
  });
  expect(review).toMatchObject({
    required: true,
    show: true,
    fundedAmount: 0,
    shortfall: 82.23,
    canContinueWithAvailableFunds: false,
    canAttemptWithInsufficientFunds: true,
  });
});

test('selected broker attempt unlocks the frozen review and cannot be selected twice', () => {
  const review = getFundingReview({
    customerAction: {code: 'EXECUTE', blocking: false},
    fundingConsent: {
      required: true, desiredAmount: 295, fundedAmount: 0, shortfall: 295,
      options: ['add_funds', 'attempt_broker'],
    },
    fundingContinuation: {
      selected: true, choice: 'attempt_broker', targetAmount: 295,
      calculationBudget: 0, remainingFundingRequired: 295,
    },
  });
  expect(review).toMatchObject({
    required: false,
    show: true,
    canAttemptWithInsufficientFunds: false,
  });
});

test('an already affordable basket still shows its capital shortfall, with or without legacy consent', () => {
  expect(getFundingReview({...contract, fundingConsent: null})).toMatchObject({required: false, show: true, shortfall: 310630});
  expect(getFundingReview(null, {planShortfall: 310630, desiredSubscriptionAmount: 1000000, activeBudget: 689370})).toMatchObject({required: false, show: true, desiredAmount: 1000000});
  expect(getFundingReview(null, {})).toBeNull();
});

describe('funding panel after the customer chose to attempt the buy', () => {
  // moneyman ICICI calculate response, 7 Oct 2026.
  const contract = {
    fundingConsent: {required: true, options: ['attempt_broker'], desiredAmount: 500, fundedAmount: 0, shortfall: 500},
    fundingContinuation: {selected: true, choice: 'attempt_broker', targetAmount: 500, calculationBudget: 0, remainingFundingRequired: 500},
    customerAction: {code: 'EXECUTE', blocking: false},
    presentation: {title: 'Broker may reject these orders', message: 'Your broker balance was verified at Rs 0.00.'},
  };

  test('shows the server warning, not "add funds then calculate again"', () => {
    const review = getFundingReview(contract);
    expect(review.attemptingDespiteShortfall).toBe(true);
    expect(review.required).toBe(false);
    const copy = fundingPanelCopy(review);
    expect(copy.warning).toBe(true);
    expect(copy.title).toBe('Broker may reject these orders');
    expect(copy.body).toBe('Your broker balance was verified at Rs 0.00.');
  });

  test('falls back to app copy when the server sends no presentation', () => {
    const copy = fundingPanelCopy(getFundingReview({...contract, presentation: undefined}));
    expect(copy.title).toBe('Your broker may reject these orders');
    expect(copy.body).toContain('₹500');
  });

  test('ordinary shortfall keeps the target / calculation / remaining summary', () => {
    const copy = fundingPanelCopy(getFundingReview({
      ...contract, fundingContinuation: undefined, presentation: undefined,
    }));
    expect(copy.warning).toBe(false);
    expect(copy.title).toContain('Remaining funding: ₹500');
  });
});
