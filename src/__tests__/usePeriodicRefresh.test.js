const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('usePeriodicRefresh', () => {
  test('polls on a configurable interval and refreshes on app foreground', () => {
    const hook = read('src/utils/usePeriodicRefresh.js');
    expect(hook).toContain('setInterval(run, intervalMs)');
    expect(hook).toContain("AppState.addEventListener('change'");
    expect(hook).toContain("if (next === 'active' && wasBackgrounded) run();");
    expect(hook).toContain('intervalMs = 45000');
  });

  test('never stacks slow fetches and stops while backgrounded', () => {
    const hook = read('src/utils/usePeriodicRefresh.js');
    expect(hook).toContain('if (inFlightRef.current) return;');
    expect(hook).toContain("if (appState.current !== 'active') return;");
    expect(hook).toContain('clearInterval(interval)');
    expect(hook).toContain('sub.remove()');
  });

  test('is gated by the enabled flag (caller pauses it under modals)', () => {
    const hook = read('src/utils/usePeriodicRefresh.js');
    expect(hook).toContain("if (!enabled || typeof refreshRef.current !== 'function') return;");
  });

  test('documents the silent contract for the underlying fetch', () => {
    const hook = read('src/utils/usePeriodicRefresh.js');
    expect(hook).toContain('{ silent: true }');
  });
});
