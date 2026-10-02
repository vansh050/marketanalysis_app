import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

import { designColor } from '../../design/literalTokens';

const Checkbox = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      style={[styles.checkboxBase, value && styles.checkedBox]}
      onPress={() => onValueChange(!value)}
    >
      {value && <Check size={16} color={designColor('fff')} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  checkboxBase: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: designColor('ccc'),
    backgroundColor: designColor('fff'),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop:3,
  },
  checkedBox: {
    backgroundColor: designColor('000'),
    borderColor: designColor('000'),
  },
});

export default Checkbox;
