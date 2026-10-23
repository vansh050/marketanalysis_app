// A Zerodha record-back that finds no order must not leave the customer on
// "Awaiting Broker Confirmation" forever (prod testaccount, ALOKINDS SL BUY,
// 2026-10-23 15:17 IST: Kite never created the order, the card never cleared).
const fs = require('fs');
const path = require('path');
import {
  ZERODHA_PUBLISHER_RETRY_GUARD_MS,
  ZERODHA_NOT_PLACED_MESSAGE,
  buildUnconfirmedPublisherResults,
  resolvePublisherNotFound,
  sanitizePublisherRecordResults,
} from '../../utils/publisherOutcome';

const created = Date.UTC(2026, 9, 23, 9, 47, 0);
const notFound = {tradingSymbol: 'ALOKINDS-EQ', orderStatus: 'order_not_found', orderId: ''};

describe('resolvePublisherNotFound', () => {
  it('turns a verified absence past the retry guard into NOT SENT', () => {
    const [row] = resolvePublisherNotFound([notFound], {
      attemptCreatedAt: created,
      now: created + ZERODHA_PUBLISHER_RETRY_GUARD_MS,
    });
    expect(row.orderStatus).toBe('NOT_OBSERVED');
    expect(row.orderStatusMessage).toBe(ZERODHA_NOT_PLACED_MESSAGE);
  });

  it('keeps it pending inside the guard and says when retry opens', () => {
    const [row] = resolvePublisherNotFound([notFound], {
      attemptCreatedAt: created,
      now: created + 60 * 1000,
    });
    expect(row.orderStatus).toBe('pending');
    expect(row.orderStatusMessage).toMatch(/no record of this order yet/);
    expect(row.orderStatusMessage).toMatch(/place it again after \d{1,2}:\d{2} (AM|PM)/);
    expect(row.attemptCreatedAt).toBe(created);
  });

  it('fails safe: no attempt time means it stays pending', () => {
    const [row] = resolvePublisherNotFound([notFound], {now: created + 10 * 60 * 1000});
    expect(row.orderStatus).toBe('pending');
  });

  it('prefers the row\'s own attempt time', () => {
    const [row] = resolvePublisherNotFound([{...notFound, attemptCreatedAt: created}], {
      attemptCreatedAt: created + 60 * 60 * 1000,
      now: created + ZERODHA_PUBLISHER_RETRY_GUARD_MS + 1,
    });
    expect(row.orderStatus).toBe('NOT_OBSERVED');
  });

  it('leaves rows the server found untouched', () => {
    const found = {tradingSymbol: 'IDEA-EQ', orderStatus: 'COMPLETE', orderId: '261023'};
    expect(resolvePublisherNotFound([found], {attemptCreatedAt: 0, now: 1e15})[0]).toBe(found);
  });
});

describe('unconfirmed rows carry their attempt', () => {
  const attempt = {attemptId: 'mobile-1', createdAt: created};

  it('buildUnconfirmedPublisherResults stamps attemptId and attemptCreatedAt', () => {
    const [row] = buildUnconfirmedPublisherResults(
      [{tradingSymbol: 'ALOKINDS-EQ', quantity: 1}], 'msg', attempt);
    expect(row).toMatchObject({orderStatus: 'pending', attemptId: 'mobile-1', attemptCreatedAt: created});
  });

  it('sanitizePublisherRecordResults stamps them too', () => {
    const [row] = sanitizePublisherRecordResults([notFound], 'msg', attempt);
    expect(row).toMatchObject({orderStatus: 'pending', attemptId: 'mobile-1', attemptCreatedAt: created});
  });

  it('without an attempt the shape is unchanged', () => {
    const [row] = buildUnconfirmedPublisherResults([{tradingSymbol: 'X'}], 'msg');
    expect(row.attemptId).toBeUndefined();
    expect(row.attemptCreatedAt).toBeUndefined();
  });
});

describe('manual Refresh never claims a Kite success', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../components/ModelPortfolioComponents/RecommendationSuccessModal.js'),
    'utf8',
  );
  it('sends status unknown for manual_refresh', () => {
    expect(src).toMatch(/publisherResults: \[\{status: 'unknown', source: 'manual_refresh'\}\]/);
    expect(src).not.toMatch(/status: 'success', source: 'manual_refresh'/);
  });
});
