import React, {useRef, useState, useEffect} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import AliceBlueConnectUI from '../../UIComponents/BrokerConnectionUI/AliceBlueConnectUI';
import {useTrade} from '../../screens/TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkExchangeBrokerToken,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

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
  const {configData} = useTrade();
  const showAlert = useModalStore(state => state.showAlert);
  const hasProcessedCallback = useRef(false);
  const sdkBridge = useSdkBridge();

  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [userDetails, setUserDetails] = useState();
  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain':
            configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => {
        setUserDetails(res.data.User);
      })
      .catch(err => console.log(err));
  };
  useEffect(() => {
    getUserDeatils();
  }, [userEmail, server.server.baseUrl]);

  const userId = userDetails && userDetails._id;

  // Get common headers for API calls
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
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

      console.log(
        '[AliceBlue] Broker connected successfully, updating model portfolio...',
      );

      // SDK pilot dual-write — see brokerSdkBridge.js. AliceBlue's
      // OAuth callback yields jwtToken + clientCode; the SDK route
      // /sdk/v1/connections/AliceBlue/exchange-token accepts this same
      // shape (backend dispatches to the same persistence path used by
      // /api/user/connect-broker).
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        sdkDualWriteSafely(
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
        eventEmitter.emit('refreshEvent', {
          source: 'AliceBlue broker connection',
        });
        // Await the migration check so we don't fire the redundant
        // "Connected Successfully" alert when the migration sheet
        // (which itself says "Reconnected to AliceBlue — your holdings
        // are already set up") will surface as the success indicator.
        // Production 2026-04-26: dual-modal stacking — alert + migration
        // sheet both visible at the same time, with the migration sheet
        // not blocking navigation, letting the user tap "Rebalance" while
        // both were open.
        const result = await fetchBrokerStatusModal();
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
    }
  }, [isVisible]);

  return (
    <AliceBlueConnectUI
      isVisible={isVisible}
      onClose={onClose}
      authUrl={buildAliceBlueAuthUrl()}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      loading={loading}
    />
  );
};

export default AliceBlueConnect;
