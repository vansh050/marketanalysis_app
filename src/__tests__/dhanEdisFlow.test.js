const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Dhan EDIS completion handoff', () => {
  test('refreshes live broker status before reopening review', () => {
    const modal = read('src/components/DdpiModal.js');
    const dhanModal = modal.slice(
      modal.indexOf('export function DhanTpinModal'),
      modal.indexOf('export function OtherBrokerModel'),
    );

    expect(dhanModal).toContain('for (let attempt = 0; attempt < 5; attempt += 1)');
    expect(dhanModal).toContain('onEdisStatusRefresh(response.data)');
    expect(dhanModal).toContain('isDhanSellAuthorizationReady(refreshedStatus, selectedSellTrades)');
    expect(dhanModal).toContain('Verify authorization and review orders');
    expect(dhanModal).not.toContain('<Text style={styles.buttonText}>Retry Order</Text>');
  });

  test.each([
    'src/components/AdviceScreenComponents/RebalanceAdviceContent.js',
    'src/components/AdviceScreenComponents/AddtoCartModal.js',
    'src/components/AdviceScreenComponents/StockAdvices.js',
    'src/screens/Drawer/MPPerformanceScreen.js',
  ])('%s lifts refreshed status into its parent', file => {
    expect(read(file)).toContain('onEdisStatusRefresh={setDhanEdisStatus}');
  });

  test.each([
    'src/components/AdviceScreenComponents/RebalanceModal.js',
    'src/components/ModelPortfolioComponents/MPReviewTradeModal.js',
    'src/components/AdviceScreenComponents/AddtoCartModal.js',
    'src/components/AdviceScreenComponents/StockAdvices.js',
  ])('%s uses selected-trade authorization', file => {
    const source = read(file);
    expect(source).toContain('isDhanSellAuthorizationReady');
    expect(source).not.toMatch(/dhanEdisStatus[^\n]*\.every\(/);
  });
});
