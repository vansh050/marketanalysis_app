import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

const Checkbox = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      style={[styles.checkboxBase, value && styles.checkedBox]}
      onPress={() => onValueChange(!value)}
    >
      {value && <Check size={16} color="#fff" />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  checkboxBase: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop:3,
  },
  checkedBox: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
});

export default Checkbox;
