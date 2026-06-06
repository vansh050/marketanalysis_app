/**
 * SdkSelfTestScreen — minimal screen that exercises the SDK end-to-end
 * to prove wiring works. Shows:
 *   - userStatus.connected_brokers (proves session mint + GET works)
 *   - sell-auth for primary broker (proves /connections/:broker/* works)
 *
 * Reach this screen via deep link `rgxapp://sdk-self-test` (set up in
 * Navigation.js when SDK integration is enabled), or by adding a
 * temporary entry to your nav stack while testing.
 */
import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useUserStatus,
  useBrokerConnections,
  useSellAuth,
} from '@alphaquark/mobile-sdk';

export default function SdkSelfTestScreen({onClose}) {
  const userStatus = useUserStatus();
  const brokers = useBrokerConnections();
  const primary = userStatus.data?.primary_broker || null;
  const sellAuth = useSellAuth(primary);

  const ok = useMemo(
    () => userStatus.data && !userStatus.error,
    [userStatus.data, userStatus.error],
  );

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>SDK self-test</Text>
      <Text style={styles.subtle}>
        Verifies session mint + 3 read endpoints. Failures point at the
        mint URL, the tenant secret, or a missing user provisioning.
      </Text>

      <Section
        label="GET /sdk/v1/user/status"
        loading={userStatus.loading}
        error={userStatus.error}>
        {ok ? (
          <>
            <Text style={styles.kv}>email: {userStatus.data.email}</Text>
            <Text style={styles.kv}>
              primary_broker: {userStatus.data.primary_broker || '(none)'}
            </Text>
            <Text style={styles.kv}>
              status: {userStatus.data.connect_broker_status || '(empty)'}
            </Text>
          </>
        ) : null}
      </Section>

      <Section
        label="GET /sdk/v1/user/status — connected_brokers"
        loading={brokers.loading}
        error={brokers.error}>
        {brokers.data ? (
          brokers.data.length === 0 ? (
            <Text style={styles.kv}>(no brokers connected)</Text>
          ) : (
            brokers.data.map((b, i) => (
              <Text key={i} style={styles.kv}>
                {b.broker} · expires {b.token_expire || '—'} ·{' '}
                {b.has_jwt_token ? 'has token' : 'no token'}
              </Text>
            ))
          )
        ) : null}
      </Section>

      <Section
        label={`GET /sdk/v1/connections/${primary || '?'}/sell-auth`}
        loading={sellAuth.loading}
        error={sellAuth.error}>
        {primary ? (
          sellAuth.data ? (
            <>
              <Text style={styles.kv}>
                isAuthorized: {String(sellAuth.data.isAuthorized)}
              </Text>
              <Text style={styles.kv}>
                reliable: {String(sellAuth.data.reliable)}
              </Text>
              <Text style={styles.kv}>
                method: {sellAuth.data.method || '—'}
              </Text>
            </>
          ) : null
        ) : (
          <Text style={styles.kv}>(no primary broker)</Text>
        )}
      </Section>

      {onClose ? (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Section({label, loading, error, children}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {loading ? <ActivityIndicator style={{marginVertical: 8}} /> : null}
      {error ? (
        <Text style={styles.errorLine}>
          ✕ {error.error}
          {error.detail ? ` — ${error.detail}` : ''}
        </Text>
      ) : null}
      {!loading && !error ? <View>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {padding: 20},
  title: {fontSize: 22, fontWeight: '700', marginBottom: 6},
  subtle: {color: '#666', marginBottom: 16, lineHeight: 18},
  section: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  sectionLabel: {fontWeight: '600', marginBottom: 6},
  kv: {fontFamily: 'monospace', fontSize: 12, marginVertical: 1},
  errorLine: {color: '#b00020', fontFamily: 'monospace', fontSize: 12},
  closeBtn: {
    marginTop: 24,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  closeBtnText: {color: '#fff', fontWeight: '600'},
});
