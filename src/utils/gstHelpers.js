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
export const recBase = (source, freq) =>
  Number(source?.pricingWithoutGst?.[freq] || source?.pricing?.[freq] || 0);

/**
 * Get the display amount for a recurring plan based on GST config.
 */
export const recDisplay = (source, freq, configGst, configGstWithText) => {
  const base = recBase(source, freq);
  if (configGst && configGstWithText) return withGst(base);
  return base;
};

/**
 * Get the payment amount for a recurring plan (sent to payment gateway).
 */
export const recPayment = (source, freq, configGst) => {
  const base = recBase(source, freq);
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
