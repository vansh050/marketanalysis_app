import React from 'react';
import { Text } from 'react-native';
import useLTPStore from './useLtpStore'; // adjust path as needed

import { designColor, designFont } from '../../../design/literalTokens';

export const calculateBuyOrderValue = (stockDetails = [], ltps = {}) =>
  stockDetails.reduce((total, item) => {
    if (String(item?.transactionType || '').toUpperCase() !== 'BUY') return total;
    const price = Number(ltps[item?.tradingSymbol]);
    const quantity = Number(item?.quantity || 0);
    const lotSize = Number(item?.Lots || item?.lots || 1);
    if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      return total;
    }
    return total + price * quantity * (Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1);
  }, 0);

const TotalAmountText = ({ stockDetails = [], textStyle = {}, type }) => {
  // Access ltps from Zustand store directly, without triggering re-renders
  const ltps = useLTPStore.getState().ltps;

  // Calculate total amount only once (no hook, no render loop)
  const calculateTotalAmount = () => {
    return calculateBuyOrderValue(stockDetails, ltps).toFixed(2);
  };

  const totalAmount = calculateTotalAmount();
  return (type === "normal" ? (<Text style={[{ color: 'white', fontSize: 14 }, textStyle]}>₹{totalAmount}
  </Text>) : type === "cart" ? (
    <Text style={{ fontFamily: designFont('Satoshi-Bold'), fontSize: 16, color: designColor('780ff4') }}>
      ₹{totalAmount || '0.00'}
    </Text>
  ) : type === "reviewTrade" ? (
    <Text style={{ fontFamily: designFont('Poppins-Medium'), fontSize: 14, color: designColor('000000ff') }}>
      ₹{totalAmount || '0.00'}
    </Text>
  ) : null);
};

export default TotalAmountText;
