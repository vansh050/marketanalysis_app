import React, { createContext, useState } from 'react';

export const InvestAmountContext = createContext();

export const InvestAmountProvider = ({ children }) => {
  const [invetAmount, setInvestAmount] = useState('');

  return (
    <InvestAmountContext.Provider value={{ invetAmount, setInvestAmount }}>
      {children}
    </InvestAmountContext.Provider>
  );
};
