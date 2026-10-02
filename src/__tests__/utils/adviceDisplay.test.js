import {
  adviceHeaderLabel,
  isExitAdvice,
  isWithdrawnUnfilledEntry,
  orderTypeDisplay,
} from '../../utils/adviceDisplay';

describe('adviceDisplay', () => {
  describe('isExitAdvice', () => {
    it.each(['fullClose', 'FULLCLOSE', 'partialClose', ' partialclose '])(
      'identifies %s as an exit advice',
      closurestatus => {
        expect(isExitAdvice(closurestatus)).toBe(true);
      },
    );

    it.each([undefined, null, '', 'closed', 'expired'])(
      'does not identify %s as an actionable exit advice',
      closurestatus => {
        expect(isExitAdvice(closurestatus)).toBe(false);
      },
    );
  });

  describe('isWithdrawnUnfilledEntry', () => {
    it('removes an unfilled entry paired with a manager full-close', () => {
      const entry = {advice_reco_id: 'reco-1', Symbol: 'ABC-EQ', trade_place_status: 'recommend'};
      const exit = {advice_reco_id: 'reco-1', Symbol: 'ABC-EQ', closurestatus: 'fullClose'};
      expect(isWithdrawnUnfilledEntry(entry, [entry, exit])).toBe(true);
    });

    it('pairs a distinct exit delivery through sourceAdviceRecoId', () => {
      const entry = {advice_reco_id: 'entry-1', Symbol: 'ABC-EQ', trade_place_status: 'recommend'};
      const exit = {
        advice_reco_id: 'exit-1',
        sourceAdviceRecoId: 'entry-1',
        Symbol: 'ABC-EQ',
        closurestatus: 'fullClose',
      };
      expect(isWithdrawnUnfilledEntry(entry, [entry, exit])).toBe(true);
    });
  });

  it('keeps the existing order and header display helpers available', () => {
    expect(orderTypeDisplay('SL-M')).toBe('Stop Loss Market');
    expect(
      adviceHeaderLabel({action: 'SELL', stopLoss: 100, profitTarget: 120}),
    ).toBe('SELL with STOP LOSS & PROFIT TARGET');
  });
});
