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

  const [apiKey, setApiKey] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState();
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

        fetchBrokerStatusModal?.();
        eventEmitter.emit('refreshEvent', {
          source: 'Groww broker connection',
        });
        showAlert(
          'success',
          'Connected Successfully',
          'Your Groww broker has been connected. Daily session refresh is now one tap.',
        );
        setShowBrokerModal?.(false);
        onClose?.();
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
        showAlert(
          'error',
          'Connection Error',
          serverMessage ||
            err?.message ||
            'Failed to connect to Groww. Please try again.',
        );
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
});

export default GrowwConnectModal;
