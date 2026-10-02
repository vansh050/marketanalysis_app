// PortfolioCard.js
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import ButtonSwitch from 'rn-switch-button';
import { useConfig } from '../../context/ConfigContext';
import { designColor, designFont } from '../../design/literalTokens';
const PortfolioCard2 = ({
  allHoldingsData,
  formatCurrency,
  profitAndLoss,
  pnlPercentage,
  pnlposneg,
  setSelectedInnerTab,
}) => {
  const config = useConfig();
  return (
    <View>
      <View
        style={[
          styles.stickyCard,
          {backgroundColor: parseFloat(profitAndLoss) >= 0 ? designColor('16a085') : designColor('c84444')},
        ]}>
        <View style={styles.pnlContainer}>
          <Text
            style={{color: 'white', fontFamily: designFont('Poppins-Regular'), fontSize: 12, opacity: 0.8}}>
            Current P&L
          </Text>
          <View style={styles.row1}>
            <View style={styles.pnlBorder}>
              <Text style={styles.pnlText2}>P&L</Text>
            </View>

            {parseFloat(profitAndLoss) > 0 ? (
              <View style={styles.row}>
                <Text style={styles.pnlValuepos}>
                  +₹{formatCurrency(Math.abs(profitAndLoss))}
                </Text>
                <View style={styles.pnlPercentageContainerpos}>
                  <Text style={styles.pnlPercentagepos}>
                    +{Math.abs(pnlPercentage)}%
                  </Text>
                </View>
              </View>
            ) : parseFloat(profitAndLoss) < 0 ? (
              <View style={styles.row}>
                <Text style={styles.pnlValueneg}>
                  -₹{formatCurrency(Math.abs(profitAndLoss))}
                </Text>
                <View style={styles.pnlPercentageContainerneg}>
                  <Text style={styles.pnlPercentageneg}>
                    {pnlPercentage}%
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.pnlValuepos}>₹0</Text>
                <View style={styles.pnlPercentageContainerpos}>
                  <Text style={styles.pnlPercentagepos}>0.00%</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.amountText}>Invested</Text>
          <Text style={styles.amountText}>Current</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text style={styles.amountValue}>
            {allHoldingsData?.totalinvvalue
              ? `₹${formatCurrency(parseInt(allHoldingsData.totalinvvalue))}`
              : '₹0'}
          </Text>
          <Text style={styles.amountValue}>
            {allHoldingsData?.totalholdingvalue
              ? `₹${formatCurrency(parseInt(allHoldingsData.totalholdingvalue))}`
              : '₹0'}
          </Text>
        </View>
      </View>
      <ButtonSwitch
        leftText={config?.bespokePlanLabel || "Bespoke"}
        rightText="Model Portfolio"
        unActiveBackColor={designColor('000')}
        activeButtonStyle={{
          backgroundColor: designColor('fff'),
          margin: 0,
          padding: 0,
          borderWidth: 1.5,
          borderColor: designColor('e6e6e6'),
        }}
        activeColor={designColor('000')}
        unActiveTextColor={designColor('1d1d1db2')}
        innerViewStyle={{padding: 0, backgroundColor: designColor('f5f5f5')}}
        outerViewStyle={{padding: 0}}
        textUnSelectedStyle={{
          color: designColor('1d1d1db2'),
          fontFamily: designFont('Poppins-Regular'),
          fontSize: 14,
        }}
        textSelectedStyle={{
          color: designColor('000'),
          fontFamily: designFont('Poppins-Medium'),
          fontSize: 16,
        }}
        onClickLeft={() => {
          setSelectedInnerTab(1);
          // console.log('selected: 2');
        }}
        onClickRight={() => {
          setSelectedInnerTab(0);
          //  console.log('selected: 2');
        }}
      />
    </View>
  );
};

export default PortfolioCard2;

const styles = StyleSheet.create({
  stickyCard: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 10,

    backgroundColor: designColor('c84444'),
    marginTop: 10,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  amountText: {
    fontSize: 16,
    color: 'white',
    fontFamily: designFont('Poppins-Regular'),
  },
  amountValue: {
    fontSize: 16,
    color: 'white',
    fontFamily: designFont('Poppins-Medium'),
  },
  pnlContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlText2: {
    fontSize: 16,
    color: 'white',

    fontFamily: designFont('Poppins-Regular'),
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 10,
  },
  pnlBorder: {
    paddingHorizontal: 15,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: 'white',
    borderWidth: 1.5,
    marginRight: 10,
    borderRadius: 20,
  },
  pnlValuepos: {
    fontSize: 18,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('73be4a'),
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValueneg: {
    fontSize: 18,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('cf3a49'),
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlPercentageContainerpos: {
    backgroundColor: designColor('6ce0c8'),
    paddingHorizontal: 13,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 20,
  },
  pnlPercentagepos: {
    fontSize: 16,
    color: 'white',
    marginTop: 3,
    marginLeft: 2,
    fontFamily: designFont('Poppins-Regular'),
  },
  pnlPercentageContainerneg: {
    backgroundColor: designColor('fdeaec'),
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentageneg: {
    fontSize: 14,
    color: designColor('cf3a49'),
    fontFamily: designFont('Poppins-Medium'),
  },
});
