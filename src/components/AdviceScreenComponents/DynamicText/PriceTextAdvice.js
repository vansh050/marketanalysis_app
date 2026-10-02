import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, StyleSheet, View } from "react-native";
import Config from "react-native-config";
import { IndianRupee } from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/FontAwesome';
// Import the WebSocketManager
import WebSocketManager from "./WebSocketManager";
import { isPriceInRecommendedRange } from "../../../utils/recommendationPnl";

import { designColor, designFont } from '../../../design/literalTokens';

const PriceTextAdvice = React.memo(({ closurestatus, type, action, symbol, advisedPrice, advisedRangeCondition, Exchange, advisedRangeHigher, advisedRangeLower, priceOverride }) => {
  // const [price, setPrice] = useState(null);
  const [price, setLtp] = useState(null);
  const configPercentage = Config.REACT_APP_PERCENTAGE_GAIN;

const updateLtp = useCallback((data) => {
  if (data?.ltp !== undefined) {
    setLtp(data.ltp);
  }
}, []);


  useEffect(() => {
    // StockCard already owns the canonical live quote through useLTPStore.
    // When it supplies that quote, avoid a second independently-timed quote.
    if (priceOverride !== undefined && priceOverride !== null) {
      return undefined;
    }

    const wsInstance = WebSocketManager.getInstance();
    wsInstance.subscribe(symbol, Exchange, updateLtp);
    wsInstance.getLTP(symbol).then(setLtp).catch(() => { });

    return () => {
      wsInstance.unsubscribe?.(symbol, updateLtp);
    };
  }, [symbol, Exchange, updateLtp, priceOverride]);

  const displayPrice =
    priceOverride !== undefined && priceOverride !== null
      ? priceOverride
      : price;

  let missedGainPercentage = null;
  let percent = null;

  if (displayPrice != null && advisedPrice != null) {
    let missedGain;

    if (action === "BUY") {
      missedGain = displayPrice - advisedPrice;
      percent = (missedGain / advisedPrice) * 100;
      missedGainPercentage = (percent * 100000) / 100;
    } else if (action === "SELL") {
      missedGain = advisedPrice - displayPrice;
      percent = (missedGain / advisedPrice) * 100;
      missedGainPercentage = (percent * 100000) / 100;
    }
  }

  const advisedRangeConditionfinal = isPriceInRecommendedRange(
    displayPrice,
    advisedRangeLower,
    advisedRangeHigher,
  );

  const priceTextStyle = [
    styles.priceText,
    type === "mainLTP" ? styles.priceText1 :
      type === "marketLTP" ? styles.value :
        type === "News" ? styles.headerCardPriceDate :
          type === "bestP1" ? styles.bestP1 :
            styles.value1,
  ];


  return (
    <View style={{ flexDirection: "row", alignItems: 'baseline', justifyContent: 'space-between', alignContent: 'flex-end', }}>
      {type === 'mainLTP' && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flex: 1 }}>
          <Text style={priceTextStyle}>₹ {displayPrice !== null ? displayPrice : '-'}</Text>
          {!advisedRangeConditionfinal && (
            <Text style={styles.redalert}>**Recommendation out of range</Text>
          )}
        </View>
      )}
      {/* Only render Running Profit if advice is in range */}
      {type === 'mainLTP' && advisedRangeConditionfinal && missedGainPercentage !== null && percent > configPercentage && !closurestatus && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <View style={{ borderWidth: 1, borderColor: designColor('33d37c'), padding: 2, borderRadius: 20 }}>
            <IndianRupee size={9} color={designColor('33d37c')} />
          </View>
          <Icon1 name="angle-double-up" size={12} color={designColor('33d37c')} style={{ paddingHorizontal: 4 }} />
          <Text style={[styles.gainText, { fontSize: 10 }]}>Running Profit</Text>
          <Text style={[styles.gainText, { color: designColor('33d37c'), marginLeft: 2 }]}>
            {missedGainPercentage.toFixed(2)}
          </Text>
        </View>
      )}
      {type === 'aftersubCP' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignContent: 'center', alignItems: 'center' }}>
          <Text style={priceTextStyle}>₹ {displayPrice !== null ? displayPrice : '-'}</Text>
        </View>
      )}
      {type === 'News' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignContent: 'center', alignItems: 'center' }}>
          <Text style={priceTextStyle}>₹ {displayPrice !== null ? displayPrice : '-'}</Text>
        </View>
      )}
      {type === 'bestP1' && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flex: 1 }}>
          <Text style={priceTextStyle}>₹ {displayPrice !== null ? displayPrice : '-'}</Text>
          <Text style={styles.bestP1change}>₹ {displayPrice !== null ? displayPrice : '-'}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  priceText: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('6b46c1'),
  },
  bestP1: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('fff'),
  },
  bestP1: {
    fontSize: 16,
    color: designColor('ffffff'),
    fontFamily: designFont('Satoshi-Medium'),
    marginTop: 2,
  },
  bestP1change: {
    fontSize: 16,
    color: designColor('14c46f'),
    fontFamily: designFont('Satoshi-Medium'),
    marginTop: 4,
    marginLeft: 20,
  },
  priceText1: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('000000ff'),
    marginTop: 0,
  },
  redalert: {
    fontSize: 11,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('c84444'),
    marginTop: 4,
  },
  headerCardPriceDate: {
    color: designColor('626262'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 18,
  },
  value: {
    fontSize: 15,
    color: designColor('c7c7c7'),
    marginBottom: 4,
    fontFamily: designFont('Satoshi-Regular'),
  },
  value1: {
    fontSize: 13,
    color: designColor('000'),
    marginBottom: 4,
    fontFamily: designFont('Satoshi-Medium'),
  },
  gainText: {
    fontSize: 12,
    color: designColor('33d37c'),
    fontFamily: designFont('Satoshi-Medium'),
  }
});

export default PriceTextAdvice;
