import React, { useState, useRef, useEffect } from 'react';

import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import KotakConnectUI from '../../UIComponents/BrokerConnectionUI/KotakConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';

const KotakModal = ({
  isVisible,
  onClose,
  onBack,
  fetchBrokerStatusModal,
  setShowBrokerModal,
  setShowKotakModal,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sheet = useRef(null);
  const scrollViewRef = useRef(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const [apiKey, setApiKey] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ucc, setucc] = useState('');
  const [iskeyVisible, setIskeyVisible] = useState(false);
  const [ismpinVisible, setIsmpinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mpin, setMpin] = useState('');
  const [totp, settotp] = useState('');

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
  };

  const [userDetails, setUserDetails] = useState();
  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
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

  // Pre-fill mobile number on reconnect — matches web 933e9a4.
  // Reads from connected_brokers[broker=Kotak].mobileNumber (primary)
  // with fallback to the legacy top-level phone_number field.
  // Strips the '+91' prefix so the <TextInput> only holds 10 digits
  // (updateKotakSecretKey re-adds '+91' before sending to the backend).
  useEffect(() => {
    if (!userDetails) return;
    const kotakSlot = Array.isArray(userDetails.connected_brokers)
      ? userDetails.connected_brokers.find(b => b.broker === 'Kotak')
      : null;
    const saved = kotakSlot?.mobileNumber || userDetails.phone_number || '';
    const digits = String(saved).replace(/^\+91/, '').replace(/\D/g, '');
    if (/^\d{10}$/.test(digits) && !mobileNumber) {
      setMobileNumber(digits);
    }
    // Intentionally depend on userDetails only — don't overwrite user
    // edits in-progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails]);

  const userId = userDetails && userDetails._id;

  const [helpVisible, setHelpVisible] = useState(false);
  const OpenHelpModal = () => {
    // console.log('modal:',helpVisible)
    setHelpVisible(true);
  };

  // Egress-IP gate state. `egressReady` is set true by <EgressIpCallout />
  // only when the user has claimed a dedicated IP AND ticked the
  // acknowledgment. `unmetAck` flashes the checkbox red for 2.5s if the
  // user taps Connect without ticking. Matches web behaviour
  // (prod-alphaquark-github/src/Home/BrokerConnection/Kotak/KotakConnection.js).
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  // Connect-button single-flight guard. `isLoading` already gates the
  // button in the UI (KotakConnectUI.js disabled prop), but if a future
  // edit accidentally drops `isLoading` from the disabled list, this
  // ref stops the parallel-request reaching ccxt. Belt-and-braces.
  const isInFlightRef = useRef(false);

  // 30s Connect debounce — Kotak TOTP rotates every 30s and is single-
  // use server-side, so back-to-back submits within the same window
  // either reuse a now-stale TOTP (broker rejects with "Incorrect
  // credentials" / "OTP already used") or arrive after the first
  // request already wrote the connection (returns the same DB row
  // with a freshly-rotated TOTP rejection). Either way the user sees
  // a confusing "Connection Error" alert ON TOP of the success-path
  // migration modal that the first request triggered. 30s matches
  // Kotak's TOTP rotation window. Same pattern as Motilal `b3b6156`.
  const lastKotakConnectAtRef = useRef(0);
  const _KOTAK_CONNECT_COOLDOWN_MS = 30 * 1000;

  const updateKotakSecretKey = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    if (isInFlightRef.current) {
      console.log('[Kotak] Connect blocked — request already in flight');
      return;
    }
    const now = Date.now();
    const sinceLast = now - lastKotakConnectAtRef.current;
    if (sinceLast < _KOTAK_CONNECT_COOLDOWN_MS) {
      const waitS = Math.ceil((_KOTAK_CONNECT_COOLDOWN_MS - sinceLast) / 1000);
      showAlert(
        'warning',
        'Please wait',
        'Kotak TOTP rotates every 30s and cannot be reused. Generate a fresh ' +
          '6-digit code in NEO and try again in ~' + waitS + 's. Tapping ' +
          'Connect with the same TOTP is what causes "Incorrect credentials" ' +
          'errors even when the previous attempt actually succeeded.',
      );
      return;
    }
    setIsLoading(true);
    isInFlightRef.current = true;
    lastKotakConnectAtRef.current = now;

    // Normalize mobile input before validating. Users commonly paste
    // "+91 9876543210" (contacts autofill), "+919876543210", "09876543210"
    // (legacy leading-zero), or "98765 43210" (formatted with space/dash).
    // A raw `^\d{10}$` test rejected all of those even though the intent
    // is a valid 10-digit Indian mobile. Strip non-digits, strip the "91"
    // / "0" country-code prefix only if doing so leaves a 10-digit
    // remainder (so a genuine number starting with 9 isn't truncated),
    // then validate.
    const digitsOnly = String(mobileNumber || '').replace(/\D/g, '');
    let normalizedMobile = digitsOnly;
    if (/^91\d{10}$/.test(normalizedMobile)) {
      normalizedMobile = normalizedMobile.slice(2);
    } else if (/^0\d{10}$/.test(normalizedMobile)) {
      normalizedMobile = normalizedMobile.slice(1);
    }

    if (!/^\d{10}$/.test(normalizedMobile)) {
      setIsLoading(false);
      isInFlightRef.current = false;
      showAlert('error', 'Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    // Reflect the normalized value in the input so the user sees what
    // we're submitting — also preserves it for subsequent retries.
    if (normalizedMobile !== mobileNumber) {
      setMobileNumber(normalizedMobile);
    }

    if (!/^\d{6}$/.test(mpin)) {
      setIsLoading(false);
      isInFlightRef.current = false;
      showAlert('error', 'Invalid MPIN', 'MPIN should be a 6-digit number.');
      return;
    }

    if (!/^\d{6}$/.test(totp)) {
      setIsLoading(false);
      isInFlightRef.current = false;
      showAlert('error', 'Invalid TOTP', 'TOTP should be a 6-digit number.');
      return;
    }

    let data = {
      uid: userId,
      apiKey: checkValidApiAnSecret(apiKey),
      mobileNumber: '+91' + normalizedMobile,
      mpin: mpin,
      ucc: ucc,
      totp: totp,
    };

    let config = {
      method: 'put',
      url: `${server.server.baseUrl}api/kotak/connect-broker`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
      data: JSON.stringify(data),
    };

    axios
      .request(config)
      .then(response => {
        console.log('[Kotak Neo] Broker connected successfully, updating model portfolio...');

        // Update model portfolio with broker information (non-critical)
        let newBrokerData = {
          user_email: userEmail,
          user_broker: 'Kotak Neo',
        };
        let A1_broker = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          data: JSON.stringify(newBrokerData),
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        };

        // Execute the model portfolio broker update - catch separately so connection success isn't affected
        return axios.request(A1_broker).catch(err => {
          console.warn('[Kotak Neo] Model portfolio update failed (non-critical):', err);
          return null;
        });
      })
      .then(async response => {
        if (response) {
          console.log('[Kotak Neo] Model portfolio updated successfully');
        }
        setIsLoading(false);
        isInFlightRef.current = false;
        // Close the Kotak modal first so the migration sheet doesn't
        // stack underneath. See AliceBlueConnect.js comment for the
        // dual-modal-stacking rationale.
        setShowKotakModal(false);
        setShowBrokerModal(false);
        eventEmitter.emit('refreshEvent', { source: 'Kotak broker connection' });
        const result = await fetchBrokerStatusModal();
        if (!result?.migrationWillShow) {
          showAlert('success', 'Connected Successfully', 'Your Kotak broker has been connected successfully!');
        }
      })
      .catch(error => {
        console.log('Connection error:', error);

        // Surface Kotak's actual rejection reason. Their error
        // strings often spell out the failure (`Invalid OTP`,
        // `OTP expired`, `Invalid MPIN`, `Invalid mobile number`),
        // which is far more useful than the generic "Incorrect
        // credentials" fallback. If the message contains any of the
        // known TOTP keywords, prepend a hint about regeneration so
        // the user doesn't try the same expired code again.
        const rawMessage =
          error.response?.data?.message ||
          error.response?.data?.details ||
          '';
        const lower = rawMessage.toLowerCase();
        const isTotpFailure =
          lower.includes('otp') ||
          lower.includes('totp') ||
          lower.includes('two factor') ||
          lower.includes('two-factor');
        let alertTitle = 'Connection Error';
        let alertBody;
        if (isTotpFailure) {
          alertTitle = 'TOTP Rejected';
          alertBody =
            (rawMessage || 'Kotak rejected the TOTP code.') +
            '\n\nKotak TOTPs rotate every 30s and can\'t be reused. Generate a fresh 6-digit code in NEO and try again.';
        } else {
          alertBody = rawMessage || 'Incorrect credentials. Please try again';
        }

        setIsLoading(false);
        isInFlightRef.current = false;
        showAlert('error', alertTitle, alertBody);
      });
  };

  const [shouldRenderContent, setShouldRenderContent] = React.useState(false);
  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
  }, [isVisible]);

  // Render content for each accordion section

  return (
    <KotakConnectUI
      isVisible={isVisible}
      onClose={onClose}
      helpVisible={helpVisible}
      setHelpVisible={setHelpVisible}
      scrollViewRef={scrollViewRef}
      shouldRenderContent={shouldRenderContent}
      mpin={mpin}
      setMpin={setMpin}
      totp={totp}
      settotp={settotp}
      mobileNumber={mobileNumber}
      setMobileNumber={setMobileNumber}
      apiKey={apiKey}
      setApiKey={setApiKey}
      ucc={ucc}
      setucc={setucc}
      iskeyVisible={iskeyVisible}
      setIskeyVisible={setIskeyVisible}
      ismpinVisible={ismpinVisible}
      setIsmpinVisible={setIsmpinVisible}
      updateKotakSecretKey={updateKotakSecretKey}
      OpenHelpModal={OpenHelpModal}
      isLoading={isLoading}
      egressUserId={userId}
      egressUserEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      configData={configData}
    />
  );
};

export default KotakModal;
