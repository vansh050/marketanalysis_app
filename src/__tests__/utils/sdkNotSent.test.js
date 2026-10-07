import fs from 'fs';
import path from 'path';
import {throwIfSdkNotSent} from '../../utils/sdkNotSent';

describe('SDK not-sent results become the server 409', () => {
  test('a placed result passes through', () => {
    expect(() => throwIfSdkNotSent({status: 'success', rows: [{}]})).not.toThrow();
    expect(() => throwIfSdkNotSent(undefined)).not.toThrow();
  });

  test('MARKET_CLOSED is re-raised with the server reason', () => {
    let caught;
    try {
      throwIfSdkNotSent({
        status: 'not_sent', notSent: true, code: 'MARKET_CLOSED', rows: [],
        recovery: {reason: 'market_closed', message: 'The market is closed. No rebalance orders were sent.'},
      });
    } catch (error) {
      caught = error;
    }
    expect(caught.response.status).toBe(409);
    expect(caught.response.data).toMatchObject({
      code: 'MARKET_CLOSED', dispatchState: 'NOT_SENT', recompute: false,
      message: 'The market is closed. No rebalance orders were sent.',
    });
  });

  test('a drifted plan keeps the recompute contract', () => {
    expect(() => throwIfSdkNotSent({notSent: true, recovery: {reason: 'recalculate_required', code: 'PLAN_EXPIRED'}}))
      .toThrow(expect.objectContaining({response: expect.objectContaining({data: expect.objectContaining({recompute: true, code: 'PLAN_EXPIRED'})})}));
  });

  test('every SDK placement site checks for a not-sent result', () => {
    const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
    const count = (src, needle) => src.split(needle).length - 1;
    expect(count(read('components/ModelPortfolioComponents/MPReviewTradeModal.js'), 'throwIfSdkNotSent(sdkResult)')).toBe(2);
    expect(count(read('components/ModelPortfolioComponents/UserStrategySubscribeModal.js'), 'throwIfSdkNotSent(sdkResult)')).toBe(3);
    expect(count(read('screens/Rebalance/ExecutionStatusScreen.js'), 'throwIfSdkNotSent(sdkResult)')).toBe(1);
  });
});
