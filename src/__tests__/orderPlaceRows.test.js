/**
 * 2026-10-12: Node /order-place returns rows as `response` (and since
 * aq_backend 2fcca2eb also as `results`). Reading only `results` showed every
 * filled single-stock order as "No Orders Placed".
 */
import fs from 'fs';
import path from 'path';
import {orderPlaceRows, withOrderPlaceResults} from '../utils/orderPlaceRows';

const row = {orderId: '26101200011861', orderStatus: 'COMPLETE'};
const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('reads the real Node reply shape (`response`)', () => {
  expect(orderPlaceRows({response: [row], testMode: false})).toEqual([row]);
});
test('prefers `results` when present, empty otherwise', () => {
  expect(orderPlaceRows({results: [row], response: []})).toEqual([row]);
  expect(orderPlaceRows({})).toEqual([]);
  expect(orderPlaceRows(null)).toEqual([]);
});
test('withOrderPlaceResults guarantees `results` for legacy callers', () => {
  expect(withOrderPlaceResults({response: [row]}).results).toEqual([row]);
});
test('every app reader of /order-place goes through the helper', () => {
  expect(read('src/components/AdviceScreenComponents/StockAdvices.js'))
    .toContain('placementResults = orderPlaceRows(response.data);');
  expect(read('src/screens/Drawer/IgnoreTradesScreen.js'))
    .toContain('placementResults = orderPlaceRows(response.data);');
  expect(read('src/services/OrderService.js'))
    .toContain('return withOrderPlaceResults(response.data);');
  for (const f of ['src/components/AdviceScreenComponents/StockAdvices.js', 'src/screens/Drawer/IgnoreTradesScreen.js']) {
    expect(read(f)).not.toContain('placementResults = response.data?.results || [];');
  }
});
