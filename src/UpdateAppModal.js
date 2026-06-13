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
const DISMISS_DURATION_HOURS = 48;

const getPackageId = () => DeviceInfo.getBundleId();

const getPlayStoreUrl = () =>
  `https://play.google.com/store/apps/details?id=${getPackageId()}`;

const getAppStoreUrl = () =>
  `https://apps.apple.com/app/id${getPackageId()}`;

// serverVersion: version string from backend config (e.g. "1.0.4").
// When provided, skips Play Store scraping — which is unreliable because
// react-native-version-check scrapes Play Store HTML and silently returns
// null whenever Google changes their page structure. Backend-controlled
// version is the authoritative source; Play Store scraping is the fallback.
export const checkForAppUpdate = async (serverVersion) => {
  try {
    const currentVersion = DeviceInfo.getVersion();
    let latestVersion = serverVersion || null;

    if (!latestVersion) {
      if (Platform.OS === 'android') {
        latestVersion = await VersionCheck.getLatestVersion({
          provider: 'playStore',
          packageName: getPackageId(),
        });
      } else {
        latestVersion = await VersionCheck.getLatestVersion({
          provider: 'appStore',
          packageName: getPackageId(),
          country: 'in',
        });
      }
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

// serverVersion prop: when provided, the component uses the backend-supplied
// version instead of scraping the Play Store. Pass config.latestAppVersion here.
const UpdateAppModal = ({visible, onClose, serverVersion}) => {
  const [showModal, setShowModal] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  const config = useConfig();
  const gradientStart = config?.gradient2 || '#0076FB';
  const gradientEnd = config?.gradient1 || '#002651';

  const checkUpdate = useCallback(async () => {
    const shouldShow = await shouldShowUpdatePrompt();
    if (!shouldShow) return;

    const result = await checkForAppUpdate(serverVersion);
    if (result.updateAvailable) {
      setLatestVersion(result.latestVersion);
      setShowModal(true);
    }
  }, [serverVersion]);

  useEffect(() => {
    if (visible !== undefined) {
      setShowModal(visible);
    } else {
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

// Placed inside ConfigProvider in App.js so it can read latestAppVersion
// from the backend config. Defined as a named export so App.js can import
// it separately from the default UpdateAppModal.
export const AppUpdateChecker = () => {
  const config = useConfig();
  return <UpdateAppModal serverVersion={config?.latestAppVersion} />;
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
