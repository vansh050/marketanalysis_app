import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import axios from 'axios';
import {AppState} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAccountEmail} from '../../utils/accountEmail';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {useTrade} from '../../screens/TradeContext';
import useModalStore from '../../GlobalUIModals/modalStore';
import eventEmitter from '../EventEmitter';
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import {getBrokerGuideConfig} from './brokerGuideConfigs';
import {describeSeedCheck} from '../../utils/totpKeyCheck';
import {
  generateDeviceTotpFromSeed,
  hasDeviceTotp,
  removeDeviceTotp,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';
import {
  fyersAppIdFieldError,
  isValidFyersAppId,
  normalizeFyersAppId,
} from '../../utils/fyersAppId';
import {getServerBrokerReconnectState} from '../../utils/brokerStateUtils';
import {
  isRetryableEnrollmentError,
  isWrongPinError,
  waitForNextTotpWindow,
} from '../../utils/deviceTotpEnrollment';

import { designColor } from '../../design/literalTokens';

// These brokers can stage phone-only quick-reconnect credentials before their
// publisher OAuth hand-off. Nothing is saved until normal broker authorization
// succeeds. Customer-owned API credentials and the setup/static-IP guide stay
// visible during enrollment even when a server slot already exists; otherwise
// the compact reconnect form can hide inputs the customer needs to correct.
// Keep the phone-enrollment sheet visible on first connect for every broker
// this shared gate owns. If no server slot exists yet, all four stage the
// phone factors before completing their canonical OAuth hand-off; a later
// enrollment or reconnect can use the direct device-TOTP endpoint.
const PHONE_ENROLLMENT_FIRST_CONNECT_BROKERS = new Set([
  'Angel One',
  'Motilal Oswal',
  'Zerodha',
  'Fyers',
]);
const DEFERRED_OAUTH_FIRST_CONNECT_BROKERS = new Set([
  'Angel One',
  'Motilal Oswal',
  'Zerodha',
  'Fyers',
]);

const BROKERS = Object.freeze({
  'Angel One': {
    endpoint: 'api/device-totp-reconnect/angel-one',
    monogram: 'A',
    colors: [designColor('1976d2'), designColor('0d47a1')],
    fields: [
      {key: 'userId', label: 'Angel One Client ID', placeholder: 'Your trading client code'},
      {key: 'mpin', label: 'Angel One MPIN', numeric: true, maxLength: 6},
    ],
    apiFields: [
      {
        key: 'apiKey',
        label: 'SmartAPI API Key',
        placeholder: 'Paste your personal SmartAPI API Key',
      },
    ],
    apiValid: values => /^.{3,512}$/.test(values.apiKey),
    apiError: 'Enter the API Key from your personal Angel One SmartAPI app.',
    egressBrokerKey: 'angelone',
    totpSetup: {
      title: 'Create your Angel One TOTP key first',
      portalUrl: 'https://smartapi.angelone.in/enable-totp',
      portalLabel: 'Open Angel One TOTP setup',
      steps: [
        'Open the Angel One TOTP setup page and sign in with your <b>Client ID</b> and trading <b>MPIN/PIN</b>.',
        'Enter the OTP sent to your registered mobile number and email address.',
        'When Angel One shows the QR code, copy the <b>manual secret key shown below the QR</b> before leaving the page. This is the Base32 key requested below.',
        'Scan the QR in Google Authenticator or Microsoft Authenticator and enter its newest <b>6-digit code</b> on Angel One to finish setup. AlphaQuark generates its own code automatically.',
      ],
      note: 'Already enabled TOTP but no longer have the secret key? Do not enter the 6-digit code as the secret. Reset/re-enable Angel One TOTP to obtain a new QR and manual Base32 key, then update your authenticator.',
    },
    valid: values => /^.{3,64}$/.test(values.userId) && /^\d{4,6}$/.test(values.mpin),
  },
  'Motilal Oswal': {
    endpoint: 'api/device-totp-reconnect/motilal-oswal',
    monogram: 'MO',
    colors: [designColor('ea1b2d'), designColor('9d1020')],
    fields: [
      {key: 'password', label: 'Motilal password', placeholder: 'Your broker password'},
      {
        key: 'twoFactor',
        label: 'DOB or PAN (2FA)',
        placeholder: 'DD/MM/YYYY or uppercase PAN',
        upper: true,
      },
    ],
    apiFields: [
      {key: 'apiKey', label: 'API Key', placeholder: 'Paste your Motilal API Key'},
      {
        key: 'clientCode',
        label: 'Client Code',
        placeholder: 'Your Motilal Client Code',
        upper: true,
      },
    ],
    apiValid: values =>
      /^.{3,512}$/.test(values.apiKey) && /^.{3,64}$/.test(values.clientCode),
    apiError: 'Enter your Motilal API Key and Client Code.',
    egressBrokerKey: 'motilaloswal',
    totpSetup: {
      title: 'Find your Motilal TOTP secret key',
      portalUrl: 'https://invest.motilaloswal.com/moAPI/APIDocumentation/Introduction',
      portalLabel: 'Open Motilal API portal',
      steps: [
        'Log in to the Motilal Oswal <b>Trading API portal</b>.',
        'Open the API dashboard and copy the <b>32-character TOTP Secret Key</b> shown for your account.',
        'Add that secret to an authenticator app and complete Motilal’s TOTP setup. AlphaQuark generates its verification code automatically.',
      ],
      note: 'The TOTP Secret Key is the fixed 32-character dashboard value. It is not the changing 6-digit authenticator code.',
    },
    valid: values =>
      /^.{4,128}$/.test(values.password) &&
      /^(?:\d{2}\/\d{2}\/\d{4}|[A-Z]{5}\d{4}[A-Z])$/.test(values.twoFactor),
  },
  Zerodha: {
    endpoint: 'api/device-totp-reconnect/zerodha',
    monogram: 'Z',
    colors: [designColor('387ed1'), designColor('245b9e')],
    fields: [
      {key: 'userId', label: 'Kite User ID', placeholder: 'For example, AB1234', upper: true},
      {key: 'password', label: 'Kite password', placeholder: 'Your Kite login password'},
    ],
    totpSetup: {
      title: 'Create your Zerodha external TOTP key',
      portalUrl: 'https://support.zerodha.com/category/trading-and-markets/general-kite/login-credentials-of-trading-platforms/articles/time-based-otp-setup',
      portalLabel: 'Open Zerodha TOTP instructions',
      steps: [
        'In Kite Web, sign in, click your <b>Client ID</b> at the top right, then open <b>My profile / Settings → Password & Security</b>.',
        'Click <b>Enable External TOTP</b> and verify the OTP sent to your registered email address.',
        'Click <b>Can’t scan? Copy the key</b> beside the QR code. Paste that fixed key into the Base32 field below and add it to your authenticator.',
        'Enter the authenticator’s newest <b>6-digit TOTP</b> and your Kite login password on Zerodha, then click Enable. AlphaQuark generates its own code automatically.',
      ],
      note: 'In the Kite app, the equivalent path is Client ID → Profile → Manage → Enable external TOTP. Use the copied fixed setup key below—not the 6-digit code that changes every 30 seconds.',
    },
    valid: values => /^.{3,64}$/.test(values.userId) && /^.{4,128}$/.test(values.password),
  },
  Fyers: {
    endpoint: 'api/device-totp-reconnect/fyers',
    monogram: 'F',
    colors: [designColor('4361ee'), designColor('2736a2')],
    fields: [
      {key: 'userId', label: 'FYERS Client ID', placeholder: 'For example, XK12345', upper: true},
      {key: 'pin', label: 'FYERS PIN', numeric: true, maxLength: 4},
    ],
    apiFields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'For example, ABCDE12345-200',
        upper: true,
        validate: fyersAppIdFieldError,
      },
      {
        key: 'appSecret',
        label: 'Secret ID',
        placeholder: 'Paste your Fyers Secret ID',
        password: true,
      },
    ],
    apiValid: values =>
      isValidFyersAppId(values.appId) && Boolean(values.appSecret),
    apiError: 'Enter the activated Fyers App ID ending in -200 and its Secret ID.',
    egressBrokerKey: 'fyers',
    totpSetup: {
      title: 'Enable FYERS external TOTP first',
      portalUrl: 'https://fyers.in/web/',
      portalLabel: 'Open FYERS Web',
      steps: [
        'In FYERS Web or the FYERS app, open <b>Profile → Others → External 2FA TOTP → Enable</b>.',
        'On the QR setup screen, copy the <b>manual/setup key</b> for the Base32 field below and scan the same QR in your authenticator.',
        'Enter the newest <b>6-digit TOTP</b> and your FYERS PIN, then finish enabling TOTP.',
      ],
      note: 'The Base32 setup key is fixed; the 6-digit authenticator code changes every 30 seconds. Keep phone date and time set to automatic.',
    },
    valid: values => /^.{3,64}$/.test(values.userId) && /^\d{4}$/.test(values.pin),
  },
});

const DeviceTotpReconnectGate = ({
  brokerName,
  fallback,
  isVisible,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const definition = BROKERS[brokerName];
  const {configData} = useTrade();
  const showAlert = useModalStore(state => state.showAlert);
  const userEmail = getAccountEmail();
  const [normalLogin, setNormalLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [serverReconnectState, setServerReconnectState] = useState(() => ({
    hasSlot: false,
    requiresOAuth: true,
    reason: 'not_checked',
    status: 'unknown',
    slotCount: 0,
    credentialsComplete: false,
  }));
  const [saveOnDevice, setSaveOnDevice] = useState(false);
  const [seed, setSeed] = useState('');
  const [values, setValues] = useState({});
  const [apiValues, setApiValues] = useState({});
  const [validationError, setValidationError] = useState('');
  const pendingEnrollment = useRef(null);
  // The server-state fetch below already downloads the full user document.
  // Keep only its id and hand it to the Fyers OAuth fallback so that modal
  // does not download and parse the same (large) document a second time.
  const serverUserId = useRef(undefined);
  const requiresOAuth = serverReconnectState.requiresOAuth;

  const recordBreadcrumb = useCallback((event, details = {}) => {
    const safe = {
      broker: brokerName,
      event,
      branch: details.branch || undefined,
      reason: details.reason || undefined,
      status: details.status || undefined,
      slotCount: Number.isFinite(details.slotCount) ? details.slotCount : undefined,
      credentialsComplete:
        typeof details.credentialsComplete === 'boolean'
          ? details.credentialsComplete
          : undefined,
      savedOnDevice:
        typeof details.savedOnDevice === 'boolean'
          ? details.savedOnDevice
          : undefined,
      errorCode: details.errorCode || undefined,
    };
    try {
      crashlytics().log(`[BrokerReconnect] ${JSON.stringify(safe)}`);
    } catch (_) {
      // Diagnostics must never interfere with broker connection.
    }
  }, [brokerName]);

  const identity = useMemo(
    () => ({
      advisor: getTenantSubdomain(configData),
      broker: brokerName,
      userEmail,
    }),
    [brokerName, configData, userEmail],
  );

  const setupGuide = useMemo(() => {
    return getBrokerGuideConfig(brokerName, {
      whiteLabelText: Config.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark',
      brokerConnectRedirectURL:
        configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '',
      ccxtBaseUrl: server.ccxtServer.baseUrl,
    });
  }, [brokerName, configData]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const subscription = AppState.addEventListener?.('memoryWarning', () => {
      recordBreadcrumb('memory_warning', {
        branch: requiresOAuth ? 'oauth' : 'quick_reconnect',
      });
    });
    return () => subscription?.remove?.();
  }, [isVisible, recordBreadcrumb, requiresOAuth]);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': getTenantSubdomain(configData),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    }),
    [configData],
  );

  useEffect(() => {
    if (!isVisible || !definition || !userEmail) return;
    let active = true;
    setChecking(true);
    setNormalLogin(false);
    pendingEnrollment.current = null;
    Promise.all([
      axios.get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {headers: headers()}),
      hasDeviceTotp(identity).catch(() => false),
    ])
      .then(([response, saved]) => {
        if (!active) return;
        serverUserId.current = response.data?.User?._id;
        const nextState = getServerBrokerReconnectState(
          response.data?.User,
          brokerName,
        );
        setServerReconnectState(nextState);
        recordBreadcrumb('server_state_resolved', {
          reason: nextState.reason,
          status: nextState.status,
          slotCount: nextState.slotCount,
          credentialsComplete: nextState.credentialsComplete,
          savedOnDevice: Boolean(saved),
        });

        // A hard disconnect or incomplete server record is authoritative.
        // Do not offer a local biometric record that the server cannot use.
        if (nextState.requiresOAuth && saved) {
          removeDeviceTotp(identity).catch(() => {});
        }
        const usableSaved = Boolean(saved) && !nextState.requiresOAuth;
        setHasSaved(usableSaved);
        setSaveOnDevice(usableSaved);
        if (
          nextState.requiresOAuth &&
          !PHONE_ENROLLMENT_FIRST_CONNECT_BROKERS.has(brokerName)
        ) {
          setNormalLogin(true);
        }
      })
      .catch(() => {
        recordBreadcrumb('server_state_failed', {reason: 'user_fetch_failed'});
        if (active && !PHONE_ENROLLMENT_FIRST_CONNECT_BROKERS.has(brokerName)) {
          setNormalLogin(true);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [
    brokerName,
    definition,
    headers,
    identity,
    isVisible,
    recordBreadcrumb,
    userEmail,
  ]);

  const reconnect = useCallback(
    async protectedValues => {
      setLoading(true);
      recordBreadcrumb('quick_reconnect_started', {branch: 'quick_reconnect'});
      try {
        const firebaseToken = await getAuth().currentUser?.getIdToken?.();
        if (!firebaseToken) throw new Error('Please sign in again before reconnecting.');
        await axios.post(
          `${server.server.baseUrl}${definition.endpoint}`,
          protectedValues,
          {headers: {...headers(), Authorization: `Bearer ${firebaseToken}`}},
        );
        recordBreadcrumb('quick_reconnect_succeeded', {branch: 'quick_reconnect'});
        return true;
      } catch (error) {
        recordBreadcrumb('quick_reconnect_failed', {
          branch: 'quick_reconnect',
          errorCode:
            error?.response?.data?.error_code ||
            (error?.response?.status ? `http_${error.response.status}` : 'client_error'),
        });
        showAlert(
          'error',
          isWrongPinError(error)
            ? `${brokerName} PIN not accepted`
            : 'Quick reconnect unavailable',
          error?.response?.data?.message || error?.message || `Continue with ${brokerName} login.`,
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [brokerName, definition, headers, recordBreadcrumb, showAlert],
  );

  const finishPendingEnrollment = useCallback(async () => {
    const pending = pendingEnrollment.current;
    pendingEnrollment.current = null;
    if (!pending) return;

    const attempt = async () => {
      // The customer typed this seed's code into the broker page seconds ago.
      // Brokers reject a TOTP reused within its 30 s window, so always verify
      // with the NEXT window's code. This runs after "Connected", in the
      // background, so the wait never blocks the customer.
      await waitForNextTotpWindow();
      const firebaseToken = await getAuth().currentUser?.getIdToken?.();
      if (!firebaseToken) throw new Error('Please sign in again before reconnecting.');
      const totp = generateDeviceTotpFromSeed(pending.seed);
      await axios.post(
        `${server.server.baseUrl}${definition.endpoint}`,
        {totp, ...pending.values},
        {headers: {...headers(), Authorization: `Bearer ${firebaseToken}`}},
      );
      return totp;
    };

    try {
      let totp;
      try {
        totp = await attempt();
      } catch (firstError) {
        if (!isRetryableEnrollmentError(firstError)) throw firstError;
        recordBreadcrumb('enrollment_retry', {
          branch: 'oauth',
          errorCode:
            firstError?.response?.data?.error_code ||
            (firstError?.response?.status
              ? `http_${firstError.response.status}`
              : 'network_error'),
        });
        totp = await attempt();
      }
      await saveDeviceTotpSeed(identity, pending.seed, totp, pending.values);
      recordBreadcrumb('enrollment_saved', {branch: 'oauth'});
      eventEmitter.emit('refreshEvent', {
        source: `${brokerName} device quick reconnect enrollment`,
      });
      showAlert(
        'success',
        `${brokerName} quick reconnect enabled`,
        'Next time your broker session expires, reconnect with biometric unlock on this phone.',
      );
    } catch (error) {
      recordBreadcrumb('enrollment_failed', {
        branch: 'oauth',
        errorCode: error?.response?.status
          ? `http_${error.response.status}`
          : 'client_error',
      });
      showAlert(
        'error',
        isWrongPinError(error)
          ? `${brokerName} connected; PIN not accepted for quick reconnect`
          : `${brokerName} connected; quick reconnect was not saved`,
        error?.response?.data?.message ||
          error?.message ||
          `You can enable ${brokerName} quick reconnect again later.`,
      );
    }
  }, [brokerName, definition, headers, identity, recordBreadcrumb, showAlert]);

  const handleFallbackSuccess = useCallback(async (...args) => {
    recordBreadcrumb('oauth_refresh_started', {branch: 'oauth'});
    const result = await fetchBrokerStatusModal?.(...args);
    recordBreadcrumb('oauth_refresh_completed', {branch: 'oauth'});
    // The broker is already connected here. Enrollment performs a second,
    // server-side broker login (up to 60 s), so it must not hold back the
    // caller's "Connected" confirmation. It runs afterwards, and its failure
    // alert appears after the success alert instead of being overwritten by it
    // (3.9.147 showed "Connected Successfully" over a failed enrollment).
    finishPendingEnrollment();
    return result;
  }, [fetchBrokerStatusModal, finishPendingEnrollment, recordBreadcrumb]);

  const finishSuccess = useCallback(async (notify = true) => {
    setShowBrokerModal?.(false);
    onClose?.();
    try {
      recordBreadcrumb('account_refresh_started', {branch: 'quick_reconnect'});
      await fetchBrokerStatusModal?.();
      recordBreadcrumb('account_refresh_completed', {branch: 'quick_reconnect'});
    } catch (error) {
      recordBreadcrumb('account_refresh_failed', {
        branch: 'quick_reconnect',
        errorCode: 'refresh_failed',
      });
      console.warn(`[${brokerName}] post-reconnect refresh failed:`, error?.message);
    }
    eventEmitter.emit('refreshEvent', {
      source: `${brokerName} broker connection`,
    });
    if (notify) {
      showAlert(
        'success',
        `${brokerName} reconnected`,
        'The broker session was refreshed using credentials protected on this phone.',
      );
    }
  }, [
    brokerName,
    fetchBrokerStatusModal,
    onClose,
    recordBreadcrumb,
    setShowBrokerModal,
    showAlert,
  ]);

  const unlockAndReconnect = useCallback(async () => {
    try {
      const login = await unlockDeviceTotpLogin(identity);
      if (!login?.totp) throw new Error(`The saved ${brokerName} login is incomplete.`);
      const ok = await reconnect({
        totp: login.totp,
        mpin: login.mpin,
        pin: login.pin,
        password: login.password,
        userId: login.userId,
        twoFactor: login.twoFactor,
      });
      if (ok) await finishSuccess();
    } catch (error) {
      showAlert(
        'error',
        error?.code === 'DEVICE_AUTHENTICATION_REQUIRED'
          ? 'Authenticate to reconnect'
          : 'Could not unlock quick reconnect',
        error?.message || `Continue with ${brokerName} login.`,
      );
    }
  }, [brokerName, finishSuccess, identity, reconnect, showAlert]);

  // Re-render every second while a setup key is entered so the key check
  // below shows the code the key produces NOW. Brokers lock the login after
  // a few wrong TOTPs, so a wrong key must be visible before "Verify" sends it
  // (Zerodha reached "1 attempt remains" on 2026-09-30 after the typed
  // current-code check was removed). Informational only: nothing is blocked.
  const [, setSeedCheckTick] = useState(0);
  const hasSeedInput = String(seed || '').trim().length > 0;
  useEffect(() => {
    if (!hasSeedInput || hasSaved) return undefined;
    const timer = setInterval(() => setSeedCheckTick(tick => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [hasSeedInput, hasSaved]);

  const sheetConfig = useMemo(
    () => ({
      ...setupGuide,
      monogram: definition?.monogram,
      brandFrom: definition?.colors?.[0],
      brandTo: definition?.colors?.[1],
      guideSteps: setupGuide?.guideSteps || [],
      note: setupGuide?.note
        ? `${setupGuide.note}\n\nQuick reconnect is optional. Enter every customer-owned API credential and phone-login detail below. API credentials are validated and refreshed on AlphaQuark’s encrypted server record; the TOTP key and personal login factors stay only in this phone’s protected keychain.`
        : 'Enter every credential shown below. Customer-owned API credentials are validated against the broker and kept encrypted on AlphaQuark servers. The TOTP key and personal login factors stay only in this phone’s protected keychain.',
    }),
    [definition, setupGuide],
  );

  // Quick reconnect is already saved on this phone and the server can use it:
  // the ONE thing the customer needs is the biometric unlock. Lead with it as
  // the primary button and hide the first-time setup guide (static IP, API
  // dashboard, step chips). Before 2026-10-01 the primary button here was the
  // disabled "Verify & enable quick reconnect" and the working unlock was a
  // small text link inside the card, which customers missed (Fyers report).
  const quickReconnectReady = hasSaved && !requiresOAuth && !checking;
  const quickReconnectConfig = useMemo(
    () => ({
      monogram: definition?.monogram,
      brandFrom: definition?.colors?.[0],
      brandTo: definition?.colors?.[1],
      guideSteps: [],
      hideStepChips: true,
      note: `Quick reconnect is set up on this phone. Tap "Reconnect with biometric unlock" and confirm with your fingerprint or screen lock to reconnect ${brokerName}. No codes or passwords needed.`,
    }),
    [brokerName, definition],
  );

  if (!definition) return fallback;
  if (normalLogin) {
    const stagedApiCredentials = pendingEnrollment.current?.apiCredentials;
    return React.isValidElement(fallback)
      ? React.cloneElement(fallback, {
          fetchBrokerStatusModal: handleFallbackSuccess,
          initialCredentials: stagedApiCredentials || undefined,
          initialUserId: serverUserId.current,
          initialEgressReady: Boolean(stagedApiCredentials),
          autoStart: brokerName === 'Fyers' && Boolean(stagedApiCredentials),
          onBackToQuickReconnect: () => {
            pendingEnrollment.current = null;
            setValidationError('');
            setNormalLogin(false);
          },
        })
      : fallback;
  }

  const submitEnrollment = async () => {
    setValidationError('');
    let generatedCode;
    try {
      generatedCode = generateDeviceTotpFromSeed(seed);
    } catch (_) {
      setValidationError(
        'The TOTP secret is invalid. Copy the Base32 setup key shown by the broker and try again.',
      );
      return;
    }
    if (!definition.valid(values)) {
      setValidationError(`Check the ${brokerName} Client ID and PIN, then try again.`);
      return;
    }
    if (definition.apiValid && !definition.apiValid(apiValues)) {
      setValidationError(definition.apiError || `Enter the ${brokerName} API credentials.`);
      return;
    }
    if (
      requiresOAuth &&
      !serverReconnectState.hasSlot &&
      DEFERRED_OAUTH_FIRST_CONNECT_BROKERS.has(brokerName)
    ) {
      recordBreadcrumb('branch_selected', {
        branch: 'oauth',
        reason: serverReconnectState.reason,
      });
      pendingEnrollment.current = {
        seed,
        values: {...values},
        apiCredentials: brokerName === 'Fyers'
          ? {
              appId: normalizeFyersAppId(apiValues.appId),
              appSecret: apiValues.appSecret,
            }
          : {...apiValues},
      };
      setNormalLogin(true);
      return;
    }
    recordBreadcrumb('branch_selected', {
      branch: 'quick_reconnect',
      reason: serverReconnectState.reason,
    });
    const apiPayload = brokerName === 'Fyers'
      ? {
          appId: normalizeFyersAppId(apiValues.appId),
          appSecret: apiValues.appSecret,
        }
      : {...apiValues};
    const ok = await reconnect({totp: generatedCode, ...values, ...apiPayload});
    if (!ok) return;
    try {
      await saveDeviceTotpSeed(identity, seed, '', values);
      setHasSaved(true);
      await finishSuccess();
    } catch (error) {
      showAlert(
        'error',
        `${brokerName} connected; quick reconnect was not saved`,
        error?.message || `Please enable ${brokerName} quick reconnect again.`,
      );
      await finishSuccess(false);
    }
  };

  const apiCredentialFields = (definition.apiFields || []).map(field => ({
    key: `api-${field.key}`,
    label: field.label,
    value: apiValues[field.key] || '',
    onChange: value => {
      let next = String(value || '').trim();
      if (field.upper) next = next.toUpperCase();
      setApiValues(current => ({...current, [field.key]: next}));
      setValidationError('');
    },
    password: Boolean(field.password),
    uncontrolled: true,
    autoCapitalize: field.upper ? 'characters' : 'none',
    placeholder: field.placeholder,
    error: apiValues[field.key] && field.validate
      ? field.validate(apiValues[field.key])
      : '',
  }));

  const fields = saveOnDevice && !hasSaved
    ? [
        ...apiCredentialFields,
        {
          label: 'TOTP Secret Key (Base32)',
          value: seed,
          onChange: value => {
            setSeed(String(value || ''));
            setValidationError('');
          },
          password: true,
          uncontrolled: true,
          autoCapitalize: 'none',
          placeholder: `Secret shown when enabling ${brokerName} TOTP`,
          hint: describeSeedCheck(seed, brokerName),
        },
        ...definition.fields.map(field => ({
          label: field.label,
          value: values[field.key] || '',
          onChange: value => {
            let next = String(value || '');
            if (field.numeric) next = next.replace(/\D/g, '');
            if (field.upper) next = next.toUpperCase();
            if (field.maxLength) next = next.slice(0, field.maxLength);
            setValues(current => ({...current, [field.key]: next}));
            setValidationError('');
          },
          password: true,
          uncontrolled: true,
          autoCapitalize: field.upper ? 'characters' : 'none',
          keyboardType: field.numeric ? 'number-pad' : 'default',
          maxLength: field.maxLength,
          placeholder: field.placeholder,
        })),
      ]
    : [];

  // Normal broker login is the DEFAULT action (2026-10-01 owner decision):
  // until the customer switches on "Enable quick reconnect", the primary
  // button opens the broker's own login. Switching it on turns the primary
  // into quick-reconnect setup, with normal login kept as the secondary link.
  const goNormalLogin = () => {
    pendingEnrollment.current = null;
    setValidationError('');
    setNormalLogin(true);
  };
  const normalLoginDefault = !quickReconnectReady && !hasSaved && !saveOnDevice;

  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker={brokerName}
      config={quickReconnectReady ? quickReconnectConfig : sheetConfig}
      egressBrokerKey={
        !quickReconnectReady && setupGuide ? definition.egressBrokerKey : null
      }
      customerId={serverUserId.current}
      customerEmail={userEmail}
      fields={fields}
      deviceTotp={{
        enabled: true,
        placeBeforeFields: true,
        hasSaved,
        saveOnDevice,
        onToggleSave: () => setSaveOnDevice(value => !value),
        // The unlock is the primary button when quickReconnectReady; no
        // duplicate small link in the card.
        onUnlock: hasSaved && !quickReconnectReady ? unlockAndReconnect : undefined,
        onForget: async () => {
          await removeDeviceTotp(identity);
          setHasSaved(false);
          setSaveOnDevice(false);
        },
        protectLabel: `Enable ${brokerName} quick reconnect on this phone`,
        savedLabel: `The ${brokerName} login is protected on this phone. Normal broker login remains available.`,
        pendingLabel:
          'Saved only after the broker verifies these details. It will not migrate to another phone.',
        setup: definition.totpSetup,
        unlockLabel: 'Reconnect with biometric unlock',
        forgetLabel: `Forget ${brokerName} quick reconnect on this phone`,
      }}
      phase="creds"
      error={validationError}
      canSubmit={
        quickReconnectReady ||
        normalLoginDefault ||
        (saveOnDevice &&
        !hasSaved &&
        Boolean(seed) &&
        definition.valid(values) &&
        (!definition.apiValid || definition.apiValid(apiValues)))
      }
      submitLabel={
        checking
          ? 'Checking connection…'
          : quickReconnectReady
            ? 'Reconnect with biometric unlock'
            : normalLoginDefault
            ? `Continue with ${brokerName} login`
            : !requiresOAuth
            ? 'Verify & enable quick reconnect'
            : `Continue with ${brokerName} login`
      }
      loading={loading || checking}
      onSubmit={
        quickReconnectReady
          ? unlockAndReconnect
          : normalLoginDefault
          ? goNormalLogin
          : submitEnrollment
      }
      alternateAction={
        normalLoginDefault
          ? undefined
          : {
              label: `Continue with normal ${brokerName} login`,
              onPress: goNormalLogin,
            }
      }
    />
  );
};

export default DeviceTotpReconnectGate;
