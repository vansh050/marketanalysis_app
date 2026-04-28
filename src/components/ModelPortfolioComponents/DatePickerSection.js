import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import DatePicker from 'react-native-date-picker';

const DatePickerSection = ({birthDate, setBirthDate}) => {
  const [isOpen, setIsOpen] = useState(false);

  const showDatePicker = () => setIsOpen(true);
  const hideDatePicker = () => setIsOpen(false);

  const handleConfirm = date => {
    setBirthDate(date);
    hideDatePicker();
  };

  const formatDate = date => {
    console.log('Here--', date);
    if (!date) return 'Select Date of Birth';

    const validDate = date instanceof Date ? date : new Date(date);
    if (isNaN(validDate.getTime())) return 'Select Date of Birth';

    return validDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // ✅ This ensures that DatePicker *always* receives a valid Date object
  const getValidDate = () => {
    if (birthDate instanceof Date && !isNaN(birthDate.getTime())) {
      return birthDate;
    }
    const parsed = new Date(birthDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return new Date(1990, 0, 1); // fallback
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        DATE OF BIRTH <Text style={styles.required}>*</Text>
      </Text>

      <TouchableOpacity
        onPress={showDatePicker}
        activeOpacity={0.7}
        style={styles.datePickerTouchable}>
        <Text
          style={[
            styles.enhancedInput,
            styles.dateInput,
            !birthDate && styles.placeholderText,
          ]}>
          {formatDate(birthDate)}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <DatePicker
          modal
          open={isOpen}
          date={getValidDate()} // ✅ guaranteed valid Date
          mode="date"
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          locale="en_GB"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: '#ef4444',
  },
  datePickerTouchable: {
    marginBottom: 15,
  },
  enhancedInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#1f2937',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    textAlignVertical: 'center',
    textAlign: 'left',
    lineHeight: 48,
  },
  dateInput: {},
  placeholderText: {
    color: '#9ca3af',
  },
});

export default DatePickerSection;
