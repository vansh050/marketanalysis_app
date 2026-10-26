/**
 * EgressIpCallout (React Native port)
 * -----------------------------------
 * Per-customer egress-IP gate for whitelist-required broker connect
 * screens. Ported from `prod-alphaquark-github/src/Home/BrokerConnection/
 * EgressIpCallout.js` for flow parity.
 *
 * Render states (mobile — identical semantics to web):
 *
 *   1. `loading`            — spinner
 *   2. `error`              — red banner with retry button; parent's
 *                             Connect button stays disabled
 *   3. `partner`            — returns null (broker doesn't need
 *                             whitelisting)
 *   4. `ipv4_provisioning`  — amber "cannot connect, dedicated IPv4
 *                             being provisioned" panel; hard-blocks
 *                             the Connect button
 *   5. `unclaimed`          — blue CTA with "Assign me a static IP"
 *                             button; hard-blocks until claim
 *   6. `claiming`           — spinner during /egress/claim
 *   7. `claimed`            — amber panel with the assigned IP, step-
 *                             by-step instructions, acknowledgment
 *                             checkbox (the only way parent's Connect
 *                             unlocks)
 *   8. `shared_ip`          — IPv4-only broker using the shared advisor
 *                             static IP (no per-customer IPv4 pool yet).
 *                             Same UX + ack gate as `claimed`, different
 *                             language. Backend returns this for e.g.
 *                             Motilal Oswal / Angel One / Arihant — see
 *                             ccxt-india common/egress_registry.py
 *                             compute_broker_status branch 1.
 *   9. `ipv4_not_enabled`   — IPv4-only broker on an advisor whose
 *                             dedicated IPv4 is disabled: no IP, a
 *                             "contact your admin" message, Connect
 *                             stays locked (2026-10-26).
 *
 * Parent contract (identical to web):
 *   <EgressIpCallout
 *     broker="upstox"             // lowercase backend broker_key
 *     customerId={user._id}
 *     customerEmail={user.email}
 *     onAcknowledgeChange={setEgressReady}
 *   />
 *
 * Parent should gate its Connect button on `egressReady === true`.
 * Returns true ONLY when broker is a partner (nothing to check) OR
 * the customer has claimed AND ticked the acknowledgment.
 *
 * The address has a one-tap Copy button as well as selectable text.
 * Customers paste this value into a broker portal often enough that a
 * long-press-only interaction is too easy to miss.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Linking,
  AppState,
} from 'react-native';
import axios from 'axios';
import Config from '../../config/env';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import LinkifiedUrl from '../../UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl';
import {useColors} from '../../theme/useColors';
import Clipboard from '@react-native-clipboard/clipboard';
// Native CashFree subscription checkout for the customer_pays ₹99/mo
// dedicated-IP paywall — SAME primitive MPInvestNowModal uses for plan
// mandates. IPV4_EGRESS_BILLING_DESIGN.md §6.2.
import {CFPaymentGatewayService} from 'react-native-cashfree-pg-sdk';
import {CFSubscriptionSession} from 'cashfree-pg-api-contract';
import {
  getCashfreeEnvironment,
  isInstallSourceError,
  friendlyPaymentError,
} from '../../utils/cashfreeEnv';

import { designToken } from '../../design/literalTokens';

// Brokers requiring per-customer IP whitelisting. Partners short-
// circuit to null without hitting /egress/me. Keep keys in sync with
// web's WHITELIST_BROKERS set (EgressIpCallout.js:72-81).
const WHITELIST_BROKERS = new Set([
  'upstox',
  'angelone',
  'fyers',
  'motilaloswal',
  'kotak',
  'hdfcsec',
  'icicidirect',
  'iifl',
  'groww',
  // Arihant TradeBridge — per-customer IP whitelisting on the customer's
  // TradeBridge account. IPv4-only broker (dedicated-IP flow like Angel One).
  'arihant',
  // DefinEdge INTEGRATE — per-customer IP whitelist in MyAccount → API Config.
  'definedge',
  // Virtual mode over Dhan's partner API host. Direct API is customer-owned
  // and uses the customer's unique free Route64 IPv6; normal Dhan remains
  // partner-routed.
  'dhan_direct',
]);

const BROKER_DISPLAY_NAMES = {
  upstox: 'Upstox',
  angelone: 'Angel One',
  fyers: 'Fyers',
  motilaloswal: 'Motilal Oswal',
  kotak: 'Kotak Neo',
  hdfcsec: 'HDFC Securities',
  icicidirect: 'ICICI Direct',
  iifl: 'IIFL Securities',
  groww: 'Groww',
  arihant: 'Arihant Capital',
  definedge: 'DefinEdge Securities',
  dhan_direct: 'Dhan Direct API',
};

const BROKER_DEV_PORTAL_URLS = {
  upstox: 'https://account.upstox.com/developer/apps',
  angelone: 'https://smartapi.angelone.in/',
  fyers: 'https://fyers.in/web/api-dashboard/user-apps',
  motilaloswal: 'https://openapi.motilaloswal.com/',
  kotak: 'https://napi.kotaksecurities.com/',
  icicidirect: 'https://api.icicidirect.com/apiuser/home',
  iifl: 'https://developers.iiflcapital.com/',
  hdfcsec: 'https://developer.hdfcsky.com/',
  groww: 'https://groww.in/trade-api/api-keys',
  arihant: 'https://tradebridge.arihantplus.com/',
  definedge: 'https://myaccount.definedgesecurities.com/',
  dhan_direct: 'https://web.dhan.co/',
};

const BROKER_WHITELIST_HINT = {
  upstox: 'API Apps → (your app) → Allowed IPs',
  angelone: 'SmartAPI Apps → (your app) → Whitelisted IPs',
  fyers: 'API Dashboard → App Details → Allowed IPs',
  motilaloswal: 'App settings → Allowed IPs',
  kotak: 'Consumer Key settings → IP Whitelist',
  icicidirect: 'Breeze API app → IP Whitelist',
  iifl: 'IIFL Capital developer app → Whitelisted IPs',
  hdfcsec: 'InvestRight API app → Allowed IPs',
  groww: 'Trade API → Generate TOTP token → Whitelisted IPs',
  arihant: 'TradeBridge portal → API Keys → Whitelisted IPs',
  definedge: 'MyAccount → API Config → Whitelisted IPs',
  dhan_direct: 'My Profile → DhanHQ APIs → Static IP',
};

function buildHeaders(configData) {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };
}

const EgressIpCallout = ({
  broker,
  customerId,
  customerEmail,
  onAcknowledgeChange,
  configData,
  showUnmetAck = false,
  onUnmetAckHandled,
  showSetupGuide = true,
  // Optional ref the parent uses to scroll the acknowledgment row into view
  // when the customer taps the locked form without ticking it.
  ackAnchorRef,
}) => {
  const brokerKey = (broker || '').toLowerCase().trim();
  const brokerDisplay = BROKER_DISPLAY_NAMES[brokerKey] || brokerKey;
  const brokerDevPortal = BROKER_DEV_PORTAL_URLS[brokerKey];
  const brokerHint = BROKER_WHITELIST_HINT[brokerKey];

  // Brand the genuine action elements (primary CTA + ack checkbox) to the
  // running white-label tenant. The semantic state panels (info/warning/
  // error) intentionally keep their conventional blue/amber/red.
  const colors = useColors();
  const brand = colors?.brand?.primary || designToken('egressCallout.brand.2563eb');

  // Keep the compliance flow visually part of the app rather than a generic
  // warning block. The content and acknowledgement rules stay identical to
  // the web flow; this only gives the two connection steps a clear hierarchy.
  const StaticIpProgress = ({ready = false}) => (
    <View style={[styles.progressCard, {borderColor: brand}]}>
      <View style={[styles.progressBadge, {backgroundColor: brand}]}> 
        <Text style={styles.progressBadgeText}>{ready ? '✓' : '1'}</Text>
      </View>
      <View style={styles.progressCopy}>
        <Text style={[styles.progressEyebrow, {color: brand}]}>SECURE CONNECTION</Text>
        <Text style={styles.progressTitle}>
          {ready
            ? 'Static IP ready — finish the broker connection'
            : 'Step 1 of 2 · Set up your static IP'}
        </Text>
      </View>
    </View>
  );

  const [loading, setLoading] = useState(true);
  const [brokerState, setBrokerState] = useState(null);
  const [brokerEntry, setBrokerEntry] = useState(null);
  const [migrationBanner, setMigrationBanner] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [flashAck, setFlashAck] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;
  // customer_pays paywall (advisor ipv4_egress.mode === 'customer_pays'):
  // /egress/claim answers 402 with a {plan} block → render a subscribe
  // sheet → native CF subscription mandate → verify-on-demand (Node polls
  // CF; subscription webhooks are unreliable).
  const [paymentInfo, setPaymentInfo] = useState(null); // the 402 body
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [awaitingHostedReturn, setAwaitingHostedReturn] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [copiedIp, setCopiedIp] = useState(null);
  const copyResetRef = useRef(null);
  // The browser checkout is the default: it gives every customer a visible
  // browser back control and lets white-label packages use AlphaQuark's
  // Cashfree-approved domain. A legacy native checkout can be explicitly
  // enabled only for a package that is approved in Cashfree.
  const preferHostedCheckout =
    String(Config.REACT_APP_CASHFREE_HOSTED_SUBSCRIPTION || 'true')
      .trim()
      .toLowerCase() !== 'false';
  const appStateRef = useRef(AppState.currentState);

  const copyIpAddress = useCallback((address) => {
    if (!address) return;
    Clipboard.setString(address);
    setCopiedIp(address);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopiedIp(null), 1800);
  }, []);

  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  const fetchStatus = useCallback(async () => {
    if (!brokerKey || !WHITELIST_BROKERS.has(brokerKey)) {
      setLoading(false);
      setBrokerState('partner');
      setErrorMsg(null);
      return;
    }
    if (!customerId && !customerEmail) {
      setLoading(false);
      setBrokerState(null);
      setErrorMsg(
        'Your account identifier is not available yet. Please reopen this screen and try again.',
      );
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = {};
      if (customerId) params.customer_id = customerId;
      if (customerEmail) params.email = customerEmail;
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}egress/me`,
        {headers: buildHeaders(configData), params, timeout: 10000},
      );
      const data = response.data || {};
      const entry = data.brokers?.[brokerKey] || null;
      setBrokerEntry(entry);
      setBrokerState(entry?.status || 'unknown');
      setMigrationBanner(
        data.migration_banner?.enabled ? data.migration_banner : null,
      );
    } catch (err) {
      console.warn('[EgressIpCallout] /egress/me failed:', err?.message || err);
      const detail =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Unknown error';
      setErrorMsg(
        `Could not load your dedicated IP status: ${detail}. Please try again.`,
      );
      setBrokerState(null);
    } finally {
      setLoading(false);
    }
  }, [brokerKey, customerId, customerEmail, configData]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Gate the parent Connect button. True ONLY for:
  //   - partner brokers (no whitelisting required)
  //   - claimed AND acknowledged
  //   - shared_ip AND acknowledged (IPv4-only brokers on the shared
  //     advisor IP — same ack requirement, different IP source)
  useEffect(() => {
    if (!onAcknowledgeChange) return;
    if (brokerState === 'partner') {
      onAcknowledgeChange(true);
      return;
    }
    if (
      (brokerState === 'claimed' || brokerState === 'shared_ip') &&
      !claiming
    ) {
      onAcknowledgeChange(acknowledged);
      return;
    }
    onAcknowledgeChange(false);
  }, [brokerState, acknowledged, claiming, onAcknowledgeChange]);

  // Parent flipped showUnmetAck — flash the ack checkbox.
  useEffect(() => {
    if (!showUnmetAck) return;
    if (brokerState !== 'claimed' && brokerState !== 'shared_ip') return;
    setFlashAck(true);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    const timer = setTimeout(() => {
      setFlashAck(false);
      onUnmetAckHandled?.();
    }, 2500);
    return () => clearTimeout(timer);
  }, [showUnmetAck, brokerState, onUnmetAckHandled, flashAnim]);

  const handleClaim = async () => {
    setClaiming(true);
    setErrorMsg(null);
    try {
      const body = {broker: brokerKey};
      if (customerId) body.customer_id = customerId;
      if (customerEmail) body.email = customerEmail;
      await axios.post(`${server.ccxtServer.baseUrl}egress/claim`, body, {
        headers: buildHeaders(configData),
        timeout: 15000,
      });
      await fetchStatus();
    } catch (err) {
      if (err.response?.data?.error_code === 'ipv4_not_enabled') {
        // Advisor has not enabled dedicated IPv4: show the
        // contact-your-advisor state from /egress/me, not an error.
        await fetchStatus();
      } else if (err.response?.status === 402 && err.response?.data?.plan) {
        // customer_pays advisor — show the subscribe sheet, not an error.
        setPaymentInfo(err.response.data);
        setVerifyMsg(null);
        setPaymentStatus({
          phase: 'ready',
          title: 'Mandate required before IP assignment',
          detail:
            'Start the secure monthly mandate, then we will confirm it with Cashfree before assigning your IP.',
        });
      } else {
        const apiErr =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message;
        setErrorMsg(`Could not assign a dedicated IP: ${apiErr}`);
      }
    } finally {
      setClaiming(false);
    }
  };

  // Poll Node → CF for a confirmed charge; on grant, re-fetch → claimed.
  const handleVerifyPayment = useCallback(async () => {
    setVerifying(true);
    setVerifyMsg(null);
    setPaymentStatus({
      phase: 'checking',
      title: 'Checking your payment with Cashfree',
      detail: 'This can take a few moments after mandate authorisation.',
    });
    try {
      const body = {broker: brokerKey};
      if (customerId) body.customer_id = customerId;
      if (customerEmail) body.email = customerEmail;
      const res = await axios.post(
        `${server.server.baseUrl}api/egress-ipv4/verify`,
        body,
        {headers: buildHeaders(configData), timeout: 30000},
      );
      if (res.data?.granted) {
        setPaymentStatus({
          phase: 'confirmed',
          title: 'Payment confirmed — your static IP is active',
          detail: 'Add the address below to your broker’s allowed-IP list, then confirm the whitelist entry.',
        });
        setPaymentInfo(null);
        setPaymentStarted(false);
        await fetchStatus(); // → claimed with the dedicated IP
      } else {
        const rawStatus = String(res.data?.payment_status || '').toUpperCase();
        const failed = ['FAILED', 'CANCELLED', 'USER_DROPPED'].includes(rawStatus);
        const detail =
          res.data?.message ||
          'Payment not confirmed yet — finish the payment, then tap “I’ve paid — verify”.';
        setPaymentStatus({
          phase: failed ? 'failed' : 'pending',
          title: failed
            ? 'Cashfree did not confirm this payment'
            : 'Mandate or payment is still pending',
          detail,
        });
        setVerifyMsg(detail);
      }
    } catch (err) {
      const detail = `Could not verify the payment: ${
        err.response?.data?.error || err.message
      }`;
      setPaymentStatus({
        phase: 'failed',
        title: 'We could not confirm the payment yet',
        detail,
      });
      setVerifyMsg(detail);
    } finally {
      setVerifying(false);
    }
  }, [brokerKey, customerId, customerEmail, configData, fetchStatus]);

  // A hosted mandate finishes in the external browser. When the customer
  // returns to the app, poll the server rather than trusting a deep-link or
  // browser result. The backend is the only authority that can grant an IP.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const returnedToApp =
        appStateRef.current !== 'active' && nextState === 'active';
      appStateRef.current = nextState;
      if (returnedToApp && awaitingHostedReturn) {
        setAwaitingHostedReturn(false);
        handleVerifyPayment();
      }
    });
    return () => subscription.remove();
  }, [awaitingHostedReturn, handleVerifyPayment]);

  const openHostedCheckout = async hostedCheckoutUrl => {
    if (!hostedCheckoutUrl || !/^https:\/\//i.test(hostedCheckoutUrl)) {
      throw new Error('Secure hosted checkout link was not returned.');
    }
    setPaymentStarted(true);
    setAwaitingHostedReturn(true);
    setPaymentStatus({
      phase: 'awaiting',
      title: 'Complete the mandate in your browser',
      detail:
        'Return to this app afterwards. We will check Cashfree automatically and never assign the IP before confirmation.',
    });
    await Linking.openURL(hostedCheckoutUrl);
  };

  // Create the CF subscription on the platform account, then launch the
  // native or AlphaQuark-hosted mandate checkout. The hosted path is for
  // white-label package IDs not approved for the native Cashfree SDK.
  const handleSubscribe = async (useHosted = preferHostedCheckout) => {
    setSubscribing(true);
    setVerifyMsg(null);
    try {
      let checkoutSessionInfo = checkoutSession;
      if (!checkoutSessionInfo) {
        const body = {broker: brokerKey};
        if (customerId) body.customer_id = customerId;
        if (customerEmail) body.email = customerEmail;
        const res = await axios.post(
          `${server.server.baseUrl}api/egress-ipv4/subscribe`,
          body,
          {headers: buildHeaders(configData), timeout: 25000},
        );
        if (res.data?.already_active) {
          await handleVerifyPayment();
          return;
        }
        checkoutSessionInfo = {
          subscriptionId: res.data?.subscription_id,
          subscriptionSessionId: res.data?.subscription_session_id,
          hostedCheckoutUrl: res.data?.hosted_checkout_url,
        };
        setCheckoutSession(checkoutSessionInfo);
      }

      if (useHosted) {
        await openHostedCheckout(checkoutSessionInfo.hostedCheckoutUrl);
        return;
      }

      const subsSessionId = checkoutSessionInfo.subscriptionSessionId;
      const subscriptionId = checkoutSessionInfo.subscriptionId;
      if (!subsSessionId) throw new Error('no payment session returned');
      setPaymentStarted(true);
      CFPaymentGatewayService.setCallback({
        onVerify: async () => {
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
          await handleVerifyPayment();
        },
        onError: async error => {
          CFPaymentGatewayService.removeCallback();
          CFPaymentGatewayService.removeEventSubscriber();
          const isCancel =
            error?.code === 'CANCELLED' ||
            error?.code === 'USER_CANCELLED' ||
            String(error?.message || '').includes('cancelled');
          setVerifyMsg(
            isCancel
              ? 'Payment cancelled — you can retry the subscription.'
              : `Payment error: ${
                  error?.message || 'please try again'
                }. If you were charged, tap “I’ve paid — verify”.`,
          );
          setPaymentStatus({
            phase: isCancel ? 'pending' : 'failed',
            title: isCancel
              ? 'Payment was cancelled'
              : 'Cashfree could not complete the payment',
            detail: isCancel
              ? 'You can reopen the secure payment page whenever you are ready.'
              : error?.message || 'Please try again. If you were charged, verify the payment.',
          });
        },
      });
      CFPaymentGatewayService.setEventSubscriber({
        onReceivedEvent: () => {},
      });
      const session = new CFSubscriptionSession(
        subsSessionId, // RAW — do not strip any suffix
        subscriptionId,
        getCashfreeEnvironment(),
      );
      CFPaymentGatewayService.doSubscriptionPayment(session);
    } catch (err) {
      // doSubscriptionPayment throws synchronously on the Play install-
      // source block — surface the actionable message.
      const message = isInstallSourceError(err)
        ? friendlyPaymentError(err)
        : err.response?.data?.error ||
          err.message ||
          'Could not start the subscription.';
      setVerifyMsg(message);
      setPaymentStatus({
        phase: 'failed',
        title: 'The payment screen could not be opened',
        detail: message,
      });
    } finally {
      setSubscribing(false);
    }
  };

  // A 402 response replaces the normal “claim IP” state with the optional
  // ₹99 subscription offer. This must never become a dead end: the customer
  // can decline it and return to the ordinary broker-connect screen without
  // starting (or cancelling) a Cashfree mandate.
  const handleDismissPayment = () => {
    setPaymentInfo(null);
    setPaymentStarted(false);
    setCheckoutSession(null);
    setAwaitingHostedReturn(false);
    setVerifyMsg(null);
    setPaymentStatus(null);
  };

  const PaymentStatusPanel = paymentStatus ? (
    <View
      style={[
        styles.paymentStatus,
        paymentStatus.phase === 'confirmed' && styles.paymentStatusConfirmed,
        paymentStatus.phase === 'failed' && styles.paymentStatusFailed,
        paymentStatus.phase === 'pending' && styles.paymentStatusPending,
      ]}>
      <Text style={styles.paymentStatusTitle}>{paymentStatus.title}</Text>
      <Text style={styles.paymentStatusDetail}>{paymentStatus.detail}</Text>
    </View>
  ) : null;

  const addressFamily = brokerEntry?.family === 'ipv6' ? 'IPv6' : 'IPv4';
  const SetupGuide =
    showSetupGuide && brokerState !== 'partner' ? (
      <View style={styles.setupGuide}>
        <Text style={[styles.setupEyebrow, {color: brand}]}>BROKER SETUP</Text>
        <Text style={styles.setupTitle}>Set up {brokerDisplay} in three steps</Text>
        <Text style={styles.setupStep}>1. Get or review the static IP shown below.</Text>
        <Text style={styles.setupStep}>
          2. Add it in {brokerHint || `${brokerDisplay}’s developer portal`}.
        </Text>
        <Text style={styles.setupStep}>
          3. Save the broker entry, then tick the confirmation box to continue.
        </Text>
        {brokerEntry?.address ? (
          <Text style={styles.setupFamily}>
            Assigned address family: {addressFamily}
          </Text>
        ) : null}
      </View>
    ) : null;

  // Partner broker — nothing to render.
  if (brokerState === 'partner') return null;

  // customer_pays paywall — the claim answered 402; render the subscribe
  // sheet until the payment is verified and the grant lands.
  if (paymentInfo && brokerState !== 'claimed') {
    const plan = paymentInfo.plan || {};
    const amount = plan.amount ?? 99;
    return (
      <View style={styles.container}>
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardBlue]}>
          <StaticIpProgress />
          <Text style={styles.titleBlue}>
            {brokerDisplay} needs a dedicated static IP — ₹{amount}/month
          </Text>
          <Text style={styles.bodyBlue}>
            • {brokerDisplay} accepts trading API requests only from an IP
            address you have whitelisted. AlphaQuark reserves a dedicated
            static IP for you so that address remains stable.
          </Text>
          <Text style={styles.bodyBlue}>
            • This ₹{amount}/month mandate is required only while you use a
            broker that needs a dedicated static IP. It covers every such
            broker connected through this manager, not only {brokerDisplay}.
          </Text>
          <Text style={styles.bodyBlue}>
            • You authorise AlphaQuark to collect the monthly service charge
            securely through Cashfree. You can cancel the mandate anytime; the
            IP is released after the 7-day grace period.
          </Text>
          {verifyMsg && (
            <Text style={[styles.bodyBlue, {marginTop: 6}]}>{verifyMsg}</Text>
          )}
          <TouchableOpacity
            onPress={() => handleSubscribe(preferHostedCheckout)}
            disabled={subscribing || verifying}
            style={[
              styles.primaryButton,
              {backgroundColor: brand},
              (subscribing || verifying) && {opacity: 0.6},
            ]}
            activeOpacity={0.8}>
            {subscribing ? (
              <ActivityIndicator size="small" color={designToken('egressCallout.color.fff')} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {paymentStarted
                  ? preferHostedCheckout
                    ? 'Open secure browser payment again'
                    : 'Open payment again'
                  : preferHostedCheckout
                    ? `Continue in browser — ₹${amount}/month`
                    : `Authorise ₹${amount}/month`}
              </Text>
            )}
          </TouchableOpacity>
          {!preferHostedCheckout && (
            <TouchableOpacity
              onPress={() => handleSubscribe(true)}
              disabled={subscribing || verifying}
              style={[
                styles.secondaryButton,
                {borderColor: brand},
                (subscribing || verifying) && {opacity: 0.6},
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open secure payment in browser">
              <Text style={[styles.secondaryButtonText, {color: brand}]}> 
                Open secure payment in browser instead
              </Text>
            </TouchableOpacity>
          )}
          {paymentStarted && (
            <TouchableOpacity
              onPress={handleVerifyPayment}
              disabled={verifying}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: brand,
                  marginTop: 8,
                },
                verifying && {opacity: 0.6},
              ]}
              activeOpacity={0.8}>
              {verifying ? (
                <ActivityIndicator size="small" color={brand} />
              ) : (
                <Text style={[styles.primaryButtonText, {color: brand}]}>
                  I’ve paid — verify
                </Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleDismissPayment}
            disabled={subscribing || verifying}
            style={[
              styles.secondaryButton,
              {borderColor: brand},
              (subscribing || verifying) && {opacity: 0.6},
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back without subscribing">
            <Text style={[styles.secondaryButtonText, {color: brand}]}> 
              Not now — go back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const MigrationBanner = migrationBanner ? (
    <View style={[styles.card, styles.cardRed, {marginBottom: 10}]}>
      <Text style={styles.bannerTitle}>Your dedicated IP is changing soon</Text>
      <Text style={styles.bannerBody}>{migrationBanner.message}</Text>
      {migrationBanner.expires_at && (
        <Text style={styles.bannerSmall}>
          Please re-whitelist by{' '}
          <Text style={styles.bold}>
            {new Date(migrationBanner.expires_at).toLocaleDateString()}
          </Text>
          .
        </Text>
      )}
    </View>
  ) : null;

  if (loading) {
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardNeutral]}>
          <View style={styles.row}>
            <ActivityIndicator size="small" color={designToken('egressCallout.color.6b7280')} />
            <Text style={styles.bodyText}>
              {'  '}Loading your dedicated IP status for {brokerDisplay}...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (errorMsg && !brokerState) {
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardRed]}>
          <Text style={styles.titleRed}>
            Unable to check your dedicated IP
          </Text>
          <Text style={styles.bodyRed}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={fetchStatus}
            style={styles.retryButton}
            activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // State: shared_ip — IPv4-only broker using the shared advisor IP.
  // Same UX + hard ack gate as "claimed", but the language explains it
  // is a shared static IP (one per advisor), not per-customer. Also
  // covers legacy "ipv4_provisioning" responses that carry an address.
  if (
    brokerState === 'shared_ip' ||
    (brokerState === 'ipv4_provisioning' && brokerEntry?.address)
  ) {
    const sharedIp = brokerEntry?.address || '72.61.251.253';
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardAmber]}>
          <StaticIpProgress />
          <Text style={styles.titleAmber}>Your dedicated static IP</Text>
          <Text style={[styles.bodyAmberNote, {fontSize: 11}]}>
            IPv4 — shared manager static IP (SEBI compliant, does not change)
          </Text>

          <IpAddressBox
            address={sharedIp}
            copied={copiedIp === sharedIp}
            onCopy={copyIpAddress}
            accent={brand}
          />

          <Text style={[styles.stepText, {marginTop: 10}]}>
            Paste it into your {brokerDisplay} IP whitelist
            {brokerHint ? (
              <>
                {' — '}
                <Text style={styles.italic}>{brokerHint}</Text>
              </>
            ) : null}
            {brokerDevPortal ? (
              <>
                {' '}
                <LinkifiedUrl url={brokerDevPortal} display="(open portal)" />
              </>
            ) : null}
          </Text>

          <Animated.View
            ref={ackAnchorRef}
            style={[
              styles.ackRow,
              flashAck && {
                backgroundColor: flashAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [designToken('brokerSheet.egress.ackFlash.fromColor'), designToken('brokerSheet.egress.ackFlash.toColor')],
                }),
                borderColor: designToken('brokerSheet.egress.ackFlash.borderColor'),
              },
            ]}>
            <TouchableOpacity
              onPress={() => setAcknowledged(!acknowledged)}
              style={styles.checkboxRow}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.checkbox,
                  acknowledged && [
                    styles.checkboxChecked,
                    {backgroundColor: brand, borderColor: brand},
                  ],
                  flashAck && !acknowledged && styles.checkboxFlash,
                ]}>
                {acknowledged && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.ackText}>
                {flashAck && !acknowledged && (
                  <Text style={[styles.bold, {color: designToken('brokerSheet.egress.ackFlash.warningText.color')}]}>
                    ⚠ Please tick this box to confirm you've whitelisted the
                    IP.{'\n'}
                  </Text>
                )}
                I have added <Text style={styles.ipInline}>{sharedIp}</Text>{' '}
                to my {brokerDisplay} developer portal whitelist. I understand
                broker API calls will be rejected until the entry is active on{' '}
                {brokerDisplay}'s side. This is a shared static IP used across
                customers of this advisor.
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {errorMsg && (
            <Text style={[styles.bodyRed, {marginTop: 6}]}>{errorMsg}</Text>
          )}
        </View>
      </View>
    );
  }

  if (brokerState === 'ipv4_provisioning') {
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardAmber]}>
          <Text style={styles.titleAmber}>
            {brokerDisplay} connections are temporarily unavailable
          </Text>
          <Text style={styles.bodyAmber}>
            {brokerDisplay} is an IPv4-only broker and requires a dedicated
            IPv4 address per customer for order placement (SEBI compliance).
            We're currently provisioning the dedicated IPv4 pool for this
            broker.
          </Text>
          <Text style={[styles.bodyAmber, styles.bold, {marginTop: 8}]}>
            {brokerEntry?.message ||
              'Please come back in a few days — once provisioning is complete, this screen will automatically let you claim your own dedicated IP and connect.'}
          </Text>
          <Text style={[styles.bodyAmberNote, {fontSize: 11, marginTop: 8}]}>
            In the meantime, please use a different broker. You cannot connect
            to {brokerDisplay} right now.
          </Text>
        </View>
      </View>
    );
  }

  if (brokerState === 'unclaimed') {
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardBlue]}>
          <StaticIpProgress />
          <Text style={styles.titleBlue}>Claim your dedicated static IP</Text>
          <Text style={styles.bodyBlue}>
            SEBI regulations require {brokerDisplay} to only accept orders
            from IP addresses you've explicitly whitelisted in their developer
            portal. We assign every customer a unique static IP for isolation
            — no IPs are shared across customers.
          </Text>
          <Text style={[styles.bodyBlue, styles.bold, {marginTop: 6}]}>
            Tap the button below to assign yourself a dedicated static IP. You
            cannot connect to {brokerDisplay} without one.
          </Text>
          {errorMsg && (
            <Text style={[styles.bodyRed, {marginTop: 6}]}>{errorMsg}</Text>
          )}
          <TouchableOpacity
            onPress={handleClaim}
            disabled={claiming}
            style={[
              styles.primaryButton,
              {backgroundColor: brand},
              claiming && {opacity: 0.6},
            ]}
            activeOpacity={0.8}>
            {claiming ? (
              <ActivityIndicator size="small" color={designToken('egressCallout.color.fff')} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Assign me a dedicated static IP
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (brokerState === 'claimed' && brokerEntry?.address) {
    const hasSecondIp = Boolean(brokerEntry.ovh_address);
    const flashBg = flashAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [designToken('brokerSheet.egress.ackFlash.fromColor'), designToken('brokerSheet.egress.ackFlash.toColor')],
    });
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        {PaymentStatusPanel}
        <View style={[styles.card, styles.cardAmber]}>
          <StaticIpProgress ready={acknowledged} />
          <Text style={styles.titleAmber}>Dedicated static IP assigned</Text>
          <Text style={[styles.bodyAmberNote, {fontSize: 11}]}>
            {brokerEntry.family === 'ipv6'
              ? 'IPv6 — unique to your account'
              : 'IPv4 — unique to your account'}
          </Text>

          {hasSecondIp ? (
            <SecondStaticIp
              brokerKey={brokerKey}
              entry={brokerEntry}
              customerId={customerId}
              customerEmail={customerEmail}
              configData={configData}
              onEntryChange={setBrokerEntry}
              showAddedButton={false}
            />
          ) : (
          <>
          <IpAddressBox
            address={brokerEntry.address}
            copied={copiedIp === brokerEntry.address}
            onCopy={copyIpAddress}
            accent={brand}
          />

          <Text style={[styles.stepText, {marginTop: 10}]}>
            Paste it into your {brokerDisplay} IP whitelist
            {brokerHint ? (
              <>
                {' — '}
                <Text style={styles.italic}>{brokerHint}</Text>
              </>
            ) : null}
            {brokerDevPortal ? (
              <>
                {' '}
                <LinkifiedUrl url={brokerDevPortal} display="(open portal)" />
              </>
            ) : null}
          </Text>
          </>
          )}

          <Animated.View
            ref={ackAnchorRef}
            style={[
              styles.ackRow,
              flashAck && {backgroundColor: flashBg, borderColor: designToken('brokerSheet.egress.ackFlash.borderColor')},
            ]}>
            <TouchableOpacity
              onPress={() => {
                const next = !acknowledged;
                setAcknowledged(next);
                const st = brokerEntry.ovh_state;
                if (next && hasSecondIp && (st === 'not_added' || st === 'rejected')) {
                  // Verified on the first order; optional, never blocks connect.
                  markOvhAdded({brokerKey, customerId, customerEmail, configData})
                    .then(fresh => fresh && setBrokerEntry(fresh))
                    .catch(() => {});
                }
              }}
              style={styles.checkboxRow}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.checkbox,
                  acknowledged && [
                    styles.checkboxChecked,
                    {backgroundColor: brand, borderColor: brand},
                  ],
                  flashAck && !acknowledged && styles.checkboxFlash,
                ]}>
                {acknowledged && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.ackText}>
                {flashAck && !acknowledged && (
                  <Text style={[styles.bold, {color: designToken('brokerSheet.egress.ackFlash.warningText.color')}]}>
                    ⚠ Please tick this box to confirm you've whitelisted the
                    IP.{'\n'}
                  </Text>
                )}
                {hasSecondIp ? (
                  <>I have added both IPs to my {brokerDisplay} developer portal whitelist.</>
                ) : (
                  <>
                    I have added{' '}
                    <Text style={styles.ipInline}>{brokerEntry.address}</Text> to
                    my {brokerDisplay} developer portal whitelist.
                  </>
                )} I understand
                broker API calls will be rejected until the entry is active on{' '}
                {brokerDisplay}'s side.
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {errorMsg && (
            <Text style={[styles.bodyRed, {marginTop: 6}]}>{errorMsg}</Text>
          )}
        </View>
      </View>
    );
  }

  // ipv4_not_enabled — the advisor has not enabled dedicated IPv4, so
  // there is no IP to whitelist (the shared advisor IP is never offered:
  // Motilal lets only one user register an IP). Connect stays locked.
  if (brokerState === 'ipv4_not_enabled') {
    return (
      <View style={styles.container}>
        {MigrationBanner}
        {SetupGuide}
        <View style={[styles.card, styles.cardNeutral]}>
          <Text style={styles.bodyText}>
            {brokerEntry?.message ||
              `A dedicated static IP for ${brokerDisplay} is not enabled for your account yet. Please contact your admin to enable it, then connect again.`}
          </Text>
        </View>
      </View>
    );
  }

  // Unknown state — minimal fallback so the user sees something and can retry.
  return (
    <View style={styles.container}>
      {MigrationBanner}
      {SetupGuide}
      {PaymentStatusPanel}
      <View style={[styles.card, styles.cardNeutral]}>
        <Text style={styles.bodyText}>
          Your dedicated IP status for {brokerDisplay} is not yet available.
        </Text>
        <TouchableOpacity
          onPress={fetchStatus}
          style={[styles.retryButton, {marginTop: 8}]}
          activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const IpAddressBox = ({address, copied, onCopy, accent}) => (
  <View style={styles.ipBox}>
    <Text style={styles.ipText} selectable>
      {address}
    </Text>
    <TouchableOpacity
      onPress={() => onCopy(address)}
      style={[styles.copyButton, {borderColor: accent}]}
      accessibilityRole="button"
      accessibilityLabel={`Copy static IP ${address}`}>
      <Text style={[styles.copyButtonText, {color: accent}]}>
        {copied ? 'Copied ✓' : 'Copy IP'}
      </Text>
    </TouchableOpacity>
  </View>
);

/**
 * Second whitelisted IP (OVH Mumbai) — ccxt-india docs/EGRESS_OVH_PRIMARY_DESIGN.md.
 * Brokers accept a primary + secondary static IP; with both whitelisted the
 * customer's orders keep flowing when one network path is down. /egress/me
 * adds `ovh_address`, `ovh_role` ('secondary' = existing customer adds it as
 * the backup; 'primary' = newer customer sets it as the main IP) and
 * `ovh_state` (not_added | requested | confirmed | rejected). `address` is
 * unchanged. Mirrors web src/Home/BrokerConnection/BackupStaticIp.js.
 */
export async function markOvhAdded({brokerKey, customerId, customerEmail, configData}) {
  const body = {broker: brokerKey};
  if (customerId) {
    body.customer_id = customerId;
  }
  if (customerEmail) {
    body.email = customerEmail;
  }
  const res = await axios.post(`${server.ccxtServer.baseUrl}egress/ovh/added`, body, {
    headers: buildHeaders(configData),
    timeout: 10000,
  });
  return res.data?.entry || null;
}

/** One broker's /egress/me entry (null on any failure — callers treat the
 *  second-IP prompt as optional). */
export async function fetchEgressEntry({brokerKey, customerId, customerEmail, configData}) {
  if (!brokerKey || (!customerId && !customerEmail)) {
    return null;
  }
  try {
    const params = {};
    if (customerId) {
      params.customer_id = customerId;
    }
    if (customerEmail) {
      params.email = customerEmail;
    }
    const res = await axios.get(`${server.ccxtServer.baseUrl}egress/me`, {
      headers: buildHeaders(configData),
      params,
      timeout: 10000,
    });
    return res.data?.brokers?.[brokerKey] || null;
  } catch (e) {
    return null;
  }
}

const OVH_STATE_NOTE = {
  requested: b => `Waiting for confirmation. We check it automatically on your next ${b} order.`,
  confirmed: () => 'Active. Your orders can use either IP.',
  rejected: b =>
    `${b} rejected this IP on your last order. Check it is entered exactly as shown, then tap "I've added it" again.`,
};

export const SecondStaticIp = ({
  brokerKey,
  entry,
  customerId,
  customerEmail,
  configData,
  onEntryChange,
  showAddedButton = true,
  withCard = false,
}) => {
  const colors = useColors();
  const brand = colors?.brand?.primary || designToken('egressCallout.brand.2563eb');
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  if (!entry?.ovh_address || !entry?.address) {
    return null;
  }

  const brokerName = BROKER_DISPLAY_NAMES[brokerKey] || brokerKey;
  const hint = BROKER_WHITELIST_HINT[brokerKey];
  const portal = BROKER_DEV_PORTAL_URLS[brokerKey];
  const ovhIsPrimary = entry.ovh_role === 'primary';
  const primary = ovhIsPrimary ? entry.ovh_address : entry.address;
  const secondary = ovhIsPrimary ? entry.address : entry.ovh_address;
  const state = entry.ovh_state || 'not_added';
  const canMarkAdded = showAddedButton && (state === 'not_added' || state === 'rejected');
  const copy = address => {
    Clipboard.setString(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 1800);
  };
  const handleAdded = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await markOvhAdded({brokerKey, customerId, customerEmail, configData});
      if (fresh) {
        onEntryChange?.(fresh);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <View testID={`second-static-ip-${brokerKey}`} accessibilityValue={{text: state}}>
      {withCard ? (
        <Text style={styles.titleAmber}>
          {state === 'confirmed' ? 'Backup IP' : 'Add a backup IP'}
        </Text>
      ) : null}
      <Text style={styles.stepText}>
        {ovhIsPrimary
          ? `${brokerName} lets you whitelist two IPs. Add both so your orders keep going through if one network has a problem.`
          : `Add a backup IP in the Secondary slot of your ${brokerName} whitelist. If our main network has a problem, your orders go through the backup instead. Your current IP stays as it is.`}
      </Text>
      <Text style={[styles.stepText, styles.bold, styles.ovhGap]}>
        {ovhIsPrimary ? 'Primary static IP' : 'Primary static IP (already set)'}
      </Text>
      <IpAddressBox address={primary} copied={copied === primary} onCopy={copy} accent={brand} />
      <Text style={[styles.stepText, styles.bold, styles.ovhGap]}>
        {ovhIsPrimary ? 'Secondary static IP' : 'Secondary static IP (add this)'}
      </Text>
      <IpAddressBox address={secondary} copied={copied === secondary} onCopy={copy} accent={brand} />
      <Text style={[styles.stepText, styles.ovhGap]}>
        Paste them into your {brokerName} IP whitelist
        {hint ? (
          <>
            {' — '}
            <Text style={styles.italic}>{hint}</Text>
          </>
        ) : null}
        {portal ? (
          <>
            {' '}
            <LinkifiedUrl url={portal} display="(open portal)" />
          </>
        ) : null}
      </Text>
      {OVH_STATE_NOTE[state] ? (
        <Text
          testID={`second-static-ip-state-${brokerKey}`}
          style={[state === 'rejected' ? styles.bodyRed : styles.stepText, styles.bold, styles.ovhNote]}>
          {OVH_STATE_NOTE[state](brokerName)}
        </Text>
      ) : null}
      {canMarkAdded ? (
        <TouchableOpacity
          onPress={handleAdded}
          disabled={saving}
          style={[styles.primaryButton, styles.ovhGap, {backgroundColor: brand}, saving && styles.ovhSaving]}
          accessibilityRole="button"
          activeOpacity={0.8}>
          {saving ? (
            <ActivityIndicator size="small" color={designToken('egressCallout.color.fff')} />
          ) : (
            <Text style={styles.primaryButtonText}>I've added it</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {error ? <Text style={[styles.bodyRed, styles.ovhError]}>{error}</Text> : null}
    </View>
  );
  return withCard ? <View style={[styles.card, styles.cardAmber]}>{body}</View> : body;
};

const styles = StyleSheet.create({
  // Second whitelisted IP (SecondStaticIp) spacing.
  ovhGap: {marginTop: 10},
  ovhNote: {marginTop: 8},
  ovhError: {marginTop: 6},
  ovhSaving: {opacity: 0.6},
  container: {
    marginTop: 18,
    marginBottom: 12,
  },
  setupGuide: {
    backgroundColor: designToken('brokerSheet.egress.setupGuide.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('brokerSheet.egress.setupGuide.borderColor'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  setupEyebrow: {
    fontFamily: designToken('brokerSheet.egress.setupEyebrow.fontFamily'),
    fontSize: 10,
    letterSpacing: 0.8,
    color: designToken('brokerSheet.egress.setupEyebrow.color'),
  },
  setupTitle: {
    color: designToken('brokerSheet.egress.setupTitle.color'),
    fontFamily: designToken('brokerSheet.egress.setupTitle.fontFamily'),
    fontSize: 15,
    marginTop: 3,
    marginBottom: 8,
  },
  setupStep: {
    color: designToken('brokerSheet.egress.setupStep.color'),
    fontFamily: designToken('brokerSheet.egress.setupStep.fontFamily'),
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  setupFamily: {
    color: designToken('brokerSheet.egress.setupFamily.color'),
    fontFamily: designToken('brokerSheet.egress.setupFamily.fontFamily'),
    fontSize: 11,
    marginTop: 8,
  },
  paymentStatus: {
    backgroundColor: designToken('brokerSheet.egress.paymentStatus.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('brokerSheet.egress.paymentStatus.borderColor'),
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  paymentStatusPending: {
    backgroundColor: designToken('egressCallout.paymentStatusPending.backgroundColor'),
    borderColor: designToken('egressCallout.paymentStatusPending.borderColor'),
  },
  paymentStatusConfirmed: {
    backgroundColor: designToken('egressCallout.paymentStatusConfirmed.backgroundColor'),
    borderColor: designToken('egressCallout.paymentStatusConfirmed.borderColor'),
  },
  paymentStatusFailed: {
    backgroundColor: designToken('egressCallout.paymentStatusFailed.backgroundColor'),
    borderColor: designToken('egressCallout.paymentStatusFailed.borderColor'),
  },
  paymentStatusTitle: {
    color: designToken('brokerSheet.egress.paymentStatusTitle.color'),
    fontFamily: designToken('brokerSheet.egress.paymentStatusTitle.fontFamily'),
    fontSize: 13,
  },
  paymentStatusDetail: {
    color: designToken('brokerSheet.egress.paymentStatusDetail.color'),
    fontFamily: designToken('brokerSheet.egress.paymentStatusDetail.fontFamily'),
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    shadowColor: designToken('egressCallout.card.shadowColor'),
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 3},
    elevation: 2,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: designToken('brokerSheet.egress.progressCard.backgroundColor'),
    padding: 10,
    marginBottom: 12,
    borderColor: designToken('brokerSheet.egress.progressCard.borderColor'),
  },
  progressBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  progressBadgeText: {
    color: designToken('brokerSheet.egress.progressBadgeText.color'),
    fontFamily: designToken('brokerSheet.egress.progressBadgeText.fontFamily'),
    fontSize: 13,
  },
  progressCopy: {flex: 1},
  progressEyebrow: {
    fontFamily: designToken('brokerSheet.egress.progressEyebrow.fontFamily'),
    fontSize: 10,
    letterSpacing: 0.6,
    color: designToken('brokerSheet.egress.progressEyebrow.color'),
  },
  progressTitle: {
    color: designToken('brokerSheet.egress.progressTitle.color'),
    fontFamily: designToken('brokerSheet.egress.progressTitle.fontFamily'),
    fontSize: 13,
    marginTop: 2,
  },
  cardNeutral: {
    backgroundColor: designToken('brokerSheet.egress.cardNeutral.backgroundColor'),
    borderColor: designToken('egressCallout.cardNeutral.borderColor'),
  },
  cardBlue: {
    backgroundColor: designToken('brokerSheet.egress.cardBlue.backgroundColor'),
    borderColor: designToken('brokerSheet.egress.cardBlue.borderColor'),
  },
  cardAmber: {
    backgroundColor: designToken('brokerSheet.egress.cardAmber.backgroundColor'),
    borderColor: designToken('brokerSheet.egress.cardAmber.borderColor'),
  },
  cardRed: {
    backgroundColor: designToken('brokerSheet.egress.cardRed.backgroundColor'),
    borderColor: designToken('brokerSheet.egress.cardRed.borderColor'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyText: {
    fontFamily: designToken('brokerSheet.egress.bodyText.fontFamily'),
    fontSize: 13,
    color: designToken('brokerSheet.egress.bodyText.color'),
  },
  titleBlue: {
    fontFamily: designToken('brokerSheet.egress.titleBlue.fontFamily'),
    fontSize: 15,
    color: designToken('brokerSheet.egress.titleBlue.color'),
    marginBottom: 6,
  },
  bodyBlue: {
    fontFamily: designToken('brokerSheet.egress.bodyBlue.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.bodyBlue.color'),
    lineHeight: 18,
  },
  titleAmber: {
    fontFamily: designToken('brokerSheet.egress.titleAmber.fontFamily'),
    fontSize: 15,
    color: designToken('brokerSheet.egress.titleAmber.color'),
    marginBottom: 4,
  },
  bodyAmber: {
    fontFamily: designToken('brokerSheet.egress.bodyAmber.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.bodyAmber.color'),
    lineHeight: 18,
  },
  // Small amber notes (static-IP hints): same defaults as bodyAmber, with
  // their own design tokens so a variant can style notes separately.
  bodyAmberNote: {
    fontFamily: designToken('brokerSheet.egress.bodyAmberNote.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.bodyAmberNote.color'),
    lineHeight: 18,
  },
  titleRed: {
    fontFamily: designToken('brokerSheet.egress.titleRed.fontFamily'),
    fontSize: 14,
    color: designToken('brokerSheet.egress.titleRed.color'),
    marginBottom: 4,
  },
  bodyRed: {
    fontFamily: designToken('brokerSheet.egress.bodyRed.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.bodyRed.color'),
  },
  bannerTitle: {
    fontFamily: designToken('brokerSheet.egress.bannerTitle.fontFamily'),
    fontSize: 13,
    color: designToken('brokerSheet.egress.bannerTitle.color'),
  },
  bannerBody: {
    fontFamily: designToken('brokerSheet.egress.bannerBody.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.bannerBody.color'),
    marginTop: 2,
  },
  bannerSmall: {
    fontFamily: designToken('brokerSheet.egress.bannerSmall.fontFamily'),
    fontSize: 11,
    color: designToken('brokerSheet.egress.bannerSmall.color'),
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: designToken('egressCallout.primaryButton.backgroundColor'),
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: designToken('brokerSheet.egress.primaryButtonText.color'),
    fontFamily: designToken('brokerSheet.egress.primaryButtonText.fontFamily'),
    fontSize: 13,
  },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontFamily: designToken('egressCallout.secondaryButtonText.fontFamily'),
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: designToken('egressCallout.retryButton.backgroundColor'),
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  retryButtonText: {
    color: designToken('egressCallout.retryButtonText.color'),
    fontFamily: designToken('egressCallout.retryButtonText.fontFamily'),
    fontSize: 12,
  },
  stepHeader: {
    fontFamily: designToken('egressCallout.stepHeader.fontFamily'),
    fontSize: 13,
    color: designToken('egressCallout.stepHeader.color'),
  },
  ipBox: {
    backgroundColor: designToken('brokerSheet.egress.ipBox.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('brokerSheet.egress.ipBox.borderColor'),
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  ipText: {
    fontFamily: designToken('brokerSheet.egress.ipText.fontFamily'),
    fontSize: 14,
    color: designToken('brokerSheet.egress.ipText.color'),
  },
  copyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: designToken('brokerSheet.egress.copyButton.backgroundColor'),
    borderColor: designToken('brokerSheet.egress.copyButton.borderColor'),
  },
  copyButtonText: {
    fontFamily: designToken('brokerSheet.egress.copyButtonText.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.copyButtonText.color'),
  },
  stepText: {
    fontFamily: designToken('brokerSheet.egress.stepText.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.stepText.color'),
    lineHeight: 18,
    marginTop: 2,
  },
  link: {
    color: designToken('egressCallout.link.color'),
    textDecorationLine: 'underline',
  },
  bold: {
    fontFamily: designToken('brokerSheet.egress.bold.fontFamily'),
    color: designToken('brokerSheet.egress.bold.color'),
  },
  italic: {
    fontStyle: 'italic',
  },
  ackRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designToken('brokerSheet.egress.ackRow.borderColor'),
    backgroundColor: designToken('brokerSheet.egress.ackRow.backgroundColor'),
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: designToken('egressCallout.checkbox.borderColor'),
    backgroundColor: designToken('egressCallout.checkbox.backgroundColor'),
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: designToken('egressCallout.checkboxChecked.backgroundColor'),
    borderColor: designToken('egressCallout.checkboxChecked.borderColor'),
  },
  checkboxFlash: {
    borderColor: designToken('brokerSheet.egress.ackFlash.borderColor'),
    borderWidth: 3,
  },
  checkboxMark: {
    color: designToken('egressCallout.checkboxMark.color'),
    fontSize: 14,
    fontFamily: designToken('egressCallout.checkboxMark.fontFamily'),
  },
  ackText: {
    flex: 1,
    fontFamily: designToken('brokerSheet.egress.ackText.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.ackText.color'),
    lineHeight: 18,
  },
  ipInline: {
    fontFamily: designToken('brokerSheet.egress.ipInline.fontFamily'),
    fontSize: 12,
    color: designToken('brokerSheet.egress.ipInline.color'),
  },
});

export default EgressIpCallout;
