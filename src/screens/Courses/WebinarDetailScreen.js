/**
 * WebinarDetailScreen — public /webinar/:lessonId equivalent.
 *
 * Three states:
 *   1. Not signed in + not bought → Buy CTA opens BuyWebinarTicketSheet.
 *   2. Signed in + enrolled       → LiveRoom composite (countdown / live / ended).
 *   3. Signed in + not enrolled   → Buy CTA.
 *
 * The T-10min join-gating lives in the LiveRoom composite, not here.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.4.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {useComponent} from '../../design/useDesign';
import { useConfig } from '../../context/ConfigContext';
import liveKitService from '../../FunctionCall/services/LiveKitService';
import BuyWebinarTicketSheet from '../../components/BuyWebinarTicketSheet';
import {getAccountEmail} from '../../utils/accountEmail';

import {designColor} from '../../design/literalTokens';

export default function WebinarDetailScreen() {
  const Presentation = useComponent('screens.WebinarDetailScreen');
  const LiveRoom = useComponent('composites.LiveRoom');
  const route = useRoute();
  const navigation = useNavigation();
  // joinToken — magic-link join (web parity, 2026-06-06): a confirmation-
  // email deep link can carry a signed JWT that lets the registrant into
  // the room with no Firebase sign-in. When present we skip the sign-in /
  // email-mismatch gating and forward the token to LiveRoom.
  const { lessonId, joinToken } = route.params || {};
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || designColor('d97706');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(() => getAuth().currentUser);
  const [buyOpen, setBuyOpen] = useState(false);
  const [showJoinFlow, setShowJoinFlow] = useState(false);
  const [purchaseEmail, setPurchaseEmail] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => setUser(u));
    return () => { if (unsub) unsub(); };
  }, []);

  const fetchPublic = useCallback(async () => {
    if (!lessonId) { setError('Missing lesson id'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const d = await liveKitService.getPublicWebinar(lessonId);
      setData(d);
      // Backend returns isEnrolled=true when the signed-in caller already
      // has a per-lesson registration. Flip into join mode so a returning
      // registrant doesn't get prompted to re-register (matches web's
      // WebinarDetailPage behaviour). When isEnrolled=false (e.g. the
      // user signed out + back in as a different account), clear any
      // stale session state — otherwise the warn box would persist
      // pointing at the OLD purchaseEmail.
      if (d?.isEnrolled) {
        setShowJoinFlow(true);
        if (d.enrolledEmail) setPurchaseEmail(d.enrolledEmail);
      } else {
        setShowJoinFlow(false);
        setPurchaseEmail('');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not load webinar');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  // Re-fetch when sign-in state flips — the /public endpoint only returns
  // isEnrolled when a Firebase Bearer is attached, so a fresh sign-in (or
  // a sign-out) needs a re-query.
  useEffect(() => { fetchPublic(); }, [fetchPublic, user?.uid]);

  // Magic-link arrival — flip straight into join mode; the JWT is the
  // credential, so no /public enrollment confirmation is needed first.
  useEffect(() => { if (joinToken) setShowJoinFlow(true); }, [joinToken]);

  const handlePurchased = useCallback((res) => {
    setBuyOpen(false);
    if (res?.buyerEmail) setPurchaseEmail(res.buyerEmail);
    setShowJoinFlow(true);
    fetchPublic();
  }, [fetchPublic]);

  const isFree = Number(data?.ticketPrice || 0) <= 0;
  const isEnded = !!data?.liveEndedAt;
  const isVod = data?.recordingStorageTier === 'promoted' && data?.gumletAssetId;
  const ctaLabel = isFree ? 'Register for free' : `Buy ticket — ₹${data?.ticketPrice}`;
  const emailMismatch = user?.email && purchaseEmail && (getAccountEmail() || '').toLowerCase() !== purchaseEmail.toLowerCase();

  return (
    <Presentation
      viewModel={{
        enabled: config?.webinarsEnabled !== false,
        accent, loading, error, data, user, buyOpen, showJoinFlow,
        purchaseEmail, joinToken, isFree, isEnded, isVod, ctaLabel, emailMismatch,
      }}
      actions={{
        onOpenPurchase: () => setBuyOpen(true),
        onClosePurchase: () => setBuyOpen(false),
        onPurchased: handlePurchased,
        onSignIn: () => navigation.navigate('Login'),
        onRegisterCurrentAccount: () => {
          setPurchaseEmail('');
          setShowJoinFlow(false);
          setBuyOpen(true);
        },
        onRequestJoinUrl: liveKitService.getJoinUrl,
      }}
      slots={{LiveRoom, BuyTicketSheet: BuyWebinarTicketSheet}}
    />
  );
}
