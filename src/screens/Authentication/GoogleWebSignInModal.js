/**
 * GoogleWebSignInModal — WebView-based Google Sign-In fallback for Android.
 *
 * Why this exists: native @react-native-google-signin/google-signin matches the
 * APK's signing-cert SHA-1 against the Firebase project's Android OAuth client.
 * When the SHA-1 isn't registered (or a release/upload-key/Play-signing
 * fingerprint is still in flight), every sign-in attempt returns
 * DEVELOPER_ERROR (status code 10). This modal sidesteps the native SDK by
 * running OAuth 2.0 implicit-grant against the project's Web client ID
 * (`config.googleWebClientId`) inside a WebView — the Web client has no SHA-1
 * binding, so it works while Android SHA fingerprints reconcile.
 *
 * Flow:
 *   1. Modal opens, WebView loads `https://accounts.google.com/o/oauth2/v2/auth`
 *      with response_type=id_token + nonce + redirect_uri pointed at the
 *      project's Firebase Auth handler URL.
 *   2. User picks an account / consents.
 *   3. Google redirects to the handler URL with `#id_token=...` in the
 *      fragment. We intercept via onShouldStartLoadWithRequest, parse the
 *      fragment, and hand the idToken back via onIdToken().
 *   4. LoginScreen exchanges idToken for a Firebase credential
 *      (auth.GoogleAuthProvider.credential) — same path as the native SDK.
 *
 * Notes:
 *   - The redirect URI `https://<authDomain>/__/auth/handler` is automatically
 *     authorized for the project's web client when Firebase Auth is enabled,
 *     so no Google Cloud Console change is required.
 *   - We spoof a Chrome user-agent because Google rejects raw WebView UAs
 *     (`disallowed_useragent`) on its OAuth screens. The Android system
 *     WebView is Chromium-based, so the spoof matches the underlying engine.
 *   - This is a TEMPORARY workaround — once all release SHA-1s land in
 *     Firebase, prefer the native flow (it's faster + supports Smart Lock).
 */

import React, { useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const randomNonce = () => {
    const arr = new Array(16);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const SPOOFED_UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const parseFragment = (url) => {
    const hashIdx = url.indexOf('#');
    if (hashIdx === -1) return {};
    const out = {};
    url.slice(hashIdx + 1)
        .split('&')
        .forEach((kv) => {
            const [k, v = ''] = kv.split('=');
            if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
        });
    return out;
};

const GoogleWebSignInModal = ({
    visible,
    onClose,
    onIdToken,
    onError,
    webClientId,
    firebaseAuthDomain,
}) => {
    const [loading, setLoading] = useState(true);
    const nonce = useMemo(() => randomNonce(), [visible]);
    const redirectUri = `https://${firebaseAuthDomain}/__/auth/handler`;

    const authUrl = useMemo(() => {
        if (!webClientId || !firebaseAuthDomain) return null;
        const params = [
            ['client_id', webClientId],
            ['redirect_uri', redirectUri],
            ['response_type', 'id_token'],
            ['scope', 'openid email profile'],
            ['nonce', nonce],
            ['prompt', 'select_account'],
        ]
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }, [webClientId, redirectUri, nonce, firebaseAuthDomain]);

    const handleRequest = (req) => {
        const { url } = req || {};
        if (!url) return true;
        if (url.startsWith(redirectUri)) {
            const params = parseFragment(url);
            if (params.id_token) {
                onIdToken && onIdToken(params.id_token);
                onClose && onClose();
                return false;
            }
            if (params.error) {
                onError && onError(new Error(`Google OAuth error: ${params.error}`));
                onClose && onClose();
                return false;
            }
        }
        return true;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={styles.closeTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Sign in with Google</Text>
                    <View style={styles.spacer} />
                </View>

                {authUrl ? (
                    <View style={styles.webContainer}>
                        <WebView
                            source={{ uri: authUrl }}
                            onShouldStartLoadWithRequest={handleRequest}
                            onLoadEnd={() => setLoading(false)}
                            onError={(e) => {
                                onError && onError(new Error(e?.nativeEvent?.description || 'WebView error'));
                                onClose && onClose();
                            }}
                            sharedCookiesEnabled
                            thirdPartyCookiesEnabled
                            javaScriptEnabled
                            domStorageEnabled
                            originWhitelist={['*']}
                            userAgent={SPOOFED_UA}
                            applicationNameForUserAgent={undefined}
                            cacheEnabled={false}
                            incognito={Platform.OS === 'android'}
                        />
                        {loading && (
                            <View style={styles.overlay} pointerEvents="none">
                                <ActivityIndicator size="large" color="#2056DF" />
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorTxt}>
                            Google Sign-In isn't configured. Missing web client ID or auth domain.
                        </Text>
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e1e1e1',
    },
    closeBtn: { paddingVertical: 4, paddingRight: 12 },
    closeTxt: { fontSize: 15, color: '#2056DF', fontWeight: '500' },
    title: { fontSize: 16, fontWeight: '600', color: '#0A0F1D', flex: 1, textAlign: 'center' },
    spacer: { width: 60 },
    webContainer: { flex: 1, position: 'relative' },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    errorContainer: { flex: 1, justifyContent: 'center', padding: 24 },
    errorTxt: { fontSize: 14, color: '#c00', textAlign: 'center' },
});

export default GoogleWebSignInModal;
