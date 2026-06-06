/**
 * BuyWebinarTicketSheet — collects buyer details + drives the CashFree
 * SDK (or short-circuits the FREE flow). Mirrors web's
 * src/components/BuyWebinarTicketModal.jsx but uses the React Native CF
 * SDK (already installed, same pattern as MPInvestNowModal §OneTime).
 *
 * onPurchased({ paymentStatus, courseId, buyerEmail, orderId? }) is
 * called on success — caller is responsible for flipping the detail
 * screen into the post-purchase state.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.4.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Config from 'react-native-config';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import {
  CFDropCheckoutPayment,
  CFEnvironment,
  CFPaymentComponentBuilder,
  CFPaymentModes,
  CFSession,
  CFThemeBuilder,
} from 'cashfree-pg-api-contract';
import liveKitService from '../FunctionCall/services/LiveKitService';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function BuyWebinarTicketSheet({ visible, onClose, lesson, onPurchased }) {
  const [phase, setPhase] = useState('form'); // form | paying | done
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setPhase('form');
      setErrorMsg('');
      handledRef.current = false;
    }
  }, [visible]);

  // Cancel any in-flight poll if the sheet closes mid-payment; also tear
  // down CF SDK callbacks so subsequent purchases get a clean slate.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      try {
        CFPaymentGatewayService.removeCallback();
        CFPaymentGatewayService.removeEventSubscriber();
      } catch {}
    };
  }, []);

  if (!visible || !lesson) return null;

  const isFree = Number(lesson.ticketPrice || 0) <= 0;

  async function pollUntilTerminal(orderId) {
    abortRef.current?.abort();
    abortRef.current = typeof AbortController !== 'undefined' ? new AbortController() : null;
    return liveKitService.pollWebinarPurchaseUntilTerminal(orderId, {
      signal: abortRef.current?.signal,
    });
  }

  function teardownSdk() {
    try {
      CFPaymentGatewayService.removeCallback();
      CFPaymentGatewayService.removeEventSubscriber();
    } catch {}
  }

  async function handleSubmit() {
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) { setErrorMsg('Please enter a valid email'); return; }
    if (!name.trim()) { setErrorMsg('Please enter your name'); return; }
    if (!isFree && !mobile.trim()) { setErrorMsg('Mobile required for payment'); return; }

    setPhase('paying');
    try {
      const purchase = await liveKitService.purchaseWebinarTicket(lesson.lessonId, {
        userEmail: cleanEmail,
        userName: name.trim(),
        mobile: mobile.trim(),
        // Mobile has no canonical return URL; backend tolerates an empty string.
        returnUrl: '',
      });

      // Free path — server already wrote the enrollment + fired email
      if (purchase.paymentStatus === 'free') {
        setPhase('done');
        onPurchased && onPurchased({ ...purchase, buyerEmail: cleanEmail });
        return;
      }

      // Paid path — drive CF SDK
      if (purchase.paymentStatus !== 'pending' || !purchase.cashfree?.payment_session_id) {
        throw new Error('Unexpected purchase response');
      }

      const paymentSessionId = purchase.cashfree.payment_session_id;
      const orderId = purchase.cashfree.order_id || purchase.orderId;
      const cfEnvironment = Config.REACT_APP_ENV === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

      // Single-shot guards — onVerify and onError can both fire on the same
      // order in some SDK paths; first writer wins, the rest no-op.
      handledRef.current = false;

      CFPaymentGatewayService.setCallback({
        onVerify: async (oid) => {
          if (handledRef.current) return;
          handledRef.current = true;
          teardownSdk();
          // Server-side webhook idempotently writes the enrollment + email;
          // we still poll once to confirm the row is materialised before
          // flipping the UI.
          const final = await pollUntilTerminal(oid);
          if (final.paymentStatus === 'paid') {
            setPhase('done');
            onPurchased && onPurchased({ ...final, buyerEmail: cleanEmail });
          } else {
            setErrorMsg(`Payment ${final.paymentStatus}`);
            setPhase('form');
          }
        },
        onError: async (error, oid) => {
          if (handledRef.current) return;
          handledRef.current = true;
          teardownSdk();
          const code = String(error?.code || '').toLowerCase();
          const msg = String(error?.message || '').toLowerCase();
          const isCancel =
            code === 'cancelled' || code === 'user_cancelled' || code === 'user_dropped'
            || code === 'transaction_cancelled' || msg.includes('cancel');
          if (isCancel) {
            // Don't make the user wait 30s for the webhook race after they
            // explicitly tapped Cancel.
            setErrorMsg(error?.message || 'Payment cancelled');
            setPhase('form');
            return;
          }
          // Likely a webhook race — give the server a window to write.
          const final = await liveKitService.pollWebinarPurchaseUntilTerminal(oid, {
            timeoutMs: 30000, intervalMs: 2000,
          });
          if (final.paymentStatus === 'paid') {
            setPhase('done');
            onPurchased && onPurchased({ ...final, buyerEmail: cleanEmail });
          } else {
            setErrorMsg(error?.message || 'Payment failed');
            setPhase('form');
          }
        },
      });

      CFPaymentGatewayService.setEventSubscriber({ onReceivedEvent: () => {} });

      const session = new CFSession(paymentSessionId, orderId, cfEnvironment);
      const paymentModes = new CFPaymentComponentBuilder()
        .add(CFPaymentModes.CARD)
        .add(CFPaymentModes.UPI)
        .add(CFPaymentModes.NB)
        .add(CFPaymentModes.WALLET)
        .add(CFPaymentModes.PAY_LATER)
        .build();
      const theme = new CFThemeBuilder()
        .setNavigationBarBackgroundColor('#d97706')
        .setNavigationBarTextColor('#FFFFFF')
        .setButtonBackgroundColor('#d97706')
        .setButtonTextColor('#FFFFFF')
        .setPrimaryTextColor('#111827')
        .setSecondaryTextColor('#6b7280')
        .build();
      const dropPayment = new CFDropCheckoutPayment(session, paymentModes, theme);
      CFPaymentGatewayService.doPayment(dropPayment);
    } catch (e) {
      teardownSdk();
      setErrorMsg(e?.response?.data?.message || e?.message || 'Purchase failed');
      setPhase('form');
    }
  }

  const ctaLabel = isFree ? 'Register' : `Pay ₹${lesson.ticketPrice}`;
  const titleLabel = isFree ? 'Register for free' : `Buy ticket — ₹${lesson.ticketPrice}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={phase === 'paying' ? undefined : onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{titleLabel}</Text>
            {phase !== 'paying' && (
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={styles.closeX}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          {!!lesson.scheduledStartTime && (
            <Text style={styles.lessonMeta}>
              {new Date(lesson.scheduledStartTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </Text>
          )}

          {phase === 'done' ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneText}>
                You're registered. We've emailed your confirmation. You'll get reminders before the class.
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.doneClose}>
                <Text style={styles.doneCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                editable={phase !== 'paying'}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@example.com"
                style={styles.input}
              />
              <Text style={styles.label}>Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={phase !== 'paying'}
                style={styles.input}
              />
              {!isFree && (
                <>
                  <Text style={styles.label}>Mobile *</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 12))}
                    editable={phase !== 'paying'}
                    keyboardType="phone-pad"
                    placeholder="10-digit mobile"
                    style={styles.input}
                  />
                </>
              )}

              {!!errorMsg && (
                <View style={styles.errorBox}><Text style={styles.errorText}>{errorMsg}</Text></View>
              )}

              {phase === 'paying' ? (
                <View style={styles.payingBox}>
                  <ActivityIndicator color="#d97706" />
                  <Text style={styles.payingText}>Waiting for confirmation… Don't close this window.</Text>
                </View>
              ) : (
                <View style={styles.ctaRow}>
                  <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSubmit} style={styles.payBtn}>
                    <Text style={styles.payBtnText}>{ctaLabel}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeX: { fontSize: 26, color: '#9ca3af', paddingHorizontal: 4 },
  lessonTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 12 },
  lessonMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  doneBox: { marginTop: 16, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 8, padding: 14 },
  doneText: { color: '#166534', fontSize: 13 },
  doneClose: { marginTop: 10, alignSelf: 'flex-start' },
  doneCloseText: { color: '#16a34a', fontWeight: '600' },
  form: { marginTop: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827' },
  errorBox: { marginTop: 10, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 6, padding: 10 },
  errorText: { color: '#991b1b', fontSize: 12 },
  payingBox: { alignItems: 'center', paddingVertical: 14 },
  payingText: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  ctaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, marginRight: 6 },
  cancelBtnText: { color: '#374151', fontWeight: '500' },
  payBtn: { backgroundColor: '#d97706', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  payBtnText: { color: '#ffffff', fontWeight: '600' },
});
