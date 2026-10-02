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
 *   fields            [{ label, value, onChange, password?, placeholder?,
 *                        uncontrolled?, autoCapitalize? }] — `uncontrolled`
 *                       seeds the input once (defaultValue) and never writes
 *                       back; use it when onChange normalises the text
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
  Keyboard,
  Image,
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

import { designColor } from '../../design/literalTokens';
import { brokerDisplayConfig } from '../../config/brokerDisplayConfig';

// Real broker logo for the header; falls back to the monogram when the
// broker has no bundled asset (matched loosely: "ICICI Direct" ↔ "ICICI").
const compactBroker = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const brokerLogoFor = broker => {
  const key = compactBroker(broker);
  if (!key) return null;
  const hit = brokerDisplayConfig.find(b => {
    const k = compactBroker(b.key);
    const n = compactBroker(b.name);
    return k === key || n === key || (k && key.startsWith(k)) || (n && key.startsWith(n));
  });
  return hit?.logo || null;
};

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

const SetupGuideCard = React.memo(({config, accent, broker, onVideo}) => {
  const guideSteps = config.guideSteps || [];
  if (!config.portalUrl && guideSteps.length === 0) return null;

  return (
    <View style={styles.guideCard}>
      <Text style={styles.guideTitle}>
        {config.guideTitle || 'How to get your API key'}
      </Text>
      {!!config.walkthroughVideoId && (
        <TouchableOpacity
          style={[styles.videoCta, {borderColor: accent}]}
          onPress={() => onVideo(config.walkthroughVideoId)}
          accessibilityRole="button"
          accessibilityLabel={`Watch ${broker} walkthrough video`}>
          <View style={[styles.videoCtaIcon, {backgroundColor: accent}]}>
            <PlayCircle size={22} color={designColor('fff')} />
          </View>
          <View style={{flex: 1}}>
            <Text style={[styles.videoCtaTitle, {color: accent}]}>Watch the setup video</Text>
            <Text style={styles.videoCtaSubtitle}>
              Follow along with a short walkthrough instead of reading the steps.
            </Text>
          </View>
        </TouchableOpacity>
      )}
      <View style={[styles.oneTimeNotice, {borderColor: accent}]}>
        <Text style={[styles.oneTimeNoticeTitle, {color: accent}]}>ONE-TIME BROKER SETUP</Text>
        <Text style={styles.oneTimeNoticeText}>
          You normally create these API credentials only once. Later reconnects
          usually just need your broker User ID, password and any required OTP.
        </Text>
      </View>
      {guideSteps.map((step, index) => (
        <View key={index} style={styles.guideStepRow}>
          <View style={[styles.guideStepNum, {borderColor: accent}]}>
            <Text style={[styles.guideStepNumText, {color: accent}]}>{index + 1}</Text>
          </View>
          <RichText text={step} style={styles.guideStepText} boldStyle={styles.guideStepBold} />
        </View>
      ))}
      {!!config.redirectUrl && (
        <TouchableOpacity
          style={styles.redirectRow}
          onPress={() => Clipboard.setString(config.redirectUrl)}>
          <Text style={styles.redirectLabel}>Redirect URL (tap to copy)</Text>
          <Text style={[styles.redirectValue, {color: accent}]} numberOfLines={1}>
            {config.redirectUrl}
          </Text>
        </TouchableOpacity>
      )}
      {!!config.note && (
        <RichText text={config.note} style={styles.guideNote} boldStyle={styles.guideStepBold} />
      )}
      <View style={styles.guideActionsRow}>
        {!!config.portalUrl && (
          <TouchableOpacity
            style={[styles.portalBtn, {backgroundColor: accent}]}
            onPress={() => Linking.openURL(config.portalUrl)}>
            <ExternalLink size={14} color={designColor('fff')} />
            <Text style={styles.portalBtnText}>{config.portalLabel || 'Open broker portal'}</Text>
          </TouchableOpacity>
        )}
        {!!config.walkthroughVideoId && (
          <TouchableOpacity
            style={styles.videoBtn}
            onPress={() => onVideo(config.walkthroughVideoId)}
            accessibilityRole="button"
            accessibilityLabel={`Watch ${broker} walkthrough in app`}>
            <PlayCircle size={15} color={accent} />
            <Text style={[styles.videoBtnText, {color: accent}]}>Watch walkthrough</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const DeviceTotpControl = React.memo(({deviceTotp, accent, loading}) => {
  if (!deviceTotp?.enabled) return null;
  const setup = deviceTotp.setup || {};
  const showSetup =
    !!deviceTotp.saveOnDevice &&
    !deviceTotp.hasSaved &&
    (setup.steps?.length > 0 || setup.portalUrl);

  return (
    <View style={styles.deviceTotpCard}>
      <TouchableOpacity
        onPress={deviceTotp.onToggleSave}
        disabled={loading || deviceTotp.hasSaved}
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: !!deviceTotp.saveOnDevice || !!deviceTotp.hasSaved,
        }}>
        <Text style={[styles.deviceTotpTitle, {color: accent}]}>
          {deviceTotp.hasSaved || deviceTotp.saveOnDevice ? '✓ ' : '○ '}
          {deviceTotp.protectLabel || 'Protect this TOTP key on this phone'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.deviceTotpText}>
        {deviceTotp.hasSaved
          ? deviceTotp.savedLabel ||
            'Saved only in this device keychain. Biometric or device passcode is required before it can be used.'
          : deviceTotp.pendingLabel ||
            'The key is stored only in the protected device keychain and cannot migrate to another phone.'}
      </Text>
      {showSetup && (
        <View style={styles.deviceTotpSetup}>
          <Text style={styles.deviceTotpSetupTitle}>
            {setup.title || 'How to create your TOTP key'}
          </Text>
          {(setup.steps || []).map((step, index) => (
            <View key={index} style={styles.deviceTotpSetupStep}>
              <View style={[styles.deviceTotpSetupNum, {borderColor: accent}]}>
                <Text style={[styles.deviceTotpSetupNumText, {color: accent}]}>
                  {index + 1}
                </Text>
              </View>
              <RichText
                text={step}
                style={styles.deviceTotpSetupText}
                boldStyle={styles.guideStepBold}
              />
            </View>
          ))}
          {!!setup.note && (
            <RichText
              text={setup.note}
              style={styles.deviceTotpSetupNote}
              boldStyle={styles.guideStepBold}
            />
          )}
          {!!setup.portalUrl && (
            <TouchableOpacity
              style={[styles.deviceTotpSetupButton, {backgroundColor: accent}]}
              onPress={() => Linking.openURL(setup.portalUrl)}
              accessibilityRole="button">
              <ExternalLink size={14} color={designColor('fff')} />
              <Text style={styles.portalBtnText}>
                {setup.portalLabel || 'Open TOTP setup'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {!!deviceTotp.hasSaved && !!deviceTotp.onUnlock && (
        <TouchableOpacity onPress={deviceTotp.onUnlock} disabled={loading}>
          <Text style={[styles.deviceTotpAction, {color: accent}]}>
            {deviceTotp.unlockLabel || 'Unlock saved key'}
          </Text>
        </TouchableOpacity>
      )}
      {!!deviceTotp.hasSaved && !!deviceTotp.onForget && (
        <TouchableOpacity onPress={deviceTotp.onForget} disabled={loading}>
          <Text style={styles.deviceTotpForget}>
            {deviceTotp.forgetLabel || 'Forget key on this phone'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

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
  deviceTotp = null,
  alternateAction = null,
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
  const inputRefs = useRef({});
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

  // Branding split (mirrors web BrokerConnectStepper): the broker's own
  // brand colors paint ONLY the monogram badge; every action element
  // (step chips, guide numbers, portal CTA, links, submit) uses the
  // ADVISOR/app white-label theme so the surface preserves app branding
  // on every tenant.
  const brandFrom = config.brandFrom || designColor('1e9f40');
  const brandTo = config.brandTo || brandFrom;
  const brokerLogo = useMemo(() => brokerLogoFor(broker), [broker]);
  const accent =
    appConfig?.mainColor ||
    appConfig?.gradient2 ||
    appConfig?.buttonColor ||
    designColor('0056b7');
  const isOtp = phase === 'otp';

  const handleSubmit = () => {
    if (loading) return;
    if (!isOtp && egressBrokerKey && !egressReady) {
      // Flash the ack checkbox inside the callout instead of a dead tap.
      setUnmetAck(true);
      return;
    }
    Keyboard.dismiss();
    onSubmit && onSubmit();
  };

  const submitEnabled = canSubmit && !loading;
  const openWalkthrough = useCallback(id => setWalkthroughVideoId(id), []);
  const handleEgressAcknowledge = useCallback(
    ready => setEgressReady(!!ready),
    [setEgressReady],
  );
  const handleUnmetAckHandled = useCallback(
    () => setUnmetAck(false),
    [setUnmetAck],
  );

  // The setup guide and IP allocation card are comparatively expensive on a
  // low-end Android device. Keep their element identity stable while a
  // controlled TextInput changes so typing and moving to the next field do not
  // reconcile the entire instructional surface on every keypress.
  const egressCallout = useMemo(
    () =>
      !isOtp && egressBrokerKey ? (
        <EgressIpCallout
          broker={egressBrokerKey}
          customerId={customerId}
          customerEmail={customerEmail || ''}
          configData={configData}
          showSetupGuide={false}
          onAcknowledgeChange={handleEgressAcknowledge}
          showUnmetAck={unmetAck}
          onUnmetAckHandled={handleUnmetAckHandled}
        />
      ) : null,
    [
      configData,
      customerEmail,
      customerId,
      egressBrokerKey,
      handleEgressAcknowledge,
      handleUnmetAckHandled,
      isOtp,
      unmetAck,
    ],
  );

  if (!isVisible) return null;

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
            <ChevronLeft size={22} color={designColor('6b7280')} />
          </TouchableOpacity>
          {brokerLogo ? (
            <View style={styles.logoTile} testID="broker-connect-logo">
              <Image source={brokerLogo} style={styles.logoImage} resizeMode="contain" />
            </View>
          ) : (
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
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Connect {broker}
            </Text>
            <Text style={styles.headerSub}>Secure broker connection</Text>
          </View>
        </View>

        {/* ── Step chips ─────────────────────────────────────── */}
        {!config.hideStepChips && <View style={styles.stepChipsRow}>
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
        </View>}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Setup guide card (creds phase only) ──────────── */}
          {!isOtp && (
            <SetupGuideCard
              config={config}
              accent={accent}
              broker={broker}
              onVideo={openWalkthrough}
            />
          )}

          {/* ── Static-IP / whitelist callout (IPv4 brokers) ─── */}
          {egressCallout}

          {/* ── Credential fields / OTP ──────────────────────── */}
          {!isOtp ? (
            <>
            {!!deviceTotp?.placeBeforeFields && (
              <DeviceTotpControl
                deviceTotp={deviceTotp}
                accent={accent}
                loading={loading}
              />
            )}
            {fields.map((f, i) => {
              const fieldKey = String(f.key || f.label || i);
              const revealPassword = Boolean(secureShown[fieldKey]);
              return (
              // Key by label, not index: callers (DeviceTotpReconnectGate)
              // add/remove fields as server state resolves, and an index key
              // would hand one field's native text to a different field.
              <View key={fieldKey}>
                <Text style={styles.label}>{f.label} *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    ref={node => {
                      inputRefs.current[fieldKey] = node;
                    }}
                    style={[styles.input, { flex: 1 }]}
                    // `uncontrolled` fields own their native text. On a busy
                    // JS thread (large accounts), a controlled `value` that
                    // the parent rewrites (uppercase / digits-only) races the
                    // keyboard, dropping characters and breaking "next".
                    {...(f.uncontrolled
                      ? { defaultValue: f.value }
                      : { value: f.value })}
                    onChangeText={f.onChange}
                    placeholder={f.placeholder || `Enter your ${f.label}`}
                    placeholderTextColor={designColor('9ca3af')}
                    secureTextEntry={!!f.password && !revealPassword}
                    autoCapitalize={f.autoCapitalize || 'none'}
                    autoCorrect={false}
                    editable={!loading}
                    multiline={!!f.multiline}
                    keyboardType={f.keyboardType}
                    maxLength={f.maxLength}
                    onBlur={f.onBlur}
                    returnKeyType={i < fields.length - 1 ? 'next' : 'done'}
                    blurOnSubmit={i === fields.length - 1}
                    onSubmitEditing={() => {
                      if (i < fields.length - 1) {
                        const next = fields[i + 1];
                        const nextKey = String(next?.key || next?.label || i + 1);
                        inputRefs.current[nextKey]?.focus?.();
                      }
                    }}
                  />
                  {!!f.password && (
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => {
                        const nextShown = !revealPassword;
                        setSecureShown((p) => ({...p, [fieldKey]: nextShown}));
                        // Android occasionally keeps the previous native
                        // secureTextEntry value even after React updates the
                        // prop. Update the mounted input as well so Show/Hide
                        // always matches its label.
                        inputRefs.current[fieldKey]?.setNativeProps?.({
                          secureTextEntry: !nextShown,
                        });
                      }}
                    >
                      <Text style={[styles.eyeBtnText, { color: accent }]}>
                        {revealPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!f.error && <Text style={styles.fieldError}>{f.error}</Text>}
                {!f.error && !!f.hint && <Text style={styles.fieldHint}>{f.hint}</Text>}
              </View>
              );
            })}
            {!deviceTotp?.placeBeforeFields && (
              <DeviceTotpControl
                deviceTotp={deviceTotp}
                accent={accent}
                loading={loading}
              />
            )}
            </>
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
                placeholderTextColor={designColor('9ca3af')}
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
          {!!alternateAction?.onPress && (
            <TouchableOpacity
              onPress={alternateAction.onPress}
              disabled={loading}
              style={styles.alternateAction}>
              <Text style={[styles.alternateActionText, {color: accent}]}>
                {alternateAction.label}
              </Text>
            </TouchableOpacity>
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
              <ActivityIndicator color={designColor('ffffff')} />
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
  fullScreen: { flex: 1, backgroundColor: designColor('ffffff') },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: designColor('e5e7eb'),
  },
  backBtn: {
    height: 36,
    width: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
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
  logoTile: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: designColor('fff'),
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  logoImage: { height: 28, width: 28 },
  monogramText: { color: designColor('fff'), fontWeight: '800', fontSize: 18 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: designColor('111827') },
  headerSub: { fontSize: 12, color: designColor('9ca3af'), marginTop: 1 },
  stepChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepChip: {
    borderRadius: 999,
    backgroundColor: designColor('f3f4f6'),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepChipText: { fontSize: 12, fontWeight: '700', color: designColor('6b7280') },
  stepChipTextActive: { color: designColor('ffffff') },
  stepDivider: {
    flex: 1,
    height: 3,
    backgroundColor: designColor('e5e7eb'),
    borderRadius: 2,
    marginHorizontal: 10,
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  guideCard: {
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: designColor('fafafa'),
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: designColor('111827'),
    marginBottom: 10,
  },
  oneTimeNotice: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: designColor('eff6ff'),
  },
  oneTimeNoticeTitle: {fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  oneTimeNoticeText: {marginTop: 3, fontSize: 12, lineHeight: 17, color: designColor('334155')},
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
  guideStepText: { flex: 1, fontSize: 13, lineHeight: 19, color: designColor('374151') },
  guideStepBold: { fontWeight: '700', color: designColor('111827') },
  guideNote: { fontSize: 12, color: designColor('6b7280'), marginTop: 4, marginBottom: 2 },
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
  fieldError: { fontSize: 11, color: designColor('b91c1c'), marginTop: 4 },
  fieldHint: { fontSize: 11, color: designColor('6b7280'), marginTop: 4, lineHeight: 15 },
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
    color: designColor('fff'),
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  videoBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  videoBtnText: { fontWeight: '700', fontSize: 12, marginLeft: 5 },
  // UPDATE 2 (2026-07-24): styles for the prominent top-of-guide walkthrough
  // video CTA. Sits above the ONE-TIME notice so users see it before the
  // numbered steps.
  videoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: designColor('ffffff'),
  },
  videoCtaIcon: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  videoCtaTitle: { fontWeight: '800', fontSize: 13 },
  videoCtaSubtitle: { fontSize: 11, color: designColor('4b5563'), marginTop: 2, lineHeight: 15 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: designColor('374151'),
    marginBottom: 6,
    marginTop: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: designColor('111827'),
    backgroundColor: designColor('fafafa'),
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  eyeBtnText: { fontWeight: '700', fontSize: 12 },
  otpHint: { fontSize: 13, color: designColor('6b7280'), marginTop: 8, marginBottom: 12 },
  otpInput: { textAlign: 'center', letterSpacing: 6, fontSize: 18 },
  resendBtn: { alignSelf: 'flex-end', marginTop: 10 },
  resendText: { fontSize: 12, fontWeight: '700' },
  resendDisabled: { color: designColor('9ca3af') },
  expiryHint: { fontSize: 11, color: designColor('9ca3af'), marginTop: 6 },
  errorBox: {
    marginTop: 14,
    backgroundColor: designColor('fef2f2'),
    borderColor: designColor('fecaca'),
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorText: { color: designColor('991b1b'), fontSize: 12 },
  alternateAction: {alignSelf: 'center', padding: 12, marginTop: 8},
  alternateActionText: {fontSize: 13, fontWeight: '800'},
  deviceTotpCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('dbeafe'),
    backgroundColor: designColor('eff6ff'),
  },
  deviceTotpTitle: {fontSize: 13, fontWeight: '800'},
  deviceTotpText: {fontSize: 11, lineHeight: 16, color: designColor('475569'), marginTop: 5},
  deviceTotpSetup: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: designColor('bfdbfe'),
  },
  deviceTotpSetupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: designColor('1e293b'),
    marginBottom: 8,
  },
  deviceTotpSetupStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  deviceTotpSetupNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  deviceTotpSetupNumText: {fontSize: 10, fontWeight: '800'},
  deviceTotpSetupText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: designColor('334155'),
  },
  deviceTotpSetupNote: {
    fontSize: 10,
    lineHeight: 15,
    color: designColor('92400e'),
    backgroundColor: designColor('fffbeb'),
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  deviceTotpSetupButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 9,
  },
  deviceTotpAction: {fontSize: 12, fontWeight: '800', marginTop: 9},
  deviceTotpForget: {fontSize: 11, fontWeight: '700', color: designColor('b91c1c'), marginTop: 8},
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: designColor('e5e7eb'),
  },
  footerBackBtn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
    marginRight: 10,
    justifyContent: 'center',
  },
  footerBackText: { color: designColor('374151'), fontWeight: '700' },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: designColor('ffffff'), fontWeight: '800', fontSize: 15 },
});

export default BrokerConnectStepperSheet;
