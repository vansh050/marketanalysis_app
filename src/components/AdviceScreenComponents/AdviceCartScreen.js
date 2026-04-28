import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList,ActivityIndicator } from 'react-native';
import axios from 'axios';
import server from '../../utils/serverConfig';
import CustomToolbar from '../../components/CustomToolbar';
import StockCard from '../../UIComponents/StockAdvicesUI/StockCard';
import { getAuth } from '@react-native-firebase/auth';

const AdviceCartScreen = ({ broker }) => {
  const [stockDetails, setStockDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

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
  const renderItem = ({ item }) => (
    console.log(item),
    <StockCard
      symbol={item.tradingSymbol}
      tradeId={item.tradeId}
      orderType={item.orderType}
      action={item.transactionType}
      // Add other props based on StockCard requirements
    />
  );

  if (loading) {
    return (
      <View style={{flex:1, justifyContent:'center',alignItems: 'center', flexDirection:'column'}}>
      
    <Text style={{color:'black',fontSize:18,fontFamily:'Poppins-Regular'}}>Loading...</Text>
    <ActivityIndicator size={20} color={'#002a5c'}/>
    </View>
    )
  }

  if (error) {
    return <Text style={{ color: 'red' }}>Error: {error}</Text>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      <CustomToolbar title="Cart" />
      <View style={styles.container}>
        {stockDetails.length === 0 ? (
          <Text style={{ color: 'gray' }}>Your cart is empty</Text>
        ) : (
          <FlatList
            data={stockDetails}
            renderItem={renderItem}
            keyExtractor={(item) => item.tradeId.toString()} // Assuming tradeId is unique
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
});

export default AdviceCartScreen;
