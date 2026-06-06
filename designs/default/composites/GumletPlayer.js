/**
 * GumletPlayer — composites.GumletPlayer — VOD playback via Gumlet's
 * hosted iframe embed inside react-native-webview.
 *
 * Why WebView (porting doc §4.5 Option B): react-native-webview is
 * already installed; Gumlet's hosted player handles DRM + rendition
 * selection + controls + analytics natively — zero native deps for v1.
 *
 * Trade-offs (acceptable for v1):
 *   - UX is slightly clunkier than a native react-native-video pipe
 *     (e.g. fullscreen gestures, AirPlay, picture-in-picture not
 *     wired). For native HLS rendering, see the activation snippet at
 *     file end + add `react-native-video` to package.json.
 *   - DRM (FairPlay/Widevine) defers to Gumlet — matches web's current
 *     posture per docs/GUMLET_MIGRATION_ARCHITECTURE.md §11.
 *
 * Props:
 *   - lesson    : { _id, title, duration }
 *   - playback  : { assetId, embedUrl, url, expiresAt, drm, format }
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function GumletPlayer({ lesson, playback }) {
  const [loading, setLoading] = useState(true);

  // Prefer the hosted embedUrl; fall back to assetId-derived URL if for
  // any reason the backend omits it (older server responses).
  const src = useMemo(() => {
    if (playback?.embedUrl) return playback.embedUrl;
    if (playback?.assetId) return `https://play.gumlet.io/embed/${encodeURIComponent(playback.assetId)}`;
    return null;
  }, [playback?.embedUrl, playback?.assetId]);

  if (!src) {
    return (
      <View style={styles.box}>
        <Text style={styles.errorText}>Video URL missing from playback token.</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <WebView
        source={{ uri: src }}
        style={styles.web}
        // Required for iframe inline playback on iOS; matches Gumlet's
        // recommended embed config.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        // Cookies — Gumlet may use them for analytics + DRM session state.
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        // Keep the player from accidentally navigating to ads / external
        // links (Gumlet's embed doesn't normally do this, but defensive).
        originWhitelist={['https://play.gumlet.io', 'https://*.gumlet.io', 'https://*.gumlet.com']}
      />
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#ffffff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000', marginTop: 12, borderRadius: 6, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#000000' },
  loadingOverlay: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  errorText: { color: '#fecaca', padding: 12, fontSize: 13 },
});

/* =========================================================================
 * ACTIVATION SNIPPET — native HLS via react-native-video (Option A from
 * docs §4.5). Replace the WebView with the Video element below after:
 *
 *   yarn add react-native-video
 *   cd ios && pod install
 *
 * import Video from 'react-native-video';
 *
 * <Video
 *   source={{ uri: playback.url }}      // signed HLS, NOT embedUrl
 *   style={styles.web}
 *   controls
 *   resizeMode="contain"
 *   onLoad={() => setLoading(false)}
 *   onError={(e) => setLoading(false)}
 * />
 *
 * Note: DRM (FairPlay/Widevine) needs react-native-video v6+ and
 * additional source.drm config. Defer to Phase 4 unless the web
 * doc's §11 DRM gap closes earlier.
 * =========================================================================
 */
