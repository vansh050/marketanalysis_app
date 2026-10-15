import {heldBuysTitle, heldBuysBody} from '../../utils/heldBuys';

describe('held post-sell buys wording', () => {
  it('names the held count and never claims alignment or submission', () => {
    const held = {count: 6, reason: 'held', message: ''};
    expect(heldBuysTitle(held)).toBe('6 buy orders not placed yet');
    const body = heldBuysBody(held);
    expect(body).toMatch(/not sent to your broker/);
    expect(body).toMatch(/Repair Portfolio/);
    expect(`${heldBuysTitle(held)} ${body}`).not.toMatch(/aligned|submitted/i);
  });

  it('appends the server explanation when one is given', () => {
    const body = heldBuysBody({count: 1, reason: 'held', message: '0 of 1 orders can be placed now.'});
    expect(body).toMatch(/the 1 remaining buy order were|the 1 remaining buy order/);
    expect(body).toMatch(/0 of 1 orders can be placed now\.$/);
  });

  it('describes unverified funds separately', () => {
    const held = {count: 2, reason: 'unverified'};
    expect(heldBuysTitle(held)).toBe('Buying power is still being verified');
    expect(heldBuysBody(held)).toMatch(/could not confirm your available funds/);
  });
});
