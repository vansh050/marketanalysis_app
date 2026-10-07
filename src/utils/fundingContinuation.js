// Only calculation options: never a capital instruction or an order request.
export const availableFundsOptions = () => ({
  forceRefresh: true,
  continueWithAvailableFunds: true,
});

// Explicitly asks the server to size the existing target and freeze it for
// review even though verified buying power is insufficient. The broker still
// makes the final accept/reject decision when the customer submits the basket.
export const insufficientFundsAttemptOptions = () => ({
  forceRefresh: true,
  attemptWithInsufficientFunds: true,
});

export const availableFundsPayload = options =>
  options?.attemptWithInsufficientFunds === true
    ? {attemptWithInsufficientFunds: true, forceRefresh: true, userFund: '0'}
    : options?.continueWithAvailableFunds === true
      ? {continueWithAvailableFunds: true, forceRefresh: true, userFund: '0'}
      : {};

// Keep the funding gap visible even when the affordable basket is executable.
// The server alone decides whether its fitted basket passes execution checks.
export const getFundingReview = (contract, calculation) => {
  const consent = contract?.fundingConsent;
  const continuation = contract?.fundingContinuation;
  const shortfall = Number(continuation?.remainingFundingRequired ?? calculation?.planShortfall ?? consent?.shortfall ?? 0);
  if (!consent && !(shortfall > 0)) return null;
  const approved = continuation?.selected === true &&
    contract?.customerAction?.code === 'EXECUTE' &&
    contract?.customerAction?.blocking !== true;
  const fundedAmount = Number(
    continuation?.calculationBudget ?? calculation?.activeBudget ?? consent?.fundedAmount ?? 0,
  );
  const canContinueWithAvailableFunds = Boolean(
    consent?.options?.includes('keep_intent') && fundedAmount > 0,
  );
  const canAttemptWithInsufficientFunds = Boolean(
    consent?.options?.includes('attempt_broker') &&
    fundedAmount <= 0 &&
    continuation?.choice !== 'attempt_broker',
  );
  // The customer already chose "Review stocks and attempt buy": the orders on
  // screen are the full target basket, NOT fitted to funds, and the next step
  // is placing them. "Add funds, then calculate again" contradicts the enabled
  // Place Order button; show the server's own warning instead.
  const attemptingDespiteShortfall =
    continuation?.selected === true && continuation?.choice === 'attempt_broker';
  return {
    ...consent,
    attemptingDespiteShortfall,
    presentationTitle: contract?.presentation?.title,
    presentationMessage: contract?.presentation?.message,
    required: consent?.required === true && !approved,
    show: consent?.required === true || shortfall > 0,
    desiredAmount: continuation?.targetAmount ?? consent?.desiredAmount ?? calculation?.desiredSubscriptionAmount,
    fundedAmount,
    shortfall,
    canContinueWithAvailableFunds,
    canAttemptWithInsufficientFunds,
  };
};

const inr = value => Number(value || 0).toLocaleString('en-IN');

/** Title + body for the funding panel shown under a rebalance basket. */
export const fundingPanelCopy = review => {
  if (!review) return null;
  if (review.attemptingDespiteShortfall) {
    return {
      warning: true,
      title: review.presentationTitle || 'Your broker may reject these orders',
      body:
        review.presentationMessage ||
        `These orders need about ₹${inr(review.shortfall)} more than your broker shows ` +
          `(₹${inr(review.fundedAmount)}). You chose to place them anyway, so your broker ` +
          'may reject some or all of them. Add funds first to avoid that. Your investment ' +
          `target of ₹${inr(review.desiredAmount)} stays unchanged.`,
    };
  }
  return {
    warning: false,
    title:
      `Investment target: ₹${inr(review.desiredAmount)}. This calculation: ` +
      `₹${inr(review.fundedAmount)}. Remaining funding: ₹${inr(review.shortfall)}.`,
    body: null,
  };
};
