import React from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View} from 'react-native';

import {designColor, designFont} from '../../../src/design/literalTokens';

const AdviceCartScreen = ({viewModel, slots}) => {
  const {loading, error, stockDetails} = viewModel;
  const {Toolbar, StockCard} = slots;
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
        <ActivityIndicator size={20} color={designColor('002a5c')} />
      </View>
    );
  }
  if (error) return <Text style={styles.errorText}>Error: {error}</Text>;
  return (
    <View style={styles.screen}>
      <Toolbar title="Cart" />
      <View style={styles.container}>
        {stockDetails.length === 0 ? (
          <Text style={styles.emptyText}>Your cart is empty</Text>
        ) : (
          <FlatList
            data={stockDetails}
            renderItem={({item}) => (
              <StockCard
                symbol={item.tradingSymbol}
                tradeId={item.tradeId}
                orderType={item.orderType}
                action={item.transactionType}
              />
            )}
            keyExtractor={item => item.tradeId.toString()}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: designColor('fafafa')},
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column'},
  loadingText: {color: designColor('000'), fontSize: 18, fontFamily: designFont('Poppins-Regular')},
  errorText: {color: designColor('f00')},
  emptyText: {color: designColor('808080')},
});

export default AdviceCartScreen;
