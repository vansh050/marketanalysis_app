# In-App Support Widget (chat + voice) — Setup

The support widget (`src/components/SupportWidget/SupportWidget.js`, mounted in
`App.js`) is **chat-first with optional voice**. It is gated by the per-advisor
flag `voiceSupportUserEnabled` (supportAQ → advisor_config.voice_support_user_enabled,
default OFF) — same gate as the web app, so it carries across white-labels.

## What works out of the box (no native steps)

**Chat** works immediately on the next JS bundle / release — it only does
`fetch` to the AlphaQuark support brain (`https://customersupport.alphaquark.in/chat`).
No new dependencies, no native linking. When the advisor's flag is ON, an
authenticated user sees a 💬 button → chat panel.

The voice `@vapi-ai/react-native` SDK is **lazy-required**: if it isn't installed,
the widget silently runs chat-only (the 📞 button is hidden). The app will NOT
crash without it. So you can ship chat now and add voice later.

## To enable VOICE (one-time native setup, then a rebuild)

1. **Install the SDK + its WebRTC peer:**
   ```bash
   npm install @vapi-ai/react-native @daily-co/react-native-daily-js @daily-co/react-native-webrtc
   ```
   (Pin whatever versions `@vapi-ai/react-native` asks for as peers.)

2. **iOS** — add the mic usage string to `ios/<App>/Info.plist`:
   ```xml
   <key>NSMicrophoneUsageDescription</key>
   <string>AlphaQuark Support uses your microphone for voice support calls.</string>
   ```
   Then:
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android** — ensure `android/app/src/main/AndroidManifest.xml` has:
   ```xml
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   ```
   (The widget also requests it at runtime via `react-native-permissions` /
   `PermissionsAndroid`, which is already a dependency.)

4. **Rebuild** the app (`npm run android` / `npm run ios`, or a release build).
   The lazy-require now resolves, and the 📞 button appears in the chat header.

## Config / keys (already embedded in the component)

- Brain chat endpoint: `https://customersupport.alphaquark.in/chat`
- Vapi assistant id: `7323e900-a15e-4616-b383-c1affcde7fb9`
- Vapi PUBLIC key: `5cfbb95d-…` (start-call scoped, safe in-app — NEVER the private key)

These match the web build. If a call errors on connect, verify `5cfbb95d-…` is the
Vapi **Public** key (Dashboard → API Keys), not the demo shareKey.

## Notes

- The widget reuses the same brain as WhatsApp / web, including the human handoff
  (escalations ping the internal Telegram channel with a CRM deep-link).
- `senderRef` = the logged-in user's email, so the brain resolves identity for
  account-aware answers (generic info answers work for everyone).
- No OTA/CodePush in this app → all of the above ships on the next store release.
