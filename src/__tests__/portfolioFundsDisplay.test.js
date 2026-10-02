import fs from 'fs';
import path from 'path';

const read = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('portfolio funds display', () => {
  test('passes the fetched broker cash value into the portfolio presentation', () => {
    const container = read('src/screens/PortfolioScreen/PortfolioScreen.js');
    const presentation = read('designs/default/screens/PortfolioScreen.js');
    expect(container).toContain('availableCash:');
    expect(container).toContain('Number(funds.availablecash)');
    expect(presentation).toContain('availableCash={availableCash}');
  });

  test('shows a verified amount or an explicit unavailable state', () => {
    const card = read('src/screens/PortfolioScreen/PortFolioCard.js');
    expect(card).toContain("{'\\n'}Available cash:");
    expect(card).toContain("? `₹ ${formatDisplayedMoney(availableCash)}`");
    expect(card).toContain(": 'Unavailable'");
  });
});
