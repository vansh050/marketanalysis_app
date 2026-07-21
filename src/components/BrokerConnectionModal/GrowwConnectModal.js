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
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';
import { saveBrokerSessionTime } from '../../utils/brokerSessionUtils';
import EgressIpCallout from './EgressIpCallout';
import {ChevronDown, ChevronUp} from 'lucide-react-native';
import GrowwHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/GrowwHelpContent';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';
import {getAccountEmail} from '../../utils/accountEmail';

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
  const sdkBridge = useSdkBridge();

  const [apiKey, setApiKey] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState();
  // Read More / See Less toggle — mirrors ZerodhaConnectUI's expanded
  // help pattern. Collapsed by default so the form stays the
  // primary action; tapping Read More expands the GrowwHelpContent
  // panel to show Important Notes + Need Help sections.
  const [helpExpanded, setHelpExpanded] = useState(false);
  // Gated by EgressIpCallout acknowledgment. Customers must claim a
  // dedicated egress IP, whitelist it on Groww's side, and tick the
  // acknowledgment checkbox before the Connect button does anything.
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();

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

        // SDK pilot dual-write — see brokerSdkBridge.js. Groww uses
        // /api/groww/update-key (no /api/user/connect-broker step
        // because update-key persists directly), so we mirror with
        // /sdk/v1/connections/Groww/connect.
        if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
          sdkDualWriteSafely(
            sdkConnectBroker(sdkBridge.client, 'Groww', payload),
            'Groww',
            'connect',
          );
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

        setShowBrokerModal?.(false);
        onClose?.();
        // Wrap post-success steps so a downstream throw doesn't bubble
        // to the outer catch and get rewritten as a granular Groww error
        // code or "Connection Error". See KotakModal.js (commit 172767d)
        // and BROKER_CONNECTION.md § Broker-connect post-success hygiene.
        try {
          const result = await fetchBrokerStatusModal?.();
          eventEmitter.emit('refreshEvent', {
            source: 'Groww broker connection',
          });
          if (!result?.migrationWillShow) {
            showAlert(
              'success',
              'Connected Successfully',
              'Your Groww broker has been connected. Daily session refresh is now one tap.',
            );
          }
        } catch (postSuccessErr) {
          console.warn(
            '[Groww] post-success step threw (connection IS saved DB-side):',
            postSuccessErr?.message || postSuccessErr,
          );
        }
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
        // Gate the generic "Connection Error" wording on whether axios
        // actually got an HTTP response. If err.response is missing,
        // it's a network/runtime error and we shouldn't claim Groww
        // rejected the credentials. See KotakModal.js (commit 172767d).
        const isHttpError = !!err?.response;
        if (isHttpError) {
          showAlert(
            'error',
            'Connection Error',
            serverMessage ||
              err?.message ||
              'Failed to connect to Groww. Please try again.',
          );
        } else {
          showAlert(
            'error',
            'Connection Issue',
            'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.',
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = loading || !apiKey.trim() || !totpToken.trim();

  // Shared web-parity stepper surface (RN port of web BrokerConnectStepper —
  // same guide steps + egress static-IP gating as prod web GrowwConnection.js).
  // Container keeps its own egressReady/unmetAck because handleSubmit guards
  // on them; the sheet renders the EgressIpCallout and drives this state.
  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="Groww"
      config={{
        monogram: 'G',
        brandFrom: '#00b386',
        brandTo: '#0a7d63',
        portalUrl: 'https://groww.in/trade-api/api-keys',
        portalLabel: 'Open Groww Trade API',
        walkthroughVideoId: 'Stba6JN-uMI',
        guideSteps: [
          'Log in at <b>groww.in</b> and verify your device',
          'Open <b>groww.in/trade-api/api-keys</b>',
          'Open the <b>Generate API key</b> dropdown → pick <b>Generate TOTP token</b>',
          'Name the token and click <b>Continue</b>',
          'Copy <b>both</b> values shown — the <b>JWT token</b> and the <b>Base32 secret</b> (shown once!)',
          'Click <b>Update static IP</b> and whitelist the IP below',
        ],
      }}
      egressBrokerKey="groww"
      customerId={userId}
      customerEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      fields={[
        {
          label: 'TOTP Token (API Key)',
          value: apiKey,
          onChange: (t) => setApiKey(t.trim()),
          multiline: true,
          placeholder: 'Paste the JWT token (eyJ...) from Groww',
        },
        {
          label: 'TOTP QR Secret (Base32)',
          value: totpToken,
          onChange: (t) => setTotpToken(t.trim()),
          placeholder: '~32-char Base32 secret',
        },
      ]}
      phase="creds"
      error={''}
      canSubmit={Boolean(apiKey) && Boolean(totpToken)}
      submitLabel="Connect Groww"
      loading={loading}
      onSubmit={handleSubmit}
    />
  );
};

export default GrowwConnectModal;
