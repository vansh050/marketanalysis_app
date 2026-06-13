import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TextInput,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useTrade } from '../../screens/TradeContext';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';
import { saveBrokerSessionTime } from '../../utils/brokerSessionUtils';
import EgressIpCallout from './EgressIpCallout';
import {ChevronDown, ChevronUp} from 'lucide-react-native';
import GrowwHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/GrowwHelpContent';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const { height: screenHeight } = Dimensions.get('window');

// Transport-layer wrap. The backend re-encrypts the seed with its
// own AES-256-CBC env key before Mongo write — this CryptoJS layer
// is only for wire protection. Same pattern as FyersConnect.js.
const encryptForTransport = (plain) =>
  CryptoJS.AES.encrypt(plain, 'ApiKeySecret').toString();

const GROWW_API_KEYS_URL = 'https://groww.in/trade-api/api-keys';

const GrowwConnectModal = ({
  isVisible,
  setShowBrokerModal,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();

  const [apiKey, setApiKey] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState();
  // Read More / See Less toggle — mirrors ZerodhaConnectUI's expanded
  // help pattern. Collapsed by default so the form stays the
  // primary action; tapping Read More expands the GrowwHelpContent
  // panel to show Important Notes + Need Help sections.
  const [helpExpanded, setHelpExpanded] = useState(false);
  // Gated by EgressIpCallout acknowledgment. Customers must claim a
  // dedicated egress IP, whitelist it on Groww's side, and tick the
  // acknowledgment checkbox before the Connect button does anything.
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const advisorSubdomain =
    configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain();

  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': advisorSubdomain,
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  useEffect(() => {
    if (!userEmail) return;
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: authHeaders,
      })
      .then((res) => setUserDetails(res.data.User))
      .catch((err) =>
        console.log('[Groww] Failed to fetch user details:', err?.message),
      );
  }, [userEmail, server.server.baseUrl]);

  const userId = userDetails?._id;

  const openGrowwDashboard = () => {
    Linking.openURL(GROWW_API_KEYS_URL).catch((err) =>
      console.warn('[Groww] Failed to open API keys page:', err?.message),
    );
  };

  const handleSubmit = async () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    if (!userId) {
      showAlert('error', 'Error', 'User not found. Please try again.');
      return;
    }
    const trimmedApiKey = apiKey.trim();
    const trimmedToken = totpToken.trim();
    if (!trimmedApiKey || !trimmedToken) {
      showAlert(
        'error',
        'Missing Credentials',
        'Paste both the API Key and the TOTP Secret Key (the Base32 string shown below the QR on Groww\'s "Generate TOTP token" dialog — not the JWT-style token at the top).',
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        uid: userId,
        user_email: userEmail,
        user_broker: 'Groww',
        apiKey: encryptForTransport(trimmedApiKey),
        totp_seed: encryptForTransport(trimmedToken),
      };
      const res = await axios.post(
        `${server.server.baseUrl}api/groww/update-key`,
        payload,
        { headers: authHeaders, timeout: 25000 },
      );
      if (res.data?.success) {
        try {
          await saveBrokerSessionTime('Groww');
        } catch (_) {
          // non-critical
        }

        // SDK pilot dual-write — see brokerSdkBridge.js. Groww uses
        // /api/groww/update-key (no /api/user/connect-broker step
        // because update-key persists directly), so we mirror with
        // /sdk/v1/connections/Groww/connect.
        if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
          sdkDualWriteSafely(
            sdkConnectBroker(sdkBridge.client, 'Groww', payload),
            'Groww',
            'connect',
          );
        }

        // Non-critical — model-portfolio broker sync, same as FyersConnect.
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
            { user_email: userEmail, user_broker: 'Groww' },
            { headers: authHeaders },
          );
        } catch (mpErr) {
          console.warn(
            '[Groww] Model portfolio update failed (non-critical):',
            mpErr?.message,
          );
        }

        setShowBrokerModal?.(false);
        onClose?.();
        // Wrap post-success steps so a downstream throw doesn't bubble
        // to the outer catch and get rewritten as a granular Groww error
        // code or "Connection Error". See KotakModal.js (commit 172767d)
        // and BROKER_CONNECTION.md § Broker-connect post-success hygiene.
        try {
          const result = await fetchBrokerStatusModal?.();
          eventEmitter.emit('refreshEvent', {
            source: 'Groww broker connection',
          });
          if (!result?.migrationWillShow) {
            showAlert(
              'success',
              'Connected Successfully',
              'Your Groww broker has been connected. Daily session refresh is now one tap.',
            );
          }
        } catch (postSuccessErr) {
          console.warn(
            '[Groww] post-success step threw (connection IS saved DB-side):',
            postSuccessErr?.message || postSuccessErr,
          );
        }
        return;
      }
      showAlert(
        'error',
        'Connection Error',
        res.data?.message ||
          'Failed to connect Groww. Please verify your API Key, TOTP Secret Key (Base32 string below the QR), and that your dedicated IP is whitelisted on Groww.',
      );
    } catch (err) {
      const errorCode = err?.response?.data?.error_code;
      const serverMessage = err?.response?.data?.message;
      console.error('[Groww] update-key failed:', err?.message, errorCode);
      // Granular codes come from ccxt-india app_groww.py:_normalize_totp_token
      // (NOT_BASE32, WRONG_LENGTH) and _mint_groww_access_token
      // (GROWW_REJECTED). INVALID_SEED / INVALID_CREDENTIALS are the
      // pre-normalization codes, kept for rollout compat.
      if (errorCode === 'NOT_BASE32') {
        showAlert(
          'error',
          'TOTP Secret Key format is off',
          serverMessage ||
            'The TOTP Secret Key needs to be the Base32 string from BELOW the QR code on Groww\'s "Generate TOTP token" dialog — ~32 characters of A–Z and 2–7 only (e.g. HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP). The API Key field takes the JWT at the top of the same dialog, but the TOTP Secret Key must be the Base32 below the QR.',
        );
      } else if (errorCode === 'WRONG_LENGTH') {
        showAlert(
          'error',
          'TOTP Secret Key looks incomplete',
          serverMessage ||
            'The Base32 secret you pasted is shorter than Groww\'s minimum. Make sure you copied the full ~32-character string shown below the QR on the "Generate TOTP token" dialog — it\'s shown only once.',
        );
      } else if (errorCode === 'GROWW_REJECTED') {
        showAlert(
          'error',
          'Groww rejected the credentials',
          serverMessage ||
            'Groww did not accept the combination. Most common causes: (1) the API Key field is missing or has the wrong value — it should be the long JWT-style "TOTP Token" from the TOP of Groww\'s "Generate TOTP token" dialog. (2) the TOTP Secret Key is from a different "Generate TOTP token" dialog than the JWT you pasted. (3) your dedicated static IP is not whitelisted — click "Update static IP" on Groww and add the IP shown below.',
        );
      } else if (
        errorCode === 'INVALID_SEED' ||
        errorCode === 'INVALID_CREDENTIALS'
      ) {
        showAlert(
          'error',
          'Groww rejected the credentials',
          serverMessage ||
            'Same mismatch as above. Verify (1) the API Key is the JWT from the TOP of the "Generate TOTP token" dialog, (2) the TOTP Secret Key is the Base32 string below the QR in the SAME dialog, and (3) your dedicated static IP is whitelisted via Groww\'s "Update static IP".',
        );
      } else {
        // Gate the generic "Connection Error" wording on whether axios
        // actually got an HTTP response. If err.response is missing,
        // it's a network/runtime error and we shouldn't claim Groww
        // rejected the credentials. See KotakModal.js (commit 172767d).
        const isHttpError = !!err?.response;
        if (isHttpError) {
          showAlert(
            'error',
            'Connection Error',
            serverMessage ||
              err?.message ||
              'Failed to connect to Groww. Please try again.',
          );
        } else {
          showAlert(
            'error',
            'Connection Issue',
            'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.',
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = loading || !apiKey.trim() || !totpToken.trim();

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Connect to Groww</Text>
            <Text style={styles.description}>
              One-time setup. After this, refreshing your Groww session is a
              single tap — no re-pasting credentials each day.
            </Text>

            <View style={styles.stepsBlock}>
              <View style={styles.stepRow}>
                <View style={styles.stepBullet}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>
                    Open Groww's Trade API page
                  </Text>
                  <TouchableOpacity onPress={openGrowwDashboard}>
                    <Text style={styles.linkText}>
                      groww.in/trade-api/api-keys
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepBullet}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>
                    Click "Generate API key" (top right) → "Generate TOTP token"
                  </Text>
                  <Text style={styles.stepBodyText}>
                    On Groww's Trade API keys page, open the{' '}
                    <Text style={styles.boldText}>Generate API key</Text>{' '}
                    dropdown at the top right and pick{' '}
                    <Text style={styles.boldText}>Generate TOTP token</Text>{' '}
                    (not "Generate Access Token"). Groww opens a "TOTP
                    token" dialog with <Text style={styles.boldText}>two
                    values you need — both come from this single dialog</Text>.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepBullet}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>
                    Copy both values from the TOTP dialog
                  </Text>
                  <Text style={styles.stepBodyText}>
                    Groww's "TOTP token" dialog shows two values — both
                    are needed, both come from this single dialog:
                    {'\n\n'}
                    • <Text style={styles.boldText}>JWT at the top</Text>{' '}
                    (starts with{' '}
                    <Text style={styles.monoText}>eyJraWQi…</Text>) → paste
                    into our <Text style={styles.boldText}>"TOTP Token
                    (used as API Key)"</Text> field below. Groww uses this
                    as the Bearer token.
                    {'\n\n'}
                    • <Text style={styles.boldText}>Base32 secret below
                    the QR</Text> (~32 chars, A–Z and 2–7, e.g.{' '}
                    <Text style={styles.monoText}>
                      HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP
                    </Text>
                    ) → paste into our <Text style={styles.boldText}>"TOTP
                    QR Secret (Base32)"</Text> field below. Our backend
                    uses it to mint a fresh 6-digit TOTP every daily
                    refresh.
                    {'\n\n'}
                    Both values are shown only once — copy them carefully
                    before closing the dialog.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepBullet}>
                  <Text style={styles.stepNumber}>4</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>
                    Click "Update static IP" and whitelist the dedicated IP
                  </Text>
                  <Text style={styles.stepBodyText}>
                    Still on the Trade API keys page, click{' '}
                    <Text style={styles.boldText}>Update static IP</Text>{' '}
                    (top right, next to Generate API key) and paste the
                    dedicated IP we issue you (shown below) into the
                    whitelist. Groww rejects access-token requests and
                    orders from non-whitelisted IPs — the most common
                    cause of the "Groww rejected the credentials" error.
                  </Text>
                </View>
              </View>
            </View>

            {/* Read More / See Less expandable help — mirrors
                ZerodhaConnectUI's pattern. Collapsed shows a one-line
                "About this connection"; expanded reveals Important
                Notes + Need Help sections (matching Zerodha's yellow
                callout + gray support box). */}
            <View style={styles.guideBox}>
              <GrowwHelpContent
                expanded={helpExpanded}
                onExpandChange={setHelpExpanded}
              />
            </View>
            <TouchableOpacity
              onPress={() => setHelpExpanded(prev => !prev)}
              style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {helpExpanded ? 'See Less' : 'Read More'}
              </Text>
              <View style={styles.toggleIconContainer}>
                {helpExpanded ? (
                  <ChevronUp size={14} color="#000" />
                ) : (
                  <ChevronDown size={14} color="#000" />
                )}
              </View>
            </TouchableOpacity>

            {/* Per-customer dedicated IP claim/whitelist gate.
                Submit button is locked until the customer has claimed
                an IP, whitelisted it on Groww's side, and ticked the
                acknowledgment checkbox. */}
            <EgressIpCallout
              broker="groww"
              customerId={userId}
              customerEmail={userEmail}
              onAcknowledgeChange={setEgressReady}
              showUnmetAck={unmetAck}
              onUnmetAckHandled={() => setUnmetAck(false)}
            />

            <Text style={styles.inputLabel}>TOTP Token (used as API Key) *</Text>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Paste the JWT (eyJraWQi…) from the TOP of Groww's dialog"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={[styles.input, styles.monoInput]}
            />
            <Text style={styles.helperText}>
              The long JWT-style value labelled "TOTP Token" at the TOP of
              Groww's "Generate TOTP token" dialog — Groww uses this as
              the Bearer token. Not the Base32 secret below the QR (that
              goes in the next field).
            </Text>

            <Text style={styles.inputLabel}>TOTP QR Secret (Base32) *</Text>
            <TextInput
              value={totpToken}
              onChangeText={setTotpToken}
              placeholder="Paste the ~32-char Base32 secret below the QR (A–Z, 2–7)"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              style={[styles.input, styles.monoInput]}
            />
            <Text style={styles.helperText}>
              The ~32-character Base32 secret shown BELOW the QR code on
              Groww's "Generate TOTP token" dialog. Stored encrypted;
              never shown back to you. If the secret is ever revoked on
              Groww, generate a new one and
              reconnect here.
            </Text>

            <TouchableOpacity
              style={[styles.button, submitDisabled && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitDisabled}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Connect Groww</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: screenHeight * 0.9,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsBlock: {
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1faea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a7a5a',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  stepBodyText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#333',
  },
  monoText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    color: '#333',
  },
  linkText: {
    fontSize: 13,
    color: '#1d6be8',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111',
    marginBottom: 10,
  },
  monoInput: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  helperText: {
    fontSize: 12,
    color: '#777',
    lineHeight: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#00d09c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#b7e6d6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
  },
  // Read More / See Less help-panel styles. Mirrors
  // ZerodhaConnectUI's guideBox + toggleContainer / toggleText /
  // toggleIconContainer for cross-broker visual parity.
  guideBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#ccc',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 86, 183, 1)',
    marginRight: 8,
  },
  toggleIconContainer: {
    backgroundColor: '#fff',
    elevation: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
});

export default GrowwConnectModal;
