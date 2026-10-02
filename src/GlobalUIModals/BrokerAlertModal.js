import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  BackHandler,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react-native';
import useModalStore from './modalStore';

import { designColor, designFont } from '../design/literalTokens';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');

const BrokerAlertModal = () => {
  const {alertVisible, alertType, alertTitle, alertMessage, hideAlert} =
    useModalStore();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  // Handle animations
  useEffect(() => {
    if (alertVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [alertVisible]);

  // Handle Android back button
  useEffect(() => {
    if (!alertVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      hideAlert();
      return true;
    });

    return () => backHandler.remove();
  }, [alertVisible, hideAlert]);

  const getIconAndColor = () => {
    switch (alertType) {
      case 'success':
        return {
          icon: <CheckCircle size={48} color={designColor('22c55e')} />,
          bgColor: designColor('dcfce7'),
          borderColor: designColor('22c55e'),
          titleColor: designColor('15803d'),
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={48} color={designColor('f59e0b')} />,
          bgColor: designColor('fef3c7'),
          borderColor: designColor('f59e0b'),
          titleColor: designColor('b45309'),
        };
      case 'info':
        return {
          icon: <Info size={48} color={designColor('3b82f6')} />,
          bgColor: designColor('dbeafe'),
          borderColor: designColor('3b82f6'),
          titleColor: designColor('1d4ed8'),
        };
      case 'error':
      default:
        return {
          icon: <AlertCircle size={48} color={designColor('ef4444')} />,
          bgColor: designColor('fee2e2'),
          borderColor: designColor('ef4444'),
          titleColor: designColor('dc2626'),
        };
    }
  };

  const {icon, bgColor, borderColor, titleColor} = getIconAndColor();

  const getButtonStyle = () => {
    switch (alertType) {
      case 'success':
        return {backgroundColor: designColor('22c55e')};
      case 'warning':
        return {backgroundColor: designColor('f59e0b')};
      case 'info':
        return {backgroundColor: designColor('3b82f6')};
      case 'error':
      default:
        return {backgroundColor: designColor('ef4444')};
    }
  };

  if (!alertVisible) return null;

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <View style={[styles.fullScreenOverlay, {paddingTop: statusBarHeight}]} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, {opacity: fadeAnim}]}>
        <Pressable style={styles.backdropPressable} onPress={hideAlert} />
      </Animated.View>
      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.modalContainer,
            {borderColor},
            {
              opacity: fadeAnim,
              transform: [{scale: scaleAnim}],
            },
          ]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={hideAlert}>
            <X size={20} color={designColor('666')} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconContainer, {backgroundColor: bgColor}]}>
            {icon}
          </View>

          {/* Title */}
          <Text style={[styles.title, {color: titleColor}]}>
            {alertTitle || (alertType === 'error' ? 'Error' : alertType === 'success' ? 'Success' : 'Alert')}
          </Text>

          {/* Message */}
          <Text style={styles.message}>{alertMessage}</Text>

          {/* OK Button */}
          <TouchableOpacity
            style={[styles.okButton, getButtonStyle()]}
            onPress={hideAlert}>
            <Text style={styles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 999999,
    elevation: 999999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: designColor('fff'),
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    elevation: 10,
    shadowColor: designColor('000'),
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: designFont('Poppins-SemiBold'),
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('4b5563'),
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  okButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okButtonText: {
    color: designColor('fff'),
    fontSize: 16,
    fontFamily: designFont('Poppins-SemiBold'),
    fontWeight: '600',
  },
});

export default BrokerAlertModal;
