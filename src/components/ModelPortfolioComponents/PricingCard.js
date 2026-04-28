import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useConfig } from '../../context/ConfigContext';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';

const PricingCard = ({ pricingOptions = [], discount = 0 }) => {
  // Get dynamic colors from config
  const config = useConfig();
  const mainColor = config?.mainColor || '#2563EB';
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  const [selectedPricing, setSelectedPricing] = useState(pricingOptions[0]?.period || '');

  // Get current and original price based on selected period
  const selectedOption = pricingOptions.find(opt => opt.period === selectedPricing);
  const currentPrice = selectedOption?.amount || 0;
  const originalPrice = Math.round(currentPrice / (1 - discount / 100));

  return (
    <View style={[styles.card, { backgroundColor: `${mainColor}15`, borderColor: `${mainColor}30` }]}>
      {pricingOptions.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.buttonContainer}>
            {pricingOptions.map(option => (
              <TouchableOpacity
                key={option.period}
                onPress={() => setSelectedPricing(option.period)}
                style={[
                  styles.optionButton,
                  selectedPricing === option.period && [styles.optionButtonActive, { backgroundColor: mainColor, borderColor: mainColor }]
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedPricing === option.period && styles.optionTextActive
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.priceContainer}>
        <Text style={styles.originalPrice}>₹{originalPrice.toLocaleString()}</Text>
        <Text style={styles.currentPrice}>
          ₹{configGst && configGstWithText ? withGst(currentPrice).toLocaleString() : currentPrice.toLocaleString()}{' '}
          {configGst && <Text style={styles.gstText}>{configGstWithText ? 'including GST' : '+ GST'}</Text>}
        </Text>
        {discount > 0 && (
          <View style={styles.saveTag}>
            <Text style={styles.saveText}>Save {discount}%</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E0F2FE', // light blue gradient effect simplified
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: '#2563EB', // blue-600
    borderColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 14,
    color: '#374151', // gray-700
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    fontSize: 16,
    color: '#6B7280', // gray-500
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827', // gray-900
  },
  gstText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  saveTag: {
    backgroundColor: '#D1FAE5', // green-50
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0', // green-100
  },
  saveText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669', // green-600
  },
});

export default PricingCard;
