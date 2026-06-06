/**
 * GrowwHelpContent — Zerodha-style help/notes panel for the Groww
 * connect modal. Renders a brief overview (collapsed) and adds
 * Important Notes + Need Help sections (expanded only).
 *
 * Why a separate file (and not inline in the modal): the modal already
 * has a detailed 4-step inline setup guide (the precise click path on
 * Groww's Trade API page — keep as-is, it's load-bearing). This help
 * component supplements that with the *cross-broker* concerns Zerodha
 * already shows — what each value does, daily refresh behaviour, how
 * to recover if Groww revokes the secret, and a Need Help section.
 * Visual style (yellow note callout, gray support box) matches
 * ZerodhaHelpContent for cross-broker UX consistency.
 *
 * Mirrors ZerodhaHelpContent's contract so GrowwConnectModal can use
 * the same `expanded` / `onExpandChange` driving pattern + the
 * "Read More / See Less" toggle outside the component.
 */
import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';

const GrowwHelpContent = ({expanded, onExpandChange}) => {
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
      <View style={[styles.container, {paddingBottom: 20}]}>
        <Text style={styles.title}>About this connection</Text>
        <Text style={styles.intro}>
          Groww uses an API Key + TOTP Secret pair (Bearer token + seed
          for daily 6-digit codes) instead of OAuth. Tap{' '}
          <Text style={{fontWeight: '700'}}>Read More</Text> below for
          notes on which value goes where, daily refresh behaviour,
          and what to do if you hit a "rejected credentials" error.
        </Text>

        {expanded && (
          <>
            <View style={styles.noteContainer}>
              <Text style={styles.noteTitle}>Which value goes where?</Text>
              <Text style={styles.noteText}>
                • The <Text style={{fontWeight: '700'}}>JWT</Text> (starts
                with <Text style={styles.mono}>eyJraWQi…</Text>) → paste
                into the "TOTP Token (used as API Key)" field. Groww
                uses this as the Bearer token.
              </Text>
              <Text style={styles.noteText}>
                • The <Text style={{fontWeight: '700'}}>Base32 secret</Text>{' '}
                (~32 chars, A–Z and 2–7) shown below the QR → paste into
                the "TOTP QR Secret (Base32)" field. Our backend uses
                it to mint a fresh 6-digit TOTP every daily refresh.
              </Text>
              <Text style={styles.noteText}>
                Both values are shown only once on Groww's side — copy
                them carefully before closing the dialog.
              </Text>
            </View>

            <View style={styles.noteContainer}>
              <Text style={styles.noteTitle}>Important Notes:</Text>
              <Text style={styles.noteText}>
                • Groww rejects access-token requests and orders from
                non-whitelisted IPs. Whitelist the dedicated IP we issue
                or you'll see a "Groww rejected the credentials" error.
              </Text>
              <Text style={styles.noteText}>
                • The Base32 secret is stored encrypted on our side and
                never shown back to you. Daily refresh is automatic —
                you don't have to re-paste credentials each day.
              </Text>
              <Text style={styles.noteText}>
                • If Groww revokes the secret on their dashboard,
                generate a new one and reconnect here — re-pasting both
                values from the new "Generate TOTP token" dialog.
              </Text>
              <Text style={styles.noteText}>
                • Make sure you have an active Groww trading account
                with the segments you trade (equity / F&amp;O) enabled
                before connecting.
              </Text>
            </View>

            <View style={styles.supportContainer}>
              <Text style={styles.supportTitle}>Need Help?</Text>
              <Text style={styles.supportText}>
                If you encounter "Groww rejected the credentials" or any
                other error, double-check the dedicated IP whitelist on
                Groww's side first, then contact our support team with
                the error code shown.
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  intro: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  noteContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  noteText: {
    fontSize: 13,
    color: '#78350F',
    marginBottom: 6,
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  supportContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    fontFamily: 'Poppins-SemiBold',
  },
  supportText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
});

export default GrowwHelpContent;
