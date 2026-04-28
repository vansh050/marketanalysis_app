import React, {useEffect, useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import VersionCheck from 'react-native-version-check';
import { useConfig } from './context/ConfigContext';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import semver from 'semver';

const STORAGE_KEY = '@app_update_dismissed';
const DISMISS_DURATION_HOURS = 48; // Show again after 48 hours if dismissed

// Get package/bundle ID dynamically
const getPackageId = () => DeviceInfo.getBundleId();

// Generate store URLs dynamically
const getPlayStoreUrl = () =>
  `https://play.google.com/store/apps/details?id=${getPackageId()}`;

const getAppStoreUrl = () =>
  `https://apps.apple.com/app/id${getPackageId()}`;

// Utility function to check for app updates
export const checkForAppUpdate = async () => {
  try {
    const currentVersion = DeviceInfo.getVersion();
    const packageId = getPackageId();
    let latestVersion;

    if (Platform.OS === 'android') {
      latestVersion = await VersionCheck.getLatestVersion({
        provider: 'playStore',
        packageName: packageId,
      });
    } else {
      latestVersion = await VersionCheck.getLatestVersion({
        provider: 'appStore',
        packageName: packageId,
        country: 'in', // Change to your primary market country code
      });
    }

    if (latestVersion && semver.valid(currentVersion) && semver.valid(latestVersion)) {
      return {
        updateAvailable: semver.lt(currentVersion, latestVersion),
        currentVersion,
        latestVersion,
      };
    }
    return {updateAvailable: false, currentVersion, latestVersion};
  } catch (e) {
    console.log('Version check error:', e);
    return {updateAvailable: false, error: e};
  }
};

// Check if user recently dismissed the update prompt
const shouldShowUpdatePrompt = async () => {
  try {
    const dismissedData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!dismissedData) return true;

    const {timestamp} = JSON.parse(dismissedData);
    const hoursSinceDismissed = (Date.now() - timestamp) / (1000 * 60 * 60);
    return hoursSinceDismissed >= DISMISS_DURATION_HOURS;
  } catch (e) {
    return true;
  }
};

// Save dismiss timestamp
const saveDismissTimestamp = async () => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({timestamp: Date.now()}),
    );
  } catch (e) {
    console.log('Error saving dismiss timestamp:', e);
  }
};

const UpdateAppModal = ({visible, onClose}) => {
  const [showModal, setShowModal] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  // Get dynamic config from API
  const config = useConfig();
  const gradientStart = config?.gradient2 || '#0076FB';
  const gradientEnd = config?.gradient1 || '#002651';

  const checkUpdate = useCallback(async () => {
    const shouldShow = await shouldShowUpdatePrompt();
    if (!shouldShow) return;

    const result = await checkForAppUpdate();
    if (result.updateAvailable) {
      setLatestVersion(result.latestVersion);
      setShowModal(true);
    }
  }, []);

  useEffect(() => {
    // If controlled externally via visible prop
    if (visible !== undefined) {
      setShowModal(visible);
    } else {
      // Auto-check on mount if not controlled
      checkUpdate();
    }
  }, [visible, checkUpdate]);

  const handleUpdate = () => {
    const storeUrl = Platform.OS === 'android' ? getPlayStoreUrl() : getAppStoreUrl();
    Linking.openURL(storeUrl);
  };

  const handleDismiss = async () => {
    await saveDismissTimestamp();
    setShowModal(false);
    if (onClose) onClose();
  };

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient
          colors={[gradientStart, gradientEnd]}
          style={styles.container}>
          <Text style={styles.heading}>Update Available!</Text>
          <Text style={styles.message}>
            A new version{latestVersion ? ` (v${latestVersion})` : ''} of this app is available.
            Please update for the best experience and latest features.
          </Text>
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.laterButton}
            onPress={handleDismiss}
            activeOpacity={0.8}>
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    paddingVertical: 30,
    paddingHorizontal: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
    elevation: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  updateButton: {
    backgroundColor: '#29A400',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 60,
    marginBottom: 16,
    width: '100%',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  laterButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  laterButtonText: {
    color: 'white',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

export default UpdateAppModal;
