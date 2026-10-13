/**
 * gumletWatchBridge — watch-time + resume for course lessons in the app.
 *
 * The app plays a lesson by loading Gumlet's hosted embed page as the
 * WebView's TOP-LEVEL document. Gumlet's player.js receiver only switches on
 * when its page is framed, so the web player's player.js subscription does
 * not work here. Instead we inject a small script that listens to the page's
 * own <video> element(s) (light DOM and shadow roots) and posts
 * { aq: 'gumlet', event, seconds, duration } to React Native. The same script
 * seeks to the saved position once the video's length is known.
 *
 * The container (src/screens/Courses/CourseDetailScreen.js) feeds those
 * messages to createLessonWatchMeter, which mirrors the web GumletPlayer:
 * throttled POST /lessons/:lessonId/progress (resume) and watched seconds
 * every 60 s to POST /lessons/:lessonId/watch (AlphaQuark's monthly
 * viewer-hour billing). Seeks are excluded: only consecutive timeupdate
 * steps of 0–5 s count as watched.
 *
 * Cross-ref: prod-alphaquark-github docs/COURSES_ARCHITECTURE.md §13.5.
 */

export function buildGumletWatchScript(resumeAtSeconds = 0) {
  const resume = Math.max(0, Math.floor(Number(resumeAtSeconds) || 0));
  return `(function(){
  if (window.__aqWatchBridge) return; window.__aqWatchBridge = true;
  var RESUME = ${resume};
  function post(o){ try { if (window.ReactNativeWebView) { o.aq = 'gumlet'; window.ReactNativeWebView.postMessage(JSON.stringify(o)); } } catch (e) {} }
  var hooked = [];
  function collect(root, out){
    if (!root || !root.querySelectorAll) return out;
    var vs = root.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) out.push(vs[i]);
    var all = root.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) { if (all[j].shadowRoot) collect(all[j].shadowRoot, out); }
    return out;
  }
  function hook(v){
    if (hooked.indexOf(v) >= 0) return; hooked.push(v);
    var seeked = false;
    function trySeek(){
      if (seeked || !(v.duration > 0)) return;
      seeked = true;
      if (RESUME > 0 && RESUME < v.duration * 0.95) { try { v.currentTime = RESUME; } catch (e) {} }
    }
    v.addEventListener('loadedmetadata', trySeek);
    v.addEventListener('timeupdate', function(){
      if (!(v.duration > 0)) return;
      trySeek();
      if (v.paused) return;
      post({ event: 'timeupdate', seconds: v.currentTime, duration: v.duration });
    });
    v.addEventListener('ended', function(){ post({ event: 'ended', seconds: v.duration, duration: v.duration }); });
    if (v.readyState >= 1) trySeek();
  }
  function scan(){ var vs = collect(document, []); for (var i = 0; i < vs.length; i++) hook(vs[i]); }
  scan(); setInterval(scan, 1000);
})(); true;`;
}

/**
 * Parse a WebView message. Returns { event, seconds, duration, source } or
 * null. source 'bridge' = our injected script; 'gumlet' = Gumlet's own
 * React-Native messages ({ key: 'timeupdate', data: { seconds, duration } }),
 * used only as a fallback when the bridge is silent (verified 2026-10-13 on a
 * real embed page).
 */
export function parseGumletWatchMessage(raw) {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || typeof m !== 'object') return null;
    let event; let seconds; let duration; let source;
    if (m.aq === 'gumlet') {
      event = m.event; seconds = Number(m.seconds); duration = Number(m.duration); source = 'bridge';
    } else if (m.key === 'timeupdate' && m.data && typeof m.data === 'object') {
      event = 'timeupdate'; seconds = Number(m.data.seconds); duration = Number(m.data.duration); source = 'gumlet';
    } else {
      return null;
    }
    if (event !== 'timeupdate' && event !== 'ended') return null;
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(duration) || duration <= 0) return null;
    return { event, seconds, duration, source };
  } catch (e) {
    return null;
  }
}

const PROGRESS_THROTTLE_MS = 10000;
const WATCH_FLUSH_MS = 60000;

/**
 * Per-lesson meter. `service` must provide upsertLessonProgress(lessonId,
 * body) and reportWatchTime(lessonId, body); both are best-effort.
 * Returns { onMessage(raw), flush(), stop() }.
 */
export function createLessonWatchMeter({ lessonId, courseId, moduleId = '', service, onProgress, now = () => Date.now() }) {
  let last = null;
  let watched = 0;
  let pending = null;
  let lastWriteAt = 0;
  let stopped = false;
  let bridgeSeen = false;

  const writeProgress = async (pos, dur) => {
    try {
      const res = await service.upsertLessonProgress(lessonId, { courseId, moduleId, position: pos, duration: dur });
      if (res && res.data && onProgress) onProgress(lessonId, res.data);
    } catch (e) { /* best-effort */ }
  };
  const flushWatch = async () => {
    const seconds = Math.floor(watched);
    if (seconds < 1) return;
    watched -= seconds;
    try { await service.reportWatchTime(lessonId, { courseId, seconds }); } catch (e) { /* best-effort */ }
  };
  const flush = () => {
    if (pending) writeProgress(pending.pos, pending.dur);
    return flushWatch();
  };
  const timer = setInterval(() => { if (!stopped) flushWatch(); }, WATCH_FLUSH_MS);

  const onMessage = (raw) => {
    if (stopped) return;
    const m = parseGumletWatchMessage(raw);
    if (!m) return;
    // Prefer the injected bridge; Gumlet's own messages are a fallback only,
    // so the two streams are never counted together.
    if (m.source === 'bridge') bridgeSeen = true;
    else if (bridgeSeen) return;
    if (m.event === 'ended') {
      pending = { pos: m.duration, dur: m.duration };
      lastWriteAt = now();
      writeProgress(m.duration, m.duration);
      flushWatch();
      return;
    }
    if (last != null) {
      const delta = m.seconds - last;
      if (delta > 0 && delta <= 5) watched += delta;
    }
    last = m.seconds;
    pending = { pos: m.seconds, dur: m.duration };
    if (now() - lastWriteAt >= PROGRESS_THROTTLE_MS) {
      lastWriteAt = now();
      writeProgress(m.seconds, m.duration);
    }
  };
  const stop = () => {
    if (stopped) return;
    flush();
    stopped = true;
    clearInterval(timer);
  };
  return { onMessage, flush, stop };
}
