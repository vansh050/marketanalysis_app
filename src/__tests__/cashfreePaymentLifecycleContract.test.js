const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const readAndroidSource = fileName => {
  const find = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = find(absolute);
        if (nested) return nested;
      } else if (entry.name === fileName) {
        return absolute;
      }
    }
    return null;
  };
  const file = find(path.join(process.cwd(), 'android/app/src/main/java'));
  if (!file) throw new Error(`Could not find Android source ${fileName}`);
  return fs.readFileSync(file, 'utf8');
};

describe('Cashfree native payment lifecycle', () => {
  const modalSource = read(
    'src/components/ModelPortfolioComponents/MPInvestNowModal.js',
  );

  test('success is gated on durable server completion', () => {
    expect(modalSource).toContain('await completionTask();\n      await clearPendingPayment();');
    expect(modalSource).toContain('await runCashfreeCompletion(\n              `one_time:${orderId}`');
    expect(modalSource).toContain('await runCashfreeCompletion(\n              `recurring:${subscriptionId}`');
  });

  test('recurring completion errors do not close the modal', () => {
    const recurringCompletion = modalSource
      .split('const handlePaymentComplete = async')[1]
      .split('const runCashfreeCompletion = async')[0];

    expect(recurringCompletion).not.toContain('onClose()');
    expect(recurringCompletion).not.toContain('clearPendingPayment()');
    expect(recurringCompletion).not.toContain('handlePaymentSuccessWithTelegram()');
  });

  test('Android recreation delegates recovery to durable JS state', () => {
    const activity = readAndroidSource('MainActivity.kt');
    expect(activity).toContain('override fun onCreate(savedInstanceState: Bundle?)');
    expect(activity).toContain('super.onCreate(null)');
  });
});
