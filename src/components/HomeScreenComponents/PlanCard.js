import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';
import BrandLogo from '../BrandLogo';

const { width } = Dimensions.get('window');

const PlanCard = ({ data, type, onSubscribe, onMoreDetails }) => {
  const isBespoke = type === 'bespoke';
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();

  // 🟢 Calculate minimum amount + validity
  const { minAmount, validity } = useMemo(() => {
    let minAmt = null;
    let minValidity = null;

    if (data?.planType === 'onetime' && Array.isArray(data?.onetimeOptions)) {
      // Pick smallest amount from onetimeOptions
      const sorted = [...data.onetimeOptions].sort((a, b) => a.amount - b.amount);
      if (sorted.length > 0) {
        minAmt = sorted[0].amount;
        minValidity = sorted[0].duration + ' Days';
      }
    } else if (data?.planType !== 'onetime' && data?.pricing) {
      // For recurring (monthly, quarterly, etc.)
      const durations = {
        monthly: '30 Days',
        quarterly: '90 Days',
        'half-yearly': '180 Days',
        yearly: '365 Days',
      };

      let min = Infinity;
      let durationText = null;
      Object.keys(data.pricing).forEach((key) => {
        const price = data.pricing[key];
        if (price && price < min) {
          min = price;
          durationText = durations[key] || key;
        }
      });

      if (min !== Infinity) {
        minAmt = min;
        minValidity = durationText;
      }
    }

    return { minAmount: minAmt || '-', validity: minValidity || '-' };
  }, [data]);

  // Conditional styles
  const containerStyle = isBespoke ? styles.containerBespoke : styles.containerMp;
  const nameStyle = isBespoke ? styles.nameBespoke : styles.nameMp;
  const tagContainerStyle = isBespoke ? styles.tagContainerBespoke : styles.tagContainerMp;
  const tagTextStyle = isBespoke ? styles.tagTextBespoke : styles.tagTextMp;
  const detailsButtonStyle = isBespoke ? styles.detailsButtonBespoke : styles.detailsButtonMp;
  const detailsButtonTextStyle = isBespoke ? styles.detailsButtonTextBespoke : styles.detailsButtonTextMp;
  const subscribeButtonStyle = isBespoke ? styles.subscribeButtonBespoke : styles.subscribeButtonMp;
  const subscribeButtonTextStyle = isBespoke ? styles.subscribeButtonTextBespoke : styles.subscribeButtonTextMp;
  const infoLabelStyle = isBespoke ? styles.infoLabelBespoke : styles.infoLabelMp;
  const infoValueStyle = isBespoke ? styles.infoValueBespoke : styles.infoValueMp;

  return (
    <LinearGradient
      colors={isBespoke ? ['#FFFFFF', '#FFFFFF'] : ['#002651', '#0070EF']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, containerStyle]}
    >
      {/* Header */}
      <View style={styles.header}>
        {/*
          BrandLogo: alphanomy variant gets the JS-drawn gradient mark
          (no PNG asset needed); other variants render the legacy
          AlphaQuark logo.png via Image. Avoids the AlphaQuark logo
          leaking onto every Plan card on the alphanomy fork.
        */}
        <BrandLogo source={require('../../assets/logo.png')} size={30} style={styles.logo} />
        <Text style={nameStyle}>{data?.name}</Text>
        <View style={[styles.tagContainer, tagContainerStyle]}>
          <Text style={tagTextStyle}>{data?.planType === 'onetime' ? 'One Time' : 'Recurring'}</Text>
        </View>
      </View>

      {/* Middle */}
      
   

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.infoColumn}>
          <Text style={infoLabelStyle}>Min. Amt.</Text>
          <Text style={infoValueStyle}>₹ {minAmount !== '-' ? (configGst && configGstWithText ? withGst(minAmount) : minAmount) : '-'}</Text>
          {minAmount !== '-' && configGst && (
            <Text style={[infoLabelStyle, { fontSize: 10, marginTop: -2 }]}>
              {configGstWithText ? 'including GST' : '+ GST'}
            </Text>
          )}
        </View>

        {data.validity && (
    <View style={styles.middle}>
        <View style={styles.volatilityTag}>
          <Text style={styles.volatilityText}>{data?.volatility} Volatility</Text>
        </View>
      </View>
        )}
    
        <View style={styles.infoColumn}>
          <Text style={infoLabelStyle}>Validity</Text>
          <Text style={infoValueStyle}>{validity}</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={[styles.button, detailsButtonStyle]} onPress={onMoreDetails}>
          <Text style={detailsButtonTextStyle}>View More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, subscribeButtonStyle]} onPress={onSubscribe}>
          <Text style={subscribeButtonTextStyle}>Subscribe</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    marginRight: 10,
    elevation: 2,
    width: width - 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  containerBespoke: { backgroundColor: 'transparent' },
  containerMp: { backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logo: { width: 30, height: 30, marginRight: 12 },
  nameBespoke: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#000000' },
  nameMp: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  tagContainer: { paddingVertical: 4, paddingHorizontal: 12, marginLeft: 20, borderRadius: 4 },
  tagContainerBespoke: { backgroundColor: '#FFF8E1' },
  tagContainerMp: { backgroundColor: 'rgba(255, 255, 255, 1)', borderWidth: 1, borderColor: '#25221dff' },
  tagTextBespoke: { color: '#FFA726', fontWeight: '500', fontSize: 12 },
  tagTextMp: { color: '#FFA726', fontWeight: '500', fontSize: 10 },
  middle: { alignItems: 'center', marginBottom: 0,alignContent:'center',alignSelf:'center' },
  volatilityTag: { backgroundColor: 'rgba(76, 175, 80, 0.1)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  volatilityText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  infoColumn: { alignItems: 'flex-start' },
  infoLabelBespoke: { fontSize: 12, color: '#757575' },
  infoLabelMp: { fontSize: 12, color: '#BDBDBD' },
  infoValueBespoke: { fontSize: 14, fontWeight: 'bold', color: '#212121' },
  infoValueMp: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  buttonsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { flex: 1, paddingVertical: 10, borderRadius: 5, alignItems: 'center', marginHorizontal: 4 },
  detailsButtonBespoke: { backgroundColor: '#F5F5F5' },
  detailsButtonMp: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  detailsButtonTextBespoke: { color: '#212121', fontWeight: 'bold', fontSize: 12 },
  detailsButtonTextMp: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  subscribeButtonBespoke: { backgroundColor: '#1976D2' },
  subscribeButtonMp: { backgroundColor: '#FFFFFF' },
  subscribeButtonTextBespoke: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  subscribeButtonTextMp: { color: '#1976D2', fontWeight: 'bold', fontSize: 12 },
});

export default PlanCard;
