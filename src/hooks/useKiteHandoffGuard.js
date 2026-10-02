import {useCallback, useEffect, useRef} from 'react';
import Toast from 'react-native-toast-message';
import {logZerodhaDiagnostic} from '../utils/Logging';

const KITE_HANDOFF_TIMEOUT_MS = 12000;
const eventUrl = event => event?.nativeEvent?.url || event?.url || '';
export const isKiteUrl = url => {
  const match = String(url || '').match(/^https?:\/\/([^/:?#]+)/i);
  return Boolean(match && /(^|\.)kite\.zerodha\.com$/i.test(match[1]));
};

/** Quiet HTML-form → Kite handoff monitoring with one invisible retry. */
export default function useKiteHandoffGuard({
  visible,
  webViewRef,
  configData,
  flow,
  attemptId,
}) {
  const timerRef = useRef(null);
  const retryCountRef = useRef(0);
  const kiteStartedRef = useRef(false);

  const emit = useCallback((phase, detail = {}) => {
    logZerodhaDiagnostic('zerodha_mobile_handoff', {
      phase,
      flow,
      attemptId: attemptId || null,
      ...detail,
    }, configData);
  }, [attemptId, configData, flow]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const armTimeout = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (kiteStartedRef.current) return;
      if (retryCountRef.current === 0) {
        retryCountRef.current = 1;
        emit('pre_kite_timeout_auto_retry');
        webViewRef.current?.reload?.();
        timerRef.current = setTimeout(() => {
          if (kiteStartedRef.current) return;
          emit('pre_kite_timeout_terminal');
          Toast.show({
            type: 'error',
            text1: 'Could not open Kite',
            text2: 'Please check your connection and try again. No order was sent.',
            visibilityTime: 7000,
          });
        }, KITE_HANDOFF_TIMEOUT_MS);
        return;
      }
      emit('pre_kite_timeout_terminal');
      Toast.show({
        type: 'error',
        text1: 'Could not open Kite',
        text2: 'Please check your connection and try again. No order was sent.',
        visibilityTime: 7000,
      });
    }, KITE_HANDOFF_TIMEOUT_MS);
  }, [clearTimer, emit, webViewRef]);

  useEffect(() => {
    if (!visible) {
      clearTimer();
      return undefined;
    }
    retryCountRef.current = 0;
    kiteStartedRef.current = false;
    emit('form_prepared');
    armTimeout();
    return clearTimer;
  }, [armTimeout, clearTimer, emit, visible]);

  const noteUrl = useCallback((url, phase) => {
    if (!url || !isKiteUrl(url)) return;
    kiteStartedRef.current = true;
    clearTimer();
    emit(phase, {host: 'kite.zerodha.com'});
  }, [clearTimer, emit]);

  const reportFailure = useCallback((kind, event) => {
    clearTimer();
    const ambiguous = kiteStartedRef.current;
    emit(kind, {
      ambiguous,
      code: event?.nativeEvent?.code || event?.nativeEvent?.statusCode || null,
      description: event?.nativeEvent?.description || null,
    });
    Toast.show({
      type: 'error',
      text1: ambiguous ? 'Kite response was interrupted' : 'Could not open Kite',
      text2: ambiguous
        ? 'Check Kite Orders before trying again.'
        : 'Please check your connection and try again. No order was sent.',
      visibilityTime: 7000,
    });
  }, [clearTimer, emit]);

  return {
    onLoadStart: event => noteUrl(eventUrl(event), 'kite_navigation_started'),
    onLoadEnd: event => noteUrl(eventUrl(event), 'kite_page_loaded'),
    onNavigationStateChange: state =>
      noteUrl(state?.url || '', 'kite_navigation_observed'),
    onError: event => reportFailure('webview_error', event),
    onHttpError: event => reportFailure('webview_http_error', event),
  };
}
