import fs from 'fs';
import path from 'path';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('broker recovery contracts', () => {
  test('Kotak does not overwrite a validated session with pre-login form data', () => {
    const source = read('src/components/BrokerConnectionModal/KotakModal.js');
    expect(source).not.toContain("sdkConnectBroker(sdkBridge.client, 'Kotak', data)");
    expect(source).toContain('Do not dual-write Kotak');
  });

  test('manual portal authorization returns to review without placing an order', () => {
    const source = read('src/components/DdpiModal.js');
    const start = source.indexOf('const handleContinue = async () =>');
    const end = source.indexOf('const handleClose = () =>', start);
    const handler = source.slice(start, end);

    expect(handler).toContain('if (onContinue) await onContinue()');
    expect(handler).toContain('if (openReviewModal) openReviewModal()');
    expect(handler).not.toMatch(/placeOrder|process-trade/);
  });

  test('Groww TPIN instructions use the direct authorization page and say it does not sell', () => {
    const source = read('src/components/DdpiModal.js');
    expect(source).toContain('https://groww.in/holdings/cdslauth');
    expect(source).toContain('This authorizes holdings; it does not sell them.');
  });
});
