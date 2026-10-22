import {stillCheckingZerodhaAlert} from '../utils/publisherOrderLabel';

describe('stillCheckingZerodhaAlert', () => {
  it('names the order that is still open in Kite', () => {
    const [title, body] = stillCheckingZerodhaAlert([
      {tradingSymbol: 'CROPSTER', transactionType: 'SELL', orderStatus: 'OPEN'},
    ]);
    expect(title).toBe('Order still open in Kite');
    expect(body).toMatch(/CROPSTER sell order is still open in Kite/);
    expect(body).toMatch(/Nothing was retried/);
  });

  it('does not call an unconfirmed or finished leg open', () => {
    const [title] = stillCheckingZerodhaAlert([
      {tradingSymbol: 'TCS', transactionType: 'BUY', orderStatus: 'AWAITING_BROKER'},
      {tradingSymbol: 'INFY', transactionType: 'BUY', orderStatus: 'COMPLETE'},
      {tradingSymbol: 'SBIN', transactionType: 'BUY', orderStatus: ''},
    ]);
    expect(title).toBe('Still checking Zerodha');
  });
});
