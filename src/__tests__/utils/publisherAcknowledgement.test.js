import {isPublisherActivationAcknowledged} from '../../utils/publisherAcknowledgement';

test('opens only after successful durable activation', () => {
  const ready = {status: 0, recorded: true, reconciliationEnrolled: true};
  expect(isPublisherActivationAcknowledged(ready)).toBe(true);
  expect(isPublisherActivationAcknowledged({...ready, allowExecution: false})).toBe(false);
  expect(isPublisherActivationAcknowledged({...ready, status: 1})).toBe(false);
  expect(isPublisherActivationAcknowledged({...ready, reconciliationEnrolled: false})).toBe(false);
  expect(isPublisherActivationAcknowledged(undefined)).toBe(false);
});
