/**
 * DefinEdgeConnectModal — DefinEdge Securities (INTEGRATE) connection flow.
 *
 * Two-step OTP flow, mirrors web
 * `prod-alphaquark-github/src/Home/BrokerConnection/DefinEdge/DefinEdgeConnection.js`:
 *
 *   Step 1 (creds form):
 *     apiKey (api_token) + secretKey (api_secret)
 *       →  POST /api/definedge/initiate-login
 *     Returns { otp_token }. INTEGRATE SMSes/emails the OTP.
 *
 *   Step 2 (otp form):
 *     otp (+ stored otpToken + both wrapped credentials)
 *       →  PUT /api/definedge/connect-broker
 *     Backend persists api_session_key (→ jwtToken), api_token (→ apiKey),
 *     api_secret (→ secretKey), actid (→ clientCode) on the user doc and
 *     `connected_brokers[DefinEdge Securities]`.
 *
 *   No resend-otp endpoint — if OTP isn't received the user re-runs
 *   initiate-login.
 *
 * Credentials wrapped with the same AES `ApiKeySecret` envelope as
 * Arihant / Kotak / AliceBlue.
 *
 * Cross-ref: docs/BROKER_CONNECTION.md § DefinEdge Securities.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useTrade } from '../../screens/TradeContext';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';

const wrapCredential = (value) =>
  CryptoJS.AES.encrypt(String(value || ''), 'ApiKeySecret').toString();

const DefinEdgeConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((s) => s.showAlert);
  const auth = getAuth();
  const userEmail = auth.currentUser?.email;

  const [apiKey, setApiKey] = useState('');        // api_token
  const [secretKey, setSecretKey] = useState('');  // api_secret
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [step, setStep] = useState('creds'); // creds | otp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [userDetails, setUserDetails] = useState(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  useEffect(() => {
    if (!isVisible) return;
    setStep('creds');
    setOtp('');
    setOtpToken('');
    setError('');
    setLoading(false);
  }, [isVisible]);

  useEffect(() => {
    if (!userEmail || !isVisible) return;
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: headers(),
      })
      .then((res) => setUserDetails(res.data?.User))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, isVisible]);

  const uid = userDetails?._id;

  const initiateLogin = async () => {
    setError('');
    if (!apiKey.trim() || apiKey.trim().length < 8) {
      setError('API token looks too short — copy from MyAccount → API Config.');
      return;
    }
    if (!secretKey.trim() || secretKey.trim().length < 8) {
      setError('API secret looks too short — copy from MyAccount → API Config.');
      return;
    }
    if (!uid) {
      setError("Couldn't load your account — please retry in a moment.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${server.server.baseUrl}api/definedge/initiate-login`,
        {
          uid,
          apiKey: wrapCredential(apiKey.trim()),
          apiSecret: wrapCredential(secretKey.trim()),
        },
        { headers: headers() },
      );
      const data = res.data?.data || {};
      const token = data.otp_token || data.otpToken;
      if (!token) {
        setError(
          res.data?.message || 'DefinEdge did not return an otp_token. Try again.',
        );
      } else {
        setOtpToken(token);
        setStep('otp');
        if (showAlert) {
          showAlert(
            'success',
            'OTP sent',
            data.message || 'OTP sent to your registered DefinEdge contact.',
          );
        }
      }
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          'Login failed. Please verify your credentials and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const connectDefinEdge = async () => {
    setError('');
    if (!/^\d+$/.test(otp) || otp.length < 4 || otp.length > 8) {
      setError('OTP must be 4–8 digits.');
      return;
    }
    if (!otpToken) {
      setStep('creds');
      setError('Session lost — please re-enter your api_token and api_secret.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(
        `${server.server.baseUrl}api/definedge/connect-broker`,
        {
          uid,
          otpToken,
          otp,
          apiKey: wrapCredential(apiKey.trim()),
          apiSecret: wrapCredential(secretKey.trim()),
        },
        { headers: headers() },
      );
      if (showAlert) {
        showAlert('success', 'Connected', 'DefinEdge connected successfully.');
      }
      eventEmitter.emit('refreshEvent', { source: 'DefinEdge connect' });
      if (fetchBrokerStatusModal) fetchBrokerStatusModal();
      onClose && onClose();
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.details ||
          'OTP verification failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={!!isVisible}
      animationType="slide"
      transparent
      onRequestClose={loading ? undefined : onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Connect DefinEdge</Text>
            {!loading && (
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={styles.closeX}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>
              {step === 'creds'
                ? "We'll send an OTP to your registered DefinEdge contact."
                : 'Enter the OTP DefinEdge sent to your registered mobile/email.'}
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Log in at{' '}
                <Text
                  style={styles.link}
                  onPress={() =>
                    Linking.openURL('https://myaccount.definedgesecurities.com/')
                  }
                >
                  myaccount.definedgesecurities.com
                </Text>{' '}
                → API Config to generate your api_token + api_secret. Sessions
                last ~8 hours — re-OTP after expiry. Note: tokens regenerate
                when you change your DefinEdge password.
              </Text>
            </View>

            {step === 'creds' ? (
              <>
                <Text style={styles.label}>API Token *</Text>
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={(t) => setApiKey(t.trim())}
                  placeholder="Enter api_token from MyAccount"
                  autoCapitalize="none"
                  editable={!loading}
                />

                <Text style={styles.label}>API Secret *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={secretKey}
                    onChangeText={(t) => setSecretKey(t.trim())}
                    placeholder="Enter api_secret from MyAccount"
                    secureTextEntry={!showSecret}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowSecret((v) => !v)}
                  >
                    <Text style={styles.eyeBtnText}>{showSecret ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>OTP *</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter OTP"
                  keyboardType="number-pad"
                  maxLength={8}
                  editable={!loading}
                  autoFocus
                />
                <Text style={styles.expiryHint}>
                  Didn't receive an OTP? Go Back and re-run "Send OTP" — DefinEdge does not support resend.
                </Text>
              </>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step === 'otp' && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep('creds');
                  setOtp('');
                  setOtpToken('');
                  setError('');
                }}
                disabled={loading}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={step === 'creds' ? initiateLogin : connectDefinEdge}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {step === 'creds' ? 'Send OTP' : 'Connect DefinEdge'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, maxHeight: '92%',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeX: { fontSize: 28, color: '#9ca3af', paddingHorizontal: 4, lineHeight: 28 },
  scroll: { maxHeight: 460 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  infoBox: {
    backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 14,
  },
  infoText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },
  link: { color: '#1d4ed8', textDecorationLine: 'underline' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
    marginBottom: 4, backgroundColor: '#fafafa',
  },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  eyeBtnText: { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },
  otpInput: { textAlign: 'center', letterSpacing: 6, fontSize: 18 },
  expiryHint: { fontSize: 11, color: '#6b7280', marginTop: 8 },
  errorBox: {
    marginTop: 12, backgroundColor: '#fef2f2', borderColor: '#fecaca',
    borderWidth: 1, borderRadius: 6, padding: 10,
  },
  errorText: { color: '#991b1b', fontSize: 12 },
  footer: { flexDirection: 'row', marginTop: 14 },
  backBtn: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', marginRight: 8,
  },
  backBtnText: { color: '#374151', fontWeight: '600' },
  submitBtn: {
    flex: 1, backgroundColor: '#1d4ed8', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9ca3af' },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});

export default DefinEdgeConnectModal;
