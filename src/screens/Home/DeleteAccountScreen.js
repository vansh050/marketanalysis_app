/**
 * DeleteAccountScreen — in-app account deletion (Google Play requirement).
 *
 * Canonical design + retention rules:
 *   prod-alphaquark-github/docs/ACCOUNT_DELETION_ARCHITECTURE.md (approved 2026-07-17).
 * Backend: DELETE /api/account/delete (+ GET /api/account/delete-account/preview),
 *   soft-delete + SEBI retention carve-out — see accountDeletion.js.
 *
 * Flow: on mount → preview (active-sub warning) → user types DELETE to confirm →
 *   DELETE /api/account/delete → on success run the standard logout sequence
 *   (GoogleSignin.signOut → Firebase signOut → clear context/storage) → Login.
 *
 * White-label safe: colors + support copy come from ConfigContext; no advisor
 * name is hardcoded. This file is a generic surface synced to every fork.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { clearAccountEmail } from '../../utils/accountEmail';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../TradeContext';
import server from '../../utils/serverConfig';
import { getAuthedHeaders } from '../../utils/courseAuthHeaders';

const CONFIRM_WORD = 'DELETE';

const DeleteAccountScreen = ({ navigation }) => {
  const config = useConfig();
  const {
    setUserDetails,
    setIsProfileCompleted,
    setHasFetchedTrades,
    setFunds,
    setstockRecoNotExecutedfinal,
    setModelPortfolioStrategyfinal,
    setBroker,
  } = useTrade();

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const primary = config?.gradient2 || config?.buttonColor || '#0056B7';
  const danger = '#D92D20';

  // --- preview (does the user have an active paid subscription?) -----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const headers = await getAuthedHeaders();
        const res = await fetch(
          `${server.server.baseUrl}api/account/delete-account/preview`,
          { method: 'GET', headers },
        );
        const data = await res.json().catch(() => ({}));
        if (mounted && res.ok && data?.success) setPreview(data);
      } catch (e) {
        // Non-fatal — the delete still works; we just can't pre-warn.
        console.warn('[DeleteAccount] preview failed:', e?.message);
      } finally {
        if (mounted) setLoadingPreview(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const finishLogout = async () => {
    try {
      try {
        await GoogleSignin.signOut();
      } catch {
        /* Google may not have been used */
      }
      await signOut(getAuth());
      await AsyncStorage.removeItem('cartItems');
      // The resolved account identity (Apple typed email) MUST die with the
      // account — it is not cleared by Firebase signOut, and a stale value
      // would make the next sign-in resolve to the deleted account's email.
      await clearAccountEmail();
    } catch (e) {
      console.warn('[DeleteAccount] post-delete signout:', e?.message);
    }
    setUserDetails?.(null);
    setHasFetchedTrades?.(false);
    setIsProfileCompleted?.(false);
    setFunds?.({});
    setBroker?.(null);
    setstockRecoNotExecutedfinal?.([]);
    setModelPortfolioStrategyfinal?.([]);
    navigation.replace('Login');
  };

  const doDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD || deleting) return;
    setDeleting(true);
    try {
      const headers = await getAuthedHeaders();
      const res = await fetch(`${server.server.baseUrl}api/account/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ confirmDeletion: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        Alert.alert(
          'Account deleted',
          'Your account has been deleted. You will now be signed out.',
          [{ text: 'OK', onPress: finishLogout }],
          { cancelable: false },
        );
      } else if (res.status === 401 || data?.requiresReauth) {
        Alert.alert(
          'Please sign in again',
          'Your session has expired. Sign in again and retry deleting your account.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }],
        );
      } else {
        setDeleting(false);
        Alert.alert(
          'Could not delete account',
          data?.message || 'Something went wrong. Please try again.',
        );
      }
    } catch (e) {
      setDeleting(false);
      Alert.alert(
        'Could not delete account',
        'Please check your connection and try again.',
      );
    }
  };

  const confirmAndDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ],
    );
  };

  const canDelete =
    confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={24} color="#101828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        <View style={styles.warnCard}>
          <AlertTriangle size={20} color={danger} />
          <Text style={styles.warnText}>
            Deleting your account is permanent and cannot be undone.
          </Text>
        </View>

        {loadingPreview ? (
          <ActivityIndicator
            color={primary}
            style={{ marginVertical: 16 }}
          />
        ) : preview?.hasActiveSubscription ? (
          <View style={[styles.warnCard, styles.subWarn]}>
            <AlertTriangle size={20} color="#B54708" />
            <Text style={[styles.warnText, { color: '#B54708' }]}>
              You have an active subscription
              {preview?.activePlanNames?.length
                ? ` (${preview.activePlanNames.join(', ')})`
                : ''}
              . Deleting your account will end it immediately and it is{' '}
              <Text style={{ fontWeight: '700' }}>non-refundable</Text>.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>What is removed</Text>
        {[
          'Your login access — you will be signed out and cannot log in again',
          'Your profile details (name, email, phone) — anonymised',
          'Your broker connections and stored broker credentials',
          'Your app notifications, preferences and usage data',
        ].map((t, i) => (
          <Text key={`r${i}`} style={styles.bullet}>
            {'•'}  {t}
          </Text>
        ))}

        <Text style={styles.sectionLabel}>What we must keep</Text>
        <Text style={styles.note}>
          As required by SEBI (5-year record retention) and tax law, your
          advice records and invoices are retained in anonymised form. Your
          email address is released, so you may register again later as a new
          account with no prior history.
        </Text>

        <Text style={styles.sectionLabel}>
          Type {CONFIRM_WORD} to confirm
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleting}
          style={styles.input}
          placeholderTextColor="#98A2B3"
        />

        <TouchableOpacity
          onPress={confirmAndDelete}
          disabled={!canDelete}
          style={[
            styles.deleteBtn,
            { backgroundColor: canDelete ? danger : '#F2C4C0' },
          ]}>
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={deleting}
          style={styles.cancelBtn}>
          <Text style={[styles.cancelBtnText, { color: primary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#101828' },
  body: { padding: 16, paddingBottom: 40 },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  subWarn: { backgroundColor: '#FFFAEB' },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#B42318' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101828',
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bullet: { fontSize: 14, lineHeight: 22, color: '#344054', marginBottom: 4 },
  note: { fontSize: 13, lineHeight: 20, color: '#475467' },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#101828',
    marginBottom: 20,
  },
  deleteBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
});

export default DeleteAccountScreen;
