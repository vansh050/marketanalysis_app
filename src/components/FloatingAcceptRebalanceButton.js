/**
 * FloatingAcceptRebalanceButton.js
 * Animated floating button for quick rebalance acceptance/repair.
 * Ported from prod-alphaquark-github for feature parity.
 */
import React, {useEffect, useRef} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import {CheckCircle} from 'lucide-react-native';

const FloatingAcceptRebalanceButton = ({onPress, isRepair, style}) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide up animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse glow animation (non-repair only)
    if (!isRepair) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [isRepair]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        style,
        {
          transform: [
            {translateY: slideAnim},
            {scale: isRepair ? 1 : pulseAnim},
          ],
          opacity: opacityAnim,
        },
      ]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[
          styles.button,
          isRepair ? styles.repairButton : styles.rebalanceButton,
        ]}>
        <CheckCircle size={18} color="#fff" />
        <Text style={styles.buttonText}>
          {isRepair ? 'Repair Portfolio' : 'Accept Rebalance'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 50,
    elevation: 8,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  rebalanceButton: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  repairButton: {
    backgroundColor: '#DE8846',
    shadowColor: '#DE8846',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default FloatingAcceptRebalanceButton;
