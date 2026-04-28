import React from 'react';
import { Text } from 'react-native';
import useLTPStore from './useLtpStore'; // adjust path as needed

const TotalAmountText = ({ stockDetails = [], textStyle = {}, type }) => {
  // Access ltps from Zustand store directly, without triggering re-renders
  const ltps = useLTPStore.getState().ltps;

  // Calculate total amount only once (no hook, no render loop)
  const calculateTotalAmount = () => {
    let totalAmount = 0;

    stockDetails.forEach((item) => {
      if (item?.transactionType === 'BUY') {
        const price = ltps[item?.tradingSymbol];
        if (price !== null && price !== undefined && price !== '-') {
          totalAmount += parseFloat(price) * (item?.quantity || 0);
        }
      }
    });

    return totalAmount.toFixed(2);
  };

  const totalAmount = calculateTotalAmount();
  console.log("price here---",totalAmount);
  return (
    type === "normal" ? (
      <Text style={[{ color: 'white', fontSize: 14 }, textStyle]}>
        ₹{totalAmount}
      </Text>
    ) : type === "cart" ? (
      <Text style={{ fontFamily: 'Satoshi-Bold', fontSize: 16, color: '#780ff4' }}>
        ₹{totalAmount || '0.00'}
      </Text>
    ) : type === "reviewTrade" ? (
      <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 14, color: '#000000ff' }}>
        ₹{totalAmount || '0.00'}
      </Text>
    ) : null
  );
};

export default TotalAmountText;
