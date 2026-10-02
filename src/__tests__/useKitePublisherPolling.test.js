/**
 * Whole-basket settlement rule (2026-09-18).
 *
 * Before this change the hook settled on the FIRST new order it saw, and every
 * consumer closes the Kite WebView when the hook settles. Kite submits basket
 * items one at a time, so the WebView was torn down while the remaining legs
 * were still queued there — prod/arulthakur's 7-leg basket reached Zerodha as
 * two orders. See
 * docs/server_issues/2026-09-17-arul-zerodha-orders-unknown-orphan-rows.md.
 *
 * `start({ expectedOrderCount })` makes the hook wait for the whole basket;
 * omitting it keeps the legacy first-order behaviour for callers that cannot
 * count their legs.
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import {act, create} from 'react-test-renderer';
import {fetchOrderBook} from '../services/BrokerOrderBookAPI';
import useKitePublisherPolling from '../hooks/useKitePublisherPolling';
import {PUBLISHER_POLL_CONFIG} from '../utils/brokerPublisher';

const {POLL_INTERVAL_MS, POLL_TIMEOUT_MS} = PUBLISHER_POLL_CONFIG;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../services/BrokerOrderBookAPI', () => ({
  fetchOrderBook: jest.fn(),
}));
jest.mock('../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.example/'},
    ccxtServer: {baseUrl: 'https://ccxt.example/'},
    websocket: {baseUrl: 'https://websocket.example/'},
  },
}));
jest.mock('../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'test-token'),
}));
jest.mock('../utils/accountEmail', () => ({
  getEmailAsync: jest.fn(async () => 'test@example.com'),
  getAccountEmailAsync: jest.fn(async () => 'test@example.com'),
}));
jest.mock('../utils/variantHelper', () => ({
  getTenantSubdomain: () => 'test',
  getAdvisorSubdomain: () => 'test',
}));

let orderBook = [];
let api = null;

const Harness = ({onSettled}) => {
  api = useKitePublisherPolling({
    broker: 'Zerodha',
    brokerCreds: {},
    configData: {},
    onPublisherSettled: onSettled,
  });
  return null;
};

const mount = async onSettled => {
  await act(async () => {
    create(React.createElement(Harness, {onSettled}));
  });
};

const startPolling = async (options = {}) => {
  await act(async () => {
    await api.start(options);
  });
};

const advance = async (ms = POLL_INTERVAL_MS) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe('useKitePublisherPolling whole-basket settlement', () => {
  let settlements;

  beforeEach(() => {
    jest.useFakeTimers();
    orderBook = [];
    api = null;
    settlements = [];
    fetchOrderBook.mockImplementation(async () => ({
      data: orderBook.map(orderId => ({orderId, orderStatus: 'COMPLETE'})),
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('waits for the whole basket instead of settling on the first order', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling({expectedOrderCount: 3});

    orderBook = ['A'];
    await advance();
    expect(settlements).toEqual([]);

    orderBook = ['A', 'B'];
    await advance();
    expect(settlements).toEqual([]);

    orderBook = ['A', 'B', 'C'];
    await advance();
    expect(settlements).toHaveLength(1);
    expect(settlements[0].reason).toBe('orders-detected');
    expect(settlements[0].newOrders).toHaveLength(3);
  });

  test('keeps the legacy first-order behaviour when no count is supplied', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling();

    orderBook = ['A'];
    await advance();

    expect(settlements).toHaveLength(1);
    expect(settlements[0].reason).toBe('orders-detected');
  });

  test('ignores a non-positive count and falls back to the legacy behaviour', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling({expectedOrderCount: 0});

    orderBook = ['A'];
    await advance();

    expect(settlements).toHaveLength(1);
    expect(settlements[0].reason).toBe('orders-detected');
  });

  test('settles as unconfirmed on the timeout when the basket never completes', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling({expectedOrderCount: 3});

    orderBook = ['A'];
    await advance();
    expect(settlements).toEqual([]);

    await advance(POLL_TIMEOUT_MS);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].reason).toBe('timeout');
    // A partial basket reports what did reach the broker; the reason stays
    // `timeout` so resolvePublisherSettlement cannot promote it to success.
    expect(settlements[0].newOrders.map(order => order.orderId)).toEqual(['A']);
  });

  test('reports no orders on the timeout when nothing was ever detected', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling({expectedOrderCount: 2});

    await advance(POLL_TIMEOUT_MS);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].reason).toBe('timeout');
    expect(settlements[0].newOrders).toEqual([]);
  });

  test('stops polling once the basket has settled', async () => {
    await mount(settlement => settlements.push(settlement));
    await startPolling({expectedOrderCount: 1});

    orderBook = ['A'];
    await advance();
    expect(settlements).toHaveLength(1);

    orderBook = ['A', 'B'];
    await advance(POLL_INTERVAL_MS * 3);

    expect(settlements).toHaveLength(1);
  });
});

/**
 * The rule only holds if every consumer tells the hook how many legs it is
 * about to submit. A modal that opens the Kite basket without the count
 * silently reverts to first-order settlement, which is the defect above.
 */
describe('useKitePublisherPolling callers', () => {
  const callers = [
    'src/components/AdviceScreenComponents/RebalanceModal.js',
    'src/components/ModelPortfolioComponents/MPReviewTradeModal.js',
    'src/components/ReviewZerodhaTradeModal.js',
  ];

  test.each(callers)('%s passes the basket size to start()', relative => {
    const source = fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
    expect(source).toMatch(/start(Order|Kite)Polling\(\s*\{[^}]*expectedOrderCount:/);
  });
});
