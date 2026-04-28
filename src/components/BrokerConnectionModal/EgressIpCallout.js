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
 * Clipboard: RN 0.78 no longer ships Clipboard in core and this
 * project doesn't install `@react-native-clipboard/clipboard`. The
 * IP address is rendered as a `<Text selectable>` so users can
 * long-press to copy natively on both iOS and Android without a new
 * native dependency.
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
} from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import LinkifiedUrl from '../../UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl';

// Brokers requiring per-customer IP whitelisting. Partners short-
// circuit to null without hitting /egress/me. Keep keys in sync with
// web's WHITELIST_BROKERS set (EgressIpCallout.js:72-81).
const WHITELIST_BROKERS = new Set([
  'upstox',
  'angelone',
  'fyers',
  'motilaloswal',
  'iifl',
  'kotak',
  'hdfcsec',
  'icicidirect',
  'groww',
]);

const BROKER_DISPLAY_NAMES = {
  upstox: 'Upstox',
  angelone: 'Angel One',
  fyers: 'Fyers',
  motilaloswal: 'Motilal Oswal',
  iifl: 'IIFL',
  kotak: 'Kotak Neo',
  hdfcsec: 'HDFC Securities',
  icicidirect: 'ICICI Direct',
  groww: 'Groww',
};

const BROKER_DEV_PORTAL_URLS = {
  upstox: 'https://account.upstox.com/developer/apps',
  angelone: 'https://smartapi.angelone.in/',
  fyers: 'https://fyers.in/web/api-dashboard/user-apps',
  motilaloswal: 'https://openapi.motilaloswal.com/',
  kotak: 'https://npapi.kotaksecurities.com/',
  icicidirect: 'https://api.icicidirect.com/apiuser/home',
  iifl: 'https://api.iiflsecurities.com/',
  hdfcsec: 'https://developer.hdfcsec.com/',
  groww: 'https://groww.in/trade-api/api-keys',
};

const BROKER_WHITELIST_HINT = {
  upstox: 'API Apps → (your app) → Allowed IPs',
  angelone: 'SmartAPI Apps → (your app) → Whitelisted IPs',
  fyers: 'API Dashboard → App Details → Allowed IPs',
  motilaloswal: 'App settings → Allowed IPs',
  kotak: 'Consumer Key settings → IP Whitelist',
  icicidirect: 'Breeze API app → IP Whitelist',
  iifl: 'XTS connect → App → Allowed IPs',
  hdfcsec: 'InvestRight API app → Allowed IPs',
  groww: 'Trade API → Generate TOTP token → Whitelisted IPs',
};

function buildHeaders(configData) {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
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
}) => {
  const brokerKey = (broker || '').toLowerCase().trim();
  const brokerDisplay = BROKER_DISPLAY_NAMES[brokerKey] || brokerKey;
  const brokerDevPortal = BROKER_DEV_PORTAL_URLS[brokerKey];
  const brokerHint = BROKER_WHITELIST_HINT[brokerKey];

  const [loading, setLoading] = useState(true);
  const [brokerState, setBrokerState] = useState(null);
  const [brokerEntry, setBrokerEntry] = useState(null);
  const [migrationBanner, setMigrationBanner] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [flashAck, setFlashAck] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

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
  useEffect(() => {
    if (!onAcknowledgeChange) return;
    if (brokerState === 'partner') {
      onAcknowledgeChange(true);
      return;
    }
    if (brokerState === 'claimed' && !claiming) {
      onAcknowledgeChange(acknowledged);
      return;
    }
    onAcknowledgeChange(false);
  }, [brokerState, acknowledged, claiming, onAcknowledgeChange]);

  // Parent flipped showUnmetAck — flash the ack checkbox.
  useEffect(() => {
    if (!showUnmetAck) return;
    if (brokerState !== 'claimed') return;
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
      const apiErr =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message;
      setErrorMsg(`Could not assign a dedicated IP: ${apiErr}`);
    } finally {
      setClaiming(false);
    }
  };

  // Partner broker — nothing to render.
  if (brokerState === 'partner') return null;

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
        <View style={[styles.card, styles.cardNeutral]}>
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#6B7280" />
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

  if (brokerState === 'ipv4_provisioning') {
    return (
      <View style={styles.container}>
        {MigrationBanner}
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
          <Text style={[styles.bodyAmber, {fontSize: 11, marginTop: 8}]}>
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
        <View style={[styles.card, styles.cardBlue]}>
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
            style={[styles.primaryButton, claiming && {opacity: 0.6}]}
            activeOpacity={0.8}>
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
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
    const flashBg = flashAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#FEF3C7', '#FEE2E2'],
    });
    return (
      <View style={styles.container}>
        {MigrationBanner}
        <View style={[styles.card, styles.cardAmber]}>
          <Text style={styles.titleAmber}>Dedicated static IP assigned</Text>
          <Text style={[styles.bodyAmber, {fontSize: 11}]}>
            {brokerEntry.family === 'ipv6'
              ? 'IPv6 — unique to your account'
              : 'IPv4 — unique to your account'}
          </Text>

          <Text style={[styles.stepHeader, {marginTop: 12}]}>
            Whitelist this IP in your {brokerDisplay} developer portal:
          </Text>
          <View style={styles.ipBox}>
            <Text style={styles.ipText} selectable>
              {brokerEntry.address}
            </Text>
            <Text style={styles.ipHint}>(long-press to copy)</Text>
          </View>

          <View style={{marginTop: 10}}>
            {brokerDevPortal && (
              <Text style={styles.stepText}>
                <Text style={styles.bold}>a.</Text> Open{' '}
                <LinkifiedUrl
                  url={brokerDevPortal}
                  display={brokerDevPortal.replace(/^https?:\/\//, '')}
                />
              </Text>
            )}
            {brokerHint && (
              <Text style={styles.stepText}>
                <Text style={styles.bold}>b.</Text> Navigate to{' '}
                <Text style={styles.italic}>{brokerHint}</Text>
              </Text>
            )}
            <Text style={styles.stepText}>
              <Text style={styles.bold}>{brokerHint ? 'c.' : 'b.'}</Text> Paste
              the IP into the whitelist field and save
            </Text>
          </View>

          <Animated.View
            style={[
              styles.ackRow,
              flashAck && {backgroundColor: flashBg, borderColor: '#EF4444'},
            ]}>
            <TouchableOpacity
              onPress={() => setAcknowledged(!acknowledged)}
              style={styles.checkboxRow}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.checkbox,
                  acknowledged && styles.checkboxChecked,
                  flashAck && !acknowledged && styles.checkboxFlash,
                ]}>
                {acknowledged && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.ackText}>
                {flashAck && !acknowledged && (
                  <Text style={[styles.bold, {color: '#B91C1C'}]}>
                    ⚠ Please tick this box to confirm you've whitelisted the
                    IP.{'\n'}
                  </Text>
                )}
                I have added{' '}
                <Text style={styles.ipInline}>{brokerEntry.address}</Text> to
                my {brokerDisplay} developer portal whitelist. I understand
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

  // Unknown state — minimal fallback so the user sees something and can retry.
  return (
    <View style={styles.container}>
      {MigrationBanner}
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  card: {
    borderRadius: 10,
    borderWidth: 2,
    padding: 14,
  },
  cardNeutral: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  cardAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  cardRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 13,
    color: '#374151',
  },
  titleBlue: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 15,
    color: '#1E3A8A',
    marginBottom: 6,
  },
  bodyBlue: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  titleAmber: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 15,
    color: '#78350F',
    marginBottom: 4,
  },
  bodyAmber: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  titleRed: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 4,
  },
  bodyRed: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#B91C1C',
  },
  bannerTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
    color: '#991B1B',
  },
  bannerBody: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  bannerSmall: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
  },
  stepHeader: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
    color: '#78350F',
  },
  ipBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  ipText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 14,
    color: '#111827',
  },
  ipHint: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  stepText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginTop: 2,
  },
  link: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  bold: {
    fontFamily: 'Satoshi-Bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  ackRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
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
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  checkboxFlash: {
    borderColor: '#EF4444',
    borderWidth: 3,
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
  },
  ackText: {
    flex: 1,
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  ipInline: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 12,
    color: '#111827',
  },
});

export default EgressIpCallout;
