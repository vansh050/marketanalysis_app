/**
 * VoiceCallWebView — loads the SELF-HOSTED, TOKEN-GATED Vapi voice page from the
 * support brain (customersupport.alphaquark.in) inside an invisible
 * react-native-webview.
 *
 * Flow:
 *   1. POST /voice/token with the app's `aq-encrypted-key` (same HS256 token the
 *      app signs for every API call) → the brain returns a short-lived (120s)
 *      signed voice token carrying {advisor, senderRef}. This gates the endpoint
 *      so randoms can't hit /voice to start (cost-incurring) calls.
 *   2. Load GET /voice?token=<token> in the WebView. The brain serves the page +
 *      a bundled Vapi WEB SDK (/voice-sdk.js) — no third-party CDN, real https
 *      secure context for getUserMedia. The Vapi PUBLIC key + assistant id live
 *      server-side (never passed by the client). The page runs the call + the
 *      30s customer-silence cost guard.
 *
 * OS WebView WebRTC → NO native libjingle .so → no 16 KB page-size problem (see
 * CLAUDE.md "16 KB page-size check"). Source: aq-support-brain src/server/app.ts.
 *
 * Audio-only: 0×0 invisible; UI stays native in SupportWidget. MOUNT to start;
 * UNMOUNT to end. onStatus(status, reason) — 'inactivity' = cost-guard auto-drop.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import {WebView} from 'react-native-webview';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';

const BRAIN = 'https://customersupport.alphaquark.in';

export default function VoiceCallWebView({metadata, onStatus = () => {}}) {
  const ref = useRef(null);
  const [uri, setUri] = useState(null);
  const advisor = (metadata && metadata.advisor) || '';
  const senderRef = (metadata && metadata.senderRef) || 'app_user';

  // Fetch a short-lived voice token (proving we're a real app via aq-encrypted-key),
  // then load the gated page. Runs on mount (the widget mounts only during a call).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const aqKey = generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        );
        const res = await fetch(`${BRAIN}/voice/token`, {
          method: 'POST',
          headers: {'content-type': 'application/json', 'aq-encrypted-key': aqKey},
          body: JSON.stringify({advisor, senderRef}),
        });
        if (!res.ok) throw new Error('token_http_' + res.status);
        const data = await res.json().catch(() => ({}));
        if (!data || !data.token) throw new Error('no_token');
        if (!cancelled) {
          setUri(`${BRAIN}/voice?token=${encodeURIComponent(data.token)}`);
        }
      } catch (e) {
        if (!cancelled) onStatus('error', String((e && e.message) || e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // onStatus intentionally omitted — run once per mount for the stable advisor/senderRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisor, senderRef]);

  const handleMessage = useCallback(
    (e) => {
      try {
        const d = JSON.parse(e.nativeEvent.data);
        if (d && d.type === 'status') onStatus(d.status, d.reason || d.error);
      } catch (_) {}
    },
    [onStatus],
  );

  if (!uri) return null; // still fetching the token

  return (
    <View
      style={{position: 'absolute', width: 0, height: 0, opacity: 0}}
      pointerEvents="none">
      <WebView
        ref={ref}
        source={{uri}}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        onMessage={handleMessage}
        style={{width: 0, height: 0}}
      />
    </View>
  );
}
