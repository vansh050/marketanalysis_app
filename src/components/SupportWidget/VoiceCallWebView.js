/**
 * VoiceCallWebView — loads the SELF-HOSTED, TOKEN-GATED Vapi voice page from the
 * support brain (customersupport.alphaquark.in) inside an invisible
 * react-native-webview.
 *
 * Flow:
 *   1. POST {Node}/api/support/voice-token as the signed-in user (Firebase
 *      bearer + the issued app-session token the interceptor puts in
 *      `aq-encrypted-key`). Node checks the advisor's voice flag and returns a
 *      short-lived (120s) voice token + its /voice URL. Tenant and email come
 *      from the verified session, so the app does not choose them. (The brain's
 *      old app-key POST /voice/token returns 410: app keys ship in the binary.)
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
import axios from 'axios';
import Config from '../../config/env';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../../utils/variantHelper';
import {getCustomerAuthHeaders} from '../../utils/customerAuthHeaders';

const BRAIN = 'https://customersupport.alphaquark.in';

/** Ask Node for a voice token for the signed-in user; returns the /voice URL. */
export async function fetchVoiceUrl() {
  const customerHeaders = (await getCustomerAuthHeaders()) || {};
  const res = await axios.post(
    `${server.server.baseUrl}api/support/voice-token`,
    {surface: 'customer'},
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(),
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        ...customerHeaders,
      },
      timeout: 15000,
    },
  );
  const data = res && res.data;
  if (!data || !data.token) throw new Error('no_token');
  return data.voiceUrl || `${BRAIN}/voice?token=${encodeURIComponent(data.token)}`;
}

export default function VoiceCallWebView({metadata, onStatus = () => {}}) {
  const ref = useRef(null);
  const [uri, setUri] = useState(null);
  const advisor = (metadata && metadata.advisor) || '';
  const senderRef = (metadata && metadata.senderRef) || 'app_user';

  // Fetch a short-lived voice token from Node as the signed-in user,
  // then load the gated page. Runs on mount (the widget mounts only during a call).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await fetchVoiceUrl();
        if (!cancelled) setUri(url);
      } catch (e) {
        const code = e && e.response && e.response.data && e.response.data.code;
        const status = e && e.response && e.response.status;
        if (!cancelled) onStatus('error', code || (status ? 'token_http_' + status : String((e && e.message) || e)));
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
