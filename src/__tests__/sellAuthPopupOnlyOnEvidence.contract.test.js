/**
 * A rejected SELL opens the sell-authorization sheet only when the backend
 * classified the rejection as sell authorization (2026-10-19).
 *
 * Groww rejected two sells for a circuit-band breach ("Rms:rule: check
 * circuit limit ... circuit breach"). The app opened "Sell Authorization
 * Required" for ANY rejected sell on a non-Fyers broker, so the customer
 * authorized, recalculated, hit the same circuit rejection, and looped —
 * while six other sells in the same basket had filled, proving the
 * authorization was fine. The backend already classifies real sell-auth
 * failures (`classify_rejection` + `_stamp_portal_sell_auth_failure`);
 * web UpdateRebalanceModal already gates on that signal.
 */
const fs = require('fs');
const path = require('path');
import {hasExplicitSellAuthRejection} from '../utils/sellAuthMessage';

const rebalance = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'components',
    'AdviceScreenComponents',
    'RebalanceModal.js',
  ),
  'utf8',
);

// The post-placement routing: from the classification read to the
// db-update that follows the result screen.
const routing = rebalance.slice(
  rebalance.indexOf('const sellAuthRejected = hasExplicitSellAuthRejection({'),
  rebalance.indexOf('api/model-portfolio-db-update`,\n          updateData'),
);

describe('rejected sells open the sell-auth sheet only on backend evidence', () => {
  test('routing slice was found', () => {
    expect(routing.length).toBeGreaterThan(1000);
  });

  test('no broker opens the sheet for an unclassified rejected sell', () => {
    expect(routing).not.toContain("broker !== 'Fyers' || sellAuthRejected");
    expect(routing).toMatch(
      /rejectedSellCount >= 1 &&\s*sellAuthRejected\s*\)/,
    );
  });

  test('portal brokers (Groww, Upstox, ...) need evidence too', () => {
    expect(routing).toMatch(
      /successCount === 0 &&\s*sellAuthRejected\s*\)\s*\{\s*setShowOtherBrokerModel\(true\)/,
    );
  });

  test('a Groww circuit-band rejection is not sell-auth evidence', () => {
    const rows = [
      {
        symbol: 'SYNCOMF-EQ',
        transactionType: 'SELL',
        orderStatus: 'COMPLETE',
        filledShares: 1,
      },
      {
        symbol: 'CROPSTER',
        transactionType: 'SELL',
        orderStatus: 'REJECTED',
        filledShares: 0,
        classification: null,
        message_aq:
          'Rms:rule: check circuit limit including square off order exceeds : circuit breach, order price :1.70,  low price range:1.72 high price range:1.90',
      },
    ];
    expect(hasExplicitSellAuthRejection({results: rows})).toBe(false);
  });

  test('a backend-stamped sell-auth failure still opens the sheet', () => {
    const rows = [
      {
        symbol: 'CROPSTER',
        transactionType: 'SELL',
        orderStatus: 'REJECTED',
        classification: 'SELL_AUTH_REQUIRED',
        sell_auth_required: true,
      },
    ];
    expect(hasExplicitSellAuthRejection({results: rows})).toBe(true);
  });
});
