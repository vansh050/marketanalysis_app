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
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
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
import {getAccountEmail} from '../../utils/accountEmail';

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
  const userEmail = getAccountEmail();

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

  // Rendered through the shared BrokerConnectStepperSheet — the RN port of
  // web's BrokerConnectStepper (same guide steps, brand, portal link, and
  // EgressIpCallout static-IP gating as prod web's ArihantConnection.js).
  // NEVER use React Native's <Modal> here: it hard-freezes this app on
  // Android (New Architecture) — tiny white box top-left + wedged UI thread.
  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="Arihant Capital"
      config={{
        monogram: 'A',
        brandFrom: '#ff7a00',
        brandTo: '#cc5500',
        portalUrl: 'https://tradebridge.arihantplus.com',
        portalLabel: 'Open Arihant TradeBridge',
        walkthroughVideoId: 'kE3nviz2T9k',
        guideSteps: [
          'Log in at <b>tradebridge.arihantplus.com</b>',
          'Open <b>API Keys → New App</b>',
          'Whitelist the <b>IP</b> below',
          'Set the app name and redirect',
          'Copy your <b>App ID / API Key</b>',
          'Paste credentials here, then verify OTP',
        ],
        note: 'Arihant sessions expire daily — tap Reconnect from the broker tile if trades fail with "Session Expired".',
      }}
      egressBrokerKey="arihant"
      customerId={uid}
      customerEmail={userEmail}
      fields={[
        {
          label: 'Arihant User ID',
          value: userId,
          onChange: (t) => setUserId(t.trim()),
          placeholder: 'Enter your Arihant login ID',
        },
        {
          label: 'Password',
          value: password,
          onChange: setPassword,
          password: true,
          placeholder: 'Enter your Arihant password',
        },
        {
          label: 'API Key (App ID)',
          value: apiKey,
          onChange: (t) => setApiKey(t.trim()),
          password: true,
          placeholder: 'Generated at tradebridge.arihantplus.com',
        },
      ]}
      phase={step === 'otp' ? 'otp' : 'creds'}
      otp={{
        value: otp,
        onChange: (t) => setOtp(t.replace(/\D/g, '').slice(0, 8)),
        sentToText: 'Enter the OTP Arihant sent to your registered mobile/email.',
        onResend: resendOtp,
        resendDisabled: resendCooldown > 0,
        resendLabel: resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP',
        expiryHint: otpExpiry ? `OTP expires at: ${String(otpExpiry)}` : '',
      }}
      error={error}
      canSubmit={
        step === 'otp'
          ? Boolean(otp)
          : Boolean(userId) && Boolean(password) && Boolean(apiKey)
      }
      submitLabel={step === 'otp' ? 'Verify & Connect' : 'Send OTP'}
      loading={loading}
      onSubmit={step === 'otp' ? connectArihant : initiateLogin}
      onBackStep={() => {
        setStep('creds');
        setOtp('');
        setTxnId('');
        setError('');
      }}
    />
  );
};

export default ArihantConnectModal;
