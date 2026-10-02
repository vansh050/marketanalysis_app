/**
 * SurveillanceWarning — Angel One pre-trade surveillance banner
 * =============================================================================
 *
 * Renders nothing unless at least one scrip is under surveillance, so callers
 * can mount it unconditionally next to their trade list.
 *
 * Copy and styling are kept identical to the banner already used on the
 * MPReviewTradeModal / ReviewTradeModal surfaces so a customer sees the same
 * warning wherever it appears. Pair with `useAngelOneSurveillance`.
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {AlertTriangle as AlertTriangleIcon} from 'lucide-react-native';

import { designColor, designFont } from '../design/literalTokens';

const SurveillanceWarning = ({surveillanceStocks}) => {
  if (!Array.isArray(surveillanceStocks) || surveillanceStocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.surveillanceWarning}>
      <View style={styles.surveillanceHeader}>
        <AlertTriangleIcon size={18} color={designColor('dc2626')} />
        <Text style={styles.surveillanceTitle}>Surveillance Alert</Text>
      </View>
      <Text style={styles.surveillanceText}>
        The following stocks are under Angel One surveillance measures and may
        be rejected via API:
      </Text>
      {surveillanceStocks.map((stock, index) => (
        <Text key={`${stock.symbol}-${index}`} style={styles.surveillanceStock}>
          • <Text style={styles.surveillanceStockName}>{stock.symbol}</Text>{' '}
          (Surveillance: {stock.surveillance})
        </Text>
      ))}
      <Text style={styles.surveillanceNote}>
        Please trade these stocks manually through the Angel One mobile app or
        web platform.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  surveillanceWarning: {
    marginHorizontal: 10,
    marginVertical: 8,
    padding: 12,
    backgroundColor: designColor('fef2f2'),
    borderLeftWidth: 4,
    borderLeftColor: designColor('dc2626'),
    borderRadius: 4,
  },
  surveillanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  surveillanceTitle: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('dc2626'),
    marginLeft: 8,
  },
  surveillanceText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('991b1b'),
    marginBottom: 6,
  },
  surveillanceStock: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('b91c1c'),
    marginLeft: 8,
    marginBottom: 2,
  },
  surveillanceStockName: {
    fontFamily: designFont('Poppins-Bold'),
  },
  surveillanceNote: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('dc2626'),
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default SurveillanceWarning;
