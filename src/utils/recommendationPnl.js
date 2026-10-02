const toFiniteNumber = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getRecommendedRange = (lowerValue, higherValue) => {
  const rawLower = toFiniteNumber(lowerValue);
  const rawHigher = toFiniteNumber(higherValue);
  const hasLower = rawLower !== null && rawLower > 0;
  const hasHigher = rawHigher !== null && rawHigher > 0;

  // Some upstream recommendations contain the two range endpoints in display
  // order (for example 970-958) rather than numeric lower/higher order. Treat
  // both populated values as endpoints so an otherwise valid market price is
  // not marked out of range and its trade controls are not dimmed.
  const lower =
    hasLower && hasHigher ? Math.min(rawLower, rawHigher) : rawLower;
  const higher =
    hasLower && hasHigher ? Math.max(rawLower, rawHigher) : rawHigher;

  return {
    lower: hasLower ? lower : null,
    higher: hasHigher ? higher : null,
    hasRange: hasLower || hasHigher,
  };
};

export const isPriceInRecommendedRange = (
  priceValue,
  lowerValue,
  higherValue,
) => {
  const price = toFiniteNumber(priceValue);
  const {lower, higher, hasRange} = getRecommendedRange(
    lowerValue,
    higherValue,
  );

  // A missing/unavailable price is NOT "outside the advised range": with no
  // quote there is nothing to compare against, so the customer must not be
  // warned or dimmed as if the price moved away from the recommendation
  // (2026-08-21: BEML showed no LTP and the card falsely warned "outside
  // range"). Trade Now / Add to Cart stay active; the soft out-of-range
  // warning only fires when a real price exists and sits outside the bounds.
  if (price === null) {
    return true;
  }
  if (!hasRange) {
    return true;
  }
  if (lower !== null && price < lower) {
    return false;
  }
  if (higher !== null && price > higher) {
    return false;
  }
  return true;
};

export const getRecommendedEntryPrice = ({
  recommendedPrice,
  advisedRangeLower,
  advisedRangeHigher,
  action,
}) => {
  const price = toFiniteNumber(recommendedPrice);
  const {lower, higher, hasRange} = getRecommendedRange(
    advisedRangeLower,
    advisedRangeHigher,
  );

  if (
    price !== null &&
    (!hasRange ||
      ((lower === null || price >= lower) &&
        (higher === null || price <= higher)))
  ) {
    return price;
  }

  // Never use a malformed/out-of-range recommendation as the P&L reference.
  if (String(action).toUpperCase() === 'SELL') {
    return higher ?? lower;
  }
  return lower ?? higher;
};

export const calculateRecommendationPnl = ({
  ltp: ltpValue,
  entryPrice: entryPriceValue,
  action,
  isActivated,
}) => {
  const ltp = toFiniteNumber(ltpValue);
  const entryPrice = toFiniteNumber(entryPriceValue);

  if (!isActivated || ltp === null || entryPrice === null || entryPrice <= 0) {
    return {pnl: null, changePercent: null};
  }

  const direction = String(action).toUpperCase() === 'SELL' ? -1 : 1;
  const pnl = (ltp - entryPrice) * direction;

  return {
    pnl,
    changePercent: (pnl / entryPrice) * 100,
  };
};
