const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');

describe('broker host chrome follows the active tenant tokens', () => {
  test('broker guidance supports API-key and broker-hosted OAuth copy', () => {
    const source = read(
      'src/components/BrokerConnectionModal/brokerGuideConfigs.js',
    );

    expect(source).toContain("import {useTokens} from '../../theme/useTokens'");
    expect(source).toContain("config.title || 'How to get your API key'");
    for (const broker of ['Zerodha', 'Dhan', 'AliceBlue', 'Axis Securities']) {
      expect(source).toContain(broker);
    }
  });

  test('device-TOTP chrome is themed but remains backend gated', () => {
    const sheet = read(
      'src/components/BrokerConnectionModal/BrokerConnectStepperSheet.js',
    );
    const dispatch = read(
      'src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js',
    );

    expect(sheet).toContain("import useTokens from '../../theme/useTokens'");
    expect(sheet).toContain('backgroundColor: colors.surface.base');
    expect(sheet).toContain('backgroundColor: colors.surface.elevated');
    expect(sheet).toContain('if (!deviceTotp?.enabled) return null');
    expect(dispatch).toContain('runtimeConfig?.deviceTotpEnabled === true');
  });
});
