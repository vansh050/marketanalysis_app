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

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { designToken } from '../../../src/design/literalTokens';

const CONFIRM_WORD = 'DELETE';

const DeleteAccountScreen = ({viewModel, actions}) => {
  const {primary, danger, loadingPreview, preview, confirmText, deleting, canDelete} = viewModel;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={actions.onBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={24} color={designToken('deleteAccount.text')} />
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
            <AlertTriangle size={20} color={designToken('deleteAccount.warning')} />
            <Text style={[styles.warnText, { color: designToken('deleteAccount.warning') }]}>
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
          recommendation records and invoices are retained in anonymised form. Your
          email address is released, so you may register again later as a new
          account with no prior history.
        </Text>

        <Text style={styles.sectionLabel}>
          Type {CONFIRM_WORD} to confirm
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={actions.onConfirmTextChange}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleting}
          style={styles.input}
          placeholderTextColor={designToken('deleteAccount.placeholder')}
        />

        <TouchableOpacity
          onPress={actions.onConfirmDelete}
          disabled={!canDelete}
          style={[
            styles.deleteBtn,
            { backgroundColor: canDelete ? danger : designToken('deleteAccount.danger') },
          ]}>
          {deleting ? (
            <ActivityIndicator color={designToken('deleteAccount.surface')} />
          ) : (
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={actions.onBack}
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
  safe: { flex: 1, backgroundColor: designToken('deleteAccount.surface2') },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: designToken('deleteAccount.border'),
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: designToken('deleteAccount.text') },
  body: { padding: 16, paddingBottom: 40 },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: designToken('deleteAccount.surfaceMuted'),
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  subWarn: { backgroundColor: designToken('deleteAccount.warningSoft') },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: designToken('deleteAccount.danger2') },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: designToken('deleteAccount.text'),
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bullet: { fontSize: 14, lineHeight: 22, color: designToken('deleteAccount.text2'), marginBottom: 4 },
  note: { fontSize: 13, lineHeight: 20, color: designToken('deleteAccount.accent') },
  input: {
    borderWidth: 1,
    borderColor: designToken('deleteAccount.border2'),
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: designToken('deleteAccount.text'),
    marginBottom: 20,
  },
  deleteBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: designToken('deleteAccount.surface2'), fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
});

export default DeleteAccountScreen;
