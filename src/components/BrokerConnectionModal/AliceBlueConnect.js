import React, {useRef, useState, useEffect} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import AliceBlueConnectUI from '../../UIComponents/BrokerConnectionUI/AliceBlueConnectUI';
import {useTrade} from '../../screens/TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {getTenantSubdomain} from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkExchangeBrokerToken,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';
import {getAccountEmail} from '../../utils/accountEmail';
import {authenticator} from '../../utils/totp';
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import {
  hasAliceBlueDeviceLogin,
  removeAliceBlueDeviceLogin,
  saveAliceBlueDeviceLogin,
  unlockAliceBlueDeviceLogin,
} from '../../services/DeviceBrokerLoginVault';
import {classifyFundsResponse} from '../../utils/brokerSessionValidator';
import {normalizeDeviceTotpSeedInput} from '../../services/DeviceTotpVault';

import { designColor } from '../../design/literalTokens';

// Route through CCXT backend (matching web's handleAliceBlueConnect) so origin
// is stored in MongoDB for multi-site callback routing. The CCXT server
// redirects to AliceBlue and then back to `${origin}${returnPath}` with the
// OAuth result params, which the WebView nav handler below intercepts.
//
// HARDCODED `prod.alphaquark.in` — DO NOT read from
// `REACT_APP_BROKER_CONNECT_REDIRECT_URL` (production 2026-04-26 — that
// var was repurposed in `f9f5d0f` (Groww App Links) from
// `https://prod.alphaquark.in/stock-recommendation` →
// `https://app-links.alphaquark.in/broker-callback`. AliceBlue's
// partner appcode is **allow-listed against `prod.alphaquark.in` only**
// — when our origin is `app-links.alphaquark.in/broker-callback`,
// AliceBlue's portal silently bounces the user back to the password
// screen after OTP because the redirect URL fails its appcode-whitelist
// check, and the WebView never sees a callback URL to intercept.
// tidi_new hardcoded this in `BrokerAuthPage._getAliceBlueLoginUrl`
// (commit `d5fb65b`) for the same reason. Safe because the WebView
// intercepts the callback by query params (`user_broker=AliceBlue` /
// `access_token`), so the redirect host never has to match the
// runtime app's actual host. See `docs/BROKER_CONNECTION.md
// § Per-broker redirect URL reference`.
const buildAliceBlueAuthUrl = () => {
  const origin = 'https://prod.alphaquark.in';
  const returnPath = '/stock-recommendation';
  return `${server.ccxtServer.baseUrl}aliceblue/login?origin=${encodeURIComponent(
    origin,
  )}&returnPath=${encodeURIComponent(returnPath)}`;
};

const AliceBlueConnect = ({
  isVisible,
  setShowAliceblueModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData, userDetails, getUserDeatils} = useTrade();
  // The live runtime config is what the dispatcher routed on. TradeContext's
  // cached configData can lack deviceTotpEnabled, which opened the AliceBlue
  // login page directly with no quick-reconnect option (2026-09-30).
  const freshConfig = useConfig();
  const showAlert = useModalStore(state => state.showAlert);
  const hasProcessedCallback = useRef(false);
  const sdkBridge = useSdkBridge();

  const [loading, setLoading] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [showBrokerLogin, setShowBrokerLogin] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [aliceUserId, setAliceUserId] = useState('');
  const [alicePassword, setAlicePassword] = useState('');
  const [aliceTotpSeed, setAliceTotpSeed] = useState('');
  // Normal AliceBlue login is the default (2026-10-01 owner decision);
  // quick reconnect is opt-in via the "Enable quick reconnect" switch.
  const [quickReconnectOptIn, setQuickReconnectOptIn] = useState(false);
  const assistedCredentialsRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();
  const advisorSubdomain =
    getTenantSubdomain(configData);
  // AliceBlue uses one partner OAuth product in both cases. The shared
  // deviceTotpEnabled switch only adds the optional phone-vault-assisted
  // experience; it does not move the customer to an Individual Trader API.
  // Retain the historical AliceBlue-only flag as a compatibility alias.
  const assistedLoginEnabled =
    freshConfig?.deviceTotpEnabled === true ||
    freshConfig?.aliceBlueDeviceLoginEnabled === true ||
    configData?.config?.deviceTotpEnabled === true ||
    configData?.deviceTotpEnabled === true ||
    configData?.config?.aliceBlueDeviceLoginEnabled === true ||
    configData?.aliceBlueDeviceLoginEnabled === true;
  const vaultIdentity = {
    advisor: advisorSubdomain,
    broker: 'AliceBlue',
    userEmail,
  };

  useEffect(() => {
    let cancelled = false;
    assistedCredentialsRef.current = null;
    if (!isVisible || !assistedLoginEnabled || !userEmail) return undefined;
    setShowBrokerLogin(false);
    setVaultError('');
    hasAliceBlueDeviceLogin(vaultIdentity)
      .then(saved => {
        if (!cancelled) setHasSavedLogin(saved);
      })
      .catch(() => {
        if (!cancelled) setHasSavedLogin(false);
      });
    return () => {
      cancelled = true;
    };
    // Exact primitive dependencies keep the device-vault scope stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, assistedLoginEnabled, advisorSubdomain, userEmail]);

  const useNormalBrokerLogin = () => {
    assistedCredentialsRef.current = null;
    setVaultError('');
    setShowBrokerLogin(true);
  };

  const unlockAssistedLogin = async () => {
    setVaultBusy(true);
    setVaultError('');
    try {
      const credentials = await unlockAliceBlueDeviceLogin(vaultIdentity);
      if (!credentials) return;
      assistedCredentialsRef.current = credentials;
      setShowBrokerLogin(true);
    } catch (error) {
      setVaultError(error?.message || 'Device authentication failed.');
    } finally {
      setVaultBusy(false);
    }
  };

  const enrolAssistedLogin = async () => {
    setVaultBusy(true);
    setVaultError('');
    try {
      const normalizedSeed = normalizeDeviceTotpSeedInput(aliceTotpSeed);
      if (!aliceUserId.trim() || !alicePassword) {
        throw new Error('Enter your AliceBlue user ID and password.');
      }
      // Syntax-check the seed and stage it only in memory. The keychain write
      // happens after AliceBlue returns a successful OAuth callback.
      authenticator.generate(normalizedSeed);
      assistedCredentialsRef.current = {
        broker: 'AliceBlue',
        userId: aliceUserId.trim(),
        password: alicePassword,
        totpSeed: normalizedSeed,
      };
      setShowBrokerLogin(true);
    } catch (error) {
      setVaultError(error?.message || 'Could not protect AliceBlue login.');
    } finally {
      setVaultBusy(false);
    }
  };

  const forgetAssistedLogin = async () => {
    setVaultBusy(true);
    try {
      await removeAliceBlueDeviceLogin(vaultIdentity);
      assistedCredentialsRef.current = null;
      setHasSavedLogin(false);
      setVaultError('');
    } catch (error) {
      setVaultError(error?.message || 'Could not remove the protected login.');
    } finally {
      setVaultBusy(false);
    }
  };

  const generateAssistedTotp = async () => {
    const seed = assistedCredentialsRef.current?.totpSeed;
    if (!seed) return null;
    try {
      return authenticator.generate(seed);
    } catch (_) {
      return null;
    }
  };

  // Get common headers for API calls
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  // Parse query string from URL
  const parseQueryString = queryString => {
    const params = {};
    if (!queryString) return params;
    const query = queryString.startsWith('?')
      ? queryString.substring(1)
      : queryString;
    const pairs = query.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return params;
  };

  // Handle WebView navigation - detect OAuth callback params
  // Prod callback returns: user_broker=AliceBlue&status=0&access_token=xxx&client_id=yyy
  const handleWebViewNavigationStateChange = navState => {
    const {url} = navState;
    console.log('[AliceBlue] WebView URL:', url);

    if (hasProcessedCallback.current) return;

    // Detect callback URL with AliceBlue OAuth params
    if (
      url.includes('user_broker=AliceBlue') ||
      (url.includes('access_token=') && url.includes('client_id='))
    ) {
      const queryString = url.split('?')[1];
      if (!queryString) return;

      const queryParams = parseQueryString(queryString);
      const status = queryParams.status;
      const accessToken = queryParams.access_token;
      const clientId = queryParams.client_id;

      if (status === '1') {
        // AliceBlue connection failed
        const errorMsg = queryParams.error || 'Connection failed';
        console.error('[AliceBlue] OAuth failed:', errorMsg);
        hasProcessedCallback.current = true;
        showAlert(
          'error',
          'Connection Failed',
          `AliceBlue connection failed: ${errorMsg}`,
        );
        onClose();
        return;
      }

      if (status === '0' && accessToken && clientId) {
        hasProcessedCallback.current = true;
        saveBrokerConnection(accessToken, clientId);
      }
    }
  };

  // Save broker connection (same as prod connectBroker.js AliceBlue callback)
  const saveBrokerConnection = async (accessToken, clientId) => {
    const userId =
      userDetails?._id || (await getUserDeatils?.())?._id;
    if (!userId) {
      showAlert('error', 'Error', 'User not found. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const brokerData = {
        uid: userId,
        user_broker: 'AliceBlue',
        jwtToken: accessToken,
        clientCode: clientId,
      };

      await axios.request({
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,
        headers: getHeaders(),
        data: JSON.stringify(brokerData),
      });

      const pendingDeviceLogin = assistedCredentialsRef.current;
      if (pendingDeviceLogin && !hasSavedLogin) {
        try {
          await saveAliceBlueDeviceLogin(
            vaultIdentity,
            pendingDeviceLogin,
            '',
          );
          setHasSavedLogin(true);
          setAlicePassword('');
          setAliceTotpSeed('');
        } catch (vaultSaveError) {
          setVaultError(
            vaultSaveError?.message ||
              'AliceBlue connected, but quick reconnect was not saved.',
          );
          console.warn(
            '[AliceBlue] connected but device login save failed:',
            vaultSaveError?.message,
          );
        }
      }

      console.log(
        '[AliceBlue] Broker connected successfully, updating model portfolio...',
      );

      // SDK pilot dual-write — see brokerSdkBridge.js. AliceBlue's
      // OAuth callback yields jwtToken + clientCode; the SDK route
      // /sdk/v1/connections/AliceBlue/exchange-token accepts this same
      // shape (backend dispatches to the same persistence path used by
      // /api/user/connect-broker).
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        // Await the data-plane write before declaring success. It was
        // previously fire-and-forget, so the refreshed account could still
        // expose the pre-login expired AliceBlue slot and immediately ask the
        // customer to log in again.
        await sdkDualWriteSafely(
          sdkExchangeBrokerToken(sdkBridge.client, 'AliceBlue', {
            access_token: accessToken,
            client_id: clientId,
          }),
          'AliceBlue',
          'exchange-token',
        );
      }

      // Update model portfolio (non-critical)
      try {
        await axios.request({
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          data: JSON.stringify({
            user_email: userEmail,
            user_broker: 'AliceBlue',
          }),
          headers: getHeaders(),
        });
        console.log('[AliceBlue] Model portfolio updated successfully');
      } catch (err) {
        console.warn(
          '[AliceBlue] Model portfolio update failed (non-critical):',
          err,
        );
      }

      setLoading(false);
      // Close the AliceBlue WebView modal first so the migration sheet
      // (if any) doesn't stack underneath a stale OAuth modal.
      onClose();
      setShowBrokerModal(false);
      // Wrap post-success steps so a downstream throw doesn't bubble to
      // the outer catch and get rewritten as "Connection Error". See
      // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
      // § Broker-connect post-success hygiene.
      try {
        // Await the migration check so we don't fire the redundant
        // "Connected Successfully" alert when the migration sheet
        // (which itself says "Reconnected to AliceBlue — your holdings
        // are already set up") will surface as the success indicator.
        // Production 2026-04-26: dual-modal stacking — alert + migration
        // sheet both visible at the same time, with the migration sheet
        // not blocking navigation, letting the user tap "Rebalance" while
        // both were open.
        const result = await fetchBrokerStatusModal?.();
        const refreshedUser = result?.verifiedUser || result?.userDetails;
        const sessionCheck = refreshedUser
          ? classifyFundsResponse(
              result?.funds,
              refreshedUser.connect_broker_status,
              refreshedUser.user_broker || 'AliceBlue',
            )
          : {reason: 'PROBE_FAILED'};
        // Publish only after the canonical refresh/verification has settled.
        // Emitting first used to start several overlapping user/funds reads,
        // one of which could repaint the just-connected session as expired.
        eventEmitter.emit('refreshEvent', {
          source: 'AliceBlue broker connection',
          freshUser: refreshedUser || null,
          fundsAlreadyRefreshed: true,
        });
        if (
          sessionCheck.reason === 'TOKEN_EXPIRED' ||
          sessionCheck.reason === 'NOT_CONNECTED'
        ) {
          showAlert(
            'error',
            'AliceBlue session not active',
            sessionCheck.message ||
              'AliceBlue did not accept the new session. Please reconnect once more.',
          );
          return;
        }
        // Dismiss every mounted token-expire prompt, not only the instance
        // that launched this WebView. Home can have multiple recommendation
        // cards mounted; leaving one stale prompt open produced the observed
        // success alert stacked above "Authentication Required".
        eventEmitter.emit('brokerConnectionVerified', {
          broker: 'AliceBlue',
          freshUser: refreshedUser || null,
        });
        if (!result?.migrationWillShow) {
          showAlert(
            'success',
            'Connected Successfully',
            'Your AliceBlue broker has been connected successfully!',
          );
        }
      } catch (postSuccessErr) {
        console.warn(
          '[AliceBlue] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    } catch (error) {
      console.error('[AliceBlue] Connection error:', error);
      setLoading(false);
      const isHttpError = !!error?.response;
      const rawMessage =
        error.response?.data?.message ||
        error.response?.data?.details ||
        '';
      let alertTitle = 'Connection Error';
      let alertBody;
      if (isHttpError) {
        alertBody =
          rawMessage || 'Failed to connect AliceBlue. Please try again.';
      } else {
        alertTitle = 'Connection Issue';
        alertBody =
          'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
      }
      showAlert('error', alertTitle, alertBody);
    }
  };

  // Reset callback flag when modal opens
  useEffect(() => {
    if (isVisible) {
      hasProcessedCallback.current = false;
      if (!assistedLoginEnabled) setShowBrokerLogin(true);
    }
  }, [isVisible, assistedLoginEnabled]);

  if (assistedLoginEnabled && !showBrokerLogin) {
    const normalLoginDefault = !hasSavedLogin && !quickReconnectOptIn;
    return (
      <BrokerConnectStepperSheet
        isVisible={isVisible}
        onClose={onClose}
        broker="AliceBlue"
        config={{
          monogram: 'A',
          brandFrom: designColor('2563eb'),
          brandTo: designColor('1d4ed8'),
          portalUrl: 'https://ant.aliceblueonline.com/',
          portalLabel: 'Open AliceBlue ANT',
          guideSteps: normalLoginDefault
            ? [
                '<b>AliceBlue login:</b> sign in on AliceBlue’s own page with your user ID, password and TOTP, then approve the consent.',
                'Want faster reconnects? Switch on <b>quick reconnect</b> below to save your login on this phone.',
              ]
            : hasSavedLogin
            ? [
                '<b>Quick Reconnect on this phone:</b> unlock the AliceBlue login protected by biometrics or your device PIN.',
                'The app fills the same AliceBlue partner-login page and generates a fresh TOTP locally.',
                'Review and approve any consent AliceBlue displays.',
              ]
            : [
                '<b>Quick Reconnect on this phone:</b> enter your AliceBlue user ID and password once.',
                'Enable TOTP in AliceBlue ANT and copy the <b>manual Base32 setup key</b> shown with the authenticator QR. If ANT does not expose a setup key, use Normal AliceBlue Login.',
                'Paste the setup key below. AlphaQuark generates the current six-digit TOTP automatically.',
              ],
          note:
            'Both choices use AlphaQuark’s existing AliceBlue partner login. Quick Reconnect keeps the password and TOTP secret only in this phone’s protected keychain; Normal AliceBlue Login asks you to enter them manually at the broker.',
        }}
        fields={hasSavedLogin || normalLoginDefault ? [] : [
          {
            label: 'AliceBlue User ID',
            value: aliceUserId,
            onChange: setAliceUserId,
            placeholder: 'User ID / registered login',
          },
          {
            label: 'AliceBlue Password',
            value: alicePassword,
            onChange: setAlicePassword,
            password: true,
            placeholder: 'Entered only into the broker login',
          },
          {
            label: 'TOTP Secret Key (Base32)',
            value: aliceTotpSeed,
            onChange: value => setAliceTotpSeed(String(value || '')),
            password: true,
            autoCapitalize: 'none',
            placeholder: 'Secret shown during AliceBlue TOTP setup',
          },
        ]}
        error={vaultError}
        canSubmit={
          hasSavedLogin ||
          normalLoginDefault ||
          (Boolean(aliceUserId.trim()) &&
            Boolean(alicePassword) &&
            Boolean(aliceTotpSeed))
        }
        submitLabel={
          hasSavedLogin
            ? 'Quick Reconnect on this phone'
            : normalLoginDefault
            ? 'Continue with AliceBlue login'
            : 'Set up Quick Reconnect on this phone'
        }
        onSubmit={
          hasSavedLogin
            ? unlockAssistedLogin
            : normalLoginDefault
            ? useNormalBrokerLogin
            : enrolAssistedLogin
        }
        loading={vaultBusy}
        deviceTotp={hasSavedLogin ? {
          enabled: true,
          hasSaved: true,
          saveOnDevice: true,
          onToggleSave: () => {},
          onForget: forgetAssistedLogin,
          protectLabel: 'Protected AliceBlue login saved on this phone',
          savedLabel:
            'Biometrics or the device PIN is required. The password and TOTP seed are never copied to AlphaQuark servers.',
          forgetLabel: 'Forget AliceBlue login on this phone',
        } : {
          enabled: true,
          placeBeforeFields: true,
          hasSaved: false,
          saveOnDevice: quickReconnectOptIn,
          onToggleSave: () => setQuickReconnectOptIn(value => !value),
          protectLabel: 'Enable AliceBlue quick reconnect on this phone',
          pendingLabel:
            'Saved only after AliceBlue accepts these details. It will not migrate to another phone.',
        }}
        alternateAction={
          normalLoginDefault
            ? null
            : {
                label: 'Use Normal AliceBlue Login',
                onPress: useNormalBrokerLogin,
              }
        }
      />
    );
  }

  return (
    <AliceBlueConnectUI
      isVisible={isVisible}
      onClose={onClose}
      authUrl={buildAliceBlueAuthUrl()}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      loading={loading}
      assistedCredentials={assistedCredentialsRef.current}
      onAssistedTotpRequired={generateAssistedTotp}
    />
  );
};

export default AliceBlueConnect;
