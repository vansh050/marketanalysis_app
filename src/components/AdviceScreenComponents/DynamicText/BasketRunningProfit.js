import React, {useMemo, useCallback, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {IndianRupee} from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/FontAwesome';
import Config from 'react-native-config';
import useLTPStore from './useLtpStore';
import {symbolName} from 'typescript';

const PERCENTAGE_THRESHOLD = -1;
// console.log('perfthh--', PERCENTAGE_THRESHOLD);
// Custom hook to subscribe to individual symbols
const useSymbolLTP = symbol => {
  return useLTPStore(state => state.ltps[symbol]);
};

// Individual trade profit calculator component
const TradeProfit = React.memo(({trade, onProfitChange}) => {
  const ltpData = useSymbolLTP(trade.Symbol);

  const profit = useMemo(() => {
    if (!ltpData) return {profit: 0, investment: 0};

    const ltpPrice =
      typeof ltpData === 'object' ? ltpData.last_traded_price : ltpData;
    const currentLTP = parseFloat(
      String(ltpPrice)?.replace(/[₹,]/g, '') || '0',
    );
    const entryPrice = parseFloat(trade.price_when_send_advice || '0');

    if (!entryPrice || !currentLTP || isNaN(currentLTP)) {
      return {profit: 0, investment: 0};
    }

    const quantity = Number(trade.Quantity || 1);
    const lots = Number(trade.Lots || 1);
    const isBuy = trade.Type === 'BUY';
    // console.log(
    //   'entry price----',
    //   entryPrice,
    //   currentLTP,
    //   trade.Symbol,
    //   lots,
    //   quantity,
    // );
    const diff = currentLTP - entryPrice;
    const effectiveDiff = isBuy ? diff : -diff;

    const tradeProfit = effectiveDiff * lots;
    const investment = entryPrice * lots;

    return {profit: tradeProfit, investment};
  }, [ltpData, trade]);

  // Update parent component whenever profit changes
  React.useEffect(() => {
    onProfitChange(trade.Symbol, profit.profit, profit.investment);
  }, [profit.profit, profit.investment, trade.Symbol, onProfitChange]);

  return null; // This component only calculates, doesn't render anything
});

const BasketRunningProfit = React.memo(({basket}) => {
  const [profits, setProfits] = useState({});

  // console.log('running ---');

  // Memoized callback to handle profit updates from individual TradeProfit components
  const handleProfitChange = useCallback((symbol, profit, investment) => {
    // console.log('symbols >>>>>', symbol);
    // console.log('Filtered out expired trade:', investment);
    setProfits(prev => ({
      ...prev,
      [symbol]: {profit, investment},
    }));
  }, []);

  // Calculate total profit and percentage from individual profits
  const profitData = useMemo(() => {
    if (!basket?.trades?.length) {
      return {totalProfit: 0, profitPercent: 0, isVisible: false};
    }

    let totalProfit = 0;
    let totalInvestment = 0;



    // console.log('profits -------', profits);
    Object.values(profits).forEach(({profit, investment}) => {
      totalProfit += profit || 0;
      totalInvestment += investment || 0;
    });

    const profitPercent =
      totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    const isVisible = profitPercent > PERCENTAGE_THRESHOLD;
     console.log('toa>>>>>>>>>>', totalInvestment,totalProfit,basket.trades[0].basketName);
    // console.log('Profit --percent---', totalProfit, profitPercent, isVisible);

    return {totalProfit, profitPercent, isVisible};
  }, [profits, basket?.trades?.length]);

  // Don't render if profit is below threshold
  if (!profitData.isVisible) {
    return null;
  }

  console.log('profit---', profitData, basket.trades[0].basketName);

  return (
    <View>
      {/* Hidden profit calculators - each subscribes to individual symbols */}
      {basket?.trades?.map((trade, index) => (
        <TradeProfit
          key={`${trade.Symbol}-${index}`}
          trade={trade}
          onProfitChange={handleProfitChange}
        />
      ))}

      {/* Actual UI component */}
      {profitData.profitPercent > 0 && (
        <View style={styles.container}>
          <View style={styles.profitRow}>
            <View style={styles.profitRow1}>
              <View style={styles.rupeeIcon}>
                <IndianRupee size={5} color={'#33D37C'} />
              </View>
              <Icon1
                name="angle-double-up"
                size={12}
                color={'#33D37C'}
                style={{paddingHorizontal: 4}}
              />
              <Text style={styles.profitText}>Running Profit</Text>
            </View>

            <Text style={styles.profitValue}>
              ₹ {profitData.totalProfit.toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default BasketRunningProfit;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profitRow: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profitRow1: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rupeeIcon: {
    borderWidth: 1,
    borderColor: '#33D37C',
    padding: 2,
    borderRadius: 20,
  },
  profitText: {
    fontSize: 9,
    color: '#33D37C',
    fontFamily: 'Satoshi-Medium',
  },
  profitValue: {
    color: '#33D37C',
    marginLeft: 2,
    fontSize: 9,
    fontFamily: 'Satoshi-Medium',
  },
});