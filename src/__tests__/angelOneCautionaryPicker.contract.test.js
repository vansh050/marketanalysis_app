const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');

describe('Angel One picker interstitial contract', () => {
  const container = read('src/components/BrokerSelectionModal.js');
  const warning = read(
    'src/components/BrokerConnectionModal/AngelOneCautionaryWarning.js',
  );

  test('the picker-controlled warning can acknowledge and cancel', () => {
    expect(container).toContain('visible={!!pendingAngelOneBroker}');
    expect(warning).toContain("const controlled = typeof onAck === 'function'");
    expect(warning).toContain('onPress={() => controlled ? onAck() : setAcked(true)}');
    expect(warning).toContain('const close = onCancel || onClose');
  });

  test('acknowledgement dispatches the selected broker modal', () => {
    expect(container).toContain('openModal(broker.key)');
  });
});
