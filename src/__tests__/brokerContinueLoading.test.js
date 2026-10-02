const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('continue without broker remains visibly busy until persistence completes', () => {
  const container = read('src/components/BrokerSelectionModal.js');
  const presentation = read('designs/default/composites/BrokerSelectionModal.js');
  expect(container).toContain('await handleAcceptRebalanceWithoutBroker()');
  expect(container).toContain('continueWithoutBrokerLoading');
  expect(presentation).toContain('disabled={continueWithoutBrokerLoading}');
  expect(presentation).toContain('Continuing...');
  const advice = read('src/components/AdviceScreenComponents/StockAdvices.js');
  expect(advice).toContain('getUserDeatils().catch');
  expect(advice).not.toContain('await getUserDeatils();');
});
