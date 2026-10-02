import fs from 'fs';
import path from 'path';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Fyers broker-evidence-first sell authorization', () => {
  const rebalance = read(
    'src/components/AdviceScreenComponents/RebalanceModal.js',
  );
  const stockAdvices = read(
    'src/components/AdviceScreenComponents/StockAdvices.js',
  );
  const cart = read(
    'src/components/AdviceScreenComponents/AddtoCartModal.js',
  );
  const mpReview = read(
    'src/components/ModelPortfolioComponents/MPReviewTradeModal.js',
  );
  const ddpiModal = read('src/components/DdpiModal.js');

  test('Fyers has no cached-flag pre-order gate in rebalance', () => {
    expect(rebalance).not.toContain('Pre-order EDIS check for Fyers broker');
    expect(rebalance).toContain("broker !== 'Fyers' && getUserDeatils");
  });

  test('every direct-order surface consumes the strict backend predicate', () => {
    for (const source of [rebalance, stockAdvices, cart, mpReview]) {
      expect(source).toContain('hasExplicitSellAuthRejection');
    }
  });

  test('Fyers CDSL HTML uses the app-root browser and hides native sheets', () => {
    const start = ddpiModal.indexOf('export function FyersTpinModal');
    const source = ddpiModal.slice(start);
    expect(source).toContain(
      'visible={isOpen && !isWebViewOpen && !showTpinConfirmation}',
    );
    expect(source).toContain('<PublisherWebViewOverlay');
    expect(source).toContain('source={{html: webViewHtml}}');
  });
});
