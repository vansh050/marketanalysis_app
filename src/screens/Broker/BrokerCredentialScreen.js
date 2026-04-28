/**
 * BrokerCredentialScreen — Generic credential form for hybrid and credential-only brokers.
 * Handles: Upstox, ICICI Direct, HDFC, Fyers, Motilal Oswal (hybrid — form + OAuth)
 *          Kotak (pure credential — form + TOTP)
 *
 * Route params:
 *   brokerConfig: BrokerConfig from brokerRegistry
 *   onSuccess: () => void (callback after connection)
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';
import CryptoJS from 'react-native-crypto-js';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { getApiBrokerName, BROKER_AUTH_TYPE } from '../../config/brokerRegistry';
import { getBrokerCallbackUrl } from '../../utils/brokerAuth';
import useModalStore from '../../GlobalUIModals/modalStore';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const encrypt = (val) => CryptoJS.AES.encrypt(val, 'ApiKeySecret').toString();

const BrokerCredentialScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { brokerConfig, onSuccess } = route.params || {};

  const auth = getAuth();
  const userEmail = auth.currentUser?.email;
  const showAlert = useModalStore((state) => state.showAlert);

  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const hasConnected = useRef(false);

  const brokerName = brokerConfig?.name;
  const brokerKey = brokerConfig?.key;
  const apiBrokerName = getApiBrokerName(brokerConfig);
  const fields = brokerConfig?.fields || [];
  const isHybrid = brokerConfig?.authType === BROKER_AUTH_TYPE.HYBRID;

  // ---------------------------------------------------------------------------
  // Get user ID
  // ---------------------------------------------------------------------------
  const getUserId = useCallback(async () => {
    if (!userEmail) return null;
    try {
      const resp = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${encodeURIComponent(userEmail)}`,
        { headers: getHeaders(), timeout: 10000 },
      );
      return resp.data?.data?._id || resp.data?._id;
    } catch { return null; }
  }, [userEmail]);

  // ---------------------------------------------------------------------------
  // Validate form
  // ---------------------------------------------------------------------------
  const validate = () => {
    const newErrors = {};
    for (const field of fields) {
      const val = (formValues[field.key] || '').trim();
      if (!val) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (field.validation && !new RegExp(field.validation).test(val)) {
        newErrors[field.key] = field.validationError || `Invalid ${field.label}`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------------------------------------------------------
  // Connection success handler
  // ---------------------------------------------------------------------------
  const onConnectionSuccess = useCallback(async () => {
    // Switch model portfolios to new broker (non-critical)
    axios.post(
      `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
      { user_email: userEmail, user_broker: apiBrokerName },
      { headers: getHeaders(), timeout: 10000 },
    ).catch(() => {});

    showAlert('success', 'Connected', `${brokerName} connected successfully.`);
    if (onSuccess) onSuccess();
    navigation.goBack();
  }, [brokerName, apiBrokerName, userEmail, onSuccess, navigation, showAlert]);

  // ---------------------------------------------------------------------------
  // Submit credentials per broker
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');

      const callbackUrl = getBrokerCallbackUrl();

      switch (brokerKey) {
        // ── HYBRID BROKERS: form → get OAuth URL → WebView ──
        case 'upstox': {
          const resp = await axios.post(
            `${server.server.baseUrl}api/upstox/update-key`,
            {
              uid: userId,
              apiKey: encrypt(formValues.apiKey),
              secretKey: encrypt(formValues.secretKey),
              redirect_uri: callbackUrl,
            },
            { headers: getHeaders(), timeout: 15000 },
          );
          const authUrl = resp.data?.response;
          if (!authUrl) throw new Error('No auth URL returned');
          setWebviewUrl(authUrl);
          setSubmitting(false);
          return;
        }

        case 'icicidirect': {
          const resp = await axios.put(
            `${server.server.baseUrl}api/icici/update-key`,
            { uid: userId, apiKey: encrypt(formValues.apiKey), secretKey: encrypt(formValues.secretKey) },
            { headers: getHeaders(), timeout: 15000 },
          );
          const authUrl = resp.data?.response?.loginUrl || resp.data?.response;
          if (authUrl && authUrl.startsWith('http')) {
            setWebviewUrl(authUrl);
          } else {
            // ICICI may return a redirect URL to open externally
            await saveBrokerConnection(userId, { jwtToken: '', clientCode: '' });
            await onConnectionSuccess();
          }
          setSubmitting(false);
          return;
        }

        case 'hdfc': {
          const resp = await axios.post(
            `${server.server.baseUrl}api/hdfc/update-key`,
            { uid: userId, apiKey: encrypt(formValues.apiKey), secretKey: encrypt(formValues.secretKey) },
            { headers: getHeaders(), timeout: 15000 },
          );
          const authUrl = resp.data?.response?.loginUrl || resp.data?.response;
          if (authUrl && authUrl.startsWith('http')) {
            setWebviewUrl(authUrl);
          } else {
            throw new Error('No auth URL returned');
          }
          setSubmitting(false);
          return;
        }

        case 'fyers': {
          const resp = await axios.post(
            `${server.server.baseUrl}api/fyers/update-key`,
            {
              uid: userId,
              redirect_url: callbackUrl,
              clientCode: formValues.secretKey,
              secretKey: encrypt(formValues.clientCode),
            },
            { headers: getHeaders(), timeout: 15000 },
          );
          const authUrl = resp.data?.response;
          if (!authUrl) throw new Error('No auth URL returned');
          setWebviewUrl(authUrl);
          setSubmitting(false);
          return;
        }

        case 'motilal': {
          const resp = await axios.put(
            `${server.server.baseUrl}api/motilal-oswal/update-key`,
            {
              uid: userId,
              apiKey: formValues.apiKey,
              clientCode: formValues.clientCode,
              redirectUrl: brokerConfig.redirectUrl || callbackUrl,
            },
            { headers: getHeaders(), timeout: 15000 },
          );
          const authUrl = resp.data?.response?.loginUrl || resp.data?.response;
          if (authUrl && authUrl.startsWith('http')) {
            setWebviewUrl(authUrl);
          } else {
            throw new Error('No auth URL returned');
          }
          setSubmitting(false);
          return;
        }

        // ── PURE CREDENTIAL: Groww (TOTP-seed) ──
        // 2026-04-21: routes to /api/groww/update-key with
        // {apiKey, totp_seed} so the backend stores the seed
        // AES-256 encrypted and enables one-tap daily refresh via
        // /api/groww/refresh-token. Without this explicit case the
        // default branch would POST to /api/user/connect-broker which
        // trusts an upstream-validated jwtToken — wrong for Groww
        // since the customer is handing us raw credentials.
        case 'groww': {
          await axios.post(
            `${server.server.baseUrl}api/groww/update-key`,
            {
              uid: userId,
              user_email: userEmail,
              user_broker: 'Groww',
              apiKey: encrypt(formValues.apiKey),
              totp_seed: encrypt(formValues.totp_seed),
            },
            { headers: getHeaders(), timeout: 20000 },
          );
          await onConnectionSuccess();
          setSubmitting(false);
          return;
        }

        // ── PURE CREDENTIAL: Kotak ──
        case 'kotak': {
          await axios.put(
            `${server.server.baseUrl}api/kotak/connect-broker`,
            {
              uid: userId,
              apiKey: encrypt(formValues.apiKey),
              secretKey: encrypt(formValues.secretKey),
              mobileNumber: '+91' + formValues.mobileNumber,
              mpin: formValues.mpin,
              ucc: formValues.ucc,
              totp: formValues.totp,
            },
            { headers: getHeaders(), timeout: 20000 },
          );
          await onConnectionSuccess();
          setSubmitting(false);
          return;
        }

        default: {
          // Generic fallback
          const body = { uid: userId, user_broker: apiBrokerName };
          for (const field of fields) {
            body[field.key] = field.isSecret ? encrypt(formValues[field.key]) : formValues[field.key];
          }
          await axios.put(
            `${server.server.baseUrl}api/user/connect-broker`,
            body,
            { headers: getHeaders(), timeout: 15000 },
          );
          await onConnectionSuccess();
          setSubmitting(false);
          return;
        }
      }
    } catch (e) {
      console.error(`[BrokerCredential:${brokerKey}] submit error:`, e.message);
      setErrorMsg(e.response?.data?.message || e.message || 'Connection failed');
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save broker connection to DB (reused by WebView callback)
  // ---------------------------------------------------------------------------
  const saveBrokerConnection = async (userId, extraFields) => {
    await axios.put(
      `${server.server.baseUrl}api/user/connect-broker`,
      { uid: userId, user_broker: apiBrokerName, ...extraFields },
      { headers: getHeaders(), timeout: 15000 },
    );
  };

  // ---------------------------------------------------------------------------
  // WebView callback handler (for hybrid brokers after OAuth)
  // ---------------------------------------------------------------------------
  const handleWebViewCallback = useCallback(async (url) => {
    if (hasConnected.current) return;
    hasConnected.current = true;
    setWebviewUrl(null);
    setSubmitting(true);

    try {
      const params = {};
      const qs = url.includes('?') ? url.split('?')[1] : '';
      qs.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });

      const userId = await getUserId();
      if (!userId) throw new Error('User not found');

      switch (brokerKey) {
        case 'upstox': {
          const code = params.code || params.auth_code;
          if (!code) throw new Error('No auth code received');
          // Backend exchanges code for token
          await saveBrokerConnection(userId, {
            jwtToken: code,
            secretKey: encrypt(formValues.apiKey),
          });
          break;
        }

        case 'fyers': {
          const authCode = params.auth_code || params.code;
          if (!authCode) throw new Error('No auth code received');
          // Exchange auth code for access token
          const resp = await axios.post(
            `${server.ccxtServer.baseUrl}fyers/gen-access-token`,
            { user_email: userEmail, clientId: formValues.secretKey, clientSecret: formValues.clientCode, authCode },
            { headers: getHeaders(), timeout: 15000 },
          );
          const token = resp.data?.accessToken || resp.data?.data?.accessToken;
          await saveBrokerConnection(userId, {
            jwtToken: token,
            clientCode: formValues.secretKey,
            secretKey: encrypt(formValues.clientCode),
          });
          break;
        }

        case 'icicidirect':
        case 'hdfc':
        case 'motilal': {
          const token = params.access_token || params.auth_token || params.jwtToken;
          const saveData = {};
          if (token) saveData.jwtToken = token;
          if (params.client_id) saveData.clientCode = params.client_id;
          await saveBrokerConnection(userId, saveData);
          break;
        }

        default:
          throw new Error(`Unhandled WebView callback for ${brokerName}`);
      }

      await onConnectionSuccess();
    } catch (e) {
      console.error(`[BrokerCredential:${brokerKey}] WebView callback error:`, e.message);
      setErrorMsg(e.message);
      hasConnected.current = false;
    }
    setSubmitting(false);
  }, [brokerKey, brokerName, formValues, getUserId, onConnectionSuccess]);

  // ---------------------------------------------------------------------------
  // WebView callback URL detection
  // ---------------------------------------------------------------------------
  const isCallbackUrl = (url) => {
    const patterns = [
      'broker-callback', 'auth_code=', 'access_token=', 'request_token=',
      'stock-recommendation', 'api/deploy/broker/callback', 'status=success',
      'motilal-oswal/callback', 'icici/auth-callback',
    ];
    return patterns.some((p) => url.includes(p));
  };

  // ---------------------------------------------------------------------------
  // Render — WebView mode (after form submission for hybrid)
  // ---------------------------------------------------------------------------
  if (webviewUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setWebviewUrl(null); hasConnected.current = false; }} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Authorize {brokerName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <WebView
          source={{ uri: webviewUrl }}
          onNavigationStateChange={(navState) => {
            if (navState.url && isCallbackUrl(navState.url)) {
              handleWebViewCallback(navState.url);
            }
          }}
          onShouldStartLoadWithRequest={(req) => {
            if (isCallbackUrl(req.url)) {
              handleWebViewCallback(req.url);
              return false;
            }
            return true;
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={styles.webviewLoading} size="large" color="#1A237E" />}
          style={styles.webview}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — Form mode
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect {brokerName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formContainer}>
          {/* YouTube instruction link */}
          {brokerConfig?.youtubeVideoId && (
            <TouchableOpacity
              style={styles.videoLink}
              onPress={() => Linking.openURL(`https://youtube.com/watch?v=${brokerConfig.youtubeVideoId}`)}
            >
              <Text style={styles.videoLinkText}>Watch setup instructions</Text>
            </TouchableOpacity>
          )}

          {/* Dynamic form fields */}
          {fields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={[styles.input, errors[field.key] && styles.inputError]}
                value={formValues[field.key] || ''}
                onChangeText={(val) => {
                  setFormValues((prev) => ({ ...prev, [field.key]: val }));
                  if (errors[field.key]) setErrors((prev) => ({ ...prev, [field.key]: null }));
                }}
                placeholder={field.placeholder}
                placeholderTextColor="#999"
                secureTextEntry={field.isSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors[field.key] && (
                <Text style={styles.fieldError}>{errors[field.key]}</Text>
              )}
            </View>
          ))}

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{errorMsg}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isHybrid ? 'Connect & Authorize' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  formContainer: { padding: 20, paddingBottom: 100 },
  videoLink: {
    padding: 12, backgroundColor: '#E3F2FD', borderRadius: 10, marginBottom: 20, alignItems: 'center',
  },
  videoLinkText: { color: '#1565C0', fontSize: 14, fontWeight: '600' },

  fieldContainer: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#333',
  },
  inputError: { borderColor: '#EF5350' },
  fieldError: { fontSize: 12, color: '#EF5350', marginTop: 4 },

  errorBox: {
    padding: 14, backgroundColor: '#FFEBEE', borderRadius: 10,
    borderWidth: 1, borderColor: '#FFCDD2', marginTop: 8,
  },
  errorBoxText: { fontSize: 13, color: '#C62828' },

  bottomSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#F8F9FC',
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  submitBtn: {
    backgroundColor: '#1A237E', paddingVertical: 15, borderRadius: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  webview: { flex: 1 },
  webviewLoading: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
});

export default BrokerCredentialScreen;
