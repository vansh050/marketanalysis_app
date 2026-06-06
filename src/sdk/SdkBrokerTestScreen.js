/**
 * SdkBrokerTestScreen — debug harness for the 4 pilot brokers.
 *
 * Reachable when REACT_APP_SDK_INTEGRATION=true (registered in
 * Navigation.js as Stack.Screen 'SdkBrokerTest'). One tap opens the
 * SDK-powered modal for each broker, with no broker pre-selection
 * carried over from the legacy flow — everything routes through the
 * unified SdkBrokerConnectModal.
 *
 * Use this in dev to verify each schema renders, the OAuth WebView
 * fires for OAuth brokers, and credential submit lands at
 * /sdk/v1/connections/:broker/update-credentials.
 */
import React, {useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import {useAqSdk, getBrokerFormSchema} from '@alphaquark/mobile-sdk';

// Legacy broker connect modals — proven UX with header back button,
// inline instructions, WebView, and per-broker quirks (AliceBlue OTP
// intercept, Kotak +91 normalisation). The SDK test screen launches
// these directly so QA gets the real broker connect flow even while
// the SDK is still proving out the data-plane routes.
import ZerodhaConnectModal from '../components/BrokerConnectionModal/ZerodhaConnectModal';
import AliceBlueConnect from '../components/BrokerConnectionModal/AliceBlueConnect';
import KotakModal from '../components/BrokerConnectionModal/KotakModal';
import AngleOneBookingTrueSheet from '../components/BrokerConnectionModal/AngleoneBookingModal';
import UpstoxModal from '../components/BrokerConnectionModal/upstoxModal';
import ICICIUPModal from '../components/BrokerConnectionModal/icicimodal';
import IIFLModal from '../components/iiflmodal';
import MotilalModal from '../components/BrokerConnectionModal/MotilalModal';
import HDFCconnectModal from '../components/BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from '../components/BrokerConnectionModal/DhanConnectModal';
import FyersConnect from '../components/BrokerConnectionModal/FyersConnect';
import GrowwConnectModal from '../components/BrokerConnectionModal/GrowwConnectModal';
import AxisConnectModal from '../components/BrokerConnectionModal/AxisConnectModal';

// Dummy creds used by the "smoke test" path — every broker accepts a
// different shape; the backend rejects all of them, but we get to
// observe the network round-trip and verify the SDK route exists,
// the session token authenticates, and the error response is the
// expected upstream-validation flavour.
const SMOKE_BODIES = {
  Zerodha: {apiKey: 'smoke_kite_key', secretKey: 'smoke_kite_secret'},
  Kotak: {
    apiKey: 'smoke_kotak_key',
    mobileNumber: '+919999999999',
    mpin: '0000',
    ucc: 'SMOKE',
    totp: '000000',
  },
  'Angel One': {
    apiKey: 'smoke_smartapi_key',
    clientCode: 'SMOKE01',
    mpin: '0000',
    totp: '000000',
  },
  AliceBlue: {
    apiKey: 'smoke_ant_key',
    secretKey: 'smoke_ant_secret',
    clientId: 'SMOKE01',
  },
};

// Pilot 4 — these are the brokers whose legacy modals additionally
// route their final save call through the SDK data plane when
// REACT_APP_SDK_INTEGRATION=true (see brokerSdkBridge.js). The
// remaining brokers below open the same legacy modal but the modal's
// internal axios calls stay on the legacy /api/* routes for now.
const PILOT_BROKERS = [
  {
    key: 'Zerodha',
    label: 'Zerodha — legacy connect + SDK exchange-token',
    LegacyComponent: ZerodhaConnectModal,
    sdkRewired: true,
  },
  {
    key: 'Kotak',
    label: 'Kotak — legacy connect + SDK connect',
    LegacyComponent: KotakModal,
    sdkRewired: true,
  },
  {
    key: 'Angel One',
    label: 'Angel One — legacy connect + SDK connect',
    LegacyComponent: AngleOneBookingTrueSheet,
    sdkRewired: true,
  },
  {
    key: 'AliceBlue',
    label: 'AliceBlue — legacy connect + SDK exchange-token',
    LegacyComponent: AliceBlueConnect,
    sdkRewired: true,
  },
  // Round 2 — same legacy modal as production, now with SDK
  // dual-write enabled when REACT_APP_SDK_INTEGRATION=true. Each
  // modal calls sdkConnectBroker(...) right after its legacy
  // /api/user/connect-broker (or /api/<broker>/update-key, where
  // applicable) succeeds. Failure is logged but never blocks the
  // legacy success path. Same pattern as the four pilot brokers
  // above.
  {
    key: 'Upstox',
    label: 'Upstox — legacy connect + SDK connect (OAuth)',
    LegacyComponent: UpstoxModal,
    sdkRewired: true,
  },
  {
    key: 'ICICI Direct',
    label: 'ICICI Direct — legacy connect + SDK connect',
    LegacyComponent: ICICIUPModal,
    sdkRewired: true,
  },
  {
    key: 'IIFL Securities',
    label: 'IIFL — legacy connect + SDK connect',
    LegacyComponent: IIFLModal,
    sdkRewired: true,
  },
  {
    key: 'Motilal Oswal',
    label: 'Motilal Oswal — legacy connect + SDK connect',
    LegacyComponent: MotilalModal,
    sdkRewired: true,
  },
  {
    key: 'Hdfc Securities',
    label: 'HDFC Securities — legacy connect + SDK connect',
    LegacyComponent: HDFCconnectModal,
    sdkRewired: true,
  },
  {
    key: 'Dhan',
    label: 'Dhan — legacy connect + SDK connect (PAT)',
    LegacyComponent: DhanConnectModal,
    sdkRewired: true,
  },
  {
    key: 'Fyers',
    label: 'Fyers — legacy connect + SDK connect (OAuth)',
    LegacyComponent: FyersConnect,
    sdkRewired: true,
  },
  {
    key: 'Groww',
    label: 'Groww — legacy connect + SDK connect (App Links)',
    LegacyComponent: GrowwConnectModal,
    sdkRewired: true,
  },
  {
    key: 'Axis Securities',
    label: 'Axis Securities — legacy connect + SDK connect',
    LegacyComponent: AxisConnectModal,
    sdkRewired: true,
  },
];

export default function SdkBrokerTestScreen({navigation}) {
  const [activeBroker, setActiveBroker] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [smokeBusy, setSmokeBusy] = useState(false);
  const {ready, userRef, client} = useAqSdk();

  const runSmokeTest = async () => {
    if (!ready) {
      setLastResult({error: 'provider not ready'});
      return;
    }
    setSmokeBusy(true);
    const out = {};
    for (const broker of PILOT_BROKERS) {
      const body = SMOKE_BODIES[broker.key];
      const schema = getBrokerFormSchema(broker.key);
      try {
        // Mirror BrokerCredentialForm's dispatch — schema decides
        // whether the broker uses /update-credentials (Kotak, Zerodha)
        // or /connect (Angel One, AliceBlue, Dhan, Groww).
        const r =
          schema?.submitEndpoint === 'connect'
            ? await client.connectBroker(broker.key, body)
            : await client.updateBrokerCredentials(broker.key, body);
        out[broker.key] = {
          via: schema?.submitEndpoint || 'update-credentials',
          ok: true,
          response: r,
        };
      } catch (e) {
        out[broker.key] = {
          via: schema?.submitEndpoint || 'update-credentials',
          ok: false,
          httpStatus: e?.httpStatus,
          code: e?.message,
          detail: e?.detail,
        };
      }
    }
    setLastResult(out);
    setSmokeBusy(false);
  };

  // Render the test scroll list AND the active broker modal as
  // siblings inside a flex root, NOT modals inside the ScrollView.
  // Reason: legacy broker modals on Android use CrossPlatformOverlay
  // which renders a `position: 'absolute'` View with zIndex: 9999.
  // Inside a ScrollView, that absolute positioning is relative to the
  // scroll *content* (not the screen), so the overlay appears inline
  // between buttons and scrolls with the page — defeating its
  // full-screen takeover semantics. Lifting the modal to a screen-
  // root sibling restores the intended cover-everything behaviour
  // and matches how BrokerModalRenderer mounts these in production.
  return (
    <View style={{flex: 1, backgroundColor: '#f0f0f0'}}>
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>SDK Broker connect — pilot</Text>
      <Text style={styles.subtle}>
        Bound user: {userRef || '(none — log in first)'}
        {'\n'}Provider ready: {String(ready)}
      </Text>

      {PILOT_BROKERS.map(b => (
        <Pressable
          key={b.key}
          style={styles.btn}
          onPress={() => {
            setLastResult(null);
            setActiveBroker(b.key);
          }}>
          <Text style={styles.btnText}>{b.label}</Text>
        </Pressable>
      ))}

      <Pressable
        style={[styles.btn, styles.smokeBtn, smokeBusy && styles.btnBusy]}
        disabled={smokeBusy}
        onPress={runSmokeTest}>
        <Text style={styles.btnText}>
          {smokeBusy
            ? 'Running smoke test…'
            : '🧪 Smoke-test all 4 (per-broker endpoint)'}
        </Text>
      </Pressable>

      {lastResult ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Last result</Text>
          <Text style={styles.resultBody}>{JSON.stringify(lastResult, null, 2)}</Text>
        </View>
      ) : null}

      {navigation && (
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            // SdkBrokerTest is set as the initial route via
            // REACT_APP_SDK_BROKER_TEST_FIRST, so goBack() no-ops
            // (no previous screen). Use replace to drop into the
            // real app stack — Splash starts the normal Login → Home
            // flow.
            if (navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else if (navigation.replace) {
              navigation.replace('Splash');
            } else {
              navigation.navigate?.('Splash');
            }
          }}>
          <Text style={styles.backBtnText}>
            ← Exit test screen (boot into normal app)
          </Text>
        </Pressable>
      )}

    </ScrollView>

    {PILOT_BROKERS.map(b => {
      if (activeBroker !== b.key) return null;
      const LegacyComponent = b.LegacyComponent;
      return (
        <LegacyComponent
          key={b.key}
          isVisible={true}
          onClose={() => setActiveBroker(null)}
          fetchBrokerStatusModal={() => {
            setLastResult({status: 'connect_success', broker: b.key});
            return Promise.resolve({migrationWillShow: false});
          }}
          setShowBrokerModal={() => setActiveBroker(null)}
        />
      );
    })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '700', marginBottom: 6},
  subtle: {color: '#666', marginBottom: 18, fontFamily: 'monospace', fontSize: 12},
  btn: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnText: {color: '#fff', fontWeight: '600', fontSize: 14},
  smokeBtn: {backgroundColor: '#7b1fa2', marginTop: 12},
  btnBusy: {opacity: 0.6},
  resultBox: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  resultLabel: {fontWeight: '600', marginBottom: 6},
  resultBody: {fontFamily: 'monospace', fontSize: 12, color: '#333'},
  backBtn: {
    marginTop: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 6,
    alignItems: 'center',
  },
  backBtnText: {color: '#666', fontWeight: '600'},
});
