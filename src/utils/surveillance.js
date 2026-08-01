/**
 * surveillance — pure helpers for the Angel One pre-trade surveillance check.
 *
 * Kept dependency-free (no react-native, no network, no config) so it is
 * unit-testable on its own. The stateful fetching lives in
 * hooks/useAngelOneSurveillance, which imports from here.
 */

/**
 * A row counts as "under surveillance" only when the scrip was found AND
 * carries a non-empty stage that isn't 'N' (Angel One's "none" sentinel).
 * Anything else — not found, blank, 'N' — is tradeable.
 *
 * Deliberately total: malformed/missing input returns false rather than
 * throwing, because this runs inline on a trade surface and a crash here
 * would be far worse than a missing warning.
 */
export const isUnderSurveillance = row =>
  row?.found === true &&
  !!row?.surveillance &&
  row.surveillance !== '' &&
  row.surveillance !== 'N';

/**
 * Filter a raw `/angelone/equity/surveillance` response down to the rows
 * worth showing the customer. Returns [] for any non-array input.
 */
export const filterSurveillanceStocks = raw =>
  Array.isArray(raw?.surveillance) ? raw.surveillance.filter(isUnderSurveillance) : [];

export default {isUnderSurveillance, filterSurveillanceStocks};
