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

const DefinEdgeConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((s) => s.showAlert);
  const auth = getAuth();
  const userEmail = getAccountEmail();

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

  // Rendered through the shared BrokerConnectStepperSheet — the RN port of
  // web's BrokerConnectStepper (same guide steps, brand, portal link, and
  // EgressIpCallout static-IP gating as prod web's DefinEdgeConnection.js).
  // NEVER use React Native's <Modal> here: it hard-freezes this app on
  // Android (New Architecture) — tiny white box top-left + wedged UI thread.
  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="DefinEdge Securities"
      config={{
        monogram: 'D',
        brandFrom: '#1565c0',
        brandTo: '#0d3f8a',
        portalUrl: 'https://myaccount.definedgesecurities.com',
        portalLabel: 'Open Definedge MyAccount',
        walkthroughVideoId: 'A6ytHApBTo4',
        guideSteps: [
          'Log in at <b>signin.definedgesecurities.com</b>',
          'Open <b>MyAccount → API Config</b>',
          'Whitelist the <b>IP</b> below',
          'Copy your <b>API Token</b> and <b>API Secret</b>',
          'Paste them here',
          'Verify with the OTP',
        ],
        note: "DefinEdge sessions last ~8 hours; you'll re-verify with OTP after that.",
      }}
      egressBrokerKey="definedge"
      customerId={uid}
      customerEmail={userEmail}
      fields={[
        {
          label: 'API Token',
          value: apiKey,
          onChange: (t) => setApiKey(t.trim()),
          password: true,
          placeholder: 'From MyAccount → API Config',
        },
        {
          label: 'API Secret',
          value: secretKey,
          onChange: (t) => setSecretKey(t.trim()),
          password: true,
          placeholder: 'From MyAccount → API Config',
        },
      ]}
      phase={step === 'otp' ? 'otp' : 'creds'}
      otp={{
        value: otp,
        onChange: (t) => setOtp(t.trim()),
        sentToText: 'Enter the OTP DefinEdge sent to your registered mobile/email.',
      }}
      error={error}
      canSubmit={
        step === 'otp' ? Boolean(otp) : Boolean(apiKey) && Boolean(secretKey)
      }
      submitLabel={step === 'otp' ? 'Verify & Connect' : 'Send OTP'}
      loading={loading}
      onSubmit={step === 'otp' ? connectDefinEdge : initiateLogin}
      onBackStep={() => {
        setStep('creds');
        setOtp('');
        setOtpToken('');
        setError('');
      }}
    />
  );
};

export default DefinEdgeConnectModal;
