# Courses + Webinars — Alphab2bapp porting spec

> Status: **BUILT — Phases 0/1/2 shipped; live class now renders via the
> WebView bridge.** (Header corrected 2026-06-19 — it previously said "SPEC
> ONLY (2026-05-23)" and was never updated as the implementation landed.) The
> full feature is live in the app: catalog (`MyCoursesScreen`), course detail
> + VOD playback via `react-native-webview` (`composites.GumletPlayer`),
> webinar discovery (`WebinarsListScreen`) + detail (`WebinarDetailScreen`),
> free + paid purchase for both courses and webinars (`CoursePurchaseSheet` /
> `BuyWebinarTicketSheet` via the Cashfree RN SDK), coupons (`CouponService`),
> enrollment writes (`GumletService.addClientCourse`), magic-link join
> (`/token-magic`, ported 2026-06-19), and Android FCM reminders
> (`WebinarReminderHandler`). Navigation + per-advisor config gates
> (`coursesEnabled` / `webinarsEnabled`) are wired.
>
> **Live-class video — WebView bridge (2026-06-19).**
> `designs/default/composites/LiveRoom.js` now renders the LIVE class for
> real: on "Join" it calls `LiveKitService.getJoinUrl` →
> `POST /api/livekit/join-url/:lessonId` (Firebase + verifyEnrollment; the
> server mints a magic `joinToken` for the caller and returns the per-advisor
> `https://<advisor>.alphaquark.in/webinar/:id?joinToken=…` URL), then opens
> that URL in a **full-screen Modal `react-native-webview`**. The existing web
> webinar overlay runs the LiveKit room via the **device browser's WebRTC**,
> so **no native LiveKit deps and no native rebuild** are required — it ships
> with a normal JS release. Viewers are subscribe-only (no camera/mic), so no
> media permissions are prompted. VOD replay continues to play via the Gumlet
> WebView. **Remaining validation:** WebRTC-in-WKWebView must be confirmed on
> a real iOS device (works iOS 14.3+); Android System WebView is fine. A
> NATIVE LiveKit path (background audio / PiP) is preserved as **Option A** in
> §4.2.1 but is not used.
>
> Web side: shipped 2026-05-22 → 2026-05-23 as Slices 1–4 of the LiveKit
> + webinar work, iterated through 2026-06-19. Canonical web reference is
> `prod-alphaquark-github/docs/COURSES_ARCHITECTURE.md` §14 and the
> Changelog rows dated 2026-05-23 onward. This doc points back at those
> sections rather than duplicating their prose.
>
> Supersedes the earlier `LIVE_CLASS_INTEGRATION.md`, which covered only
> the LiveKit live-class viewer in isolation. That file is now a one-line
> pointer here.
>
> **Parity with the last 3 weeks of web courses/webinar changes (audited
> 2026-06-19):** all web changes 2026-05-29 → 2026-06-19 are either already
> reflected in the app or are web-only / admin-only and out of mobile scope.
> See §10 "Web parity matrix (3-week audit)" at the bottom for the
> item-by-item reconciliation.

---

## 1. Scope

What's mobile-ready on the backend, in priority order:

| # | Surface | Web file(s) | Web status | Mobile priority |
|---|---|---|---|---|
| 1 | Public webinar discovery (`/webinars`) | `src/Home/Course/WebinarsListPage.jsx` | Live | **P0** — drives all webinar traffic |
| 2 | Public webinar detail + Buy ticket (`/webinar/:lessonId`) | `src/Home/Course/WebinarDetailPage.jsx`, `src/components/BuyWebinarTicketModal.jsx` | Live | **P0** — pairs with #1 |
| 3 | LiveKit live-class viewer | `designs/default/sections/LiveRoom.js` (web) | Live | **P0** — required by #2 |
| 4 | My Courses / My Webinars | `src/Home/Course/UserCourses.js` (`kind === 'webinar'` filtered out) | Live | **P1** |
| 5 | Course catalog + detail + VOD playback (Gumlet) | `src/Home/Course/CoursePage.js`, `courseDetailsPage.js` | Live | **P1** |
| 6 | Course purchase + coupons | `src/components/CoursePaymentModal.jsx`, `services/CourseCouponService.js` | Live | **P2** |
| 7 | Push reminders (T-24h / T-1h / T-15m / T-1m) | Cron: `aq_backend_github/CronJob/CronLiveClassReminders.js` | Live (server) | **P0 with #1** — FCM token registration is the only client work |
| 8 | Lesson chat / comments | `src/components/LessonComments.js` | Live | **P3** — defer |
| 9 | Embed mode (`?embed=1`) | `WebinarDetailPage` padding shrink | Live | **Skip** — iframe story, not mobile |

P0 = required for v1 mobile webinar launch. P1 = enables full Courses
parity. P2 = monetisation completeness. P3 = nice-to-have.

---

## 2. Backend contract (unchanged across web / RN / Flutter)

All endpoints below already exist on prod. **You do not need a backend
change to ship the mobile surface.**

### 2.1 LiveKit / webinar endpoints (`aq_backend_github/Routes/livekit.js`)

| Method + path | Auth | Body / params | Returns |
|---|---|---|---|
| `POST /api/livekit/token/:lessonId` | Firebase Bearer + `verifyEnrollment` | `{courseId}` | `{url, token, ttlSeconds}` |
| `POST /api/livekit/host-token/:lessonId` | Firebase Bearer + admin role | `{}` | `{url, token, ttlSeconds}` |
| `GET /api/livekit/webinars/list` | **public** (header-only) | — | `{upcoming, live, replay, advisor}` |
| `GET /api/livekit/webinars/:lessonId/public` | **public** (opportunistic Bearer) | — | `{title, description, scheduledStartTime, scheduledDurationMinutes, ticketPrice, recordingEnabled, lessonId, courseId, liveStartedAt, liveEndedAt, recordingStorageTier, gumletAssetId, registrationCount, isEnrolled, enrolledEmail, advisor}` |
| `POST /api/livekit/webinars/:lessonId/purchase` | **Firebase Bearer** + caller.email == body.userEmail (since backend commit `c8512b9`, 2026-05-30) | `{userEmail, userName, mobile, returnUrl}` | `{paymentStatus: 'free'\|'pending', orderId, courseId, cashfree: {payment_session_id, order_id}, buyerEmail}` |
| `GET /api/livekit/webinars/purchase-status/:orderId` | **Firebase Bearer** + caller.email == buyerEmail | — | `{paymentStatus: 'paid'\|'pending'\|'failed', orderId, courseId, buyerEmail}` |
| `POST /api/livekit/quick-create-webinar` | Firebase Bearer + admin | `{title, description, scheduledStartTime, scheduledDurationMinutes, recordingEnabled, ticketPrice}` | `{courseId, moduleId, lessonId}` |
| `GET /api/livekit/webinars/registrations` | Firebase Bearer + admin | — | `{byLesson: {[lessonId]: {count, hostCount, registrants[]}}}` |
| `POST /api/livekit/promote-to-vod/:lessonId` | Firebase Bearer + admin | `{}` | `{lessonId, gumletAssetId, status, recordingStorageTier}` |
| `POST /api/livekit/webhook` | LiveKit Cloud JWT | LiveKit event | server-to-server only — ignore on mobile |

All "public" endpoints still require the standard header pair
(`X-Advisor-Subdomain`, `aq-encrypted-key`) — see §3.1.

**Backend security-gate (2026-05-30, `c8512b9`)** — `/webinars/:lessonId/purchase`
and `/webinars/purchase-status/:orderId` are no longer anonymous-friendly.
Both routes now chain `verifyFirebaseIdToken` and enforce
`caller.email == body.userEmail` (purchase) / `caller.email == buyerEmail`
(status). The mobile FE must attach a Firebase Bearer on every call and
pre-fill the email field from `auth.currentUser.email` (lock it for
signed-in users) so the registrant can't accidentally trip
`EMAIL_MISMATCH`. The corresponding helper is `getOptionalAuthHeaders()`
in `src/utils/courseAuthHeaders.js` — see §3.1.

### 2.2 Gumlet VOD playback (`aq_backend_github/Routes/gumlet.js`)

| Method + path | Auth | Body | Returns |
|---|---|---|---|
| `POST /api/gumlet/playback-token/:lessonId` | Firebase Bearer + enrollment | `{courseId}` | `{playbackUrl, expiresAt}` |
| `GET /api/gumlet/collections` | header-only | — | course list |
| `GET /api/gumlet/collections/:courseId` | header-only | — | course with modules + lessons |
| `GET /api/gumlet/client-course/details` | header-only | `?userEmail=&courseId=` | `{ data: { course: { startDate, endDate, ... }, modules, ... } }` on enrolled; 404 on not-enrolled |

Same `verifyFirebaseIdToken + verifyEnrollment` chain as
`/api/livekit/token` — the server is the source of truth on enrollment,
the client never gates playback locally.

**CashFree install-source check (2026-06-09)** — CashFree's native
SDK rejects sideloaded APKs in `PRODUCTION` env with
`"com.google.android.packageinstaller is not a trusted source"`. This
is anti-fraud, enforced inside the bundled native AAR, **not
configurable from JS**. Mobile centralizes the environment selection
in `src/utils/cashfreeEnv.js` — `getCashfreeEnvironment()` returns
SANDBOX whenever:
- `REACT_APP_CASHFREE_ENV=sandbox` (explicit override), OR
- `__DEV__` is true (Metro debug build), OR
- `REACT_APP_ENV !== 'production'`.
Else PRODUCTION. The helper's `friendlyPaymentError(err, fallback)`
also rewrites the install-source error into a user-readable message
with workaround paths. Used by `CoursePurchaseSheet` AND
`BuyWebinarTicketSheet` — any new CashFree-driven surface MUST use
the helper, not construct `CFEnvironment` inline. To actually accept
payments on a sideloaded build: install via Play Store Internal
Testing, or whitelist `com.google.android.packageinstaller` at the
CashFree merchant dashboard.

**`/client-course/details` consumer (CourseDetailScreen)** — mobile
`GumletService.getClientCourseDetails(userEmail, courseId)` drives the
"Get free access" / "Enroll now" / "Purchased" CTA on
`CourseDetailScreen`. Without this query the CTA stays in the
un-purchased state forever, even after a successful enrollment write
(2026-06-09 bug). Re-fire it inside the `onPurchased` callback of
`CoursePurchaseSheet` so the button flips immediately after a free
or paid enrollment lands — the public course payload returned by
`getCourse` has no per-user enrollment state and won't reflect the
change on its own.

### 2.3 Idempotency guarantees (already shipped, don't reimplement)

- All paid + free webinar purchases route through
  `utilities/courseEnrollmentWriter.upsertCourseEnrollment` (server-side).
  Double-tap / poll-race produces an `idempotent_update` action, never a
  duplicate `CourseClientList` row.
- Free webinar synthetic `orderId` is **stable**:
  `FREE_WEBINAR_<lessonId>_<email>`. Client can retry freely.
- Bundle purchases route the same way + dedup duplicate `courseId` in
  `courses[]` via a `processedCourseIds` Set.

Mobile MUST NOT implement its own client-side dedup or "have I bought
this?" cache for purchase — trust the server response (`paymentStatus`).

---

## 3. Alphab2bapp wiring conventions

Mirror the patterns already used by `BrokerSelectionScreen`,
`InvestFlowScreen`, `PortfolioScreen`, `ModelPortfolioService` rather
than copying web's `axios + import { auth } from "../../firebase"` shape.

### 3.1 Headers helper

```js
// src/utils/courseAuthHeaders.js
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import { getAdvisorSubdomain } from './storageUtils';
import { generateToken } from './cryptoUtils';

export function getPublicHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };
}

export async function getAuthedHeaders() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Sign-in required');
  const idToken = await user.getIdToken(false);
  return {
    ...getPublicHeaders(),
    Authorization: `Bearer ${idToken}`,
  };
}

// Soft-auth: attach Bearer when signed in, fall through to public
// headers otherwise. Used by /purchase + /purchase-status (which now
// REQUIRE Bearer, but the helper shape stays graceful for any future
// truly-public endpoint).
export async function getOptionalAuthHeaders() {
  const headers = getPublicHeaders();
  try {
    const user = getAuth().currentUser;
    if (user) {
      const idToken = await user.getIdToken(false);
      headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (_) { /* anonymous fallback */ }
  return headers;
}
```

This is the only auth surface the courses + webinars services need.
`getAdvisorSubdomain()` already exists; `generateToken` already exists
under `src/utils/cryptoUtils.js`.

### 3.2 File layout

```
src/
  FunctionCall/services/
    LiveKitService.js          # mirrors web src/services/LiveKitService.js
    GumletService.js           # subset: just playback token + get course
  screens/
    Courses/
      WebinarsListScreen.js    # public /webinars equivalent
      WebinarDetailScreen.js   # public /webinar/:lessonId equivalent
      MyCoursesScreen.js       # auth-required, mirrors UserCourses.js
      CourseDetailScreen.js    # auth-required, mirrors courseDetailsPage.js
  components/
    BuyWebinarTicketSheet.js   # bottom-sheet variant of BuyWebinarTicketModal
designs/default/
  composites/
    LiveRoom.js                # LiveKit RN viewer (host=false by default)
    GumletPlayer.js            # react-native-video or webview wrapper
```

The `composites/` placement matches alphab2bapp's existing design-folder
convention (it does not have a `sections/` folder — that was web's
shape; the web doc reference to `sections.LiveRoom` resolves there but
the mobile mirror lives in `composites/`).

### 3.3 Push notifications

`@react-native-firebase/messaging` v20 is already installed (see
`package.json`). The reminders cron is server-driven — the only client
work is:

1. On app launch (or post-login), request notification permission +
   read the FCM token.
2. POST the token to `/api/fcm/register-device` (existing endpoint per
   `fcm_per_advisor.md` memory; per-advisor service-account).
3. Handle foreground messages (display in-app) + background taps
   (deep-link to `/webinar/:lessonId`).

No client-side scheduling. The 4 reminder thresholds (T-24h email,
T-1h email + push, T-15m push, T-1m push) all fire from
`aq_backend_github/CronJob/CronLiveClassReminders.js` per
`webinar_registrations[lessonId]`.

---

## 4. Section-by-section porting plan

### 4.1 LiveKitService (P0)

Direct port of `prod-alphaquark-github/src/services/LiveKitService.js`,
swapping headers per §3.1 above. Use `fetch` or `axios` — alphab2bapp
mixes both; either is fine.

```js
// src/FunctionCall/services/LiveKitService.js
import Config from 'react-native-config';
import { getAuthedHeaders, getOptionalAuthHeaders, getPublicHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${Config.REACT_APP_NODE_SERVER_API_URL}api/livekit`;

async function postJson(url, body, headers) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json.data;
}
async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json.data;
}

export const LiveKitService = {
  // viewer
  getViewerToken: async (lessonId, courseId) =>
    postJson(`${BASE}/token/${lessonId}`, { courseId }, await getAuthedHeaders()),

  // public discovery
  listPublicWebinars: () => getJson(`${BASE}/webinars/list`, getPublicHeaders()),
  // /public takes an OPTIONAL Bearer — when signed in, the server returns
  // `isEnrolled` + `enrolledEmail` so WebinarDetailScreen can render the
  // LiveRoom directly for returning registrants. Use the soft-auth helper.
  getPublicWebinar:    async (lessonId) => getJson(`${BASE}/webinars/${lessonId}/public`, await getOptionalAuthHeaders()),

  // purchase (Firebase Bearer required + caller.email == body.userEmail
  // since backend commit c8512b9, 2026-05-30). Use the soft-auth helper
  // so anonymous callers fall through gracefully (the backend will then
  // return INVALID_TOKEN, which the FE maps to a friendly "please sign
  // in" message — see BuyWebinarTicketSheet's FRIENDLY_ERRORS).
  purchaseWebinarTicket: async (lessonId, body) =>
    postJson(`${BASE}/webinars/${lessonId}/purchase`, body, await getOptionalAuthHeaders()),
  getWebinarPurchaseStatus: async (orderId) =>
    getJson(`${BASE}/webinars/purchase-status/${orderId}`, await getOptionalAuthHeaders()),

  // 3-min poll with AbortController (port verbatim from web — keep the
  // 30s shorter timeout for the post-cancel race path)
  pollWebinarPurchaseUntilTerminal: async (orderId, { timeoutMs = 180000, intervalMs = 3000, signal } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) return { paymentStatus: 'aborted', orderId };
      const s = await LiveKitService.getWebinarPurchaseStatus(orderId);
      if (s.paymentStatus === 'paid' || s.paymentStatus === 'failed') return s;
      await new Promise((resolve) => {
        const t = setTimeout(resolve, intervalMs);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
    return { paymentStatus: signal?.aborted ? 'aborted' : 'timeout', orderId };
  },
};
```

### 4.2 LiveRoom composite (P0)

LiveKit React Native package:

```bash
yarn add @livekit/react-native @livekit/react-native-webrtc livekit-client
npx react-native-webrtc-init        # links iOS Podfile + Android gradle
```

**iOS Info.plist** — NSCameraUsageDescription, NSMicrophoneUsageDescription,
`UIBackgroundModes = [audio, voip]`.

**Android AndroidManifest.xml** — RECORD_AUDIO, CAMERA,
MODIFY_AUDIO_SETTINGS, BLUETOOTH, BLUETOOTH_CONNECT, INTERNET, plus
camera/microphone uses-feature with `required="false"`.

```js
// designs/default/composites/LiveRoom.js
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import {
  LiveKitRoom, AudioSession, useTracks, VideoTrack,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { LiveKitService } from '../../../src/FunctionCall/services/LiveKitService';

export default function LiveRoom({ lesson, courseId, host = false }) {
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => AudioSession.stopAudioSession();
  }, []);

  useEffect(() => {
    if (!lesson?._id) return;
    LiveKitService.getViewerToken(lesson._id, courseId)
      .then(setBundle)
      .catch((e) => setError(e.message));
  }, [lesson?._id, courseId]);

  if (error) return <View><Text>{error}</Text></View>;
  if (!bundle) return <View><Text>Joining live class…</Text></View>;

  // Full-screen presentation (see "Sizing contract" note below).
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* slim dark header: lesson.title + Close (calls onClose) */}
        <LiveKitRoom serverUrl={bundle.url} token={bundle.token} connect
                     audio={host} video={host} style={{ flex: 1 }}>
          <RoomBody />
        </LiveKitRoom>
      </View>
    </Modal>
  );
}

function RoomBody() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  return (
    <View style={{ flex: 1 }}>
      {tracks.map((t) => (
        <VideoTrack key={t.publication.trackSid} trackRef={t} style={{ flex: 1 }} />
      ))}
    </View>
  );
}
```

T-10min "Join now" gating is part of `LiveRoom` on web — port that
logic into this composite too (compare `scheduledStartTime` against
`Date.now()`; show countdown until 10min before).

**Sizing contract — full-screen room (2026-06-19, parity with the web
`courseDetailsPage.js` / `WebinarDetailPage.jsx` full-viewport fix).** Once a
viewer joins, the room MUST present in a **full-screen RN `Modal`**
(`presentationStyle="fullScreen"`) with a slim dark header (lesson title +
Close) and a `flex:1` video body — NOT a fixed `height: 360` panel inside the
detail screen's `ScrollView`. A small fixed-height panel is the mobile
equivalent of the web "webinar fits very small / maximize doesn't help" bug
that was fixed on the web side. The placeholder `LiveRoomActive`
(`designs/default/composites/LiveRoom.js`) already renders this Modal shell
(`styles.modalRoot` / `modalHeader` / `roomBody`); when activating LiveKit,
drop `<LiveKitRoom style={{ flex: 1 }}>` into the `roomBody` slot and keep the
Modal wrapper — do not revert to an inline fixed-height `<View>`. The
activation snippet at the bottom of `LiveRoom.js` reflects this.

**Magic-link join (ported 2026-06-19, web parity with the 2026-06-06 web
feature).** `LiveKitService.getViewerToken(lessonId, courseId, { joinToken })`
now branches: with `joinToken` it POSTs `/api/livekit/token-magic/:lessonId`
(public headers, no Firebase — the signed JWT is the credential); without it,
the Firebase `/token/:lessonId` path as before. `WebinarDetailScreen` reads a
`joinToken` route param, flips straight into join mode, suppresses the sign-in
+ email-mismatch gating, and forwards it to `composites.LiveRoom` (which passes
it to `getViewerToken`). The deep-link source (an Android App Link / iOS
Universal Link on `<subdomain>.alphaquark.in/webinar/:lessonId?joinToken=…`
that routes into `WebinarDetailScreen` with `{ joinToken }`) is NOT yet
configured — until it is, magic links open the web page, and the in-app path
is exercised only if a navigator passes `joinToken` explicitly. The
service/screen plumbing is in place so wiring the deep link is the only
remaining step for full magic-link parity.

**Live-class WebView bridge (2026-06-19) — the live implementation.**
`composites.LiveRoom` renders the live class by loading the existing **web**
webinar room page in a full-screen `react-native-webview`, so the device
browser's WebRTC stack runs LiveKit and we install **no native LiveKit deps**.
Flow:
1. `handleJoin` → `LiveKitService.getJoinUrl(lessonId, courseId)` →
   `POST /api/livekit/join-url/:lessonId` (Firebase + `verifyEnrollment`).
2. The server mints a magic `joinToken` for the caller's verified email
   (`webinarJoinToken.signJoinToken`) and returns
   `{ joinToken, joinUrl, lessonId }` with
   `joinUrl = https://<advisor>.alphaquark.in/webinar/<lessonId>?joinToken=…`
   (`buildMagicJoinUrl`, per-advisor subdomain from `req.subdomain`).
3. `LiveRoomWebView` opens `joinUrl` in a full-screen Modal WebView. The web
   page's full-viewport overlay (the 2026-06-19 web fix) renders the room +
   chat; `/token-magic` is called by the web page, not the app.

WebView config that matters: `allowsInlineMediaPlayback`,
`mediaPlaybackRequiresUserAction={false}` (remote audio/video autoplay),
`thirdPartyCookiesEnabled` + `sharedCookiesEnabled` (LiveKit/analytics),
`limitsNavigationsToAppBoundDomains={false}` (iOS WKWebView signalling). Viewers
are **subscribe-only** (no `getUserMedia`), so **no camera/mic permissions** are
prompted — which is why this needs no manifest/Info.plist changes. **Validate
on a real iOS device** (WKWebView WebRTC is supported iOS 14.3+); Android System
WebView is fine. The backend endpoint is `aq_backend_github/Routes/livekit.js`
(`/join-url/:lessonId`), tracked in `prod-alphaquark-github/docs/COURSES_ARCHITECTURE.md §14.3`.

### 4.2.1 Option A — NATIVE LiveKit (optional upgrade, NOT used)

> **The live class already works via the WebView bridge (§4.2 above) — this
> section is an OPTIONAL future upgrade, not a required step.** Use it only if
> you later want a native room (background audio, picture-in-picture, no
> browser chrome). It is a **native build** — it changes the iOS Podfile +
> Android Gradle and needs a real device/emulator rebuild, so it CANNOT be done
> in a headless repo checkout. To adopt it, replace `LiveRoomWebView` with the
> native snippet at the bottom of `LiveRoom.js` (which uses
> `getViewerToken` / `getViewerToken({joinToken})` instead of `getJoinUrl`).

1. **Install the native deps** (let the resolver pick a co-compatible matrix —
   do not hand-pin unless a build fails):
   ```bash
   yarn add @livekit/react-native @livekit/react-native-webrtc livekit-client
   cd ios && pod install && cd ..
   ```
2. **iOS `Info.plist`** — add:
   - `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` (viewer is
     audio/video-OFF, but the WebRTC lib links the frameworks; Apple requires
     the strings to exist).
   - `UIBackgroundModes` → include `audio` and `voip`.
3. **Android `AndroidManifest.xml`** — add `RECORD_AUDIO`, `CAMERA`,
   `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH`, `BLUETOOTH_CONNECT`, `INTERNET`, plus
   camera/microphone `uses-feature` with `required="false"` (viewers without a
   camera must still install).
4. **Swap the `LiveRoomActive` body** in `designs/default/composites/LiveRoom.js`
   with the activation snippet at the bottom of that file. **Keep the
   full-screen `Modal` + header wrapper** (`styles.modalRoot` / `modalHeader` /
   `roomBody`) — only the `roomBody` contents change: drop
   `<LiveKitRoom serverUrl={bundle.url} token={bundle.token} connect audio={host}
   video={host} style={{ flex: 1 }}>` + `<RoomBody />` into it, and add the
   `AudioSession.startAudioSession()` / `stopAudioSession()` effect.
5. **No JS-side token work needed** — `getViewerToken` already returns
   `{ url, token, ttlSeconds }` for both the Firebase (`/token`) and magic-link
   (`/token-magic`) paths, and the T-10min gate + countdown already work.
6. **Env / backend** — nothing new on the client. The backend already mints
   tokens (`/api/livekit/token/:lessonId` + `/token-magic/:lessonId`) and runs
   the LiveKit Cloud webhook → Wasabi recording pipeline. Confirm the server's
   `LIVEKIT_*` env is set (it is, on tidi) — a 503 `LIVEKIT_NOT_CONFIGURED`
   from `/token` means the server side isn't configured, not the app.
7. **Test**: schedule a webinar from admin, join from a second device within
   the T-10min window, confirm the host's video/screenshare renders full-screen
   and Close returns to the detail screen.

After activation, update this doc's status header + the design-system docs
(`DESIGN_MIGRATION_PROGRESS.md` etc.) + `CHANGELOG.md` per the repo's blocking
doc rule, and add the new native deps to the "Open follow-ups" closed list.

### 4.3 WebinarsListScreen (P0)

Mirrors `WebinarsListPage.jsx`. Three sections (LIVE NOW, UPCOMING,
REPLAYS), each tapping into a navigation push to `WebinarDetailScreen`.

```js
// src/screens/Courses/WebinarsListScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LiveKitService } from '../../FunctionCall/services/LiveKitService';

const SECTIONS = [
  { key: 'live',     title: 'Live now',           cta: 'Join now',     badge: 'LIVE',     color: '#dc2626' },
  { key: 'upcoming', title: 'Upcoming',           cta: 'Register',     badge: 'UPCOMING', color: '#d97706' },
  { key: 'replay',   title: 'Past webinars (replays)', cta: 'Watch replay', badge: 'REPLAY', color: '#16a34a' },
];

export default function WebinarsListScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState({ upcoming: [], live: [], replay: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await LiveKitService.listPublicWebinars());
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {error ? <Text style={{ color: 'red', padding: 16 }}>{error}</Text> : null}
      {SECTIONS.map((s) => {
        const items = data[s.key] || [];
        if (s.key === 'live' && items.length === 0) return null;
        if (s.key === 'replay' && items.length === 0) return null;
        return (
          <View key={s.key} style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>{s.title}</Text>
            {items.length === 0 ? (
              <Text style={{ color: '#6b7280' }}>No upcoming webinars scheduled.</Text>
            ) : items.map((c) => (
              <TouchableOpacity
                key={c.lessonId}
                onPress={() => navigation.navigate('WebinarDetail', { lessonId: c.lessonId })}
                style={{ padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 }}
              >
                <Text style={{ color: s.color, fontWeight: '600', fontSize: 11 }}>{s.badge}</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 4 }}>{c.title}</Text>
                {!!c.description && <Text numberOfLines={2} style={{ color: '#6b7280', marginTop: 4 }}>{c.description}</Text>}
                <Text style={{ color: '#9ca3af', marginTop: 6, fontSize: 12 }}>
                  {c.scheduledStartTime
                    ? new Date(c.scheduledStartTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    : 'TBA'}
                </Text>
                <Text style={{ color: '#b45309', marginTop: 6, fontSize: 13, fontWeight: '500' }}>{s.cta} →</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
```

Honour the `appConfig.webinarsEnabled === false` gate the same way
web does (render a "Not available" screen). Read it from
`configContext`.

### 4.4 WebinarDetailScreen + BuyWebinarTicketSheet (P0)

This is the biggest port. State machine mirrors web exactly:

1. Unauthenticated viewer, not bought → Buy button → `BuyWebinarTicketSheet`.
2. Signed-in viewer, enrolled → `LiveRoom` composite (countdown / live / ended).
3. Signed-in viewer, not enrolled → Buy button.

Web reference: `WebinarDetailPage.jsx`, `BuyWebinarTicketModal.jsx`.

**CashFree on mobile**: web uses `@cashfree/sdk` JS. On RN use
[`react-native-cashfree-pg-sdk`](https://www.npmjs.com/package/react-native-cashfree-pg-sdk).
The `payment_session_id` returned by `/purchase` is the same artifact;
the SDK's `CFPaymentGatewayService` consumes it. After the SDK reports
success / cancel, fall back to `pollWebinarPurchaseUntilTerminal` —
that path is unchanged from web.

```bash
yarn add react-native-cashfree-pg-sdk
```

Cancel-code short-circuit: web ignores webhook-race polling when CF
reports `user_dropped` / `user_cancelled` / `transaction_cancelled`.
The RN SDK exposes the same codes via its error callback — preserve
the short-circuit (don't make the user wait 30s after they tapped
"Cancel").

Cross-email warning: if `user.email !== purchaseEmail`, show the same
amber warning web shows. Compare case-insensitively.

### 4.5 GumletPlayer composite + CourseDetailScreen (P1)

Two implementation options for the player:

**Option A — `react-native-video`** (preferred):
- Server returns a signed HLS URL via `/api/gumlet/playback-token/:lessonId`.
- `react-native-video` plays it directly. No DRM v1.
- Pros: native UX, fast, gesture-friendly.
- Cons: no DRM until you wire FairPlay/Widevine (deferred per web §11 gap).

**Option B — `WebView` wrapping Gumlet's hosted player**:
- Server returns the embed URL; render in `react-native-webview`.
- Pros: trivial; matches web DRM story automatically.
- Cons: clunky UX, breaks deep-link gestures.

**Recommendation**: Option A for v1. Wire FairPlay/Widevine in
Phase 2 when the web doc's §11 DRM gap closes.

`CourseDetailScreen` mirrors `courseDetailsPage.js` — module list,
lesson list, unlock semantics. The validity-day extension logic
(`CourseClientList.courses[].endDate` from sum of `paymentDetails[].validityDays`)
is server-computed; client just reads `endDate` and renders countdown.

### 4.6 MyCoursesScreen (P1)

Mirrors `src/Home/Course/UserCourses.js`. Filter
`enrollment.kind === 'webinar'` out by default — webinar buyers
shouldn't see the empty container course in "My Courses". Optionally
add a separate "My Webinars" tab that shows only `kind === 'webinar'`
with the live/replay/ended pill per row.

### 4.7 Coupons (P2)

Reuse `services/CourseCouponService.js` as the FE contract. Mobile
needs a text input + "Apply" button in the purchase sheet; the rest is
server-validated. The first-payment-only recurring display (web
2026-05-23 pricing slice) is purely a label change — show
"First cycle: ₹X · Renews at ₹Y" when `coupon.mode === 'first_payment_only'`.

### 4.8 Push reminders (P0 — paired with §4.1)

Already-installed: `@react-native-firebase/messaging`.

Wire-up checklist:

1. `useEffect` on app shell — request permission, get token,
   POST to existing `/api/fcm/register-device` (see
   `fcm_per_advisor.md` memory for the per-advisor service-account
   convention).
2. `messaging().onMessage` — foreground; render a toast or modal.
3. `messaging().onNotificationOpenedApp` / `getInitialNotification` —
   background tap; deep-link to `WebinarDetailScreen` via the
   payload's `lessonId`.
4. iOS APNS: per `Alphab2bapp/CLAUDE.md` §FCM, APNS cert + Firebase
   project are already configured. No new infra.

The cron writes one row per (lessonId, userEmail) into
`webinar_registrations` and walks that for fan-out. There's no
client-side scheduling and no per-platform cron quirks to handle.

---

## 5. Explicitly out of scope for v1

- **Embed mode** (`?embed=1` URL param + iframe-friendly padding). This
  is a web-only story (advisors paste an `<iframe>` on external pages).
  Mobile ignores the query param.
- **Host UI** (advisor-as-broadcaster). Mobile is viewer-only in v1.
  Hosts continue on web's `LiveRoom` with the admin Schedule modal.
- **Lesson chat / comments**. `LessonComment` collection exists but the
  near-real-time poll is heavyweight on mobile (battery). Defer to a
  Firebase Realtime DB swap or skip.
- **DRM**. Gumlet supports FairPlay + Widevine; web doesn't enforce DRM
  today. Mobile v1 ships without DRM; revisit when web flips.
- **Push-to-talk / viewer unmute**. Viewers stay view-only.
- **Per-advisor LiveKit project**. Everyone shares one project; per-advisor
  billing separation is a Phase 4 story.

---

## 6. Phase plan

| Phase | Surface | Notes |
|---|---|---|
| 0 | LiveKitService + push-reminder wiring | No UI yet — get the token pipe + FCM registration working in isolation, verify with a hand-crafted webinar registration row. |
| 1 | WebinarsListScreen + WebinarDetailScreen + BuyWebinarTicketSheet + LiveRoom composite | First user-visible cut. Free webinars first, then CashFree. |
| 2 | MyCoursesScreen + CourseDetailScreen + GumletPlayer | Full Courses parity (sans coupons). Option A player. |
| 3 | Coupons + bundles + reviews | Monetisation polish. |
| 4 | DRM (FairPlay/Widevine) + LessonComments | Deferred items if business prioritises. |

Phase 0 + 1 is the v1 mobile webinar launch. Phase 2 is the Courses
parity launch.

---

## 7. Backend touch-points you should NOT change

The web Slices 1–4 are designed to be platform-agnostic. If you find
yourself wanting to:

- Add a new field to `/webinars/list` — push back, prefer a separate
  endpoint or a query param.
- Change the auth model on `/playback-token` — DON'T. The
  `verifyFirebaseIdToken + verifyEnrollment` chain is what closes the
  COURSES_ARCHITECTURE.md §11.1 OTP-without-enrollment gap.
- Add a `platform: 'mobile'` branch anywhere — no. Mobile uses the same
  contracts as web.

The exceptions that DO warrant a backend touch:

- FCM device-token registration endpoint (`/api/fcm/register-device` —
  per `fcm_per_advisor.md`). If the existing surface doesn't accept
  webinar-specific topics, extend it.
- A `react-native-cashfree-pg-sdk` quirk (e.g. it wants a different
  return-URL shape). The backend already accepts a `returnUrl` in
  `/purchase` body — but verify the SDK doesn't need an `app://` scheme.

---

## 8. Open follow-ups (from old LIVE_CLASS_INTEGRATION §5, still valid)

- **Recording → VOD pipeline**: `recordingS3Key` is populated; admin's
  Promote-to-VOD button writes `gumletAssetId` and the detail page
  switches branches. Mobile follows automatically once GumletPlayer
  ships.
- **Chat panel**: see §5 above — deferred.
- **Push notifications**: §4.8 above is now the canonical mobile plan
  (was open in the old doc).
- **Per-advisor LiveKit project**: still not needed v1.

---

## 9. References

- `prod-alphaquark-github/docs/COURSES_ARCHITECTURE.md` §14 — canonical
  backend + web reference for the LiveKit + webinar work.
- `prod-alphaquark-github/docs/COURSES_ARCHITECTURE.md` Changelog rows
  dated 2026-05-23 — Slices 1–4 + audit follow-ups (the source of every
  endpoint and field name in §2 above).
- `prod-alphaquark-github/docs/GUMLET_MIGRATION_ARCHITECTURE.md` —
  Gumlet playback-token + Firebase-ID-token + verifyEnrollment
  enforcement; will retire into COURSES_ARCHITECTURE.md after Phase 6.
- `Alphab2bapp/CLAUDE.md` — broker-auth lesson + FCM-per-advisor setup.
- Memory: `fcm_per_advisor.md`, `advisor_enumeration_gotcha.md`.

---

## 10. Web parity matrix (3-week audit, 2026-05-29 → 2026-06-19)

Audited every courses/webinar change shipped on web in the trailing 3 weeks
and reconciled against the app. Verdicts:

| # | Web change (last 3 weeks) | Web files | Mobile status |
|---|---|---|---|
| 1 | Webinar security hardening — auth-gate purchase + caller.email==userEmail + signed-out redirect | `LiveKitService.js`, `BuyWebinarTicketModal.jsx`, `WebinarDetailPage.jsx` | ✅ **Already in app** — `getOptionalAuthHeaders` + `BuyWebinarTicketSheet` email lock + `EMAIL_MISMATCH` handling. |
| 2 | Anonymous registration on shared links | `WebinarDetailPage.jsx`, `BuyWebinarTicketModal.jsx`, `LiveKitService.js` | ✅ **Already in app** — purchase uses optional-auth headers; anonymous register supported. |
| 3 | Magic-link join (`/token-magic`, skip sign-in) | `WebinarDetailPage.jsx`, `LiveKitService.js`, `LiveRoom.jsx` | ✅ **Ported 2026-06-19** — `getViewerToken({joinToken})` + `WebinarDetailScreen` route-param + `LiveRoom` prop. Deep-link source still TODO (§4.2.1 note). |
| 4 | Live-room sizing → full-viewport overlay (3 commits) | `WebinarDetailPage.jsx`, `LiveRoom.jsx`, `courseDetailsPage.js`, `HeaderForCourse.js` | ✅ **Ported 2026-06-19** — `composites.LiveRoom` full-screen Modal contract (§4.2). Mobile never had the cramped-modal bug (live → dedicated screen). |
| 5 | Course-coupon UI + revenue-leak fix (₹0 guard) | `CoursePaymentModal.jsx`, `courseDetailsPage.js` | ✅ **Already in app** — `CoursePurchaseSheet` coupon chain + `normalizeDiscount` 100%-off guard + `validateChargeableAmount`. |
| 6 | Phantom-enrollment fix (no "purchased" without payment) | `courseDetailsPage.js` | ✅ **Already in app** — `CoursePurchaseSheet` writes enrollment only in the post-payment SUCCESS branch. |
| 7 | Published-only user catalog (`?includeDrafts`) | `GumletService.js`, `CoursePage.js`, `UserCourses.js` | ✅ **Already correct** — app `GumletService.listCollections` hits `/collections` which defaults to `isPublished:true` (BE `dc8eb45`); app is viewer-only so it never requests drafts. |
| 8 | Lesson Discussion "Post Comment" email-source fix | `LessonComments.js` (admin) | ⛔ **Out of scope** — admin-only surface; lesson comments are P3/deferred on mobile (§5). |
| 9 | Responsive hardening for public course cards/tabs | `CourseCard.js`, `CoursePage.js` | ✅ **N/A / already fine** — native layout; app cards use flex + `numberOfLines`, no CSS wrap bug. |
| 10 | Admin: webinar status badges flip live + registration pills | `WebinarsList.js` (admin) | ⛔ **Out of scope** — admin web surface; the app is viewer-only (no admin webinar management). |
| 11 | Admin: Manage Trailer Gumlet reconcile + failure banners | `AdminCourseComponent.js`, `LessonUploadModal.js`, `GumletService.js` (admin) | ⛔ **Out of scope** — admin-only. |
| 12 | Admin: drop VdoCipher root-folder gate | `AdminVideoImport.js` (admin) | ⛔ **Out of scope** — admin-only; app never used VdoCipher (Gumlet from day one). |
| 13 | Admin: lesson-attachments VdoCipher→Gumlet | `LessonAttachments.js`, `GumletService.js` (admin) | ⛔ **Out of scope** — admin-only. |
| 14–18 | Admin UX: remove dead Quiz icon, unlock-settings modal fixes, bundle dark-mode, CourseList wrap, required-asterisk sweep | various `AdminVideoImport/*` (admin) | ⛔ **Out of scope** — admin web surfaces. |
| — | LiveKit **live video stream** itself | `designs/default/sections/LiveRoom.jsx` (web, real LiveKit) | ✅ **Wired 2026-06-19 via the WebView bridge** — `composites.LiveRoom` loads the web join URL (`/api/livekit/join-url`) in a full-screen WebView; browser WebRTC runs the room, no native deps. Pending real-iOS-device WebRTC verification (§4.2). Native LiveKit kept as optional Option A (§4.2.1). |

**Net:** every web courses/webinar change in the window is now reflected in the
app or is web/admin-only and out of mobile scope. The app's viewer-facing
course + webinar flows — including the **live** class via the WebView bridge —
are at parity. The only open item is a real-device check of WebRTC-in-WKWebView
on iOS.

---

## 11. QA verification — Buy Ticket registration failure (2026-07-28)

The QA document's paid-webinar screenshot matches the host-registration
collision fixed on 2026-06-26 by backend commit `4e50aa3`, which is present on
the production backend:

- `/public` enrollment lookup excludes `{isHost: true}`;
- `/purchase` already-enrolled lookup excludes `{isHost: true}`;
- `/purchase-status` enrollment lookup excludes `{isHost: true}`; and
- the registration upsert key keeps host and customer rows separate for the
  same lesson/email.

An admin who is auto-registered as the webinar host can therefore still use the
customer Buy Ticket flow for testing. No mobile API, Cashfree invocation, or
form change was needed in the 2026-07-28 QA batch.
