/**
 * CoursePurchaseSheet — buyer collects details + applies coupon + pays.
 *
 * Mirrors web's `courseDetailsPage.handleUnlockPayment` flow + adds the
 * coupon input UI that exists as dead code in web's CoursePaymentModal.
 *
 * Flow:
 *  1. Buyer enters email, name, mobile, PAN, GSTIN, (optional) coupon code.
 *  2. Apply coupon → CouponService.checkCoupon — sets discount/finalAmount.
 *  3. Tap Pay:
 *     a. CashFreeOrderService.createCourseOrder (carries couponId) →
 *        payment_session_id + cashfree_order_id.
 *     b. CFDropCheckoutPayment via the existing
 *        react-native-cashfree-pg-sdk (same as BuyWebinarTicketSheet).
 *     c. On verify: getOrderStatus → if SUCCESS, confirmCoursePurchase
 *        (POST /client-course/purchase). The server verifies the order is
 *        PAID, belongs to the signed-in account and this course, and
 *        matches the server price, then enrolls. 402 = not verifiable yet:
 *        the cron enrolls within minutes, so we say so instead of failing.
 *     d. onPurchased(result) called.
 *  4. FREE path (course.price === 0 OR coupon brings amount to 0):
 *     claimFreeCourse (POST /client-course/claim-free). The server
 *     recomputes the price and refuses anything above ₹0.
 *
 *  The buyer is always the signed-in Firebase account (2026-10-12): the
 *  email field shows it read-only. Until then the sheet wrote the
 *  enrollment through the admin-only /client-course/add, which refused it —
 *  free enrollments never landed and paid ones waited for the cron.
 *
 * Server-side webhook + reconciliation cron is the safety net for any
 * FE failure between (b) and (d).
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.7.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ScrollView,
  Linking,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Config from '../config/env';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import {
  CFDropCheckoutPayment,
  CFPaymentComponentBuilder,
  CFPaymentModes,
  CFSession,
  CFThemeBuilder,
} from 'cashfree-pg-api-contract';
import couponService from '../FunctionCall/services/CouponService';
import cashfreeOrderService from '../FunctionCall/services/CashFreeOrderService';
import gumletService from '../FunctionCall/services/GumletService';
import studentPaymentService from '../FunctionCall/services/StudentPaymentService';
import {
  choosePhonePeGroup,
  openAndAwaitReturn,
  phonePeAppMetadata,
} from '../FunctionCall/services/AppPaymentGateway';
import { getAuth } from '@react-native-firebase/auth';
import {
  getCashfreeEnvironment,
  friendlyPaymentError,
} from '../utils/cashfreeEnv';

import { designColor, designToken } from '../design/literalTokens';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// Same format the server checks before tagging the CashFree order.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export default function CoursePurchaseSheet({ visible, onClose, course, onPurchased }) {
  const [phase, setPhase] = useState('form'); // form | paying | done
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  // Paid, but the server could not verify the order yet (402): access is
  // granted by the reconciliation cron within minutes.
  const [pendingAccess, setPendingAccess] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      // The purchase identity is the signed-in account, not a typed email.
      setEmail(String(getAuth().currentUser?.email || '').trim().toLowerCase());
      setPendingAccess(false);
      setPhase('form');
      setErrorMsg('');
      setCouponMsg('');
      handledRef.current = false;
    }
  }, [visible]);

  useEffect(() => () => {
    try {
      CFPaymentGatewayService.removeCallback();
      CFPaymentGatewayService.removeEventSubscriber();
    } catch {}
  }, []);

  const basePrice = Number(course?.price || 0);
  const discount = appliedCoupon ? Number(appliedCoupon.discountAmount || appliedCoupon.discount || 0) : 0;
  const finalAmount = useMemo(() => Math.max(0, basePrice - discount), [basePrice, discount]);
  const isFreeFlow = finalAmount <= 0;

  if (!visible || !course) return null;

  function teardownSdk() {
    try {
      CFPaymentGatewayService.removeCallback();
      CFPaymentGatewayService.removeEventSubscriber();
    } catch {}
  }

  async function handleApplyCoupon() {
    setCouponMsg('');
    if (!couponCode.trim()) {
      setCouponMsg('Enter a coupon code first');
      return;
    }
    setCouponLoading(true);
    try {
      const data = await couponService.checkCoupon({
        couponCode: couponCode.trim(),
        planId: course._id,
        amount: basePrice,
      });
      // BE response shape is not contractually pinned. Derive the discount
      // through a priority chain (BE finalAmount → BE discountAmount → manual
      // compute from discountType/discountValue/maxDiscountAmount). Without
      // this, a 30% coupon whose BE response carries only the raw coupon doc
      // shape (discountType + discountValue) would render as ₹0 saved.
      // Ported from web parity commit 9c23d97f.
      const orderAmt = Number(basePrice) || 0;
      const numOrNull = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const couponDoc = data?.coupon || data || {};
      const beFinal = numOrNull(data?.finalAmount ?? data?.final_amount ?? data?.payableAmount);
      const beDiscount = numOrNull(data?.discountAmount ?? data?.discount_amount ?? data?.discount);

      let discountAmount = null;
      let finalAmount = null;

      if (beFinal !== null && beDiscount !== null) {
        finalAmount = beFinal;
        discountAmount = beDiscount;
      } else if (beFinal !== null) {
        finalAmount = beFinal;
        discountAmount = Math.max(0, orderAmt - beFinal);
      } else if (beDiscount !== null) {
        discountAmount = beDiscount;
        finalAmount = Math.max(0, orderAmt - beDiscount);
      } else {
        const discountType = couponDoc?.discountType || couponDoc?.type;
        const discountValue = numOrNull(couponDoc?.discountValue ?? couponDoc?.value);
        const maxDiscount = numOrNull(couponDoc?.maxDiscountAmount);
        if (discountType === 'percentage' && discountValue !== null) {
          let d = (orderAmt * discountValue) / 100;
          if (maxDiscount !== null && d > maxDiscount) d = maxDiscount;
          discountAmount = d;
          finalAmount = Math.max(0, orderAmt - d);
        } else if (discountType === 'fixed' && discountValue !== null) {
          discountAmount = Math.min(discountValue, orderAmt);
          finalAmount = Math.max(0, orderAmt - discountAmount);
        }
      }

      // Refuse silent 100%-off unless the source actually says it's a 100%
      // discount.
      const looksLike100Percent =
        couponDoc?.discountType === 'percentage' && Number(couponDoc?.discountValue) >= 100;
      const finalIsZeroByDesign =
        finalAmount === 0 && (orderAmt === 0 || looksLike100Percent);

      if (
        finalAmount === null ||
        discountAmount === null ||
        finalAmount < 0 ||
        discountAmount < 0 ||
        (finalAmount === 0 && !finalIsZeroByDesign)
      ) {
        setAppliedCoupon(null);
        setCouponMsg(
          "We couldn't determine the discount for this coupon. Please refresh, retry, or contact support.",
        );
        return;
      }

      setAppliedCoupon({
        ...data,
        couponId: data?.couponId || data?._id || couponDoc?._id || undefined,
        discountAmount,
        finalAmount,
      });
      setCouponMsg(`Coupon applied — you save ₹${discountAmount.toLocaleString()}`);
    } catch (e) {
      setAppliedCoupon(null);
      setCouponMsg(e?.message || 'Coupon invalid');
    } finally {
      setCouponLoading(false);
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMsg('');
  }

  function validateInputs() {
    const cleanEmail = email.trim().toLowerCase();
    if (!getAuth().currentUser) {
      return 'Please sign in to enroll';
    }
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) return 'Your account has no email address. Please sign in with an email to enroll.';
    if (!name.trim()) return 'Please enter your name';
    if (!mobile.trim() || mobile.trim().length < 10) return 'Please enter a 10-digit mobile';
    const cleanPan = pan.trim().toUpperCase();
    if (cleanPan && !PAN_RE.test(cleanPan)) return 'PAN must be 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)';
    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin && !GSTIN_RE.test(cleanGstin)) {
      return 'GSTIN must be 15 characters (e.g. 27ABCDE1234F1Z5)';
    }
    return '';
  }

  function serverMessage(e, fallback) {
    return e?.response?.data?.message || e?.message || fallback;
  }

  // Paid: confirm with the server, which verifies the order at CashFree.
  async function finishPaidPurchase(status, cashfreeOrderId) {
    const orderId = status?.order_id || cashfreeOrderId;
    let pending = false;
    try {
      await gumletService.confirmCoursePurchase({ courseId: course._id, orderId, name: name.trim() });
    } catch (e) {
      // Money was taken either way. 402 = the gateway hasn't confirmed to
      // the server yet; the reconciliation cron enrolls within minutes.
      // Anything else: the order is still on record server-side, so the
      // same cron path applies — never tell a paying buyer it failed.
      pending = true;
      console.warn('[CoursePurchaseSheet] confirmCoursePurchase:', e?.response?.status, serverMessage(e, ''));
    }
    setPendingAccess(pending);
    setPhase('done');
    onPurchased && onPurchased({
      paymentStatus: pending ? 'paid_pending' : 'paid',
      buyerEmail: email.trim().toLowerCase(),
      courseId: course._id,
      orderId,
      transactionId: status?.cf_payment_id,
    });
  }

  async function handleFreePay() {
    setPhase('paying');
    setErrorMsg('');
    let result;
    try {
      result = await gumletService.claimFreeCourse({
        courseId: course._id,
        couponId: appliedCoupon?.couponId || appliedCoupon?._id || undefined,
        name: name.trim(),
      });
    } catch (e) {
      const code = e?.response?.status;
      setErrorMsg(
        code === 402
          ? 'This course is not free at the current price. Please refresh and pay to enroll.'
          : code === 409
            ? serverMessage(e, 'This coupon is no longer available.')
            : serverMessage(e, 'Could not record free enrollment. Please try again.'),
      );
      setPhase('form');
      return;
    }
    if (!result?.success) {
      setErrorMsg(result?.message || 'Could not record free enrollment. Please try again.');
      setPhase('form');
      return;
    }
    setPhase('done');
    onPurchased && onPurchased({
      paymentStatus: 'free',
      buyerEmail: email.trim().toLowerCase(),
      courseId: course._id,
      addClientResult: result,
    });
  }

  // Course payments follow the gateway the advisor chose in supportAQ
  // (2026-10-12). CashFree keeps the flow below; Razorpay runs natively
  // here; PayU and PhonePe need a browser redirect, so the buyer finishes
  // on the advisor's website. If the lookup fails, the CashFree path runs
  // and the server refuses it (409 USE_STUDENT_CHECKOUT) for a non-CashFree
  // advisor rather than collect into the wrong account.
  async function handlePaidPay() {
    setPhase('paying');
    setErrorMsg('');
    let gw = null;
    try {
      gw = await studentPaymentService.getGateway();
    } catch (e) {
      console.warn('[CoursePurchaseSheet] gateway lookup failed:', e?.message);
    }
    if (gw?.gateway === 'razorpay') {
      await payWithRazorpay();
      return;
    }
    if (gw?.gateway === 'phonepe') {
      await payWithPhonePe();
      return;
    }
    // PayU needs a hosted browser form, so the buyer finishes on the website.
    if (gw?.gateway === 'payu') {
      if (gw.website) {
        Linking.openURL(`${gw.website}/course/${course._id}`).catch(() => {});
        setErrorMsg('Please complete this purchase on the website we just opened. Your course appears here once paid.');
      } else {
        setErrorMsg('Please buy this course on the advisor\'s website.');
      }
      setPhase('form');
      return;
    }
    await payWithCashfree();
  }

  async function payWithRazorpay() {
    let order;
    try {
      order = await studentPaymentService.startCourseCheckout({
        courseId: course._id,
        couponId: appliedCoupon?.couponId || appliedCoupon?._id || undefined,
        name: name.trim(),
        mobile: mobile.trim(),
        pan: pan.trim().toUpperCase(),
        gstin: gstin.trim().toUpperCase() || undefined,
      });
    } catch (e) {
      if (e?.code === 'USE_CASHFREE') {
        await payWithCashfree();
        return;
      }
      setErrorMsg(e?.message || 'Could not start payment');
      setPhase('form');
      return;
    }
    const c = order.checkout || {};
    let resp;
    try {
      resp = await RazorpayCheckout.open({
        key: c.key,
        order_id: c.orderId,
        amount: c.amount,
        currency: c.currency || 'INR',
        name: c.name || course.title || 'Course',
        description: course.title || '',
        prefill: c.prefill || {},
      });
    } catch (e) {
      // Closed or failed inside Razorpay. Ask the server once in case the
      // payment went through anyway (it is the authority, not this callback).
      const st = await studentPaymentService.status(order.orderId).catch(() => null);
      if (st?.status === 'fulfilled') {
        finishStudentPurchase(order.orderId, true);
        return;
      }
      setErrorMsg(e?.description || e?.error?.description || 'Payment cancelled');
      setPhase('form');
      return;
    }
    let final = await studentPaymentService.confirm(order.orderId, {
      razorpay: { paymentId: resp?.razorpay_payment_id, orderId: resp?.razorpay_order_id, signature: resp?.razorpay_signature },
    }).catch(() => null);
    if (final?.status !== 'fulfilled') {
      final = await studentPaymentService.waitForFinal(order.orderId);
    }
    // Paid either way at this point: anything short of fulfilled is
    // finished by the server's reconciliation within minutes.
    finishStudentPurchase(order.orderId, final?.status === 'fulfilled');
  }

  // PhonePe: the order is opened on the merchant ID for the payment group the
  // buyer picks, paid in PhonePe, and confirmed by the server when the buyer
  // returns (the server's reconciliation finishes it if the app is closed).
  async function payWithPhonePe() {
    const paymentInstrumentGroup = await choosePhonePeGroup();
    if (paymentInstrumentGroup === null) {
      setPhase('form');
      return;
    }
    let order;
    try {
      order = await studentPaymentService.startCourseCheckout({
        courseId: course._id,
        couponId: appliedCoupon?.couponId || appliedCoupon?._id || undefined,
        name: name.trim(),
        mobile: mobile.trim(),
        pan: pan.trim().toUpperCase(),
        gstin: gstin.trim().toUpperCase() || undefined,
        paymentInstrumentGroup,
        channelMetadata: phonePeAppMetadata(),
      });
    } catch (e) {
      if (e?.code === 'USE_CASHFREE') {
        await payWithCashfree();
        return;
      }
      setErrorMsg(e?.message || 'Could not start payment');
      setPhase('form');
      return;
    }
    const redirectUrl = order?.checkout?.redirectUrl;
    if (!redirectUrl) {
      setErrorMsg('PhonePe did not return a checkout page. Please try again.');
      setPhase('form');
      return;
    }
    try {
      await openAndAwaitReturn(redirectUrl);
    } catch (e) {
      setErrorMsg(e?.message || 'Could not open PhonePe');
      setPhase('form');
      return;
    }
    const final = await studentPaymentService.waitForFinal(order.orderId, { timeoutMs: 30000 });
    if (final?.status === 'fulfilled') {
      finishStudentPurchase(order.orderId, true);
    } else if (final?.status === 'failed' || final?.status === 'expired') {
      setErrorMsg('PhonePe reported that this payment was not completed.');
      setPhase('form');
    } else {
      // Not confirmed yet — either still processing or not paid. Never show
      // a purchase as done on an unconfirmed order; the server finishes a
      // real payment and the course then appears in My Courses.
      setErrorMsg('Payment not confirmed yet. If you completed it in PhonePe, the course will appear in a few minutes.');
      setPhase('form');
    }
  }

  function finishStudentPurchase(orderId, confirmed) {
    setPendingAccess(!confirmed);
    setPhase('done');
    onPurchased && onPurchased({
      paymentStatus: confirmed ? 'paid' : 'paid_pending',
      buyerEmail: email.trim().toLowerCase(),
      courseId: course._id,
      orderId,
    });
  }

  async function payWithCashfree() {
    let cfOrderResponse;
    try {
      cfOrderResponse = await cashfreeOrderService.createCourseOrder({
        amount: finalAmount,
        customerId: `A-${mobile.trim()}`,
        user_email: email.trim().toLowerCase(),
        mobileNumber: mobile.trim(),
        pan: pan.trim().toUpperCase(),
        gstin: gstin.trim().toUpperCase() || undefined,
        course,
        name: name.trim(),
        userId: undefined, // resolved server-side by email if absent
        couponId: appliedCoupon?.couponId || appliedCoupon?._id || undefined,
      });
    } catch (e) {
      setErrorMsg(e?.response?.data?.message || e?.message || 'Could not start payment');
      setPhase('form');
      return;
    }

    const paymentSessionId = cfOrderResponse?.data?.payment_session_id;
    const cashfreeOrderId = cfOrderResponse?.subscription?.cashfree_order_id;
    const beforePaymentOrderId = cfOrderResponse?.data?.order_id || cashfreeOrderId;
    if (!paymentSessionId || !cashfreeOrderId) {
      setErrorMsg('Missing payment session data from server');
      setPhase('form');
      return;
    }

    // Do NOT pre-write the enrollment here. The earlier pre-payment call
    // created a CourseClientList row that BE accepted as enrolled — so a
    // user who opened the QR modal and closed it without paying still
    // appeared purchased. Authoritative enrollment is now written exactly
    // once, in the post-payment SUCCESS branch below. The CashFree webhook
    // + reconciliation cron (via order_tags.courseId on the order) remain
    // the server-side safety net for FE write failures.
    // Ported from web parity commit 7af384a6.

    handledRef.current = false;

    CFPaymentGatewayService.setCallback({
      onVerify: async (oid) => {
        if (handledRef.current) return;
        handledRef.current = true;
        teardownSdk();
        try {
          const status = await cashfreeOrderService.getOrderStatus(cashfreeOrderId);
          if (String(status?.payment_status || '').toUpperCase() === 'SUCCESS') {
            await finishPaidPurchase(status, cashfreeOrderId);
          } else {
            setErrorMsg(`Payment ${String(status?.payment_status || 'unknown').toLowerCase()}`);
            setPhase('form');
          }
        } catch (e) {
          setErrorMsg(e?.message || 'Could not verify payment');
          setPhase('form');
        }
      },
      onError: async (error) => {
        if (handledRef.current) return;
        handledRef.current = true;
        teardownSdk();
        const code = String(error?.code || '').toLowerCase();
        const msg = String(error?.message || '').toLowerCase();
        const isCancel =
          code === 'cancelled' || code === 'user_cancelled' || code === 'user_dropped'
          || code === 'transaction_cancelled' || msg.includes('cancel');
        if (isCancel) {
          setErrorMsg(error?.message || 'Payment cancelled');
          setPhase('form');
          return;
        }
        // Install-source rejection can also surface as an onError event
        // on some SDK builds. Translate before showing.
        // Webhook-race window: give the server a chance to mark the order SUCCESS.
        try {
          const status = await cashfreeOrderService.getOrderStatus(cashfreeOrderId);
          if (String(status?.payment_status || '').toUpperCase() === 'SUCCESS') {
            await finishPaidPurchase(status, cashfreeOrderId);
            return;
          }
        } catch {}
        setErrorMsg(friendlyPaymentError(error, 'Payment failed'));
        setPhase('form');
      },
    });

    CFPaymentGatewayService.setEventSubscriber({ onReceivedEvent: () => {} });

    const cfEnvironment = getCashfreeEnvironment();
    const session = new CFSession(paymentSessionId, cashfreeOrderId, cfEnvironment);
    const paymentModes = new CFPaymentComponentBuilder()
      .add(CFPaymentModes.CARD)
      .add(CFPaymentModes.UPI)
      .add(CFPaymentModes.NB)
      .add(CFPaymentModes.WALLET)
      .add(CFPaymentModes.PAY_LATER)
      .build();
    const theme = new CFThemeBuilder()
      .setNavigationBarBackgroundColor(designToken('cashfreeCheckout.course.navBar.background'))
      .setNavigationBarTextColor(designToken('cashfreeCheckout.course.navBar.text'))
      .setButtonBackgroundColor(designToken('cashfreeCheckout.course.button.background'))
      .setButtonTextColor(designToken('cashfreeCheckout.course.button.text'))
      .setPrimaryTextColor(designToken('cashfreeCheckout.course.text.primary'))
      .setSecondaryTextColor(designToken('cashfreeCheckout.course.text.secondary'))
      .build();
    const dropPayment = new CFDropCheckoutPayment(session, paymentModes, theme);
    try {
      CFPaymentGatewayService.doPayment(dropPayment);
    } catch (e) {
      teardownSdk();
      // CashFree's install-source check fires here for sideloaded APKs.
      // friendlyPaymentError() rewrites that specific message into
      // something the user can act on; everything else falls through
      // to the raw SDK message.
      setErrorMsg(friendlyPaymentError(e, 'Could not open payment'));
      setPhase('form');
    }
  }

  async function handlePay() {
    const v = validateInputs();
    if (v) { setErrorMsg(v); return; }
    if (isFreeFlow) await handleFreePay(); else await handlePaidPay();
  }

  const titleLabel = isFreeFlow
    ? (appliedCoupon ? 'Enroll for free (coupon)' : 'Enroll for free')
    : `Enroll — ₹${finalAmount.toLocaleString()}`;
  const payCta = isFreeFlow ? 'Enroll' : `Pay ₹${finalAmount.toLocaleString()}`;

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

          <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
          {!!course.validityDurationDays && (
            <Text style={styles.courseMeta}>Access for {course.validityDurationDays} days from purchase</Text>
          )}

          {phase === 'done' ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneText}>
                {pendingAccess
                  ? 'Payment received. Your course will unlock within a few minutes — no need to pay again.'
                  : 'Enrolled. Your course is now unlocked.'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.doneClose}>
                <Text style={styles.doneCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Email *</Text>
              {/* Read-only: the course is added to the signed-in account. */}
              <TextInput
                value={email}
                editable={false}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Sign in to enroll"
                style={[styles.input, styles.inputReadOnly]}
              />
              <Text style={styles.label}>Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={phase !== 'paying'}
                style={styles.input}
              />
              <Text style={styles.label}>Mobile *</Text>
              <TextInput
                value={mobile}
                onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 12))}
                editable={phase !== 'paying'}
                keyboardType="phone-pad"
                placeholder="10-digit mobile"
                style={styles.input}
              />
              <Text style={styles.label}>PAN (optional)</Text>
              <TextInput
                value={pan}
                onChangeText={(t) => setPan(t.toUpperCase().slice(0, 10))}
                editable={phase !== 'paying'}
                autoCapitalize="characters"
                placeholder="ABCDE1234F"
                style={styles.input}
              />
              <Text style={styles.label}>GSTIN (optional, for a business invoice)</Text>
              <TextInput
                value={gstin}
                onChangeText={(t) => setGstin(t.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 15))}
                editable={phase !== 'paying'}
                autoCapitalize="characters"
                placeholder="27ABCDE1234F1Z5"
                style={styles.input}
              />

              <Text style={styles.label}>Coupon code</Text>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponCode}
                  onChangeText={(t) => setCouponCode(t.toUpperCase())}
                  editable={phase !== 'paying' && !appliedCoupon}
                  autoCapitalize="characters"
                  placeholder="OFF50"
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                />
                {appliedCoupon ? (
                  <TouchableOpacity onPress={clearCoupon} style={styles.couponClearBtn}>
                    <Text style={styles.couponClearText}>Clear</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleApplyCoupon}
                    disabled={couponLoading || phase === 'paying'}
                    style={styles.couponApplyBtn}
                  >
                    {couponLoading
                      ? <ActivityIndicator color={designColor('fff')} />
                      : <Text style={styles.couponApplyText}>Apply</Text>}
                  </TouchableOpacity>
                )}
              </View>
              {!!couponMsg && (
                <Text style={[styles.couponMsg, appliedCoupon ? styles.couponMsgOk : styles.couponMsgErr]}>
                  {couponMsg}
                </Text>
              )}

              <View style={styles.totalsBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Course price</Text>
                  <Text style={styles.totalValue}>₹{basePrice.toLocaleString()}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: designColor('16a34a') }]}>Discount</Text>
                    <Text style={[styles.totalValue, { color: designColor('16a34a') }]}>– ₹{discount.toLocaleString()}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={styles.totalLabelFinal}>You pay</Text>
                  <Text style={styles.totalValueFinal}>
                    {isFreeFlow ? 'Free' : `₹${finalAmount.toLocaleString()}`}
                  </Text>
                </View>
              </View>

              {!!errorMsg && (
                <View style={styles.errorBox}><Text style={styles.errorText}>{errorMsg}</Text></View>
              )}

              {phase === 'paying' ? (
                <View style={styles.payingBox}>
                  <ActivityIndicator color={designColor('16a34a')} />
                  <Text style={styles.payingText}>Working… don't close this window.</Text>
                </View>
              ) : (
                <View style={styles.ctaRow}>
                  <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePay} style={styles.payBtn}>
                    <Text style={styles.payBtnText}>{payCta}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: designColor('ffffff'), borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: designColor('111827'), flex: 1 },
  closeX: { fontSize: 26, color: designColor('9ca3af'), paddingHorizontal: 4 },
  courseTitle: { fontSize: 14, fontWeight: '600', color: designColor('111827'), marginTop: 10 },
  courseMeta: { fontSize: 11, color: designColor('6b7280'), marginTop: 4 },
  inputReadOnly: { opacity: 0.7 },
  doneBox: { marginTop: 16, backgroundColor: designColor('f0fdf4'), borderColor: designColor('bbf7d0'), borderWidth: 1, borderRadius: 8, padding: 14 },
  doneText: { color: designColor('166534'), fontSize: 13 },
  doneClose: { marginTop: 10, alignSelf: 'flex-start' },
  doneCloseText: { color: designColor('16a34a'), fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: designColor('374151'), marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: designColor('d1d5db'), borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: designColor('111827') },
  couponRow: { flexDirection: 'row', alignItems: 'stretch' },
  couponApplyBtn: { backgroundColor: designColor('16a34a'), paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6 },
  couponApplyText: { color: designColor('fff'), fontWeight: '600' },
  couponClearBtn: { backgroundColor: designColor('f3f4f6'), paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6 },
  couponClearText: { color: designColor('374151'), fontWeight: '500' },
  couponMsg: { marginTop: 6, fontSize: 12 },
  couponMsgOk: { color: designColor('15803d') },
  couponMsgErr: { color: designColor('b91c1c') },
  totalsBox: { marginTop: 16, padding: 12, backgroundColor: designColor('f9fafb'), borderRadius: 8, borderColor: designColor('e5e7eb'), borderWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: designColor('374151'), fontSize: 13 },
  totalValue: { color: designColor('111827'), fontSize: 13 },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: designColor('e5e7eb'), marginTop: 6, paddingTop: 8 },
  totalLabelFinal: { color: designColor('111827'), fontWeight: '700', fontSize: 14 },
  totalValueFinal: { color: designColor('111827'), fontWeight: '700', fontSize: 16 },
  errorBox: { marginTop: 12, backgroundColor: designColor('fef2f2'), borderColor: designColor('fecaca'), borderWidth: 1, borderRadius: 6, padding: 10 },
  errorText: { color: designColor('991b1b'), fontSize: 12 },
  payingBox: { alignItems: 'center', paddingVertical: 14 },
  payingText: { color: designColor('6b7280'), fontSize: 12, marginTop: 6 },
  ctaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, marginRight: 6 },
  cancelBtnText: { color: designColor('374151'), fontWeight: '500' },
  payBtn: { backgroundColor: designColor('16a34a'), paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  payBtnText: { color: designColor('ffffff'), fontWeight: '600' },
});
