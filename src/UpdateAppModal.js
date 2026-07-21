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

// App Store URLs require Apple's numeric app ID (e.g. id1234567890), NOT the
// bundle ID. The numeric ID is per-tenant and lives in backend config as
// `iosAppStoreId`. When null (app not yet on App Store, TestFlight only), we
// return null so callers can skip the version prompt entirely instead of
// linking the user to an invalid URL.
const getAppStoreUrl = (appStoreId) => {
  if (!appStoreId) return null;
  return `https://apps.apple.com/app/id${appStoreId}`;
};

// Platform-specific version override. Android and iOS frequently sit at
// different store versions (e.g. Android 1.0.38 is live while iOS is still on
// 1.0.17 in review). A single shared floor would soft-lock the lagging
// platform — iOS users can never reach an Android-only version, so the
// "Update Required" gate loops forever. Resolve `<base>Android` / `<base>Ios`
// first, then fall back to the platform-agnostic `<base>` for backward compat.
// Used for both `latestAppVersion` and `minAppVersion`.
const pickPlatformVersion = (cfg, base) => {
  if (!cfg) return undefined;
  const key = base + (Platform.OS === 'ios' ? 'Ios' : 'Android');
  return cfg[key] || cfg[base] || undefined;
};

// Only PLAY-STORE installs get the mandatory upgrade gate. Sideloaded / APK /
// dev installs (installer null, "adb", or unknown) can't update through the
// store, so we never hard-block them — APK installs are explicitly exempt.
// iOS has no sideloaded-APK case here, so it's always treated as store.
const STORE_INSTALLERS = [
  'com.android.vending', // Google Play
  'com.google.android.feedback', // Play (legacy)
];
const isStoreInstall = async () => {
  if (Platform.OS === 'ios') return true;
  try {
    const inst = (await DeviceInfo.getInstallerPackageName()) || '';
    return STORE_INSTALLERS.includes(inst);
  } catch (e) {
    return false; // unknown → treat as sideload, don't force
  }
};

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
  const [mandatory, setMandatory] = useState(false);

  const config = useConfig();
  const gradientStart = config?.gradient2 || '#0076FB';
  const gradientEnd = config?.gradient1 || '#002651';

  const checkUpdate = useCallback(async () => {
    // Backend-supplied version is authoritative; fall back to config so a bare
    // <UpdateAppModal/> mount resolves the same latestAppVersion that
    // <AppUpdateChecker/> passes explicitly.
    const sv = serverVersion ?? pickPlatformVersion(config, 'latestAppVersion');
    const result = await checkForAppUpdate(sv);
    // Self-heal: if a refreshed config says no update is needed, HIDE the modal
    // (it may have been shown earlier from a higher floor that was since lowered).
    if (!result.updateAvailable) {
      setShowModal(false);
      return;
    }

    // APK / sideloaded installs can't update via the store → never gate them.
    const fromStore = await isStoreInstall();
    if (!fromStore) {
      setShowModal(false);
      return;
    }

    // Mandatory by default (force upgrade, non-dismissible). A backend
    // `minAppVersion` (platform-specific or generic) softens it: at/above min →
    // optional dismissible nudge.
    let isMandatory = config?.forceUpdate !== false;
    const minV = pickPlatformVersion(config, 'minAppVersion');
    if (
      minV &&
      semver.valid(minV) &&
      semver.valid(result.currentVersion)
    ) {
      isMandatory = semver.lt(result.currentVersion, minV);
    }

    // Optional nudges respect the 48h "Maybe Later" cooldown; mandatory ignores it.
    if (!isMandatory) {
      const shouldShow = await shouldShowUpdatePrompt();
      if (!shouldShow) return;
    }

    setMandatory(isMandatory);
    setLatestVersion(result.latestVersion);
    setShowModal(true);
  }, [serverVersion, config]);

  useEffect(() => {
    if (visible !== undefined) {
      setShowModal(visible);
    } else {
      checkUpdate();
    }
  }, [visible, checkUpdate]);

  const handleUpdate = () => {
    const storeUrl =
      Platform.OS === 'android'
        ? getPlayStoreUrl()
        : getAppStoreUrl(config?.iosAppStoreId);
    if (!storeUrl) return;
    Linking.openURL(storeUrl);
  };

  const handleDismiss = async () => {
    await saveDismissTimestamp();
    setShowModal(false);
    if (onClose) onClose();
  };

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Block the Android hardware-back dismiss when the update is mandatory.
        if (!mandatory) handleDismiss();
      }}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={[gradientStart, gradientEnd]}
          style={styles.container}>
          <Text style={styles.heading}>
            {mandatory ? 'Update Required' : 'Update Available!'}
          </Text>
          <Text style={styles.message}>
            {mandatory
              ? `A required update${latestVersion ? ` (v${latestVersion})` : ''} is available. Please update to continue using the app.`
              : `A new version${latestVersion ? ` (v${latestVersion})` : ''} of this app is available. Please update for the best experience and latest features.`}
          </Text>
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
          {!mandatory && (
            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleDismiss}
              activeOpacity={0.8}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          )}
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
  // Platform-specific latest version (Android vs iOS) with fallback to the
  // generic latestAppVersion.
  return <UpdateAppModal serverVersion={pickPlatformVersion(config, 'latestAppVersion')} />;
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
