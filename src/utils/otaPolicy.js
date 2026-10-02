// OTA acceptance policy — an OTA may replace this APK's embedded bundle ONLY
// when the release explicitly declares the exact binary it was built for.
//
// 2026-10-01: the version check alone was not enough. For an open-ended
// release (Production v93, target ">=3.9.129") Revopush's update_check
// answers with `target_binary_range` set to the CALLING app's own version
// (verified live: binary 3.9.169 -> target "3.9.169", label v93). The old
// `appVersion === binaryVersion` test therefore passed, and v93's
// 4-day-old code replaced every new APK on the next restart (e.g. the
// Angel One form came back with an "API Secret" field removed on 30 Sep).
//
// Every release made by `npm run ota:*` now carries the marker
// `[aq-target <platform> <exact binary version>]` in its description; the
// server never rewrites descriptions. No marker → rejected.
import {Platform} from 'react-native';

export const otaTargetMarker = (platform, binaryVersion) =>
  `[aq-target ${platform} ${String(binaryVersion || '').trim()}]`;

export const isExactOtaTargetForBinary = (
  targetVersion,
  binaryVersion,
  description,
  platform = Platform.OS,
) =>
  typeof targetVersion === 'string' &&
  typeof binaryVersion === 'string' &&
  targetVersion.trim() === binaryVersion.trim() &&
  typeof description === 'string' &&
  description.includes(otaTargetMarker(platform, binaryVersion));

export const installExactTargetOta = async ({codePush, binaryVersion, platform = Platform.OS}) => {
  const remotePackage = await codePush.checkForUpdate();
  if (!remotePackage) return {status: 'up_to_date'};

  if (
    !isExactOtaTargetForBinary(
      remotePackage.appVersion,
      binaryVersion,
      remotePackage.description,
      platform,
    )
  ) {
    console.warn(
      `[OTA] Ignored ${remotePackage.label || 'release'}: not declared for ${platform} ${binaryVersion}`,
    );
    return {status: 'target_rejected', target: remotePackage.appVersion, label: remotePackage.label};
  }

  const localPackage = await remotePackage.download();
  await localPackage.install(codePush.InstallMode.ON_NEXT_RESTART);
  return {status: 'installed_for_next_restart', label: remotePackage.label};
};
