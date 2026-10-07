import fs from 'fs';
import path from 'path';

// moneyman / Fyers, 7 Oct 2026 15:30:56 IST: ccxt refused MARKET_CLOSED and the
// SDK returned {notSent: true, rows: []}. The Fyers branch padded the empty rows
// into five "Submission is not yet verified" legs, so it looked placed.
describe('Fyers placement refused before dispatch', () => {
  const modal = fs.readFileSync(
    path.resolve(__dirname, '../components/AdviceScreenComponents/RebalanceModal.js'),
    'utf8',
  );
  const fyers = modal.slice(
    modal.indexOf("SDK executeAdvice dual-path (Phase C) — Fyers publisher path."),
    modal.indexOf("console.error('[FyersPublisher] Error:', error);") + 3000,
  );

  test('an SDK not-sent result stops before padding pending legs', () => {
    const notSent = fyers.indexOf('if (sdkResult?.notSent === true) {');
    const padding = fyers.indexOf('includeUnconfirmedPublisherLegs(checkData, stockDetails)');
    expect(notSent).toBeGreaterThan(-1);
    expect(padding).toBeGreaterThan(notSent);
    expect(fyers).toContain("'Orders not placed'");
  });

  test('the legacy path explains MARKET_CLOSED and plan refusals with an Alert', () => {
    expect(fyers).toContain("error?.response?.data?.code === 'MARKET_CLOSED'");
    expect(fyers).toContain("planRefusalMessage(\n          error?.response?.data?.code,\n          'Fyers',");
    expect(modal).not.toContain("text1: 'Portfolio refreshed'");
  });
});
