import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const CurrentHoldingsScreen = ({viewModel, actions}) => {
  const {loading, holdings, editableHoldings, editMode} = viewModel;
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={designColor('1a237e')} />
        <Text style={styles.loadingText}>Loading holdings...</Text>
      </View>
    );
  }

  const visibleHoldings = editMode ? editableHoldings : holdings;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={actions.onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Your Holdings</Text>
        <TouchableOpacity onPress={actions.onToggleEdit} style={styles.editBtn}>
          <Text style={styles.editBtnText}>{editMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Review your current holdings before rebalancing. These will be used to calculate buy/sell orders.
          </Text>
        </View>
        {holdings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No existing holdings found. This appears to be a fresh portfolio.</Text>
          </View>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.symbolColumn]}>Symbol</Text>
              <Text style={[styles.th, styles.quantityColumn]}>Qty</Text>
              <Text style={[styles.th, styles.numberColumn]}>Avg Price</Text>
              <Text style={[styles.th, styles.numberColumn]}>LTP</Text>
            </View>
            {visibleHoldings.map((holding, index) => (
              <View key={`${holding.symbol}-${index}`} style={styles.tableRow}>
                <Text style={[styles.td, styles.symbolColumn]} numberOfLines={1}>{holding.symbol}</Text>
                {editMode ? (
                  <TextInput
                    style={[styles.td, styles.editInput, styles.quantityColumn]}
                    value={String(holding.quantity)}
                    onChangeText={value => actions.onQuantityChange(index, value)}
                    keyboardType="number-pad"
                  />
                ) : (
                  <Text style={[styles.td, styles.quantityColumn]}>{holding.quantity}</Text>
                )}
                <Text style={[styles.td, styles.numberColumn]}>₹{holding.averagePrice.toFixed(1)}</Text>
                <Text style={[styles.td, styles.numberColumn]}>₹{holding.ltp.toFixed(1)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.continueBtn} onPress={actions.onContinue}>
          <Text style={styles.continueBtnText}>Confirm & Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: designColor('f8f9fc')},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 12, color: designColor('666'), fontSize: 14},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: designColor('1a237e')},
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backBtnText: {color: designColor('fff'), fontSize: 22, fontWeight: '600'},
  headerTitle: {color: designColor('fff'), fontSize: 17, fontWeight: '700'},
  editBtn: {paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8},
  editBtnText: {color: designColor('fff'), fontSize: 13, fontWeight: '600'},
  scrollContent: {padding: 16, paddingBottom: 100},
  infoBox: {padding: 14, backgroundColor: designColor('e3f2fd'), borderRadius: 12, marginBottom: 16},
  infoText: {fontSize: 13, color: designColor('1565c0'), lineHeight: 20},
  emptyBox: {padding: 24, backgroundColor: designColor('fff'), borderRadius: 12, alignItems: 'center'},
  emptyText: {fontSize: 14, color: designColor('666'), textAlign: 'center'},
  tableHeader: {flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: designColor('e8eaf6'), borderRadius: 8},
  th: {fontSize: 11, fontWeight: '700', color: designColor('555'), textTransform: 'uppercase'},
  tableRow: {flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: designColor('f0f0f0'), backgroundColor: designColor('fff')},
  td: {fontSize: 13, color: designColor('333')},
  symbolColumn: {flex: 2},
  quantityColumn: {flex: 1, textAlign: 'center'},
  numberColumn: {flex: 1, textAlign: 'right'},
  editInput: {backgroundColor: designColor('f5f5f5'), borderWidth: 1, borderColor: designColor('e0e0e0'), borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4},
  bottomSection: {position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: designColor('f8f9fc'), borderTopWidth: 1, borderTopColor: designColor('e0e0e0')},
  continueBtn: {backgroundColor: designColor('1a237e'), paddingVertical: 15, borderRadius: 14, alignItems: 'center'},
  continueBtnText: {color: designColor('fff'), fontSize: 16, fontWeight: '700'},
});

export default CurrentHoldingsScreen;
