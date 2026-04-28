import { Platform } from 'react-native';

export const getDeepLink = (path = '') => {
  const scheme = 'app_name'; // Your scheme defined in AndroidManifest.xml
  const host = 'www.app_name.com'; // Your host
  const prefix = Platform.OS === 'android' ? `${scheme}://${host}` : `${scheme}://`;
  return `${prefix}${path}`;
};

/**
 * Breaks down a full symbol into base symbol and strike info for better display
 * @param {string} symbol - The full symbol (e.g., "SIEMENS30DEC253100PE")
 * @param {string} searchSymbol - The search symbol/base symbol (e.g., "SIEMENS")
 * @returns {object} - { baseSymbol, strikeInfo, fullSymbol }
 */
export const breakdownSymbol = (symbol, searchSymbol = '') => {
  if (!symbol) {
    return { baseSymbol: 'N/A', strikeInfo: '', fullSymbol: 'N/A' };
  }

  // Helper function to parse strike info from patterns like "30DEC253100PE"
  const parseStrikeInfo = (strikeStr) => {
    // Try to match options pattern: (DD)(MONTHNAME)(YY)(STRIKE)(CE|PE)
    const optionsPattern = /^(\d{2})([A-Z]{3})(\d{2})(\d+\.?\d*)(CE|PE)$/;
    const match = strikeStr.match(optionsPattern);

    if (match) {
      const [, day, month, year, strike, optionType] = match;
      return `${day} ${month} ${year} ${strike} ${optionType}`;
    }

    // Try future pattern: (DD)(MONTH)(YY)FUT
    const futurePattern = /^(\d{2})([A-Z]{3})(\d{2})FUT$/;
    const futMatch = strikeStr.match(futurePattern);

    if (futMatch) {
      const [, day, month, year] = futMatch;
      return `${day} ${month} ${year} FUT`;
    }

    // If no pattern matched, return as-is
    return strikeStr;
  };

  // If searchSymbol is provided and valid, use it
  if (searchSymbol && searchSymbol.trim()) {
    const baseSymbol = searchSymbol;
    const strikeInfo = symbol.startsWith(searchSymbol)
      ? symbol.slice(searchSymbol.length)
      : '';

    // Parse the strikeInfo for better formatting
    const parsedStrikeInfo = strikeInfo ? parseStrikeInfo(strikeInfo) : '';

    return { baseSymbol, strikeInfo: parsedStrikeInfo, fullSymbol: symbol };
  }

  // Smart parsing when searchSymbol is not provided
  // Pattern: SYMBOL+DD+MONTHNAME+YY+STRIKE+CE/PE
  // Examples: NIFTY23DEC2524900PE, BANKNIFTY16JAN2547500CE

  // Try to match options pattern: (SYMBOL)(DD)(MONTHNAME)(YY)(STRIKE)(CE|PE)
  const optionsPattern = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})(\d+\.?\d*)(CE|PE)$/;
  const match = symbol.match(optionsPattern);

  if (match) {
    const [, name, day, month, year, strike, optionType] = match;
    const baseSymbol = `${name} ${day} ${month} ${year}`;
    const strikeInfo = `${strike} ${optionType}`;
    return { baseSymbol, strikeInfo, fullSymbol: symbol };
  }

  // Try future pattern: SYMBOL+DD+MONTH+YY+FUT
  const futurePattern = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})FUT$/;
  const futMatch = symbol.match(futurePattern);

  if (futMatch) {
    const [, name, day, month, year] = futMatch;
    const baseSymbol = `${name} ${day} ${month} ${year}`;
    const strikeInfo = 'FUT';
    return { baseSymbol, strikeInfo, fullSymbol: symbol };
  }

  // If no pattern matched, return full symbol as base
  return { baseSymbol: symbol, strikeInfo: '', fullSymbol: symbol };
};
