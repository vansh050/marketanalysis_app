import {brokerConnectionPill} from '../../src/utils/nba/brokerConnectionPill';
import {BROKER_STATUS} from '../../src/utils/nba/brokerStatus';

describe('broker connection pill', () => {
  it('does not call stored credentials a live connection', () => {
    expect(brokerConnectionPill({brokerState: BROKER_STATUS.OK})).toEqual({
      tone: 'grey', label: 'Broker Linked',
    });
  });

  it('uses live only after a successful broker probe', () => {
    expect(brokerConnectionPill({
      brokerState: BROKER_STATUS.OK,
      liveVerified: true,
    })).toEqual({tone: 'green', label: 'Broker Live'});
  });

  it('shows a linked account blocker instead of connected', () => {
    expect(brokerConnectionPill({
      brokerState: BROKER_STATUS.OK,
      liveVerified: true,
      accountRecovery: {blocked: true},
    })).toEqual({tone: 'amber', label: 'Broker Linked · Check'});
  });
});
