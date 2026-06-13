/**
 * ArihantConnectModal — Arihant Capital (TradeBridge) connection flow.
 *
 * Two-step OTP flow, mirrors web
 * `prod-alphaquark-github/src/Home/BrokerConnection/Arihant/ArihantConnection.js`:
 *
 *   Step 1 (creds form):
 *     userId + password + apiKey  →  POST /api/arihant/initiate-login
 *     Returns { txnId, otpExpiryTime }. Arihant SMS/emails the OTP.
 *
 *   Step 2 (otp form):
 *     otp (+ stored txnId)  →  PUT /api/arihant/connect-broker
 *     Backend persists accessToken / refreshToken / jwtToken / secretKey /
 *     clientCode on the user doc and `connected_brokers[Arihant Capital]`.
 *
 *   Resend OTP: POST /api/arihant/resend-otp (30s cooldown).
 *
 * Credentials wrapped with the same AES `ApiKeySecret` envelope as
 * Kotak / AliceBlue (`checkValidApiAnSecret` below).
 *
 * Cross-ref: docs/BROKER_CONNECTION.md § Arihant Capital.
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

const ArihantConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((s) => s.showAlert);
  const auth = getAuth();
  const userEmail = auth.currentUser?.email;

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [step, setStep] = useState('creds'); // creds | otp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
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

  // Reset state on every fresh open so a previous error / OTP step
  // doesn't bleed into the next attempt.
  useEffect(() => {
    if (!isVisible) return;
    setStep('creds');
    setOtp('');
    setTxnId('');
    setError('');
    setLoading(false);
    setResendCooldown(0);
  }, [isVisible]);

  // Fetch user._id once — Node-side Routes/Broker/Arihant.js needs
  // `uid` to look up the user doc when persisting credentials.
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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(
      () => setResendCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [resendCooldown]);

  const uid = userDetails?._id;

  const initiateLogin = async () => {
    setError('');
    if (!userId.trim() || userId.trim().length < 3) {
      setError('User ID must be at least 3 characters');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }
    if (!uid) {
      setError("Couldn't load your account — please retry in a moment.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${server.server.baseUrl}api/arihant/initiate-login`,
        {
          uid,
          userId: userId.trim(),
          password,
          apiKey: wrapCredential(apiKey.trim()),
        },
        { headers: headers() },
      );
      const data = res.data?.data || {};
      if (!data.txnId) {
        setError(res.data?.message || 'Arihant did not return a txnId. Try again.');
      } else {
        setTxnId(data.txnId);
        setOtpExpiry(data.otpExpiryTime || null);
        setStep('otp');
        setResendCooldown(30);
        if (showAlert) {
          showAlert(
            'success',
            'OTP sent',
            data.message || 'OTP sent to your registered mobile/email.',
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

  const connectArihant = async () => {
    setError('');
    if (!/^\d+$/.test(otp) || otp.length < 4 || otp.length > 8) {
      setError('OTP must be 4–8 digits.');
      return;
    }
    if (!txnId) {
      setStep('creds');
      setError('Session lost — please re-enter your credentials.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(
        `${server.server.baseUrl}api/arihant/connect-broker`,
        {
          uid,
          userId: userId.trim(),
          txnId,
          otp,
          apiKey: wrapCredential(apiKey.trim()),
        },
        { headers: headers() },
      );
      if (showAlert) {
        showAlert('success', 'Connected', 'Arihant Capital connected successfully.');
      }
      eventEmitter.emit('refreshEvent', { source: 'Arihant connect' });
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

  const resendOtp = async () => {
    if (resendCooldown > 0 || !txnId) return;
    setResendCooldown(30);
    try {
      await axios.post(
        `${server.server.baseUrl}api/arihant/resend-otp`,
        {
          uid,
          userId: userId.trim(),
          txnId,
          apiKey: wrapCredential(apiKey.trim()),
        },
        { headers: headers() },
      );
      if (showAlert) showAlert('success', 'OTP resent', 'A fresh OTP has been sent.');
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.details ||
        'Failed to resend OTP.';
      if (showAlert) showAlert('error', 'Resend failed', msg);
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
            <Text style={styles.headerTitle}>Connect Arihant Capital</Text>
            {!loading && (
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={styles.closeX}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>
              {step === 'creds'
                ? "We'll send an OTP to your registered Arihant contact."
                : 'Enter the OTP Arihant sent to your registered mobile/email.'}
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Log in at{' '}
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL('https://tradebridge.arihantplus.com/')}
                >
                  tradebridge.arihantplus.com
                </Text>{' '}
                to generate your API Key (App ID). Arihant sessions expire
                daily — tap Reconnect from the broker tile if trades fail
                with "Session Expired".
              </Text>
            </View>

            {step === 'creds' ? (
              <>
                <Text style={styles.label}>Arihant User ID *</Text>
                <TextInput
                  style={styles.input}
                  value={userId}
                  onChangeText={(t) => setUserId(t.trim())}
                  placeholder="Enter your Arihant login ID"
                  autoCapitalize="none"
                  editable={!loading}
                />

                <Text style={styles.label}>Password *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your Arihant password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Text style={styles.eyeBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>API Key (App ID) *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={apiKey}
                    onChangeText={(t) => setApiKey(t.trim())}
                    placeholder="Generated at tradebridge.arihantplus.com"
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowApiKey((v) => !v)}
                  >
                    <Text style={styles.eyeBtnText}>{showApiKey ? 'Hide' : 'Show'}</Text>
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
                <View style={styles.resendRow}>
                  <Text style={styles.resendHint}>
                    OTP sent to your registered Arihant contact.
                  </Text>
                  <TouchableOpacity
                    onPress={resendOtp}
                    disabled={resendCooldown > 0 || loading}
                  >
                    <Text
                      style={[
                        styles.resendCta,
                        (resendCooldown > 0 || loading) && styles.resendCtaDisabled,
                      ]}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {!!otpExpiry && (
                  <Text style={styles.expiryHint}>OTP expires at: {String(otpExpiry)}</Text>
                )}
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
                  setTxnId('');
                  setError('');
                }}
                disabled={loading}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={step === 'creds' ? initiateLogin : connectArihant}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {step === 'creds' ? 'Send OTP' : 'Connect Arihant'}
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
    backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 14,
  },
  infoText: { fontSize: 12, color: '#065f46', lineHeight: 18 },
  link: { color: '#047857', textDecorationLine: 'underline' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
    marginBottom: 4, backgroundColor: '#fafafa',
  },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  eyeBtnText: { color: '#047857', fontWeight: '600', fontSize: 12 },
  otpInput: { textAlign: 'center', letterSpacing: 6, fontSize: 18 },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  resendHint: { fontSize: 11, color: '#6b7280', flex: 1, marginRight: 8 },
  resendCta: { fontSize: 12, fontWeight: '600', color: '#047857' },
  resendCtaDisabled: { color: '#9ca3af' },
  expiryHint: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
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
    flex: 1, backgroundColor: '#047857', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9ca3af' },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});

export default ArihantConnectModal;
