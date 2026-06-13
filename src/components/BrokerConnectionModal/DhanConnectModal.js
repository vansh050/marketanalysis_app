import React, {useState, useRef, useEffect} from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import server from '../../utils/serverConfig';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import DhanConnectUI from '../../UIComponents/BrokerConnectionUI/DhanConnectUI';
import DhanOAuthUI from '../../UIComponents/BrokerConnectionUI/DhanOAuthUI';
import {useTrade} from '../../screens/TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const DhanConnectModal = ({
  isVisible,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const showAlert = useModalStore(state => state.showAlert);
  const sdkBridge = useSdkBridge();

  // OAuth mode is primary (matching web). Manual credential form is fallback.
  const [oauthMode, setOauthMode] = useState(true);

  // Credential form state (manual / fallback path)
  const [cliendId, setCliendId] = useState('');
  const [accessToken, setaccessToken] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shouldRenderContent, setShouldRenderContent] = useState(false);

  const hasProcessedCallback = useRef(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [userDetails, setUserDetails] = useState(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: getHeaders(),
      })
      .then(res => setUserDetails(res.data.User))
      .catch(err => console.log(err));
  };

  useEffect(() => {
    if (userEmail) getUserDeatils();
  }, [userEmail]);

  // Prefetched final URL (post-redirects) — lets the WebView skip
  // ccxt → auth.dhan.co → partner-login.dhan.co hops (~200ms saved).
  const [prefetchedAuthUrl, setPrefetchedAuthUrl] = useState(null);

  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      hasProcessedCallback.current = false;
      setOauthMode(true); // Always start in OAuth mode when opening
      setPrefetchedAuthUrl(null);
    }
  }, [isVisible]);

  const userId = userDetails?._id;

  // Dhan OAuth start URL — CCXT generates consent + redirects to Dhan's site
  const DHAN_OAUTH_URL = `${server.ccxtServer.baseUrl}dhan/login`;

  // Opt 1: Mint the consentID on the server BEFORE the WebView starts
  // loading. `fetch({redirect:'follow'})` follows the 302 chain
  // (ccxt → auth.dhan.co → partner-login.dhan.co) and exposes the
  // final URL on `resp.url`. We then hand that directly to the
  // WebView so it skips two redirect hops — the server-side consent
  // mint has already happened in parallel while the modal mounted.
  // If prefetch fails for any reason we fall back to the multi-hop
  // URL (no regression).
  useEffect(() => {
    if (!isVisible || prefetchedAuthUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(DHAN_OAUTH_URL, {
          method: 'GET',
          redirect: 'follow',
        });
        if (cancelled) return;
        const finalUrl = resp?.url;
        if (
          typeof finalUrl === 'string' &&
          finalUrl.includes('dhan.co') &&
          finalUrl !== DHAN_OAUTH_URL
        ) {
          console.log('[Dhan] prefetched final URL:', finalUrl);
          setPrefetchedAuthUrl(finalUrl);
        }
      } catch (err) {
        console.warn('[Dhan] consentID prefetch failed:', err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible, DHAN_OAUTH_URL, prefetchedAuthUrl]);

  // ── OAuth callback handler ────────────────────────────────────────
  // The CCXT /dhan/callback consumes the token and redirects to:
  // prod.alphaquark.in/stock-recommendation?dhan_client_id=...&dhan_access_token=...
  const handleWebViewNavigationStateChange = navState => {
    const {url} = navState;
    if (!url || hasProcessedCallback.current) return;

    if (url.includes('dhan_client_id=') && url.includes('dhan_access_token=')) {
      const queryString = url.split('?')[1];
      if (!queryString) return;

      const params = {};
      queryString.split('&').forEach(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) return;
        const key = decodeURIComponent(pair.slice(0, eqIdx));
        const value = decodeURIComponent(pair.slice(eqIdx + 1));
        params[key] = value;
      });

      const dhanClientId = params['dhan_client_id'];
      const dhanAccessToken = params['dhan_access_token'];

      if (dhanClientId && dhanAccessToken) {
        hasProcessedCallback.current = true;
        saveBrokerConnection(dhanClientId, dhanAccessToken);
      }
    }
  };

  // ── Shared save logic (used by both OAuth and credential form) ────
  const saveBrokerConnection = async (clientId, jwtToken) => {
    if (!userId) {
      // userId not loaded yet — try fetching and retry
      try {
        const res = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
          {headers: getHeaders()},
        );
        const uid = res.data?.User?._id;
        if (!uid) {
          showAlert('error', 'Error', 'User not found. Please try again.');
          return;
        }
        return saveBrokerConnectionWithUid(uid, clientId, jwtToken);
      } catch {
        showAlert('error', 'Error', 'User not found. Please try again.');
        return;
      }
    }
    return saveBrokerConnectionWithUid(userId, clientId, jwtToken);
  };

  const saveBrokerConnectionWithUid = async (uid, clientId, jwtToken) => {
    setLoading(true);
    try {
      const dhanBrokerData = {
        uid,
        user_broker: 'Dhan',
        clientCode: clientId,
        jwtToken,
      };
      await axios.request({
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,
        headers: getHeaders(),
        data: JSON.stringify(dhanBrokerData),
      });

      console.log('[Dhan] Broker connected, updating model portfolio...');

      // SDK pilot dual-write — see brokerSdkBridge.js.
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        sdkDualWriteSafely(
          sdkConnectBroker(sdkBridge.client, 'Dhan', dhanBrokerData),
          'Dhan',
          'connect',
        );
      }

      // Update model portfolio with new broker (non-critical)
      try {
        await axios.request({
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          headers: getHeaders(),
          data: JSON.stringify({user_email: userEmail, user_broker: 'Dhan'}),
        });
      } catch (err) {
        console.warn('[Dhan] Model portfolio update failed (non-critical):', err);
      }

      setLoading(false);
      setShowBrokerModal(false);
      onClose();
      // Wrap post-success steps so a downstream throw doesn't bubble to
      // the outer catch and get rewritten as "Connection Failed". See
      // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
      // § Broker-connect post-success hygiene.
      try {
        const result = await fetchBrokerStatusModal();
        eventEmitter.emit('refreshEvent', {source: 'Dhan broker connection'});
        if (!result?.migrationWillShow) {
          showAlert(
            'success',
            'Connected Successfully',
            'Your Dhan broker has been connected successfully!',
          );
        }
        getUserDeatils();
      } catch (postSuccessErr) {
        console.warn(
          '[Dhan] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    } catch (error) {
      console.error('[Dhan] Connection error:', error);
      setLoading(false);
      const isHttpError = !!error?.response;
      const rawMessage =
        error.response?.data?.message ||
        error.response?.data?.details ||
        '';
      let alertTitle = 'Connection Failed';
      let alertBody;
      if (isHttpError) {
        alertBody =
          rawMessage ||
          'Failed to connect Dhan. Please check your credentials and try again.';
      } else {
        alertTitle = 'Connection Issue';
        alertBody =
          'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
      }
      showAlert('error', alertTitle, alertBody);
    }
  };

  // ── Credential form submit (manual fallback path) ─────────────────
  const handleSubmit = () => {
    if (!cliendId || !accessToken) {
      showAlert('error', 'Missing Fields', 'Please enter your Client ID and Access Token.');
      return;
    }
    saveBrokerConnection(cliendId, accessToken);
  };

  // ── Render ────────────────────────────────────────────────────────
  if (oauthMode) {
    return (
      <DhanOAuthUI
        isVisible={isVisible}
        onClose={onClose}
        authUrl={prefetchedAuthUrl || DHAN_OAUTH_URL}
        handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
        loading={loading}
        onSwitchToManual={() => setOauthMode(false)}
      />
    );
  }

  return (
    <DhanConnectUI
      isVisible={isVisible}
      onClose={onClose}
      cliendId={cliendId}
      accessToken={accessToken}
      setCliendId={setCliendId}
      setaccessToken={setaccessToken}
      isPasswordVisible={isPasswordVisible}
      isPasswordVisibleup={isPasswordVisibleup}
      setIsPasswordVisible={setIsPasswordVisible}
      setIsPasswordVisibleup={setIsPasswordVisibleup}
      handleSubmit={handleSubmit}
      loading={loading}
      shouldRenderContent={shouldRenderContent}
      OpenHelpModal={() => setHelpVisible(true)}
      setHelpVisible={setHelpVisible}
      helpVisible={helpVisible}
    />
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
});

export default DhanConnectModal;
