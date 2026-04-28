/**
 * Centralized trade response conversion utility.
 * Replaces identical convertResponse() functions duplicated across 5 files.
 */

/**
 * Convert a data array of trade items into the standardized order payload format.
 *
 * @param {Array} dataArray - Array of trade items with { symbol, qty, orderType, exchange, token, zerodhaTradeId }
 * @param {string} broker - The broker name (e.g. 'Zerodha', 'Dhan', 'Angel One')
 * @returns {Array} Array of standardized order objects
 */
export const convertResponse = (dataArray, broker) => {
  return dataArray.map(item => {
    const responseObj = {
      transactionType: item.orderType,
      exchange: item.exchange || '',
      segment: 'EQUITY',
      productType: 'DELIVERY',
      orderType: 'MARKET',
      price: 0,
      tradingSymbol: item.symbol,
      token: item?.token ? item?.token : '',
      quantity: item.qty,
      priority: 0,
      user_broker: broker,
    };

    if (broker === 'Zerodha' && item?.zerodhaTradeId) {
      responseObj.zerodhaTradeId = item.zerodhaTradeId;
    }

    return responseObj;
  });
};
