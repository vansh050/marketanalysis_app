import codePush from '@revopush/react-native-code-push';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import {installExactTargetOta} from './otaPolicy';

// Monotonic safety contract understood by the Node execution-intent boundary.
export const EXECUTION_BUNDLE_VERSION = 2026091102;

export const executionBundleHeaders = () => ({
  'X-AQ-Execution-Client': 'mobile',
  'X-AQ-Execution-Bundle': String(EXECUTION_BUNDLE_VERSION),
});

export const handleStaleExecutionBundle = async error => {
  if (error?.response?.data?.code !== 'EXECUTION_BUNDLE_STALE') return false;
  // Never terminate the process while an execution flow is on screen. The
  // previous IMMEDIATE install mode looked exactly like an Android crash when
  // the order boundary rejected an old JS bundle. Download now and apply on
  // the customer's next normal restart; the server has already guaranteed
  // that no order was dispatched for EXECUTION_BUNDLE_STALE.
  //
  // 2026-10-01: exact-target only. The former bare CodePush sync call accepted
  // open-ended releases such as Production v93 (>=3.9.129) and could replace a
  // newer APK's embedded bundle with older code (CLAUDE.md OTA blocker, rule
  // 2). Same guard as the launch-time check in index.js.
  let result = {status: 'error'};
  try {
    result = await installExactTargetOta({
      codePush,
      binaryVersion: DeviceInfo.getVersion(),
    });
  } catch (e) {
    console.warn('[OTA] stale-bundle update check failed:', e?.message || e);
  }
  const downloaded = result.status === 'installed_for_next_restart';
  Toast.show({
    type: 'info',
    text1: downloaded ? 'Safety update downloaded' : 'App update required',
    text2: downloaded
      ? 'No order was sent. Reopen the app before trying again.'
      : 'No order was sent. Please update the app, then try again.',
    visibilityTime: 7000,
  });
  return true;
};
