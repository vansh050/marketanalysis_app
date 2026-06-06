/**
 * SdkBrokerConnectModal — unified, SDK-powered broker connect modal.
 *
 * Phase A (this commit): used as a parallel surface behind
 * isSdkIntegrationEnabled() for 4 pilot brokers — Zerodha, Kotak,
 * Angel One, Groww. Hooks into BrokerModalRenderer.js dispatch so the
 * legacy per-broker modals (KotakModal, ZerodhaConnectModal, …) stay
 * untouched in normal builds.
 *
 * State machine:
 *   form     → BrokerCredentialForm renders the broker's schema
 *   oauth    → form's apiKey+secret captured, WebViewBrokerAuthFlow
 *              opens the OAuth login URL; on redirect-URL match the
 *              SDK posts /exchange-token automatically
 *   done     → success copy + close button
 *   error    → surfaces SdkError, retry button restores `form`
 *
 * Behind the scenes:
 *   - schema-driven: schema.flow === 'oauth' routes through the
 *     WebView, others land directly via /update-credentials
 *   - the consumer's apiKey/secretKey for OAuth brokers go through
 *     the form first so they ride along to /exchange-token as
 *     extraExchangeBody — never baked into the bundle
 *   - on close at any step, an unfinished connect leaves no state
 *     server-side until /update-credentials or /exchange-token is hit
 */
import React, {useEffect, useState} from 'react';
import {Modal, View, Text, Pressable, StyleSheet} from 'react-native';
import {
  BrokerCredentialForm,
  WebViewBrokerAuthFlow,
  getBrokerFormSchema,
} from '@alphaquark/mobile-sdk';
import Config from 'react-native-config';

const BROKER_REDIRECT_URL =
  Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
  'https://prod.alphaquark.in/stock-recommendation';

// Brokers where the apiKey/secret is the ADVISOR'S shared key (read
// from the app's .env, mirroring legacy ZerodhaConnectUI behaviour),
// NOT a per-user secret. The form is empty for these — we go straight
// to the WebView with these creds pre-loaded into extraExchangeBody so
// the backend exchange-token can pass them through to ccxt's
// gen-access-token (or fall back to ccxt's own per-tenant config).
const ADVISOR_SHARED_OAUTH_EXTRAS = {
  // Mirrors legacy ZerodhaConnectUI: passes only apiKey to the exchange
  // step; the apiSecret is resolved server-side by ccxt-india's
  // ZERODHA_API_SECRET env var (see app_zerodha.py gen-access-token).
  Zerodha: () => {
    const apiKey = Config?.REACT_APP_ZERODHA_API_KEY;
    return apiKey ? {apiKey} : {};
  },
};

export default function SdkBrokerConnectModal({
  visible,
  onClose,
  broker,
  onSuccess,
}) {
  const schema = broker ? getBrokerFormSchema(broker) : null;
  const [phase, setPhase] = useState('form');
  const [oauthExtras, setOauthExtras] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);

  // Skip the form for OAuth brokers with no user-supplied fields —
  // jump straight to the WebView with advisor-shared apiKey/secret
  // from .env. Mirrors legacy ZerodhaConnectUI handleConnectZerodha:
  // the user only logs in to Kite, never types apiKey.
  useEffect(() => {
    if (!visible || !schema) return;
    if (
      schema.flow === 'oauth' &&
      Array.isArray(schema.fields) &&
      schema.fields.length === 0
    ) {
      const sharedExtrasFn = ADVISOR_SHARED_OAUTH_EXTRAS[broker];
      const sharedExtras = sharedExtrasFn ? sharedExtrasFn() : {};
      setOauthExtras(sharedExtras);
      setPhase('oauth');
    } else {
      setPhase('form');
      setOauthExtras({});
    }
    setErrorMsg(null);
  }, [visible, broker, schema]);

  const reset = () => {
    setPhase('form');
    setOauthExtras({});
    setErrorMsg(null);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  if (!broker || !schema) return null;

  // Header chrome — every phase needs a visible close affordance, and
  // the Android hardware back inside a Modal doesn't always reach the
  // host nav stack. The X button calls handleClose unconditionally;
  // legacy ZerodhaConnectUI had the same pattern (modal close in the
  // header) and we mirror it here for parity.
  const Header = ({title}) => (
    <View style={styles.header}>
      <Pressable
        onPress={handleClose}
        accessibilityLabel="Close"
        hitSlop={12}
        style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      transparent={false}>
      <View style={styles.root}>
        {phase === 'form' && (
          <>
            <Header title={`Connect ${broker}`} />
            <BrokerCredentialForm
              broker={broker}
              onContinueToOauth={extras => {
                setOauthExtras(extras);
                setPhase('oauth');
              }}
              onSuccess={() => {
                setPhase('done');
                onSuccess?.({broker, viaOauth: false});
              }}
              onError={err => {
                setErrorMsg(err?.detail || err?.error || 'Connect failed');
                setPhase('error');
              }}
            />
          </>
        )}

        {phase === 'oauth' && (
          <WebViewBrokerAuthFlow
            broker={broker}
            redirectUrl={BROKER_REDIRECT_URL}
            extraExchangeBody={oauthExtras}
            onSuccess={() => {
              setPhase('done');
              onSuccess?.({broker, viaOauth: true});
            }}
            onError={err => {
              setErrorMsg(err?.detail || err?.error || 'OAuth failed');
              setPhase('error');
            }}
            onClose={handleClose}
          />
        )}

        {phase === 'done' && (
          <>
            <Header title={broker} />
            <View style={styles.statusPanel}>
            <Text style={styles.statusOk}>✓ {broker} connected</Text>
            <Text style={styles.statusBody}>
              Your {broker} account is linked. Token expires in 15
              minutes per backend session policy; the SDK auto-refreshes.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </Pressable>
            </View>
          </>
        )}

        {phase === 'error' && (
          <>
            <Header title={broker} />
            <View style={styles.statusPanel}>
            <Text style={styles.statusBad}>✕ Could not connect {broker}</Text>
            <Text style={styles.statusBody}>{errorMsg}</Text>
            <Pressable style={styles.secondaryBtn} onPress={reset}>
              <Text style={styles.secondaryBtnText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  closeBtnText: {fontSize: 20, color: '#444'},
  headerTitle: {flex: 1, fontWeight: '600', fontSize: 16, marginLeft: 8},
  headerSpacer: {width: 36},
  statusPanel: {flex: 1, padding: 24, justifyContent: 'center'},
  statusOk: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 12,
  },
  statusBad: {
    fontSize: 22,
    fontWeight: '700',
    color: '#b00020',
    marginBottom: 12,
  },
  statusBody: {color: '#444', lineHeight: 20, marginBottom: 24},
  primaryBtn: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {color: '#fff', fontWeight: '600', fontSize: 16},
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: {color: '#1976d2', fontWeight: '600', fontSize: 16},
});
