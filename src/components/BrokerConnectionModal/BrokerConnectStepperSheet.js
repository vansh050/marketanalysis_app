/**
 * BrokerConnectStepperSheet — RN port of web's
 * src/components/BrokerConnectStepper/BrokerConnectStepper.jsx.
 *
 * The shared "pleasing" connect surface for credential+OTP brokers:
 *   - gradient monogram header + broker title
 *   - Credentials → OTP step chips
 *   - numbered setup guide card with a portal deep-link (+ optional
 *     walkthrough video link)
 *   - <EgressIpCallout> for per-customer IP-whitelist brokers (the
 *     IPv4 dedicated-IP / static-IP flow — same component Angel One
 *     per-customer uses); its acknowledgment gates the submit button
 *     exactly like web (`egressReady` / `unmetAck` flash)
 *   - credential fields with Show/Hide, OTP phase with resend
 *
 * Rendered through CrossPlatformOverlay — NEVER React Native's <Modal>,
 * which hard-freezes this app on Android (New Architecture): the window
 * paints as a tiny white box top-left and the UI thread wedges. See
 * ArihantConnectModal for the incident note.
 *
 * Contract (mirrors web BrokerConnectStepper):
 *   broker            display name ("Arihant Capital")
 *   config            { monogram, brandFrom, brandTo, portalUrl,
 *                       portalLabel, walkthroughVideoId?, guideSteps[],
 *                       note? }
 *   egressBrokerKey   lowercase backend broker_key ('arihant') or null
 *   customerId / customerEmail  passed through to EgressIpCallout
 *   fields            [{ label, value, onChange, password?, placeholder? }]
 *   phase             'creds' | 'otp'
 *   otp               { value, onChange, sentToText, onResend?,
 *                       resendDisabled?, resendLabel?, expiryHint? }
 *   error             string ('' hides the box)
 *   canSubmit         boolean (field-level validity; egress ack is
 *                     layered on top internally)
 *   submitLabel / onSubmit / loading
 *   onBackStep        otp → creds
 *   isVisible / onClose
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft, PlayCircle, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import CrossPlatformOverlay from '../CrossPlatformOverlay';
import EgressIpCallout from './EgressIpCallout';
import BrokerWalkthroughPlayer from './BrokerWalkthroughPlayer';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';

// Render "Log in at <b>portal.com</b>" strings from the shared web
// guide-step copy — bold segments only, no other markup supported.
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

const BrokerConnectStepperSheet = ({
  isVisible,
  onClose,
  broker,
  config = {},
  egressBrokerKey = null,
  customerId,
  customerEmail,
  fields = [],
  phase = 'creds',
  otp = null,
  error = '',
  canSubmit = false,
  submitLabel = 'Connect',
  onSubmit,
  onBackStep,
  loading = false,
  // Optional EXTERNAL egress gate (mirrors web BrokerConnectStepper's
  // egressReady/setEgressReady/unmetAck/setUnmetAck props) — containers
  // whose submit handlers already guard on their own egressReady (Kotak,
  // Groww, Fyers) pass state through; otherwise the sheet self-manages.
  egressReady: egressReadyProp,
  setEgressReady: setEgressReadyProp,
  unmetAck: unmetAckProp,
  setUnmetAck: setUnmetAckProp,
}) => {
  const { configData } = useTrade();
  const appConfig = useConfig();
  const insets = useSafeAreaInsets();
  const [secureShown, setSecureShown] = useState({});
  const [walkthroughVideoId, setWalkthroughVideoId] = useState(null);
  useEffect(() => {
    if (!isVisible) {
      setWalkthroughVideoId(null);
    }
  }, [isVisible]);
  // Egress-whitelist gate — driven entirely by EgressIpCallout
  // (partner brokers auto-ready; whitelist brokers require the ack).
  // External state wins when the parent owns the gate.
  const [egressReadyInt, setEgressReadyInt] = useState(!egressBrokerKey);
  const [unmetAckInt, setUnmetAckInt] = useState(false);
  const egressReady =
    egressReadyProp !== undefined ? egressReadyProp : egressReadyInt;
  const setEgressReady = setEgressReadyProp || setEgressReadyInt;
  const unmetAck = unmetAckProp !== undefined ? unmetAckProp : unmetAckInt;
  const setUnmetAck = setUnmetAckProp || setUnmetAckInt;

  if (!isVisible) return null;

  // Branding split (mirrors web BrokerConnectStepper): the broker's own
  // brand colors paint ONLY the monogram badge; every action element
  // (step chips, guide numbers, portal CTA, links, submit) uses the
  // ADVISOR/app white-label theme so the surface preserves app branding
  // on every tenant.
  const brandFrom = config.brandFrom || '#1e9f40';
  const brandTo = config.brandTo || brandFrom;
  const accent =
    appConfig?.mainColor ||
    appConfig?.gradient2 ||
    appConfig?.buttonColor ||
    '#0056B7';
  const isOtp = phase === 'otp';
  const guideSteps = config.guideSteps || [];

  const handleSubmit = () => {
    if (loading) return;
    if (!isOtp && egressBrokerKey && !egressReady) {
      // Flash the ack checkbox inside the callout instead of a dead tap.
      setUnmetAck(true);
      return;
    }
    onSubmit && onSubmit();
  };

  const submitEnabled = canSubmit && !loading;

  return (
    <CrossPlatformOverlay
      visible={!!isVisible}
      onClose={loading ? () => {} : onClose}
    >
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={loading ? undefined : onClose}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color="#6b7280" />
          </TouchableOpacity>
          <LinearGradient
            colors={[brandFrom, brandTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.monogram}
          >
            <Text style={styles.monogramText}>
              {config.monogram || String(broker || '?').charAt(0)}
            </Text>
          </LinearGradient>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Connect {broker}
            </Text>
            <Text style={styles.headerSub}>Secure broker connection</Text>
          </View>
        </View>

        {/* ── Step chips ─────────────────────────────────────── */}
        <View style={styles.stepChipsRow}>
          <View style={[styles.stepChip, !isOtp && { backgroundColor: accent }]}>
            <Text style={[styles.stepChipText, !isOtp && styles.stepChipTextActive]}>
              1 · Credentials
            </Text>
          </View>
          <View style={styles.stepDivider} />
          <View style={[styles.stepChip, isOtp && { backgroundColor: accent }]}>
            <Text style={[styles.stepChipText, isOtp && styles.stepChipTextActive]}>
              2 · OTP
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Setup guide card (creds phase only) ──────────── */}
          {!isOtp && (config.portalUrl || guideSteps.length > 0) && (
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>How to get your API key</Text>
              <View style={[styles.oneTimeNotice, {borderColor: accent}]}> 
                <Text style={[styles.oneTimeNoticeTitle, {color: accent}]}>ONE-TIME BROKER SETUP</Text>
                <Text style={styles.oneTimeNoticeText}>
                  You normally create these API credentials only once. Later
                  reconnects usually just need your broker User ID, password and
                  any required OTP.
                </Text>
              </View>
              {guideSteps.map((s, i) => (
                <View key={i} style={styles.guideStepRow}>
                  <View style={[styles.guideStepNum, { borderColor: accent }]}>
                    <Text style={[styles.guideStepNumText, { color: accent }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <RichText
                    text={s}
                    style={styles.guideStepText}
                    boldStyle={styles.guideStepBold}
                  />
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
                <RichText
                  text={config.note}
                  style={styles.guideNote}
                  boldStyle={styles.guideStepBold}
                />
              )}
              <View style={styles.guideActionsRow}>
                {!!config.portalUrl && (
                  <TouchableOpacity
                    style={[styles.portalBtn, { backgroundColor: accent }]}
                    onPress={() => Linking.openURL(config.portalUrl)}
                  >
                    <ExternalLink size={14} color="#fff" />
                    <Text style={styles.portalBtnText}>
                      {config.portalLabel || 'Open broker portal'}
                    </Text>
                  </TouchableOpacity>
                )}
                {!!config.walkthroughVideoId && (
                  <TouchableOpacity
                    style={styles.videoBtn}
                    onPress={() => setWalkthroughVideoId(config.walkthroughVideoId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Watch ${broker} walkthrough in app`}
                  >
                    <PlayCircle size={15} color={accent} />
                    <Text style={[styles.videoBtnText, { color: accent }]}>
                      Watch walkthrough
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Static-IP / whitelist callout (IPv4 brokers) ─── */}
          {!isOtp && !!egressBrokerKey && (
            <EgressIpCallout
              broker={egressBrokerKey}
              customerId={customerId}
              customerEmail={customerEmail || ''}
              configData={configData}
              showSetupGuide={false}
              onAcknowledgeChange={(ready) => setEgressReady(!!ready)}
              showUnmetAck={unmetAck}
              onUnmetAckHandled={() => setUnmetAck(false)}
            />
          )}

          {/* ── Credential fields / OTP ──────────────────────── */}
          {!isOtp ? (
            fields.map((f, i) => (
              <View key={i}>
                <Text style={styles.label}>{f.label} *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={f.value}
                    onChangeText={f.onChange}
                    placeholder={f.placeholder || `Enter your ${f.label}`}
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!!f.password && !secureShown[i]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    multiline={!!f.multiline}
                    keyboardType={f.keyboardType}
                    maxLength={f.maxLength}
                    onBlur={f.onBlur}
                  />
                  {!!f.password && (
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() =>
                        setSecureShown((p) => ({ ...p, [i]: !p[i] }))
                      }
                    >
                      <Text style={[styles.eyeBtnText, { color: accent }]}>
                        {secureShown[i] ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!f.error && <Text style={styles.fieldError}>{f.error}</Text>}
              </View>
            ))
          ) : (
            <View>
              <Text style={styles.otpHint}>
                {otp?.sentToText ||
                  'Enter the OTP sent to your registered mobile/email.'}
              </Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp?.value || ''}
                onChangeText={otp?.onChange}
                placeholder="Enter OTP"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={8}
                editable={!loading}
                autoFocus
              />
              {!!otp?.onResend && (
                <TouchableOpacity
                  onPress={otp.onResend}
                  disabled={!!otp.resendDisabled || loading}
                  style={styles.resendBtn}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: accent },
                      (otp.resendDisabled || loading) && styles.resendDisabled,
                    ]}
                  >
                    {otp.resendLabel || 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              )}
              {!!otp?.expiryHint && (
                <Text style={styles.expiryHint}>{otp.expiryHint}</Text>
              )}
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          {isOtp && !!onBackStep && (
            <TouchableOpacity
              style={styles.footerBackBtn}
              onPress={onBackStep}
              disabled={loading}
            >
              <Text style={styles.footerBackText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: accent },
              !submitEnabled && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!submitEnabled}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
        <BrokerWalkthroughPlayer
          videoId={walkthroughVideoId}
          title={`${broker} walkthrough`}
          accent={accent}
          onClose={() => setWalkthroughVideoId(null)}
        />
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#ffffff' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    height: 36,
    width: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  monogram: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  monogramText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  stepChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepChip: {
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepChipText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  stepChipTextActive: { color: '#ffffff' },
  stepDivider: {
    flex: 1,
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginHorizontal: 10,
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  guideCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  oneTimeNotice: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#eff6ff',
  },
  oneTimeNoticeTitle: {fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  oneTimeNoticeText: {marginTop: 3, fontSize: 12, lineHeight: 17, color: '#334155'},
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  guideStepNum: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  guideStepNumText: { fontSize: 11, fontWeight: '800' },
  guideStepText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#374151' },
  guideStepBold: { fontWeight: '700', color: '#111827' },
  guideNote: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 2 },
  redirectRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#ffffff',
  },
  redirectLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  redirectValue: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  fieldError: { fontSize: 11, color: '#b91c1c', marginTop: 4 },
  guideActionsRow: {
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
  portalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  videoBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  videoBtnText: { fontWeight: '700', fontSize: 12, marginLeft: 5 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  eyeBtnText: { fontWeight: '700', fontSize: 12 },
  otpHint: { fontSize: 13, color: '#6b7280', marginTop: 8, marginBottom: 12 },
  otpInput: { textAlign: 'center', letterSpacing: 6, fontSize: 18 },
  resendBtn: { alignSelf: 'flex-end', marginTop: 10 },
  resendText: { fontSize: 12, fontWeight: '700' },
  resendDisabled: { color: '#9ca3af' },
  expiryHint: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  errorBox: {
    marginTop: 14,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorText: { color: '#991b1b', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  footerBackBtn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 10,
    justifyContent: 'center',
  },
  footerBackText: { color: '#374151', fontWeight: '700' },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});

export default BrokerConnectStepperSheet;
