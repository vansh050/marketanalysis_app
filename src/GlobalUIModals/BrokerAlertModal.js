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

import { designColor, designFont, designToken } from '../design/literalTokens';

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
          icon: <CheckCircle size={48} color={designToken('brokerAlert.success')} />,
          bgColor: designToken('brokerAlert.successSoft'),
          borderColor: designToken('brokerAlert.success'),
          titleColor: designToken('brokerAlert.successStrong'),
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={48} color={designToken('brokerAlert.warning')} />,
          bgColor: designToken('brokerAlert.warningSoft'),
          borderColor: designToken('brokerAlert.warning'),
          titleColor: designToken('brokerAlert.warning2'),
        };
      case 'info':
        return {
          icon: <Info size={48} color={designToken('brokerAlert.accent')} />,
          bgColor: designToken('brokerAlert.accentSoft'),
          borderColor: designToken('brokerAlert.accent'),
          titleColor: designToken('brokerAlert.accent2'),
        };
      case 'error':
      default:
        return {
          icon: <AlertCircle size={48} color={designToken('brokerAlert.danger')} />,
          bgColor: designToken('brokerAlert.dangerSoft'),
          borderColor: designToken('brokerAlert.danger'),
          titleColor: designToken('brokerAlert.danger2'),
        };
    }
  };

  const {icon, bgColor, borderColor, titleColor} = getIconAndColor();

  const getButtonStyle = () => {
    switch (alertType) {
      case 'success':
        return {backgroundColor: designToken('brokerAlert.success')};
      case 'warning':
        return {backgroundColor: designToken('brokerAlert.warning')};
      case 'info':
        return {backgroundColor: designToken('brokerAlert.accent')};
      case 'error':
      default:
        return {backgroundColor: designToken('brokerAlert.danger')};
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
            <X size={20} color={designToken('brokerAlert.textSecondary')} />
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
    backgroundColor: designToken('brokerAlert.surface'),
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
    color: designToken('brokerAlert.textSecondary2'),
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
    color: designToken('brokerAlert.surface'),
    fontSize: 16,
    fontFamily: designFont('Poppins-SemiBold'),
    fontWeight: '600',
  },
});

export default BrokerAlertModal;
