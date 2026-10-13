import {
  buildGumletWatchScript,
  parseGumletWatchMessage,
  createLessonWatchMeter,
} from '../../utils/gumletWatchBridge';

const bridge = (event, seconds, duration) => JSON.stringify({ aq: 'gumlet', event, seconds, duration });
const native = (seconds, duration) => JSON.stringify({ key: 'timeupdate', data: { seconds, duration } });

function makeService() {
  return {
    upsertLessonProgress: jest.fn(async (lessonId, body) => ({
      data: { lessonId, lastPositionSeconds: body.position, durationSeconds: body.duration, completed: body.position / body.duration >= 0.95 },
    })),
    reportWatchTime: jest.fn(async () => ({ data: { counted: 1 } })),
  };
}
const flushPromises = () => new Promise((r) => setImmediate(r));

describe('gumletWatchBridge', () => {
  test('script embeds an integer resume point and is self-guarded', () => {
    const js = buildGumletWatchScript(30.9);
    expect(js).toContain('var RESUME = 30;');
    expect(js).toContain('__aqWatchBridge');
    expect(js.trim().endsWith('true;')).toBe(true);
    expect(buildGumletWatchScript(-5)).toContain('var RESUME = 0;');
  });

  test('parses bridge and Gumlet-native messages, rejects others', () => {
    expect(parseGumletWatchMessage(bridge('timeupdate', 3, 16))).toEqual({ event: 'timeupdate', seconds: 3, duration: 16, source: 'bridge' });
    expect(parseGumletWatchMessage(native(3, 16))).toEqual({ event: 'timeupdate', seconds: 3, duration: 16, source: 'gumlet' });
    expect(parseGumletWatchMessage(native(0, null))).toBeNull();
    expect(parseGumletWatchMessage('{"key":"onLoad"}')).toBeNull();
    expect(parseGumletWatchMessage('not json')).toBeNull();
    expect(parseGumletWatchMessage(bridge('pause', 3, 16))).toBeNull();
  });

  describe('createLessonWatchMeter', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate'] }));
    afterEach(() => jest.useRealTimers());

    test('counts played seconds (seeks excluded), marks complete on ended, notifies caller', async () => {
      const service = makeService();
      const onProgress = jest.fn();
      const meter = createLessonWatchMeter({ lessonId: 'l1', courseId: 'c1', service, onProgress });
      for (let t = 0; t <= 4; t += 0.25) meter.onMessage(bridge('timeupdate', t, 16));
      meter.onMessage(bridge('timeupdate', 14, 16)); // seek
      for (let t = 14.25; t <= 16; t += 0.25) meter.onMessage(bridge('timeupdate', t, 16));
      meter.onMessage(bridge('ended', 16, 16));
      await flushPromises();
      expect(service.upsertLessonProgress).toHaveBeenLastCalledWith('l1', { courseId: 'c1', moduleId: '', position: 16, duration: 16 });
      expect(onProgress).toHaveBeenLastCalledWith('l1', expect.objectContaining({ completed: true }));
      expect(service.reportWatchTime).toHaveBeenCalledWith('l1', { courseId: 'c1', seconds: 6 });
      meter.stop();
    });

    test('throttles progress writes to one per 10 s and flushes watch time every 60 s', async () => {
      let clock = 0;
      const service = makeService();
      const meter = createLessonWatchMeter({ lessonId: 'l1', courseId: 'c1', service, now: () => clock });
      for (let t = 0; t <= 30; t += 0.5) { clock = 1e12 + t * 1000; meter.onMessage(bridge('timeupdate', t, 600)); }
      expect(service.upsertLessonProgress).toHaveBeenCalledTimes(4); // ~0, 10, 20, 30 s
      jest.advanceTimersByTime(60000);
      await flushPromises();
      expect(service.reportWatchTime).toHaveBeenCalledWith('l1', { courseId: 'c1', seconds: 30 });
      meter.stop();
    });

    test('Gumlet-native messages are used only while the bridge is silent', async () => {
      const service = makeService();
      const meter = createLessonWatchMeter({ lessonId: 'l1', courseId: 'c1', service });
      for (let t = 0; t <= 2; t += 0.5) meter.onMessage(native(t, 100));
      for (let t = 2.5; t <= 4; t += 0.5) { meter.onMessage(bridge('timeupdate', t, 100)); meter.onMessage(native(t + 0.1, 100)); }
      meter.stop();
      await flushPromises();
      expect(service.reportWatchTime).toHaveBeenCalledWith('l1', { courseId: 'c1', seconds: 4 });
    });

    test('stop() flushes the last position and is idempotent; later messages are ignored', async () => {
      const service = makeService();
      const meter = createLessonWatchMeter({ lessonId: 'l1', courseId: 'c1', service, now: () => 0 });
      meter.onMessage(bridge('timeupdate', 0, 100));
      meter.onMessage(bridge('timeupdate', 1, 100));
      service.upsertLessonProgress.mockClear();
      meter.stop();
      meter.stop();
      meter.onMessage(bridge('timeupdate', 2, 100));
      await flushPromises();
      expect(service.upsertLessonProgress).toHaveBeenCalledTimes(1);
      expect(service.upsertLessonProgress).toHaveBeenCalledWith('l1', expect.objectContaining({ position: 1 }));
      expect(service.reportWatchTime).toHaveBeenCalledWith('l1', { courseId: 'c1', seconds: 1 });
    });
  });
});
