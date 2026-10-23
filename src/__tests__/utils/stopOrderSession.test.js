// SL orders are rejected during exchange call auctions (Zerodha, prod
// testaccount, 2026-10-23 15:15:10 IST: "Stop-loss orders not allowed in the
// current session."). The app warns before sending.
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));
const {Alert} = require('react-native');
const {
  activeStopOrderAuctionWindow,
  stopOrderSessionWarning,
  confirmStopOrderSession,
} = require('../../utils/stopOrderSession');

// Build a Date for an IST wall-clock time (IST = UTC+5:30).
const ist = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h, mi) - 330 * 60 * 1000);
const FRI = [2026, 10, 23];
const sl = {tradingSymbol: 'IDEA-EQ', orderType: 'SL', transactionType: 'BUY'};

describe('activeStopOrderAuctionWindow (IST)', () => {
  it.each([
    ['09:00', 9, 0, true], ['09:07', 9, 7, true], ['09:08', 9, 8, false],
    ['15:14', 15, 14, false], ['15:15', 15, 15, true], ['15:34', 15, 34, true],
    ['15:35', 15, 35, false], ['12:00', 12, 0, false],
  ])('%s -> %s', (_, h, m, expected) => {
    expect(Boolean(activeStopOrderAuctionWindow(ist(...FRI, h, m)))).toBe(expected);
  });

  it('never on a weekend', () => {
    expect(activeStopOrderAuctionWindow(ist(2026, 10, 24, 15, 20))).toBeNull();
  });
});

describe('stopOrderSessionWarning', () => {
  it('names the SL leg during the closing auction', () => {
    const msg = stopOrderSessionWarning([sl], ist(...FRI, 15, 17));
    expect(msg).toMatch(/^IDEA is a stop-loss order/);
    expect(msg).toMatch(/closing auction \(3:15–3:35 PM\)/);
    expect(msg).toMatch(/next trading day/);
  });

  it('ignores market and limit legs', () => {
    expect(stopOrderSessionWarning(
      [{tradingSymbol: 'HCC-EQ', orderType: 'LIMIT'}, {tradingSymbol: 'X', orderType: 'MARKET'}],
      ist(...FRI, 15, 17))).toBeNull();
  });

  it('is silent outside the auction windows', () => {
    expect(stopOrderSessionWarning([sl], ist(...FRI, 11, 24))).toBeNull();
  });

  it('accepts SL-M and lowercase', () => {
    expect(stopOrderSessionWarning([{symbol: 'A', orderType: 'sl-m'}], ist(...FRI, 9, 3))).toMatch(/pre-open/);
  });
});

describe('confirmStopOrderSession', () => {
  beforeEach(() => Alert.alert.mockReset());

  it('resolves true without prompting when nothing to warn', async () => {
    await expect(confirmStopOrderSession([sl], ist(...FRI, 11, 0))).resolves.toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each([['Cancel', false], ['Place anyway', true]])('%s -> %s', async (label, expected) => {
    Alert.alert.mockImplementation((t, m, buttons) => buttons.find(b => b.text === label).onPress());
    await expect(confirmStopOrderSession([sl], ist(...FRI, 15, 20))).resolves.toBe(expected);
  });
});
