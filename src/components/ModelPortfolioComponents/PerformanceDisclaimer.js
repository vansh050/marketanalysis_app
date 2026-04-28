import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {ShieldAlert, ChevronRight, SquareCheck, Square} from 'lucide-react-native';

const DISCLAIMER_POINTS = [
  'Past performance is not indicative of future returns. The value of investments can go down as well as up.',
  'The returns shown are simulated / backtested and do not represent actual returns earned by any investor.',
  'Investments in the securities market are subject to market risks, including loss of principal.',
  'This is not investment advice. Please consult your financial advisor before making any investment decisions.',
  'Registration with SEBI does not guarantee performance of the intermediary or provide any assurance of returns.',
];

const PerformanceDisclaimer = ({onAccept, accentColor = '#1a1a1a'}) => {
  const [checked, setChecked] = useState(false);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <ShieldAlert size={36} color="#f59e0b" />
      </View>

      {/* Title */}
      <Text style={styles.title}>Before you view performance</Text>
      <Text style={styles.subtitle}>
        Please read and acknowledge the following
      </Text>

      {/* Disclaimer Points */}
      <View style={styles.pointsContainer}>
        {DISCLAIMER_POINTS.map((point, index) => (
          <View key={index} style={styles.pointRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>

      {/* Checkbox */}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setChecked(!checked)}
        activeOpacity={0.7}>
        {checked ? (
          <SquareCheck size={22} color={accentColor} />
        ) : (
          <Square size={22} color="#9ca3af" />
        )}
        <Text style={styles.checkboxText}>
          I have read and understood that past performance does not guarantee
          future results
        </Text>
      </TouchableOpacity>

      {/* Accept Button */}
      <TouchableOpacity
        style={[
          styles.acceptButton,
          checked
            ? {backgroundColor: accentColor}
            : styles.acceptButtonDisabled,
        ]}
        onPress={() => {
          if (checked) onAccept();
        }}
        disabled={!checked}
        activeOpacity={0.8}>
        <Text
          style={[
            styles.acceptButtonText,
            !checked && styles.acceptButtonTextDisabled,
          ]}>
          I Understand & Continue
        </Text>
        <ChevronRight
          size={18}
          color={checked ? '#fff' : '#9ca3af'}
          style={{marginLeft: 4}}
        />
      </TouchableOpacity>

      {/* Footer note */}
      <Text style={styles.footerText}>
        Investment in securities market is subject to market risks. Read all the
        related documents carefully before investing.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  pointsContainer: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
    marginTop: 6,
    marginRight: 10,
  },
  pointText: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  checkboxText: {
    flex: 1,
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#374151',
    marginLeft: 10,
    lineHeight: 18,
  },
  acceptButton: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  acceptButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  acceptButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  acceptButtonTextDisabled: {
    color: '#9ca3af',
  },
  footerText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 8,
  },
});

export default PerformanceDisclaimer;
