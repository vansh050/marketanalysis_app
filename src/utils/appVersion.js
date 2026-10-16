const NUMERIC_VERSION = /^\d+(?:\.\d+)*$/;

const parseAppVersion = (value) => {
  const normalized = String(value ?? '').trim();
  if (!NUMERIC_VERSION.test(normalized)) {
    return null;
  }
  return normalized.split('.').map((part) => Number(part));
};

// Native versions are numeric dot sequences, not necessarily semantic
// versions. Markup Android uses values such as 1.0.84 while its iOS App Store
// train uses whole-number marketing versions such as 29 and 30.
export const compareAppVersions = (left, right) => {
  const leftParts = parseAppVersion(left);
  const rightParts = parseAppVersion(right);
  if (!leftParts || !rightParts) {
    return null;
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) {
      return -1;
    }
    if (leftPart > rightPart) {
      return 1;
    }
  }
  return 0;
};

export const isAppVersionOlder = (currentVersion, requiredVersion) =>
  compareAppVersions(currentVersion, requiredVersion) === -1;
