/**
 * Accept Rebalance step timing (2026-10-02). One `[accept-timing]` log line
 * per step, in ms since the tap, so a slow tap can be attributed from logcat
 * (release builds keep console.log). No network, no state.
 */
let startedAt = 0;
let label = '';

export const acceptTimingStart = name => {
  startedAt = Date.now();
  label = String(name || '');
  console.log('[accept-timing]', label, 'tap');
};

export const acceptTimingMark = step => {
  if (!startedAt) return;
  console.log('[accept-timing]', label, step, `+${Date.now() - startedAt}ms`);
};
