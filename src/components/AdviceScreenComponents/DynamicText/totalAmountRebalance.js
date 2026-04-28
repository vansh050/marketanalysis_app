import React, { useEffect, useState, useRef } from 'react';
import { Text } from 'react-native';
import useLTPStore from './useLtpStore'; // adjust path as needed

const TotalAmountTextRebalance = ({
  stockDetails = [],
  textStyle = {},
  type,
}) => {
  const [totalAmount, setTotalAmount] = useState('0.00');
  const stockDetailsRef = useRef(stockDetails);

  // Keep reference to latest stockDetails
  useEffect(() => {
    stockDetailsRef.current = stockDetails;
  }, [stockDetails]);

  // Function to calculate total based on current LTPs with '-' handled as 0 and SELL subtracted
  const calculateTotalAmount = ltps => {
    let total = 0;
    stockDetailsRef.current.forEach(item => {
      const priceRaw = ltps[item?.symbol];
      const price = priceRaw === '-' ? 0 : parseFloat(priceRaw) || 0;
      const quantity = item?.qty || 0;

      if (item?.orderType === 'BUY') {
        total += price * quantity;
      } else if (item?.orderType === 'SELL') {
        total -= price * quantity;
      }
    });
    return total < 0 ? '0.00' : total.toFixed(2);
  };

  useEffect(() => {
    // Subscribe to LTP changes
    const unsubscribe = useLTPStore.subscribe(
      state => state.ltps,
      newLtps => {
        setTotalAmount(calculateTotalAmount(newLtps));
      },
    );

    // Initial calculation
    const initialLtps = useLTPStore.getState().ltps || {};
    setTotalAmount(calculateTotalAmount(initialLtps));

    return () => unsubscribe();
  }, []);

  return type === 'normal' ? (
    <Text style={[{ color: 'white', fontSize: 14 }, textStyle]}>
      ₹{totalAmount}
    </Text>
  ) : type === 'cart' ? (
    <Text style={{ fontFamily: 'Satoshi-Bold', fontSize: 16, color: '#780ff4' }}>
      ₹{totalAmount}
    </Text>
  ) : type === 'reviewTrade' ? (
    <Text
      style={{ fontFamily: 'Poppins-Medium', fontSize: 14, color: '#000000ff' }}>
      ₹{totalAmount}
    </Text>
  ) : null;
};

export default TotalAmountTextRebalance;
