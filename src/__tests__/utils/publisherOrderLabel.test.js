import {publisherOrderLabel} from '../../utils/publisherOrderLabel';
import {summarizeOrderStatuses} from '../../utils/orderStatusUtils';
test('completed fills and absent orders remain distinct', () => {
 const rows = [...Array(17).fill({orderStatus: 'COMPLETE'}), ...Array(3).fill({orderStatus: 'NOT_OBSERVED'})];
 expect(summarizeOrderStatuses(rows)).toMatchObject({successCount: 17, failureCount: 3, pendingCount: 0, unknownCount: 0});
 expect(publisherOrderLabel('NOT_OBSERVED')).toBe('NOT SENT');
 expect(publisherOrderLabel('AWAITING_BROKER')).toBe('VERIFYING WITH BROKER');
});
