/**
 * The Invest Now disclaimer hardcoded one advisor's name, SEBI number
 * (INH000016588) and website for every tenant until 2026-10-16. It must name
 * the current advisor from config, and never fall back to someone else.
 */
const fs = require('fs');
const path = require('path');

jest.mock('../context/ConfigContext', () => ({ useConfig: () => ({}) }));
jest.mock('../design/literalTokens', () => ({
  designColor: () => '#000',
  designFont: (f) => f,
}));
jest.mock('lucide-react-native', () => ({ XIcon: () => null }));

const { buildDisclaimerPoints } = require('../components/ModelPortfolioComponents/DisclaimerModal');

describe('DisclaimerModal advisor identity', () => {
  test('names the configured advisor and registration', () => {
    const points = buildDisclaimerPoints({ advisorName: 'Kyzen Research', sebiRaNumber: 'INH000025780' });
    expect(points[0]).toBe('Kyzen Research is registered with SEBI as a Research Analyst, Registration No. INH000025780.');
  });

  test('omits the registration line when none is configured', () => {
    const points = buildDisclaimerPoints({ advisorName: 'Acme', sebiRaNumber: null });
    expect(points.some((p) => /Registration No\./.test(p))).toBe(false);
  });

  test('no other advisor identity is left in the file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/ModelPortfolioComponents/DisclaimerModal.js'),
      'utf8',
    );
    const body = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(body).not.toMatch(/Alireza|Magnus|hathway|INH000016588/i);
  });
});
