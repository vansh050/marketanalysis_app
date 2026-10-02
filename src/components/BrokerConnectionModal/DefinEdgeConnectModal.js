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
 *   Reconnect mode (reauthConfig.definedgeOtpToken): an 8h session has
 *   expired but the stored api_token/api_secret never do. The backend's
 *   reauth-url branch reuses the STORED creds server-side and hands back a
 *   fresh otp_token — so reconnect renders ONLY the OTP step (no credential
 *   form, no Static-IP / video / guide, which are one-time onboarding) and
 *   verifies via PUT /api/definedge/connect-broker with reuseStoredCreds:
 *   true (no creds in the payload). Mirrors web DefinEdgeConnection.js.
 *
 *   No resend-otp endpoint — if OTP isn't received the user re-runs
 *   initiate-login.
 *
 *   Credentials wrapped with the same AES `ApiKeySecret` envelope as
 *   Arihant / Kotak / AliceBlue.
 *
 *   Cross-ref: docs/BROKER_CONNECTION.md § DefinEdge Securities.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  generateDeviceTotpFromSeed,
  hasDeviceTotp,
  removeDeviceTotp,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';

import { designColor } from '../../design/literalTokens';

const wrapCredential = (value) =>
  CryptoJS.AES.encrypt(String(value || ''), 'ApiKeySecret').toString();

const DefinEdgeConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
  reauthConfig,
}) => {
  const { configData } = useTrade();
  const runtimeConfig = useConfig();
  const showAlert = useModalStore((s) => s.showAlert);
  const auth = getAuth();
  const userEmail = getAccountEmail();

  const [apiKey, setApiKey] = useState('');        // api_token
  const [secretKey, setSecretKey] = useState('');  // api_secret
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  // Reconnect (definedgeOtpToken) starts directly on the OTP step — the
  // backend already fired initiate-login with stored creds and returned the
  // otp_token. Full connect (no token) starts on the creds step.
  const [step, setStep] = useState(
    reauthConfig?.definedgeOtpToken ? 'otp' : 'creds',
  ); // creds | otp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const autoReauthStartedRef = useRef(false);
  const deviceReconnectStartedRef = useRef(false);
  const deviceTotpEnabled =
    runtimeConfig?.deviceTotpEnabled === true ||
    configData?.config?.deviceTotpEnabled === true;
  const [hasSavedTotp, setHasSavedTotp] = useState(false);
  const [saveTotpOnDevice, setSaveTotpOnDevice] = useState(false);
  const [deviceTotpSeed, setDeviceTotpSeed] = useState('');
  const totpIdentity = React.useMemo(
    () => ({
      advisor: getTenantSubdomain(configData),
      broker: 'DefinEdge Securities',
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

  useEffect(() => {
    if (!isVisible) return;
    // Reconnect mode: keep the otp_token handed back by reauth-url and land
    // straight on the OTP step. Full connect: reset to the creds step.
    if (reauthConfig?.definedgeOtpToken) {
      setOtpToken(reauthConfig.definedgeOtpToken);
      setStep('otp');
    } else {
      setStep('creds');
    }
    setOtp('');
    setError('');
    setLoading(false);
    autoReauthStartedRef.current = false;
    deviceReconnectStartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !deviceTotpEnabled || !userEmail) return;
    hasDeviceTotp(totpIdentity)
      .then(setHasSavedTotp)
      .catch(() => setHasSavedTotp(false));
  }, [isVisible, deviceTotpEnabled, userEmail, totpIdentity]);

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

  const initiateLogin = useCallback(async (storedCredentials = null) => {
    setError('');
    const nextApiKey = storedCredentials?.apiKey || apiKey;
    const nextSecretKey = storedCredentials?.secretKey || secretKey;
    if (!nextApiKey.trim() || nextApiKey.trim().length < 8) {
      setError('API token looks too short — copy from MyAccount → API Config.');
      return;
    }
    if (!nextSecretKey.trim() || nextSecretKey.trim().length < 8) {
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
          apiKey: wrapCredential(nextApiKey.trim()),
          apiSecret: wrapCredential(nextSecretKey.trim()),
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
        if (saveTotpOnDevice && deviceTotpSeed) {
          try {
            const generatedOtp = generateDeviceTotpFromSeed(deviceTotpSeed);
            setOtp(generatedOtp);
            await connectDefinEdge(generatedOtp, token);
          } catch (totpError) {
            setError(
              totpError?.message ||
                'Could not generate a TOTP from the setup key. Copy the Base32 key again.',
            );
          }
          return;
        }
        if (showAlert) {
          showAlert(
            'success',
            saveTotpOnDevice ? 'Enter External TOTP' : 'OTP sent',
            saveTotpOnDevice
              ? 'Enter the current code from your External TOTP setup to finish and protect quick reconnect.'
              : data.message || 'OTP sent to your registered DefinEdge contact.',
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
  // The callback invokes connectDefinEdge only after the broker returns its
  // challenge token. Including that render-local handler would recreate this
  // callback on every render and retrigger the stored-credential effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, secretKey, uid, showAlert, saveTotpOnDevice, deviceTotpSeed]);

  useEffect(() => {
    if (
      !isVisible ||
      !reauthConfig?.definedgeStoredCredentials ||
      !uid ||
      autoReauthStartedRef.current
    ) {
      return;
    }
    autoReauthStartedRef.current = true;
    setApiKey(reauthConfig.apiKey);
    setSecretKey(reauthConfig.secretKey);
    initiateLogin(reauthConfig);
  }, [isVisible, reauthConfig, uid, initiateLogin]);

  const connectDefinEdge = async (otpOverride = '', otpTokenOverride = '') => {
    setError('');
    const activeOtp = String(otpOverride || otp || '');
    if (!/^\d+$/.test(activeOtp) || activeOtp.length < 4 || activeOtp.length > 8) {
      setError('OTP must be 4–8 digits.');
      return;
    }
    const activeOtpToken = otpTokenOverride || otpToken;
    if (!activeOtpToken) {
      setStep('creds');
      setError('Session lost — please re-enter your api_token and api_secret.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(
        `${server.server.baseUrl}api/definedge/connect-broker`,
        reauthConfig?.definedgeOtpToken
          ? // Reconnect: backend reuses the STORED creds server-side — the
            // app never touches the api_secret on a session refresh.
            { uid, otpToken: activeOtpToken, otp: activeOtp, reuseStoredCreds: true }
          : {
              uid,
              otpToken: activeOtpToken,
              otp: activeOtp,
              apiKey: wrapCredential(apiKey.trim()),
              apiSecret: wrapCredential(secretKey.trim()),
            },
        { headers: headers() },
      );
      if (showAlert) {
        showAlert('success', 'Connected', 'DefinEdge connected successfully.');
      }
      if (deviceTotpEnabled && saveTotpOnDevice && deviceTotpSeed) {
        try {
          await saveDeviceTotpSeed(totpIdentity, deviceTotpSeed, '');
          setHasSavedTotp(true);
        } catch (vaultError) {
          showAlert?.(
            'error',
            'Connected; quick reconnect was not saved',
            vaultError?.message || 'Check the TOTP secret and enable it again.',
          );
        }
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

  useEffect(() => {
    if (
      !isVisible ||
      !deviceTotpEnabled ||
      !reauthConfig?.definedgeOtpToken ||
      !uid ||
      deviceReconnectStartedRef.current
    ) return;
    deviceReconnectStartedRef.current = true;
    (async () => {
      const saved = await hasDeviceTotp(totpIdentity).catch(() => false);
      setHasSavedTotp(saved);
      if (!saved) return;
      try {
        const login = await unlockDeviceTotpLogin(totpIdentity);
        if (!login?.totp) throw new Error('The protected DefinEdge login is incomplete.');
        setOtp(login.totp);
        await connectDefinEdge(login.totp);
      } catch (vaultError) {
        setError(vaultError?.message || 'Quick reconnect failed. Enter the current TOTP or OTP.');
      }
    })();
    // The broker challenge token is scoped to this modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, deviceTotpEnabled, reauthConfig?.definedgeOtpToken, uid]);

  const forgetSavedTotp = async () => {
    await removeDeviceTotp(totpIdentity);
    setHasSavedTotp(false);
    setSaveTotpOnDevice(false);
  };

  // Rendered through the shared BrokerConnectStepperSheet — the RN port of
  // web's BrokerConnectStepper (same guide steps, brand, portal link, and
  // EgressIpCallout static-IP gating as prod web's DefinEdgeConnection.js).
  // NEVER use React Native's <Modal> here: it hard-freezes this app on
  // Android (New Architecture) — tiny white box top-left + wedged UI thread.
  const reconnectMode = !!reauthConfig?.definedgeOtpToken;
  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="DefinEdge Securities"
      config={{
        monogram: 'D',
        brandFrom: designColor('1565c0'),
        brandTo: designColor('0d3f8a'),
        // Reconnect is OTP-only — the stored api_token/api_secret are valid,
        // only the 8h session expired. One-time onboarding (video, guide,
        // Static-IP) is a full-connect surface only.
        portalUrl: reconnectMode
          ? undefined
          : 'https://myaccount.definedgesecurities.com',
        portalLabel: 'Open Definedge MyAccount',
        walkthroughVideoId: reconnectMode ? undefined : 'A6ytHApBTo4',
        guideSteps: reconnectMode
          ? []
          : [
              'Log in at <b>signin.definedgesecurities.com</b>',
              'Open <b>MyAccount → API Config</b>',
              'Whitelist the <b>IP</b> below',
              'Copy your <b>API Token</b> and <b>API Secret</b>',
              'For quick reconnect, open <b>MyAccount → Account → Security → Enable External TOTP</b>, verify the emailed OTP, then choose <b>Can’t Scan? Copy the Key</b>.',
              'Paste the API credentials and Base32 setup key here. AlphaQuark generates the verification TOTP automatically.',
            ],
        note: reconnectMode
          ? 'Your DefinEdge session expired. Your saved API credentials are still valid — just re-verify with the OTP.'
          : "DefinEdge sessions last ~8 hours; you'll re-verify with OTP after that.",
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
        ...(deviceTotpEnabled && saveTotpOnDevice && !hasSavedTotp ? [{
          label: 'External TOTP Secret Key (Base32)',
          value: deviceTotpSeed,
          onChange: t => setDeviceTotpSeed(String(t || '')),
          password: true,
          autoCapitalize: 'none',
          placeholder: 'Secret shown when enabling External TOTP',
        }] : []),
      ]}
      deviceTotp={{
        enabled: deviceTotpEnabled && !reconnectMode,
        hasSaved: hasSavedTotp,
        saveOnDevice: saveTotpOnDevice,
        onToggleSave: () => setSaveTotpOnDevice(value => !value),
        onUnlock: reconnectMode
          ? async () => {
              const login = await unlockDeviceTotpLogin(totpIdentity);
              if (login?.totp) {
                setOtp(login.totp);
                await connectDefinEdge(login.totp);
              }
            }
          : undefined,
        onForget: forgetSavedTotp,
        protectLabel: 'Enable quick reconnect on this phone',
        savedLabel:
          'The External TOTP key is protected on this phone. Manual broker verification remains available.',
        pendingLabel:
          'Stores only the External TOTP key in this phone’s protected keychain.',
        unlockLabel: 'Reconnect with biometric unlock',
        forgetLabel: 'Forget DefinEdge quick reconnect on this phone',
      }}
      phase={step === 'otp' ? 'otp' : 'creds'}
      otp={{
        value: otp,
        onChange: (t) => setOtp(t.trim()),
        sentToText: saveTotpOnDevice
          ? 'Enter the current External TOTP from your authenticator.'
          : 'Enter the OTP DefinEdge sent to your registered mobile/email.',
      }}
      error={error}
      canSubmit={
        step === 'otp'
          ? Boolean(otp)
          : Boolean(apiKey) &&
            Boolean(secretKey) &&
            (!saveTotpOnDevice || hasSavedTotp || Boolean(deviceTotpSeed))
      }
      submitLabel={step === 'otp' ? 'Verify & Reconnect' : 'Send OTP'}
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
