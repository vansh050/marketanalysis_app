import {subscribePortfolioResume} from '../../utils/portfolioResume';

test('refreshes on resume, deduplicates an in-flight refresh, throttles rapid resumes, and cleans up', async () => {
  let onChange;
  let finish;
  let clock = 0;
  const remove = jest.fn();
  const refresh = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const cleanup = subscribePortfolioResume({currentState: 'active',
    addEventListener: (_event, handler) => { onChange = handler; return {remove}; },
  }, refresh, () => clock);
  onChange('active');
  await Promise.resolve();
  expect(refresh).not.toHaveBeenCalled();
  onChange('background');
  onChange('active');
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(1);
  clock = 16000;
  onChange('background');
  onChange('active');
  expect(refresh).toHaveBeenCalledTimes(1);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  clock = 1000;
  onChange('background');
  onChange('active');
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(1);
  clock = 20000;
  onChange('background');
  onChange('active');
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(2);
  finish();
  cleanup();
  expect(remove).toHaveBeenCalledTimes(1);
});
