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
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import { useTrade } from '../../screens/TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {authenticator} from '../../utils/totp';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  hasDeviceTotp,
  removeDeviceTotp,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';

import { designColor } from '../../design/literalTokens';

const wrapCredential = (value) =>
  CryptoJS.AES.encrypt(String(value || ''), 'ApiKeySecret').toString();

const ArihantConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const { configData } = useTrade();
  const runtimeConfig = useConfig();
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
  const [hasSavedTotp, setHasSavedTotp] = useState(false);
  const [saveTotpOnDevice, setSaveTotpOnDevice] = useState(false);
  const [deviceTotpSeed, setDeviceTotpSeed] = useState('');
  const [storedApiKeyWire, setStoredApiKeyWire] = useState('');
  const deviceReconnectStartedRef = React.useRef(false);
  const deviceTotpEnabled =
    runtimeConfig?.deviceTotpEnabled === true ||
    configData?.config?.deviceTotpEnabled === true;
  const totpIdentity = React.useMemo(
    () => ({
      advisor: getTenantSubdomain(configData),
      broker: 'Arihant Capital',
      userEmail,
    }),
    [configData, userEmail],
  );

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
    setStoredApiKeyWire('');
    setError('');
    setLoading(false);
    setResendCooldown(0);
    deviceReconnectStartedRef.current = false;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !deviceTotpEnabled || !userEmail) return;
    hasDeviceTotp(totpIdentity)
      .then(setHasSavedTotp)
      .catch(() => setHasSavedTotp(false));
  }, [isVisible, deviceTotpEnabled, userEmail, totpIdentity]);

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

  const initiateLogin = async (overrides = {}) => {
    setError('');
    const activeUserId = String(overrides.userId || userId || '').trim();
    const activePassword = String(overrides.password || password || '');
    const activeApiKey = String(overrides.apiKey || apiKey || '').trim();
    if (!overrides.apiKeyWire && !activeApiKey) {
      setError('API Key is required');
      return;
    }
    const apiKeyWire = overrides.apiKeyWire || wrapCredential(activeApiKey);
    setStoredApiKeyWire(apiKeyWire);
    if (!activeUserId || activeUserId.length < 3) {
      setError('User ID must be at least 3 characters');
      return;
    }
    if (!activePassword || activePassword.length < 4) {
      setError('Password must be at least 4 characters');
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
          userId: activeUserId,
          password: activePassword,
          apiKey: apiKeyWire,
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
        const enrollmentSeed = overrides.totpSeed || (
          saveTotpOnDevice ? deviceTotpSeed : ''
        );
        if (enrollmentSeed) {
          try {
            const generatedOtp = authenticator.generate(enrollmentSeed);
            setOtp(generatedOtp);
            await connectArihant({
              otpOverride: generatedOtp,
              txnIdOverride: data.txnId,
              userIdOverride: activeUserId,
              apiKeyWire,
              deviceReconnect: Boolean(overrides.totpSeed),
            });
          } catch (totpError) {
            setError(
              totpError?.message ||
                'Could not generate the saved TOTP. Enter the current code to continue.',
            );
          }
          return;
        }
        if (showAlert) {
          showAlert(
            'success',
            saveTotpOnDevice ? 'Enter Arihant TOTP' : 'OTP sent',
            saveTotpOnDevice
              ? 'Enter the current TOTP from your Arihant authenticator setup to finish and protect quick reconnect.'
              : data.message || 'OTP sent to your registered mobile/email.',
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

  const connectArihant = async (options = {}) => {
    setError('');
    const activeOtp = String(options.otpOverride || otp || '');
    const activeTxnId = String(options.txnIdOverride || txnId || '');
    const activeUserId = String(options.userIdOverride || userId || '').trim();
    const apiKeyWire =
      options.apiKeyWire || storedApiKeyWire || wrapCredential(apiKey.trim());
    if (!/^\d+$/.test(activeOtp) || activeOtp.length < 4 || activeOtp.length > 8) {
      setError('OTP must be 4–8 digits.');
      return;
    }
    if (!activeTxnId) {
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
          userId: activeUserId,
          txnId: activeTxnId,
          otp: activeOtp,
          apiKey: apiKeyWire,
        },
        { headers: headers() },
      );
      if (showAlert) {
        showAlert('success', 'Connected', 'Arihant Capital connected successfully.');
      }
      if (
        !options.deviceReconnect &&
        deviceTotpEnabled &&
        saveTotpOnDevice &&
        deviceTotpSeed
      ) {
        try {
          await saveDeviceTotpSeed(
            totpIdentity,
            deviceTotpSeed,
            '',
            {password, userId: activeUserId},
          );
          setHasSavedTotp(true);
        } catch (vaultError) {
          showAlert?.(
            'error',
            'Connected; quick reconnect was not saved',
            vaultError?.message || 'Check the TOTP key and enable it again.',
          );
        }
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

  useEffect(() => {
    if (
      !isVisible ||
      !deviceTotpEnabled ||
      !uid ||
      !userDetails ||
      deviceReconnectStartedRef.current
    ) return;
    const stored = (userDetails.connected_brokers || []).find(
      broker => broker?.broker === 'Arihant Capital',
    );
    if (!stored?.apiKey) return;
    deviceReconnectStartedRef.current = true;
    (async () => {
      const saved = await hasDeviceTotp(totpIdentity).catch(() => false);
      setHasSavedTotp(saved);
      if (!saved) return;
      try {
        const login = await unlockDeviceTotpLogin(totpIdentity);
        if (!login?.seed || !login?.password || !login?.userId) {
          throw new Error('The protected Arihant login is incomplete.');
        }
        setUserId(login.userId);
        setPassword(login.password);
        await initiateLogin({
          userId: login.userId,
          password: login.password,
          apiKeyWire: stored.apiKey,
          totpSeed: login.seed,
        });
      } catch (vaultError) {
        setError(vaultError?.message || 'Quick reconnect failed. Continue with broker login.');
      }
    })();
    // Deliberately once per modal open; failed broker auth must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, deviceTotpEnabled, uid, userDetails]);

  const forgetSavedTotp = async () => {
    await removeDeviceTotp(totpIdentity);
    setHasSavedTotp(false);
    setSaveTotpOnDevice(false);
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
          apiKey: storedApiKeyWire || wrapCredential(apiKey.trim()),
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
        brandFrom: designColor('ff7a00'),
        brandTo: designColor('cc5500'),
        portalUrl: 'https://tradebridge.arihantplus.com',
        portalLabel: 'Open Arihant TradeBridge',
        walkthroughVideoId: 'kE3nviz2T9k',
        guideSteps: [
          'Log in at <b>tradebridge.arihantplus.com</b>',
          'Open <b>My Apps → New App</b> and create an API app',
          'Whitelist the <b>IP</b> below',
          'Set the app name and redirect',
          'Copy your <b>App ID / API Key</b>',
          'For phone quick reconnect, enable Arihant External TOTP and copy the <b>manual Base32 setup key</b>. If your account offers only SMS/email OTP, leave quick reconnect off.',
          'Paste the credentials and setup key here. AlphaQuark generates the current TOTP automatically.',
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
        ...(deviceTotpEnabled && saveTotpOnDevice && !hasSavedTotp ? [{
          label: 'TOTP Secret Key (Base32)',
          value: deviceTotpSeed,
          onChange: t => setDeviceTotpSeed(String(t || '')),
          password: true,
          autoCapitalize: 'none',
          placeholder: 'Secret shown when enabling Arihant TOTP',
        }] : []),
      ]}
      deviceTotp={{
        enabled: deviceTotpEnabled,
        hasSaved: hasSavedTotp,
        saveOnDevice: saveTotpOnDevice,
        onToggleSave: () => setSaveTotpOnDevice(value => !value),
        onForget: forgetSavedTotp,
        protectLabel: 'Enable quick reconnect on this phone',
        savedLabel:
          'The TOTP key, User ID and password are protected on this phone. Normal Arihant login remains available.',
        pendingLabel:
          'Stores the TOTP key and required login factors in this phone’s protected keychain.',
        forgetLabel: 'Forget Arihant quick reconnect on this phone',
      }}
      phase={step === 'otp' ? 'otp' : 'creds'}
      otp={{
        value: otp,
        onChange: (t) => setOtp(t.replace(/\D/g, '').slice(0, 8)),
        sentToText: saveTotpOnDevice
          ? 'Enter the current TOTP from your Arihant authenticator.'
          : 'Enter the OTP Arihant sent to your registered mobile/email.',
        onResend: resendOtp,
        resendDisabled: resendCooldown > 0,
        resendLabel: resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP',
        expiryHint: otpExpiry ? `OTP expires at: ${String(otpExpiry)}` : '',
      }}
      error={error}
      canSubmit={
        step === 'otp'
          ? Boolean(otp)
          : Boolean(userId) &&
            Boolean(password) &&
            Boolean(apiKey) &&
            (!saveTotpOnDevice || hasSavedTotp || Boolean(deviceTotpSeed))
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
