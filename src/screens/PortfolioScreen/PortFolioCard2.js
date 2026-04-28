// PortfolioCard.js
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import ButtonSwitch from 'rn-switch-button';
const PortfolioCard2 = ({
  allHoldingsData,
  formatCurrency,
  profitAndLoss,
  pnlPercentage,
  pnlposneg,
  setSelectedInnerTab,
}) => (
  <View>
    <View
      style={[
        styles.stickyCard,
        {backgroundColor: parseFloat(profitAndLoss) >= 0 ? '#16A085' : '#C84444'},
      ]}>
      <View style={styles.pnlContainer}>
        <Text
          style={{color: 'white', fontFamily: 'Poppins-Regular', fontSize: 12, opacity: 0.8}}>
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
      leftText="Bespoke"
      rightText="Model Portfolio"
      unActiveBackColor="#000"
      activeButtonStyle={{
        backgroundColor: '#fff',
        margin: 0,
        padding: 0,
        borderWidth: 1.5,
        borderColor: '#E6E6E6',
      }}
      activeColor="#000"
      unActiveTextColor="#1D1D1DB2"
      innerViewStyle={{padding: 0, backgroundColor: '#F5F5F5'}}
      outerViewStyle={{padding: 0}}
      textUnSelectedStyle={{
        color: '#1D1D1DB2',
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
      }}
      textSelectedStyle={{
        color: '#000',
        fontFamily: 'Poppins-Medium',
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

export default PortfolioCard2;

const styles = StyleSheet.create({
  stickyCard: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 10,

    backgroundColor: '#C84444',
    marginTop: 10,
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
    fontFamily: 'Poppins-Regular',
  },
  amountValue: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Poppins-Medium',
  },
  pnlContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlText2: {
    fontSize: 16,
    color: 'white',

    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-Medium',
    color: '#73BE4A',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValueneg: {
    fontSize: 18,
    fontFamily: 'Poppins-Medium',
    color: '#cf3a49',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlPercentageContainerpos: {
    backgroundColor: '#6CE0C8',
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
    fontFamily: 'Poppins-Regular',
  },
  pnlPercentageContainerneg: {
    backgroundColor: '#FDEAEC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentageneg: {
    fontSize: 14,
    color: '#cf3a49',
    fontFamily: 'Poppins-Medium',
  },
});
