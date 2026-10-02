import React, { useState, useEffect } from 'react';
import axios from 'axios';
import server from '../../utils/serverConfig';
import CustomToolbar from '../../components/CustomToolbar';
import StockCard from '../../UIComponents/StockAdvicesUI/StockCard';
import { getAuth } from '@react-native-firebase/auth';
import {getAccountEmail} from '../../utils/accountEmail';
import {useComponent} from '../../design/useDesign';

const AdviceCartScreen = ({ broker }) => {
  const Presentation = useComponent('screens.AdviceCartScreen');
  const [stockDetails, setStockDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();

  useEffect(() => {
    if (userEmail) {
      getCartAllStocks();
    } else {
      setError("User not authenticated");
      setLoading(false);
    }
  }, [userEmail, broker]);

  const getCartAllStocks = async () => {
    try {
      const response = await axios.get(`${server.baseUrl}api/cart/${userEmail}?trade_place_status=recommend`);
      const transformedStockDetails = response.data.map((stock) => ({
        user_email: stock.user_email,
        trade_given_by: stock.trade_given_by,
        tradingSymbol: stock.Symbol,
        transactionType: stock.Type,
        exchange: stock.Exchange,
        segment: stock.Segment,
        productType: stock.ProductType,
        orderType: stock.OrderType,
        transactionType:stock.Type,
        price: stock.Price,
        quantity: stock.Quantity,
        priority: stock.Priority,
        tradeId: stock.tradeId,
        user_broker: broker,
      }));
        setStockDetails(transformedStockDetails);
    } catch (error) {
        setError("Failed to fetch stock details");
    } finally {
        setLoading(false);
  }
};
  return (
    <Presentation
      viewModel={{loading, error, stockDetails}}
      slots={{Toolbar: CustomToolbar, StockCard}}
    />
  );
};

export default AdviceCartScreen;
