import fs from 'fs';
import path from 'path';

// Pins the 2026-11-04 fallback: a device-TOTP DIRECT Zerodha attempt that the
// server refuses with PUBLISHER_ROUTE_REQUIRED (no own Kite app / no dedicated
// IP / dead token — refused before any broker call and before the plan is
// consumed) must continue to the Kite Publisher window, not dead-end on
// not-sent rows.
const source = fs.readFileSync(
  path.resolve(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
  'utf8',
);

describe('Zerodha direct → Publisher fallback', () => {
  test('direct attempt only returns early when the server did not route to Publisher', () => {
    expect(source).toMatch(
      /const directOutcome = await placeOrder\(\{zerodhaDirect: true\}\);\s*if \(!directOutcome\?\.routeToPublisher\) \{\s*return;\s*\}/,
    );
  });

  test('the refusal is detected before the not-sent rows branch, only for direct 409s', () => {
    const flag = source.indexOf('directRefusedRouteToPublisher = true;');
    const notSent = source.indexOf('const isDefinitivePreDispatchRefusal');
    expect(flag).toBeGreaterThan(0);
    expect(notSent).toBeGreaterThan(flag);
    const guard = source.slice(source.lastIndexOf('if (', flag), flag);
    expect(guard).toContain('options?.zerodhaDirect');
    expect(guard).toContain('error?.response?.status === 409');
    expect(guard).toContain("refusalCode === 'PUBLISHER_ROUTE_REQUIRED'");
  });

  test('placeOrder reports the routing decision to its caller', () => {
    expect(source).toMatch(
      /if \(directRefusedRouteToPublisher\) \{\s*return \{routeToPublisher: true\};\s*\}/,
    );
  });

  test('MARKET_CLOSED still shows not-sent rows (no Publisher fallback)', () => {
    expect(source).toMatch(/'MARKET_CLOSED',\s*'PUBLISHER_ROUTE_REQUIRED',/);
  });
});
