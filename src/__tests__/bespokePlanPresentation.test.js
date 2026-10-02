const fs = require('fs');

describe('bespoke plan presentation source', () => {
  const source = fs.readFileSync(
    'designs/default/screens/BespokePerformanceScreen.js',
    'utf8',
  );

  test('prefers the selected Plan over sparse strategy metadata', () => {
    expect(source).toContain(
      'const planPresentation = specificPlan || planDetails || strategyDetails || {};',
    );
  });

  test('uses the authoritative Plan presentation for the logo and content', () => {
    expect(source).toContain('planPresentation?.image');
    expect(source).toContain('resolveImageUrl(planPresentation.image, serverBaseUrl)');
    expect(source.match(/const planDoc = planPresentation;/g)).toHaveLength(2);
    expect(source).not.toContain('strategyDetails?.image');
  });
});
