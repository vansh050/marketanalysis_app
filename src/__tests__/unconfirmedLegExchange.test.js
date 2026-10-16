import {includeUnconfirmedPublisherLegs} from '../utils/publisherCompletionAuthority';

describe('includeUnconfirmedPublisherLegs exchange matching (Fyers 2026-10-05)', () => {
  it('does not add a phantom leg when the broker reports the other exchange', () => {
    const rows = [{symbol: 'PATELENG', transactionType: 'SELL', exchange: 'BSE', orderStatus: 'COMPLETE'}];
    const approved = [{symbol: 'PATELENG', transactionType: 'SELL', exchange: 'NSE'}];
    expect(includeUnconfirmedPublisherLegs(rows, approved)).toHaveLength(1);
  });
  it('still flags a missing leg when the plan has the stock on both exchanges', () => {
    const rows = [{symbol: 'ABC', transactionType: 'SELL', exchange: 'BSE', orderStatus: 'COMPLETE'}];
    const approved = [
      {symbol: 'ABC', transactionType: 'SELL', exchange: 'NSE'},
      {symbol: 'ABC', transactionType: 'SELL', exchange: 'BSE'},
    ];
    const out = includeUnconfirmedPublisherLegs(rows, approved);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({exchange: 'NSE', orderStatus: 'PENDING_CONFIRMATION'});
  });
  it('still flags a genuinely missing leg', () => {
    const out = includeUnconfirmedPublisherLegs([], [{symbol: 'XYZ', transactionType: 'BUY', exchange: 'NSE'}]);
    expect(out[0].orderStatus).toBe('PENDING_CONFIRMATION');
  });
});
