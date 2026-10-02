// SELL review screen, warn mode: a SELL would use shares a model portfolio
// owns. Shown only in that case; never blocks — with no choice the order goes
// ahead exactly as entered. Choice logic lives in utils/sellModelImpact.js;
// state + network in useSellModelImpact.
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {modelReductionPlan} from '../../utils/sellModelImpact';
import {designColor, designFont} from '../../design/literalTokens';

const fmt = n => Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 4});

const Radio = ({selected, label, onPress, testID}) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.option}
    accessibilityRole="radio"
    accessibilityState={{checked: !!selected}}
    accessibilityLabel={label}
    testID={testID}>
    <View style={[styles.radio, selected && styles.radioOn]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
    <Text style={styles.optionText}>{label}</Text>
  </TouchableOpacity>
);

const SellModelImpactNotice = ({notice, choice, chosenModel, onChoose}) => {
  const symbol = String(notice.symbol || '').replace(/-EQ$/i, '');
  const models = notice.models || [];
  const picked = chosenModel || models[0]?.modelName;
  const plan = modelReductionPlan(notice, picked);
  const owners = models.map(m => m.modelName).join(', ');
  const free = Math.max(0, Math.floor(Number(notice.freeQuantity) || 0));
  const lowerText = plan
    .map(step => `${step.modelName}'s saved quantity from ${fmt(step.from)} to ${fmt(step.to)}`)
    .join(' and ');

  return (
    <View style={styles.card} testID="sell-model-impact-notice">
      <Text style={styles.title}>
        {`${fmt(notice.fromModels)} of these ${fmt(notice.requested)} ${symbol} shares belong to ${
          models.length === 1 ? owners : `your model portfolios (${owners})`
        }.`}
      </Text>
      <Radio
        selected={choice === 'free'}
        label={free > 0 ? `Sell only the ${fmt(free)} free shares` : `Don't sell ${symbol} now`}
        onPress={() => onChoose('free', picked)}
        testID="sell-impact-free"
      />
      <Radio
        selected={choice === 'all'}
        label={`Sell all ${fmt(notice.requested)} and lower ${lowerText}`}
        onPress={() => onChoose('all', picked)}
        testID="sell-impact-all"
      />
      {models.length > 1 ? (
        <View style={styles.chips}>
          <Text style={styles.hint}>Take them from:</Text>
          {models.map(m => (
            <TouchableOpacity
              key={m.modelName}
              onPress={() => onChoose('all', m.modelName)}
              style={[styles.chip, picked === m.modelName && choice === 'all' && styles.chipOn]}
              accessibilityRole="button"
              accessibilityLabel={`Take ${symbol} shares from ${m.modelName}`}>
              <Text style={styles.chipText}>
                {m.modelName} ({fmt(m.savedQuantity)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={styles.hint}>
        {`The model's target does not change, so its next rebalance may suggest buying these back.${
          !choice ? " If you don't choose, the order goes ahead as entered." : ''
        }`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('f59e0b'),
    backgroundColor: designColor('fffbeb'),
  },
  title: {fontSize: 13, fontFamily: designFont('Satoshi-Bold'), color: designColor('92400e')},
  option: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 8},
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: designColor('b45309'),
    marginTop: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {borderColor: designColor('92400e')},
  radioDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: designColor('92400e')},
  optionText: {flex: 1, fontSize: 13, fontFamily: designFont('Satoshi-Regular'), color: designColor('92400e')},
  chips: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6, marginLeft: 24},
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('fde68a'),
    marginRight: 6,
    marginTop: 4,
  },
  chipOn: {borderColor: designColor('92400e'), backgroundColor: designColor('fef3c7')},
  chipText: {fontSize: 12, fontFamily: designFont('Satoshi-Regular'), color: designColor('92400e')},
  hint: {marginTop: 8, fontSize: 12, fontFamily: designFont('Satoshi-Regular'), color: designColor('b45309')},
});

export default SellModelImpactNotice;
