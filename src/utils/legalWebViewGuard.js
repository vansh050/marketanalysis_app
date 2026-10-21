/**
 * WebView navigation guard for the legal-document screens (Privacy Policy,
 * Terms & Conditions).
 *
 * The old guard allowed only the exact configured URL and popped the screen on
 * anything else. A routine redirect (trailing slash, http→https, www) therefore
 * closed the screen ~0.1s after it opened (Kyzen, 2026-10-21:
 * kyzenresearch.com/privacy-policy → /privacy-policy/).
 *
 * Rules: redirects, sub-frames and non-click loads stay in the WebView; a
 * clicked link to the same document stays; a clicked link elsewhere opens in
 * the system browser. The screen is never closed by the guard.
 */
import { Linking } from 'react-native';

const normalize = (url) => {
    const m = String(url || '')
        .trim()
        .match(/^(?:https?:\/\/)?(?:www\.)?([^/?#]+)([^?#]*)/i);
    if (!m) return '';
    return `${m[1].toLowerCase()}${m[2].replace(/\/+$/, '')}`;
};

export const isSameLegalDocument = (requestUrl, docUrl) => {
    if (!requestUrl || !docUrl) return false;
    return normalize(requestUrl) === normalize(docUrl);
};

export const makeLegalWebViewGuard = (docUrl, openExternal = Linking.openURL) => (request) => {
    const url = request?.url || '';
    if (!url || url === 'about:blank' || isSameLegalDocument(url, docUrl)) return true;
    // Sub-frames (iOS reports isTopFrame) and anything the user did not click
    // (redirects, scripted loads) stay inside the WebView.
    if (request?.isTopFrame === false) return true;
    if (request?.navigationType && request.navigationType !== 'click') return true;
    // Android does not report navigationType: only http(s) loads stay in-app.
    if (!request?.navigationType && /^https?:/i.test(url)) return true;
    try {
        openExternal(url);
    } catch (e) {
        // Opening externally is best effort; never close the screen.
    }
    return false;
};
