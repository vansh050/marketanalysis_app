import fs from 'fs';
import path from 'path';

const read = relative =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('broker-scoped model portfolio readiness', () => {
  const screen = read('designs/default/screens/AfterSubscriptionScreen.js');

  test('investment changes wait for broker identity and portfolio loading', () => {
    expect(screen).toContain(
      'disabled={portfolioLoading || !userDetails?.user_broker}',
    );
  });

  test('missing target data is not presented as an entitlement failure', () => {
    const targetScene = screen.slice(
      screen.indexOf("case 'portfolio'"),
      screen.indexOf("case 'methodology'"),
    );
    expect(targetScene).toContain('Target Allocation Not Available');
    expect(targetScene).not.toContain('Premium Access Required');
  });
});
