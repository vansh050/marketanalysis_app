import {compareAppVersions, isAppVersionOlder} from '../../utils/appVersion';

describe('app version comparison', () => {
  test('compares Android dotted versions numerically', () => {
    expect(isAppVersionOlder('1.0.83', '1.0.84')).toBe(true);
    expect(isAppVersionOlder('1.0.84', '1.0.84')).toBe(false);
    expect(isAppVersionOlder('1.0.100', '1.0.84')).toBe(false);
  });

  test('compares Markup iOS integer marketing versions', () => {
    expect(isAppVersionOlder('28', '30')).toBe(true);
    expect(isAppVersionOlder('30', '30')).toBe(false);
    expect(isAppVersionOlder('31', '30')).toBe(false);
  });

  test('compares AlphaPro two-part iOS and three-part Android versions', () => {
    expect(isAppVersionOlder('2.5', '2.7')).toBe(true);
    expect(isAppVersionOlder('2.7', '2.7')).toBe(false);
    expect(isAppVersionOlder('2.10', '2.7')).toBe(false);
    expect(isAppVersionOlder('3.9.130', '3.9.187')).toBe(true);
    expect(isAppVersionOlder('3.9.187', '3.9.187')).toBe(false);
  });

  test('treats missing dotted components as zero', () => {
    expect(compareAppVersions('1', '1.0.0')).toBe(0);
    expect(compareAppVersions('1.2', '1.2.1')).toBe(-1);
  });

  test('fails open for malformed configuration values', () => {
    expect(compareAppVersions('29', 'latest')).toBeNull();
    expect(isAppVersionOlder('29', 'latest')).toBe(false);
    expect(isAppVersionOlder('', '30')).toBe(false);
  });
});

