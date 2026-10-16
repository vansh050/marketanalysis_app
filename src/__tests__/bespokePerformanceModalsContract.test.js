/**
 * The bespoke plan detail presentation exports its payment / order /
 * subscribe modal block so variant designs (Kyzen) render the same
 * money-path wiring instead of re-implementing it.
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../designs/default/screens/BespokePerformanceScreen.js'), 'utf8');

test('exports the shared prop resolver, modal block and plan sections helper', () => {
  expect(src).toContain('export const resolveBespokeProps = (viewModel, actions, slots) =>');
  expect(src).toContain('export const BespokePerformanceModals = ({ viewModel, actions, slots }) =>');
  expect(src).toContain('export const bespokePlanSections = (plan) =>');
});

test('the default screen renders its modals through the shared block', () => {
  expect(src).toContain('<BespokePerformanceModals viewModel={viewModel} actions={actions} slots={slots} />');
  // The block is defined once: MPInvestNowModal is rendered in exactly one place.
  expect(src.match(/<MPInvestNowModal/g)).toHaveLength(1);
});

test('bespokePlanSections normalises admin data shapes', () => {
  // Evaluate the helper in isolation (the screen module needs native deps).
  const body = src.slice(src.indexOf('export const bespokePlanSections'));
  const fnSrc = body.slice(0, body.indexOf('\n};\n') + 3).replace('export const bespokePlanSections =', 'return');
  // eslint-disable-next-line no-new-func
  const sections = new Function(fnSrc)();
  expect(sections({keyFeature: [{label: 'A'}, null, {}], keyBenefit: ['x', 'y'], investmentManagement: ' im '})).toEqual({
    features: [{label: 'A'}], benefits: 'x\ny', investmentManagement: 'im', researchInvestment: '',
  });
  expect(sections({keyFeature: 'oops', keyBenefit: 7})).toMatchObject({features: [], benefits: ''});
});

test('the modal block never hands the investment modal a null plan', () => {
  const block = src.slice(src.indexOf('export const BespokePerformanceModals'), src.indexOf('export const bespokePlanSections'));
  expect(block).toContain('const planDetails = vm.planDetails || specificPlan || null;');
  expect(block).toContain('plans={planDetails}');
});
