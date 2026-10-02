const GST_RATE = 1.18;

/**
 * Apply 18% GST to a base amount.
 */
export const withGst = (base) => Math.round(Number(base || 0) * GST_RATE);

/**
 * Get the base (pre-GST) amount from a one-time option object.
 * Prefers amountWithoutGst, falls back to amount.
 */
export const optBase = (opt) => Number(opt?.amountWithoutGst || opt?.amount || 0);

/**
 * Get the display amount for a one-time option based on GST config.
 * When configGstWithText is true, shows GST-inclusive amount.
 * Otherwise returns the base amount (caller appends "+ GST" label).
 */
export const optDisplay = (opt, configGst, configGstWithText) => {
  const base = optBase(opt);
  if (configGst && configGstWithText) return withGst(base);
  return base;
};

/**
 * Get the payment amount for a one-time option (sent to payment gateway).
 * Always includes GST when configGst is true.
 */
export const optPayment = (opt, configGst) => {
  const base = optBase(opt);
  return configGst ? withGst(base) : base;
};

/**
 * Get the base (pre-GST) amount for a recurring plan from pricing source.
 * Prefers pricingWithoutGst, falls back to pricing.
 */
export const recBase = (source, freq, configGst = false) => {
  const explicitBase = Number(source?.pricingWithoutGst?.[freq]);
  if (Number.isFinite(explicitBase) && explicitBase > 0) return explicitBase;

  const storedPrice = Number(source?.pricing?.[freq]);
  if (!Number.isFinite(storedPrice) || storedPrice <= 0) return 0;

  // Legacy plan records may only carry `pricing`, which is the gateway total
  // (GST-inclusive when GST is enabled). Convert it back to the display base
  // before a caller appends "+ GST"; otherwise ₹11,800 becomes ₹11,800 + GST.
  if (configGst) {
    return Math.round((storedPrice / GST_RATE) * 100) / 100;
  }
  return storedPrice;
};

/**
 * Get the display amount for a recurring plan based on GST config.
 */
export const recDisplay = (source, freq, configGst, configGstWithText) => {
  const base = recBase(source, freq, configGst);
  if (configGst && configGstWithText) return withGst(base);
  return base;
};

/**
 * Get the payment amount for a recurring plan (sent to payment gateway).
 */
export const recPayment = (source, freq, configGst) => {
  const base = recBase(source, freq, configGst);
  return configGst ? withGst(base) : base;
};

/**
 * Get the GST label suffix based on config.
 * Returns " including GST", " + GST", or "" depending on configuration.
 */
export const gstLabel = (configGst, configGstWithText) => {
  if (!configGst) return '';
  if (configGstWithText) return ' including GST';
  return ' + GST';
};

/**
 * Format a display price string with appropriate GST label.
 * @param {number} baseAmount - The base (pre-GST) amount
 * @param {boolean} configGst - Whether GST is enabled
 * @param {boolean} configGstWithText - Whether to show inclusive pricing
 * @returns {string} Formatted price string like "₹11,800 including GST" or "₹10,000 + GST"
 */
export const formatGstPrice = (baseAmount, configGst, configGstWithText) => {
  const amount = Number(baseAmount || 0);
  if (configGst && configGstWithText) {
    return `₹${withGst(amount)}${gstLabel(configGst, configGstWithText)}`;
  }
  return `₹${amount}${gstLabel(configGst, configGstWithText)}`;
};
