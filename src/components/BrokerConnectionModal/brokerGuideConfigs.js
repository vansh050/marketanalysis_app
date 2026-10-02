/**
 * brokerGuideConfigs — web-parity broker setup-guide content + card.
 *
 * Single source of truth for the per-broker "how to get your API key"
 * guidance that prod web renders through BrokerConnectStepper
 * (web: connectBroker.js Upstox/HDFC/ICICI block + the per-broker
 * *Connection.js stepper configs). Consumed by:
 *   - Phase3SdkBrokerModal (SDK lane) — <BrokerGuideCard> above the
 *     EgressIpCallout + BrokerCredentialForm
 *   - (legacy lane renders the same content via BrokerConnectStepperSheet)
 *
 * Keys are the NORMALIZED broker names from BrokerConnectModalDispatch's
 * normalizeBrokerKey ('Upstox', 'HDFC', 'ICICI', 'Kotak', 'Groww',
 * 'Fyers', 'Arihant Capital', 'DefinEdge Securities').
 *
 * Branding rule (mirrors web): the broker's brand colors paint ONLY the
 * monogram badge; action elements use the app/advisor accent passed in.
 *
 * === walkthroughVideoId (UPDATE 2, 2026-07-24) ===
 * Each broker entry can carry a `walkthroughVideoId: '<youtube-id>'` so the
 * connect sheet shows a "Watch walkthrough" button that plays an in-app
 * YouTube video (BrokerConnectStepperSheet reads this and opens the video
 * modal). Videos are much clearer than text steps for the API-key setup,
 * so every broker should have one.
 *
 * To add / replace a video: extract the 11-char YouTube ID from the URL
 * (e.g. https://youtu.be/qYgpZTYYdyk → 'qYgpZTYYdyk') and set
 * `walkthroughVideoId` on that broker's entry. Missing / empty values
 * simply hide the button on that broker — no crash.
 *
 * Tenants that need their OWN videos (rather than the AlphaQuark defaults
 * below) should patch this file in their fork; there is no per-tenant
 * override on the backend today. See the markup fork's SYNC.md for the
 * standard override pattern.
 *
 * Brokers WITHOUT a video today (placeholder slots — please supply):
 *   - Angel One            (`walkthroughVideoId: ''`)
 *   - IIFL Securities      (`walkthroughVideoId: ''`)
 *   - Motilal Oswal        (`walkthroughVideoId: ''`)
 * Every other broker below already has a working YouTube ID.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import { PlayCircle, ExternalLink } from 'lucide-react-native';

import { designColor } from '../../design/literalTokens';

/**
 * opts: { whiteLabelText, brokerConnectRedirectURL, iciciRedirectUrl, ccxtBaseUrl }
 * Returns null for brokers with no guide (caller falls back to its
 * existing help surface).
 */
export function getBrokerGuideConfig(brokerName, opts = {}) {
  const wl = opts.whiteLabelText || 'AlphaQuark';
  const ccxtBaseUrl = opts.ccxtBaseUrl
    ? `${String(opts.ccxtBaseUrl).replace(/\/+$/, '')}/`
    : '';
  // The modal dispatcher normalises UI triggers to short names (ICICI,
  // HDFC), while the SDK schema exposes the broker display names. Treat
  // both spellings identically so these brokers never fall through to the
  // older embedded-help surface.
  const normalizedBrokerName = {
    'ICICI Direct': 'ICICI',
    'Hdfc Securities': 'HDFC',
    'HDFC Securities': 'HDFC',
    Motilal: 'Motilal Oswal',
    IIFL: 'IIFL Securities',
    DefinEdge: 'DefinEdge Securities',
  }[brokerName] || brokerName;
  const MAP = {
    Upstox: {
      monogram: 'U',
      brandFrom: designColor('8b54ff'),
      brandTo: designColor('5b21d6'),
      portalUrl: 'https://account.upstox.com/developer/apps',
      portalLabel: 'Open Upstox developer portal',
      redirectUrl: opts.brokerConnectRedirectURL || '',
      walkthroughVideoId: 'qYgpZTYYdyk',
      guideSteps: [
        'Log in with your <b>mobile number</b> and OTP, then your <b>PIN</b>',
        'Go to <b>Apps → My Apps</b> and click <b>New App</b>',
        `Name the app <b>${wl}</b> (keep to 2 apps max)`,
        'Set the <b>Redirect URL</b> shown below',
        'Paste your <b>IP</b> into <b>Allowed IPs</b>, accept T&C, Continue',
        'Open the new app and copy the <b>API key</b> and <b>Secret key</b>',
      ],
    },
    HDFC: {
      monogram: 'H',
      brandFrom: designColor('e4002b'),
      brandTo: designColor('8e0019'),
      portalUrl: 'https://developer.hdfcsky.com/',
      portalLabel: 'Open HDFC developer portal',
      redirectUrl: opts.brokerConnectRedirectURL || '',
      walkthroughVideoId: 'gNp76J0i45A',
      guideSteps: [
        'Open <b>developer.hdfcsky.com</b>',
        'Log in with your <b>Client ID</b>, password and OTP',
        'Accept the <b>Risk Disclosure</b>',
        `Click <b>Create</b>, name it <b>${wl}</b>, set the Redirect URL below`,
        'Paste your <b>IP</b> into <b>Allowed IPs</b>, then Create',
        'Copy the <b>API key</b> and <b>Secret key</b>',
      ],
    },
    ICICI: {
      monogram: 'I',
      brandFrom: designColor('f37e20'),
      brandTo: designColor('a3231f'),
      portalUrl: 'https://api.icicidirect.com/apiuser/home',
      portalLabel: 'Open ICICI Breeze portal',
      redirectUrl: opts.iciciRedirectUrl || '',
      walkthroughVideoId: 'PFiVLkdIhk8',
      guideSteps: [
        'Log in to your <b>ICICI Direct</b> account with OTP',
        'Open the <b>Register an App</b> tab',
        `Name it <b>${wl}</b>, set the Redirect URL below`,
        'Paste your <b>IP</b> into the <b>IP Address</b> field, Submit',
        'Open the <b>View Apps</b> tab',
        'Copy the <b>API key</b> and <b>Secret key</b>',
      ],
    },
    Kotak: {
      monogram: 'K',
      brandFrom: designColor('e3001b'),
      brandTo: designColor('9c0014'),
      portalUrl: 'https://trade.kotakneo.com/Login',
      portalLabel: 'Open Kotak Neo',
      walkthroughVideoId: 'J15Z4dP19o8',
      guideSteps: [
        'Log in to <b>Kotak Neo</b> with mobile, password and OTP',
        'Open <b>More → Trade API</b>',
        'Copy your <b>API access token</b>',
        'Whitelist the <b>IP</b> below',
        'On that page, click <b>TOTP Registration</b> → verify mobile + OTP',
        'Find your <b>Client Code (UCC)</b> in your Kotak profile',
      ],
      note: 'Your app must be <b>Active</b> in Kotak NEO → TradeAPI → API Dashboard; old API keys are rejected.',
    },
    Groww: {
      monogram: 'G',
      brandFrom: designColor('00b386'),
      brandTo: designColor('0a7d63'),
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
    },
    Fyers: {
      monogram: 'F',
      brandFrom: designColor('3d5afe'),
      brandTo: designColor('1e40af'),
      portalUrl: 'https://fyers.in/web/api-dashboard/user-apps',
      portalLabel: 'Open Fyers API Dashboard',
      redirectUrl: opts.brokerConnectRedirectURL || '',
      walkthroughVideoId: 'TdadXSWAxeY',
      guideSteps: [
        'Log in with your <b>mobile number</b>, OTP/TOTP and <b>PIN</b>',
        'Open <b>fyers.in/web/api-dashboard/user-apps</b>',
        'On that list, click the app named <b>“Algo trading app”</b> (it sits at the top). <b>Do not</b> press <b>Create App</b> — that makes an ordinary app which can never place orders',
        'Set the <b>Redirect URL</b> below',
        'Paste the <b>static IP</b> below into <b>Static IP</b> — it must match exactly',
        'Tick the permissions, including <b>Order Placement</b>',
        'Click <b>Activate</b>',
        'Fyers now issues a <b>new App ID and Secret</b>. Copy the <b>App ID</b> — it ends in <b>-200</b> and is <b>not</b> your YR…/XL… login ID',
        'Copy the new <b>Secret ID</b>',
      ],
      note: 'Since April 2026 Fyers only accepts orders from the <b>activated “Algo trading app”</b> — its App ID ends in <b>-200</b>. Any older app still logs in and shows your holdings, then rejects every order with "algo orders are not allowed". Ticking Order Placement on an older app does <b>not</b> fix it: open the “Algo trading app” entry and Activate it, which issues a <b>new App ID and Secret ID</b>. A static IP that does not match the one shown here causes the same error.',
    },
    'IIFL Securities': {
      monogram: 'I',
      brandFrom: designColor('e11d2e'),
      brandTo: designColor('991b1b'),
      portalUrl: 'https://developers.iiflcapital.com/',
      portalLabel: 'Open IIFL Capital developer portal',
      redirectUrl: opts.brokerConnectRedirectURL || '',
      guideSteps: [
        'Apply for the free <b>Individual Trader API</b>',
        `Create an app for <b>${wl}</b> after IIFL approves access`,
        'Set the <b>Redirect URL</b> shown below',
        'Add the assigned <b>IPv6</b> shown below under <b>Whitelisted IPs</b>',
        "Copy the app's <b>App Key</b> and <b>App Secret</b>",
      ],
      note: 'IIFL requires a fresh browser login each trading day. Your App Secret stays encrypted on AlphaQuark servers.',
    },
    'Arihant Capital': {
      monogram: 'A',
      brandFrom: designColor('ff7a00'),
      brandTo: designColor('cc5500'),
      portalUrl: 'https://tradebridge.arihantplus.com',
      portalLabel: 'Open Arihant TradeBridge',
      walkthroughVideoId: 'kE3nviz2T9k',
      guideSteps: [
        'Log in at <b>tradebridge.arihantplus.com</b>',
        'Open <b>API Keys → New App</b>',
        'Whitelist the <b>IP</b> below',
        'Set the app name and redirect',
        'Copy your <b>App ID / API Key</b>',
        'Paste credentials here, then verify OTP',
      ],
    },
    'Motilal Oswal': {
      monogram: 'M',
      brandFrom: designColor('f7a600'),
      brandTo: designColor('b87400'),
      portalUrl: 'https://invest.motilaloswal.com/',
      portalLabel: 'Open Motilal Oswal',
      redirectUrl: ccxtBaseUrl
        ? `${ccxtBaseUrl}motilal-oswal/callback`
        : '',
      walkthroughVideoId: '', // TODO(UPDATE 2, 2026-07-24): supply Motilal Oswal walkthrough
      guideSteps: [
        'Log in at <b>invest.motilaloswal.com</b> — Customer Login → <b>Older Version</b>',
        'Tap the <b>Profile icon</b> to find your <b>Client Code</b>',
        'Open the hamburger menu (☰) → <b>Trading API</b>',
        'Click <b>Create API Key</b>',
        'Set the <b>Redirect URL</b> shown below',
        'Whitelist the <b>IP</b> below, then copy your <b>API Key</b>',
      ],
    },
    'Angel One': {
      monogram: 'A',
      brandFrom: designColor('e31e24'),
      brandTo: designColor('8e1015'),
      portalUrl: 'https://smartapi.angelone.in/',
      portalLabel: 'Open SmartAPI portal',
      // SmartAPI redirects through the ccxt callback, not the tenant's
      // stock-recommendation URL used by brokers such as Fyers/Upstox.
      redirectUrl: ccxtBaseUrl
        ? `${ccxtBaseUrl}angelone/callback`
        : '',
      walkthroughVideoId: '', // TODO(UPDATE 2, 2026-07-24): supply SmartAPI walkthrough
      guideSteps: [
        'Sign up / log in at <b>smartapi.angelone.in</b>',
        'Open <b>My Apps</b> → <b>Create New App</b> (type: <b>Trading APIs</b>)',
        `Name it <b>${wl}</b>`,
        'Set the <b>Redirect URL</b> and <b>Postback URL</b> shown below',
        'Paste your <b>IP</b> into <b>Whitelisted IPs</b>',
        'Copy your <b>API Key</b>',
      ],
      note: 'Enter your SmartAPI API Key and Angel One Client Code below. SmartAPI does not issue or require an API Secret for this connection.',
    },
    'DefinEdge Securities': {
      monogram: 'D',
      brandFrom: designColor('1565c0'),
      brandTo: designColor('0d3f8a'),
      portalUrl: 'https://myaccount.definedgesecurities.com',
      portalLabel: 'Open Definedge MyAccount',
      walkthroughVideoId: 'A6ytHApBTo4',
      guideSteps: [
        'Log in at <b>signin.definedgesecurities.com</b>',
        'Open <b>MyAccount → API Config</b>',
        'Whitelist the <b>IP</b> below',
        'Copy your <b>API Token</b> and <b>API Secret</b>',
        'Paste them here',
        'Verify with the OTP',
      ],
      note: "DefinEdge sessions last ~8 hours; you'll re-verify with OTP after that.",
    },
  };
  return MAP[normalizedBrokerName] || null;
}

// Bold-segment renderer for the shared "<b>…</b>" guide copy.
const RichText = ({ text, style, boldStyle }) => {
  const parts = String(text || '').split(/<b>|<\/b>/);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={boldStyle}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
};

/**
 * <BrokerGuideCard config={...} accent="#0056B7" brokerName="Upstox" />
 * The polished setup-guide card: monogram + title row, numbered steps,
 * copyable redirect URL, portal + walkthrough actions.
 */
export const BrokerGuideCard = ({
  config,
  accent = designColor('0056b7'),
  brokerName,
  onWatchWalkthrough,
}) => {
  if (!config) return null;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <LinearGradient
          colors={[config.brandFrom, config.brandTo || config.brandFrom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.monogram}
        >
          <Text style={styles.monogramText}>
            {config.monogram || String(brokerName || '?').charAt(0)}
          </Text>
        </LinearGradient>
        <Text style={styles.title}>How to get your API key</Text>
      </View>
      <View style={[styles.oneTimeNotice, {borderColor: accent}]}> 
        <Text style={[styles.oneTimeNoticeTitle, {color: accent}]}>ONE-TIME BROKER SETUP</Text>
        <Text style={styles.oneTimeNoticeText}>
          You normally create these API credentials only once. Later reconnects
          usually just need your broker User ID, password and any required OTP.
        </Text>
      </View>
      {(config.guideSteps || []).map((s, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={[styles.stepNum, { borderColor: accent }]}>
            <Text style={[styles.stepNumText, { color: accent }]}>{i + 1}</Text>
          </View>
          <RichText text={s} style={styles.stepText} boldStyle={styles.stepBold} />
        </View>
      ))}
      {!!config.redirectUrl && (
        <TouchableOpacity
          style={styles.redirectRow}
          onPress={() => Clipboard.setString(config.redirectUrl)}
        >
          <Text style={styles.redirectLabel}>Redirect URL (tap to copy)</Text>
          <Text style={[styles.redirectValue, { color: accent }]} numberOfLines={1}>
            {config.redirectUrl}
          </Text>
        </TouchableOpacity>
      )}
      {!!config.note && (
        <RichText text={config.note} style={styles.note} boldStyle={styles.stepBold} />
      )}
      <View style={styles.actionsRow}>
        {!!config.portalUrl && (
          <TouchableOpacity
            style={[styles.portalBtn, { backgroundColor: accent }]}
            onPress={() => Linking.openURL(config.portalUrl)}
          >
            <ExternalLink size={14} color={designColor('fff')} />
            <Text style={styles.portalBtnText}>
              {config.portalLabel || 'Open broker portal'}
            </Text>
          </TouchableOpacity>
        )}
        {!!config.walkthroughVideoId && (
          <TouchableOpacity
            style={styles.videoBtn}
            onPress={() => onWatchWalkthrough?.(config.walkthroughVideoId)}
            accessibilityRole="button"
            accessibilityLabel={`Watch ${brokerName || 'broker'} walkthrough in app`}
          >
            <PlayCircle size={15} color={accent} />
            <Text style={[styles.videoBtnText, { color: accent }]}>
              Watch walkthrough
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    backgroundColor: designColor('fafafa'),
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  monogram: {
    height: 34,
    width: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  monogramText: { color: designColor('fff'), fontWeight: '800', fontSize: 15 },
  title: { fontSize: 13, fontWeight: '800', color: designColor('111827'), flex: 1 },
  oneTimeNotice: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: designColor('eff6ff'),
  },
  oneTimeNoticeTitle: {fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  oneTimeNoticeText: {marginTop: 3, fontSize: 12, lineHeight: 17, color: designColor('334155')},
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stepNum: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: designColor('374151') },
  stepBold: { fontWeight: '700', color: designColor('111827') },
  redirectRow: {
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: designColor('ffffff'),
  },
  redirectLabel: { fontSize: 11, fontWeight: '700', color: designColor('6b7280') },
  redirectValue: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  note: { fontSize: 12, color: designColor('6b7280'), marginTop: 4, marginBottom: 2, lineHeight: 17 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  portalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 12,
  },
  portalBtnText: { color: designColor('fff'), fontWeight: '700', fontSize: 12, marginLeft: 6 },
  videoBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  videoBtnText: { fontWeight: '700', fontSize: 12, marginLeft: 5 },
});

export default BrokerGuideCard;
