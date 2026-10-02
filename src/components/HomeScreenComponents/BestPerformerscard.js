import React, { useState, useEffect } from 'react';
import { View, Text,StyleSheet, ActivityIndicator,ScrollView,Dimensions } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { useTrade } from '../../screens/TradeContext';
import BestPerformerGainText from '../AdviceScreenComponents/DynamicText/BestPerformerGainText';
import { FlatList } from 'react-native-gesture-handler';
import { FadeLoading } from 'react-native-fade-loading';
import { designColor, designFont } from '../../design/literalTokens';
const screenWidth = Dimensions.get('window').width;
const BestPerformers = () => {
  const { bestPerformer,isPerformerLoading } = useTrade();
  const [stockRecoNotExecuted, setStockRecoNotExecuted] = useState([]);
 // console.log('Console COunt:',bestPerformer);
  useEffect(() => {
    if (bestPerformer) {
      setStockRecoNotExecuted(bestPerformer);
    }
  }, [bestPerformer]);

  const renderItem = ({ item }) => {
    const symbol = item.symbol;
    const iniprice = item.price_when_send_advice;
    const exe = item.exchange;
    //console.log('symvol:',item.symbol);
    return (
      <View style={styles.itemContainer}>
        <Text style={styles.stockName}>  {symbol.length > 12? `${symbol.substring(0,12 )}...` : symbol}</Text>
        <BestPerformerGainText
          advisedRangeCondition={0}
          symbol={symbol || ""}
          exchange={exe}
          stockDetails={stockRecoNotExecuted}
          advisedPrice={iniprice || 0}
          type={'performers'}
        />
      </View>
    );
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Missed Opportunities</Text>
      </View>
      <View style={styles.flatListContainer}>
        <FlatList
          data={stockRecoNotExecuted}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          nestedScrollEnabled={true} // Add this line
          showsVerticalScrollIndicator={true}
           ListEmptyComponent={() => (
                      isPerformerLoading ? (
                                <View style={{ flexDirection: 'colum',alignContent:'center',alignSelf:'center' }}>
                                  <FadeLoading
                                    style={{ width: screenWidth * 0.8, height: 20, marginTop: 5,}}
                                    primaryColor={designColor('f0f0f0')}
                                    secondaryColor={designColor('e0e0e0')}
                                    duration={500}
                                  />
                                  <FadeLoading
                                    style={{ width: screenWidth * 0.8, height: 20, marginTop: 5,}}
                                    primaryColor={designColor('f0f0f0')}
                                    secondaryColor={designColor('e0e0e0')}
                                    duration={500}
                                  />
                                   <FadeLoading
                                    style={{ width: screenWidth * 0.8, height: 20, marginTop: 5,}}
                                    primaryColor={designColor('f0f0f0')}
                                    secondaryColor={designColor('e0e0e0')}
                                    duration={500}
                                  />
                                   <FadeLoading
                                    style={{ width: screenWidth * 0.8, height: 20, marginVertical: 5,}}
                                    primaryColor={designColor('f0f0f0')}
                                    secondaryColor={designColor('e0e0e0')}
                                    duration={500}
                                  />
                                </View>
                              ) : (
                                <View style={styles.containerEmpty}>
                                <Text style={styles.title}>No Missed Opportunities Yet</Text>
                    <Text style={styles.subtitle}>
                      Looks like there's no data to display right now. Once you have performers, they'll appear here.
                    </Text>
                              </View>
                              )
                            )}

         contentContainerStyle={{paddingHorizontal:10}}
          indicatorStyle='black'

        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, // Allow the BestPerformers container to grow within the outer FlatList
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: designColor('fdfdfd'),
  },
  containerEmpty: {
    paddingVertical:50,
    justifyContent: 'center',
    alignItems: 'center',
    alignContent:'center',
    alignSelf:'center',
    backgroundColor: designColor('fdfdfd'),
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('000'),
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: designColor('666'),
    fontFamily:designFont('Satoshi-Medium'),
    textAlign: 'center',
    marginBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: designColor('fff'),
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e6e6e6'),
  },
  stockName: {
    fontSize: 14,
    color: 'black',
    fontFamily: designFont('Satoshi-Bold'),
    textAlign: 'left',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
  },
  flatListContainer: {

    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: designColor('f2f2f2'),
    flex:1,// Keep the fixed height for the scrollable area
    maxHeight:200,
    overflow: 'hidden',
  },
});

export default BestPerformers;