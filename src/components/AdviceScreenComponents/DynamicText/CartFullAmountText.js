import React, { useEffect, useState, useRef } from 'react';
import { Text } from 'react-native';
import useLTPStore from './useLtpStore'; // adjust path as needed

const CartFullAmountText = ({
  stockDetails = [],
  textStyle = {},
  type,
}) => {
  console.log('stock Details---', stockDetails);
  const [totalAmount, setTotalAmount] = useState('0.00');
  const stockDetailsRef = useRef(stockDetails);

  // ✅ Keep reference to latest stockDetails
  useEffect(() => {
    stockDetailsRef.current = stockDetails;
  }, [stockDetails]);

  // ✅ Calculate total based on latest LTPs
  const calculateTotalAmount = (ltps) => {
    let total = 0;

    stockDetailsRef.current.forEach((item) => {
      const ltpKey = item?.tradingSymbol;
      const priceRaw = ltps[ltpKey];
      const price = priceRaw === '-' ? 0 : parseFloat(priceRaw) || 0;
      const quantity = parseFloat(item?.quantity) || 0;
      const txnType = item?.transactionType?.toUpperCase();

      if (txnType === 'BUY') {
        total += price * quantity;
      } else if (txnType === 'SELL') {
        total -= price * quantity;
      }
    });

    // Avoid negative totals and format nicely
    return total <= 0 ? '0.00' : total.toFixed(2);
  };

  useEffect(() => {
    // ✅ Subscribe to LTP updates
    const unsubscribe = useLTPStore.subscribe(
      (state) => state.ltps,
      (newLtps) => {
        setTotalAmount(calculateTotalAmount(newLtps));
      }
    );

    // ✅ Initial calculation on mount
    const initialLtps = useLTPStore.getState().ltps || {};
    setTotalAmount(calculateTotalAmount(initialLtps));

    return () => unsubscribe();
  }, []);

  // ✅ UI handling by type
  if (type === 'normal') {
    return (
      <Text style={[{ color: 'white', fontSize: 14 }, textStyle]}>
        ₹{totalAmount}
      </Text>
    );
  }

  console.log("Total Here----",totalAmount);
  if (type === 'cart') {
    return (
      <Text
        style={{
          fontFamily: 'Satoshi-Bold',
          fontSize: 16,
          color: '#780ff4',
        }}
      >
        ₹{totalAmount}
      </Text>
    );
  }

  if (type === 'reviewTrade') {
    return (
      <Text
        style={{
          fontFamily: 'Poppins-Medium',
          fontSize: 15,
          color: '#000000ff',
        }}
      >
        ₹{totalAmount}
      </Text>
    );
  }

  return null;
};

export default CartFullAmountText;
