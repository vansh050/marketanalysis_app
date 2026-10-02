jest.mock('react-native-config', () => ({
  APP_VARIANT: 'alphaquark',
  REACT_APP_HEADER_NAME: 'prod',
}));

import fs from 'fs';
import path from 'path';
import {
  clearRuntimeAdvisorConfig,
  getRuntimeAppVariant,
  getRuntimeDesignVariant,
  getRuntimeTenantSubdomain,
  hydrateRuntimeAdvisorConfig,
  setRuntimeAdvisorConfig,
  subscribeRuntimeAdvisor,
} from '../../utils/runtimeAdvisor';
import {
  getBuildTenantSubdomain,
  getTenantSubdomain,
} from '../../utils/variantHelper';
import {
  getAdvisorContentProfile,
  getAdvisorPlanColor,
  getAdvisorPlanSummary,
} from '../../utils/advisorContentProfile';

const moneyManConfig = {
  config: {
    REACT_APP_HEADER_NAME: 'moneyman',
    APP_VARIANT: 'moneyman',
  },
};

describe('runtime advisor authority', () => {
  beforeEach(() => clearRuntimeAdvisorConfig());

  test('selected advisor wins over the AlphaB2B build tenant', () => {
    expect(getBuildTenantSubdomain()).toBe('prod');
    expect(getTenantSubdomain()).toBe('prod');

    setRuntimeAdvisorConfig(moneyManConfig);

    expect(getRuntimeTenantSubdomain()).toBe('moneyman');
    expect(getRuntimeAppVariant()).toBe('moneyman');
    expect(getRuntimeDesignVariant()).toBe('moneyman_app');
    expect(getTenantSubdomain()).toBe('moneyman');
    expect(getBuildTenantSubdomain()).toBe('prod');
    expect(getAdvisorContentProfile()).toMatchObject({
      platformDisplayName: 'MoneyMan Investments',
      planOrdering: 'fixed',
      homeFeedRestructure: true,
    });
    expect(getAdvisorPlanColor('MAMM')).toBe('#005a00');
    expect(getAdvisorPlanSummary('MFCC')).toContain('compound wealth');
  });

  test('an explicit request config has highest precedence', () => {
    setRuntimeAdvisorConfig(moneyManConfig);
    expect(getTenantSubdomain({
      config: {REACT_APP_HEADER_NAME: 'explicit-tenant'},
    })).toBe('explicit-tenant');
  });

  test('restore publishes the cached advisor and clear returns to build scope', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRuntimeAdvisor(listener);
    const storage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(moneyManConfig)),
    };

    await hydrateRuntimeAdvisorConfig(storage);
    expect(listener).toHaveBeenLastCalledWith(moneyManConfig);
    expect(getTenantSubdomain()).toBe('moneyman');

    clearRuntimeAdvisorConfig();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(getTenantSubdomain()).toBe('prod');
    unsubscribe();
  });

  test('runtime design selection only requires variants bundled by this app', () => {
    const registry = fs.readFileSync('designs/registry.js', 'utf8');
    const provider = fs.readFileSync('src/design/DesignProvider.js', 'utf8');
    if (fs.existsSync('designs/moneyman_app/index.js')) {
      expect(registry).toContain("import moneymanAppVariant from './moneyman_app'");
      expect(registry).toContain('moneyman_app: moneymanAppVariant');
    } else {
      expect(registry).not.toContain("from './moneyman_app'");
    }
    expect(provider).toContain('getRuntimeDesignVariant()');
    expect(provider).toContain('subscribeRuntimeAdvisor');
  });

  test('SDK mint and post-login headers cannot use build-only tenant sources', () => {
    const sdkRoot = fs.readFileSync('src/sdk/SdkProviderRoot.js', 'utf8');
    expect(sdkRoot).toContain('subscribeRuntimeAdvisor');
    expect(sdkRoot).toContain('mintSession(userRef, tenantSubdomain)');
    expect(sdkRoot).toContain('[tenantSubdomain]');
    expect(sdkRoot).toContain("key={`aq-sdk-${tenantSubdomain || 'default'}`}");
    expect(sdkRoot).not.toContain('return getAdvisorSubdomain()');

    const sourceRoot = path.join(process.cwd(), 'src');
    const offenders = [];
    const visit = directory => {
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') visit(absolute);
          continue;
        }
        if (!/\.(js|jsx)$/.test(entry.name)) continue;
        const lines = fs.readFileSync(absolute, 'utf8').split('\n');
        const source = lines.join('\n');
        lines.forEach((line, index) => {
          if (
            line.includes('X-Advisor-Subdomain') &&
            /(getAdvisorSubdomain\(\)|Config\??\.REACT_APP_(?:X_ADVISOR_SUBDOMAIN|HEADER_NAME)|process\.env)/.test(line)
          ) {
            offenders.push(`${path.relative(process.cwd(), absolute)}:${index + 1}`);
          }
        });
        if (
          /['"]X-Advisor-Subdomain['"]\s*:\s*(?:Config\??\.REACT_APP_|process\.env|getAdvisorSubdomain\(\))/m.test(source)
        ) {
          offenders.push(`${path.relative(process.cwd(), absolute)}:build-only-header`);
        }
      }
    };
    visit(sourceRoot);
    expect(offenders).toEqual([]);
  });
});
