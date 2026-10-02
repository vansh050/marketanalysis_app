/**
 * Connection warm-up (2026-10-02): bounded, foreground-only, read-only.
 */
jest.mock('axios', () => ({get: jest.fn(() => Promise.resolve({}))}));
jest.mock('../utils/serverConfig', () => ({ccxtServer: {baseUrl: 'https://ccxt.test/'}}));

import React from 'react';
import {AppState} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import axios from 'axios';
import useConnectionWarmup, {WARMUP_INTERVAL_MS} from '../hooks/useConnectionWarmup';

let appStateListener;

beforeEach(() => {
  jest.useFakeTimers();
  axios.get.mockClear();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    appStateListener = cb;
    return {remove: jest.fn()};
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const Probe = ({enabled}) => {
  useConnectionWarmup(enabled);
  return null;
};

test('pings once on enable, then every 5 minutes, only /health/live', () => {
  let r;
  act(() => { r = TestRenderer.create(<Probe enabled />); });
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.get.mock.calls[0][0]).toBe('https://ccxt.test/health/live');
  act(() => { jest.advanceTimersByTime(WARMUP_INTERVAL_MS - 1000); });
  expect(axios.get).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(1000); });
  expect(axios.get).toHaveBeenCalledTimes(2);
  act(() => { r.unmount(); });
  act(() => { jest.advanceTimersByTime(WARMUP_INTERVAL_MS * 3); });
  expect(axios.get).toHaveBeenCalledTimes(2); // stops when unmounted
});

test('never pings while disabled or in the background, and not twice within a minute', () => {
  act(() => { TestRenderer.create(<Probe enabled={false} />); });
  act(() => { jest.advanceTimersByTime(WARMUP_INTERVAL_MS * 2); });
  expect(axios.get).not.toHaveBeenCalled();

  act(() => { TestRenderer.create(<Probe enabled />); });
  expect(axios.get).toHaveBeenCalledTimes(1);
  act(() => { appStateListener('active'); }); // foreground flap seconds later
  expect(axios.get).toHaveBeenCalledTimes(1);
  AppState.currentState = 'background';
  act(() => { jest.advanceTimersByTime(WARMUP_INTERVAL_MS); });
  expect(axios.get).toHaveBeenCalledTimes(1);
  AppState.currentState = 'active';
  act(() => { appStateListener('active'); }); // back to foreground after > 1 min
  expect(axios.get).toHaveBeenCalledTimes(2);
});
