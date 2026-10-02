/**
 * BrokerConnectModalDispatch — single source of truth for SDK vs
 * legacy broker-connect modal routing.
 *
 * Background: ModalManager.js was the original Phase 3 dispatch site,
 * but the codebase has many bypasses that render legacy modals
 * inline via local React useState (StockAdvices.js, AddtoCartModal,
 * RebalanceAdvices, IIFLReviewTradeModal, GlobalBrokerModals). Those
 * paths NEVER hit ModalManager so Phase 3 routing was a no-op for
 * them — user-reported regression 2026-04-28: AliceBlue and Dhan
 * stayed on legacy even with REACT_APP_USE_SDK_BROKER_FLOW=true.
 *
 * Fix: extract the routing into THIS component, render it from BOTH
 * ModalManager AND every inline-render site, with the `brokerName`
 * prop driving the legacy switch. Single source of truth — when the
 * dispatch rules change, this is the only file to edit.
 *
 * Routing rules (post 2026-04-29 reauth-via-initialValue):
 *   1. If REACT_APP_USE_SDK_BROKER_FLOW is on → ALL brokers (first-
 *      connect AND re-auth) go through Phase3SdkBrokerModal.
 *   2. Otherwise → legacy per-broker modal.
 *
 * Re-auth on the SDK route works through stored-creds pre-fill —
 * `Phase3SdkBrokerModal` fetches userDetails on mount, reads
 * `connected_brokers[broker]` via `getStoredBrokerCreds`, and feeds
 * `BrokerCredentialForm` a per-broker `schemaOverride` whose fields
 * carry `initialValue` (and for Kotak `transformValue`). On reconnect
 * the user sees apiKey + secretKey + clientCode + ucc + mobileNumber
 * pre-filled; on first-connect (no stored entry) every initialValue
 * resolves to '' and the form renders empty — same UX as today.
 *
 * Mirror of tidi_new `Phase3SdkConnectScreen._buildKotakSchemaOverride`
 * (commit 2d44fbf — Kotak smart-prefill + Groww silent refresh +
 * Fyers field inversion). The legacy pre-signed `authUrl` flow
 * (`reauthHelpers.handleSmartReauth`) is unused on the SDK lane —
 * SDK always mints a fresh login URL via `client.getBrokerLoginUrl`.
 * The legacy `reauthConfig` is still resolved by `ManageConnections
 * Modal` for the legacy lane (flag off), where modals like
 * UpstoxModal continue to consume `reauthConfig.authUrl` to skip the
 * form. SDK lane ignores it.
 *
 * What changed at 2026-04-29:
 *   - Dropped `SDK_ELIGIBLE_MODALS` allowlist + `SDK_LEGACY_FALLBACK`
 *     kill-switch. Per-broker SDK gating lived for ~2 days while we
 *     audited each broker; with the audit complete and
 *     `BrokerFormField.initialValue + transformValue` ported from
 *     Flutter to RN (mobile-SDK commit 64d4eff parity), the SDK route
 *     can host every broker's first-connect flow. tidi_new (Flutter)
 *     has been routing all 13 brokers through SDK since
 *     `bd1b501 feat(sdk-integration): Phase 3 — flag-gated SDK-primary
 *     broker connect for all 13 brokers`. Alphab2bapp now matches.
 *   - If a specific broker is broken in the RN SDK at any point, the
 *     fix is to fix the SDK widget — NOT to add it back to a per-app
 *     allowlist. The flag is the single switch.
 *
 * What changed at 2026-04-30 (regression fix):
 *   - Re-introduced `SDK_LEGACY_FALLBACK` Set BUT scoped to brokers
 *     whose audit verdict is SDK-broken with no near-term path through
 *     the SDK. Angel One is the canonical case: shared-mode advisors
 *     (default for every B2B tenant) need an empty-fields publisher-
 *     OAuth schema like Zerodha, but the SDK schema currently always
 *     renders the per-customer apiKey+secretKey+clientCode form (see
 *     Phase3SdkBrokerModal.js:264-268 "Tracked as Known Gap"). The
 *     "fix the SDK widget — not the allowlist" rule still applies, but
 *     it's not acceptable for the user-facing app to show the broken
 *     form for Angel One while the SDK widget is being fixed. The
 *     allowlist is the targeted, documented escape hatch — every entry
 *     gets a verdict + ETA reference in PHASE3_BROKER_AUDIT.md.
 *
 * See:
 *   docs/PHASE3_ARCHITECTURE.md § Routing rules
 *   docs/SDK_PARITY_AUDIT.md
 *   CLAUDE.md § Phase 3 SDK Broker Migration — BLOCKING DOCUMENTATION REQUIREMENT
 */

import React, {useState} from 'react';
import Config from 'react-native-config';
import {useConfig} from '../../context/ConfigContext';
import {getAccountEmailAsync} from '../../utils/accountEmail';
import {startAccountReconciliation} from '../../services/ModelPortfolioService';
import {verifyPersistedBrokerConnection} from '../../utils/brokerConnectionVerification';

// Legacy per-broker modals
import IIFLModal from '../iiflmodal';
import ICICIUPModal from './icicimodal';
import UpstoxModal from './upstoxModal';
import MotilalModal from './MotilalModal';
import ZerodhaConnectModal from './ZerodhaConnectModal';
import HDFCconnectModal from './HDFCconnectModal';
import DhanConnectModal from './DhanConnectModal';
import AliceBlueConnect from './AliceBlueConnect';
import FyersConnect from './FyersConnect';
import KotakModal from './KotakModal';
import GrowwConnectModal from './GrowwConnectModal';
import AxisConnectModal from './AxisConnectModal';
import ArihantConnectModal from './ArihantConnectModal';
import DefinEdgeConnectModal from './DefinEdgeConnectModal';

// SDK modal (all brokers when flag on, except re-auth)
import Phase3SdkBrokerModal from './Phase3SdkBrokerModal';
import DeviceTotpReconnectGate from './DeviceTotpReconnectGate';

// Angel One pre-connect cautionary-listing warning (rendered as an
// interstitial above whichever connect modal would normally show).
import AngelOneCautionaryWarning from './AngelOneCautionaryWarning';

// Brokers that ALWAYS route to the legacy modal even when
// REACT_APP_USE_SDK_BROKER_FLOW=true. Each entry MUST have a verdict
// row in docs/PHASE3_BROKER_AUDIT.md explaining why and a removal
// criterion. Keep this Set tiny — every entry is tech debt against the
// "single switch" intent above.
//
// 2026-04-30 added Angel One — SDK widget always rendered the
//   per-customer apiKey+secretKey+clientCode form; shared-mode
//   advisors (default) needed the empty-fields publisher-OAuth schema
//   like Zerodha, AND backend /exchange-token didn't yet handle
//   auth_token for shared mode.
//
// 2026-05-01 removed Angel One — both gaps closed:
//   - Backend `/sdk/v1/connections/Angel One/{login-url,exchange-token}`
//     learned shared-mode dispatch (commit `177ce21` + follow-ups).
//   - SDK form `BrokerFormSchema` `useSharedAngelOneKey` schema-override
//     pattern shipped (Flutter `_buildAngelOneSharedSchemaOverride`,
//     RN equivalent) so shared-mode advisors see empty fields and
//     hand off straight to OAuth.
//   - Backend `/login-url` now returns `callbackUrl` for brokers whose
//     vendor app has a fixed post-auth redirect (Angel One →
//     `prod.alphaquark.in/stock-recommendation`); SDK
//     `WebViewBrokerAuthFlow` (Flutter + RN) prefers it over the
//     consumer-passed redirectUrl for the matcher. Closes the
//     "WebView lands on AQ login page" issue user-reported on both
//     apps 2026-05-01.
//
// 2026-07-17 added Arihant Capital + DefinEdge Securities — CRASH FIX.
//   These two brokers were added to the display tile list + normalizeBrokerKey
//   (2026-06-09 web parity) with purpose-built legacy modals
//   (ArihantConnectModal 2-step OTP flow, DefinEdgeConnectModal credential
//   flow) but were NEVER added to the SDK's `BROKER_FORM_SCHEMAS` map
//   (mobile-sdk packages/rn/src/components/brokerFormSchema.ts — neither
//   broker is in the `BrokerName` union at all). With the flag on and this
//   Set empty, every broker routed to Phase3SdkBrokerModal, which mounts
//   `<BrokerCredentialForm broker={brokerName}>`; that widget's initial-state
//   seeding does `for (const f of baseSchema.fields)` where
//   `baseSchema = BROKER_FORM_SCHEMAS[broker]` — `undefined` for these two —
//   so the app crashed with a TypeError on the very first render
//   (BrokerCredentialForm.tsx:159), on every tap of "Connect Arihant Capital"
//   / "Connect DefinEdge Securities". Adding them here routes to their
//   legacy modals, which is correct and complete today.
//   RULE: any broker added to normalizeBrokerKey / the display tile list
//   MUST either get a BROKER_FORM_SCHEMAS entry in the SDK repo, or be
//   listed in this Set — otherwise the SDK lane crashes on an undefined
//   schema for that broker. See also the defensive guard added in
//   Phase3SdkBrokerModal.js the same day, which prevents this crash class
//   even if a future broker is forgotten here.
//
//   UPDATE (same day, 2026-07-17, later commit): the underlying gap is
//   now closed on the SDK side — `alphaquark-mobile-sdk` `develop` gained
//   a `BrokerFlowKind: "credentials_otp_two_step"` + `BROKER_FORM_SCHEMAS`
//   entries for both brokers (derived verbatim from these same legacy
//   modals + their paired `aq_backend_github` routes), plus the backend
//   picked up `POST /:broker/initiate-login` + `POST /:broker/resend-otp`
//   + a `PUT /:broker/connect` dispatch entry for both brokers
//   (`Routes/sdk/v1/connections.js`, `Ibt-branch`). `npm run build` (tsc)
//   + the full jest suite pass, and a Metro release-bundle build of THIS
//   app confirms the rebuilt `lib/` integrates cleanly (both schemas and
//   `initiateBrokerLogin` are present in the compiled bundle). What's
//   NOT done: a real-device test of either flow against a live Arihant /
//   DefinEdge account. Per the "fix the SDK widget — not the allowlist"
//   rule above, these two entries stay in this Set UNTIL that device
//   verification passes — flipping to the SDK lane at that point is a
//   one-line removal of `'Arihant Capital', 'DefinEdge Securities'` from
//   this Set, nothing else. Do not remove them speculatively.
//
// Otherwise the Set is intentionally kept small — keep it so future
// near-term gaps have a documented home rather than scattering fallback
// decisions across files.
// 2026-07-18: the SDK lane reached guidance parity IN THE HOST — the six
// stepper brokers (Kotak/Groww/Fyers/Upstox/HDFC/ICICI) briefly sat in this
// Set, but per the "fix the SDK widget — not the allowlist" rule above, the
// polish now lives in Phase3SdkBrokerModal itself: it renders the shared
// <BrokerGuideCard> (web-parity setup guide from brokerGuideConfigs.js —
// numbered steps, portal deep-link, walkthrough video, copyable redirect
// URL) above its existing EgressIpCallout, and the form phase adopted the
// v3 sibling-Pressable touch layout (fixes the erratic credential-form
// scrolling). So those six stay on the SDK lane.
//
// 2026-07-18 (later): Arihant Capital + DefinEdge Securities REMOVED — the
// full SDK stack for their `credentials_otp_two_step` flow is verified
// present end-to-end (compiled lib BROKER_FORM_SCHEMAS + BrokerCredentialForm
// creds→otp step machine + AqSdkClient.initiateBrokerLogin/resendOtp +
// backend /sdk/v1/connections routes live on tidi), and the host now carries
// their guide configs + EGRESS_BROKER_KEY/IP_WHITELIST_BROKERS entries.
// Device verification in progress; if either flow breaks on-device, re-add
// that broker here with a PHASE3_PROGRESS.md entry (its stepper-ized legacy
// modal remains fully functional as the rollback).
// IIFL is deliberately kept on its native OAuth route. The current SDK
// schema models IIFL as a credentials/TOTP form, while the live customer-owned
// flow collects an IIFL App Key/App Secret, obtains the broker login URL from
// Node, and exchanges authcode + clientid through Node so the App Secret never
// returns to app JavaScript. IIFLModal also owns the branded developer-portal
// guide, IPv6 whitelist gate and MongoDB persistence. This is a correctness
// fallback, not a UI regression. Remove this entry only together with an SDK
// direct-OAuth schema and matching secret-preserving backend exchange route.
const SDK_LEGACY_FALLBACK = new Set(['IIFL']);

const isSdkBrokerFlowEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_BROKER_FLOW || '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
};

// Normalize the broker key — ModalManager uses 'ICICI', 'HDFC',
// 'Motilal', 'IIFL'; some inline-render sites use 'ICICIDirect',
// 'Hdfc', 'IIFLSecurities', etc. Normalize so the dispatch matches
// regardless of caller.
const normalizeBrokerKey = (raw) => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed === 'ICICI Direct') return 'ICICI';
  if (trimmed === 'Hdfc Securities' || trimmed === 'HDFC Securities')
    return 'HDFC';
  if (trimmed === 'Motilal Oswal') return 'Motilal';
  if (trimmed === 'IIFL Securities') return 'IIFL';
  if (trimmed === 'Aliceblue') return 'AliceBlue';
  if (trimmed === 'AngleOne') return 'Angel One';
  // New (2026-06-09 web parity). Mobile display tile keys are
  // 'Arihant Capital' and 'DefinEdge Securities' to match the
  // user_broker / connected_brokers slot names the backend uses.
  if (trimmed === 'DefinEdge' || trimmed === 'Definedge') return 'DefinEdge Securities';
  if (trimmed === 'Arihant') return 'Arihant Capital';
  return trimmed;
};

// Modal keys retain a few historical short names; ccxt account identity uses
// the persisted user_broker spelling.
const canonicalBrokerName = key => ({
  ICICI: 'ICICI Direct',
  HDFC: 'Hdfc Securities',
  Motilal: 'Motilal Oswal',
  IIFL: 'IIFL Securities',
}[key] || key);

const BrokerConnectModalDispatch = ({
  brokerName,
  isVisible,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
  ...rest
}) => {
  const runtimeConfig = useConfig();
  if (!isVisible) return null;

  const key = normalizeBrokerKey(brokerName);
  // DefineEdge first-connect is SDK-backed. Before device credential
  // protection existed, re-auth used the dedicated OTP modal so it could
  // initiate with encrypted credentials stored on the account. When device
  // TOTP is disabled we retain that SDK behavior; when enabled the native
  // secureTotpHostFlow below owns DefinEdge reconnect and generates the TOTP
  // from the phone vault. Broker API credentials remain server-side.
  const defineEdgeReauth =
    key === 'DefinEdge Securities' &&
    reauthConfig?.definedgeStoredCredentials === true &&
    runtimeConfig?.deviceTotpEnabled !== true;
  // Angel One is per-customer only. Its legacy sheet (AngleoneBookingModal)
  // signs every customer into a platform-shared SmartAPI app, so it must never
  // be dispatched — including as the device-TOTP gate's full-login fallback.
  // Until 2026-09-29 `angelOnePerCustomer && !secureTotpHostFlow` let
  // device-TOTP tenants fall back to that shared-key sheet; Angel One now
  // always resolves to the per-customer SDK modal, which the gate wraps.
  const angelOnePerCustomer = key === 'Angel One';
  // Device-keystore TOTP needs native biometric callbacks owned by the host
  // app. Until the SDK exposes that host callback contract, route only the
  // reusable-seed brokers through their fully equivalent native sheets when
  // the advisor enables device TOTP. Upstox is included because its native
  // sheet owns the Firebase-bound direct PIN+TOTP reconnect path; normal
  // OAuth remains the fallback.
  const secureTotpHostFlow =
    runtimeConfig?.deviceTotpEnabled === true &&
    (key === 'Kotak' ||
      key === 'Groww' ||
      key === 'Upstox' ||
      key === 'Dhan' ||
      key === 'Angel One' ||
      key === 'Motilal' ||
      key === 'Zerodha' ||
      key === 'Fyers' ||
      key === 'DefinEdge Securities' ||
      key === 'Arihant Capital');
  // AliceBlue stays on the same partner OAuth product in both modes. When the
  // shared device-TOTP feature is enabled, route it to the native modal so the
  // customer can choose between phone-protected WebView assistance and the
  // unchanged manual partner login. Keep the older AliceBlue-only flag as a
  // backwards-compatible alias for advisors that enabled it before the flows
  // were consolidated under deviceTotpEnabled.
  const secureAliceBlueHostFlow =
    (runtimeConfig?.deviceTotpEnabled === true ||
      runtimeConfig?.aliceBlueDeviceLoginEnabled === true) &&
    key === 'AliceBlue';
  const refreshAndReconcile = async (...args) => {
    const email = await getAccountEmailAsync();
    // Refresh host state FIRST, then verify. Order matters: the legacy lane
    // calls setShowBrokerModal(false) + onClose() *before* invoking this and
    // swallows our throw (see BROKER_CONNECTION.md § Broker-connect
    // post-success hygiene). Verifying first would mean a failed verification
    // skipped the TradeContext refresh entirely while the sheet was already
    // gone, stranding the app on pre-connect state. Refreshing first keeps
    // that lane no worse than before while the throw below still suppresses
    // its "Connected Successfully" toast.
    const result = await fetchBrokerStatusModal?.(...args);

    let verifiedUser = null;
    let verificationError = null;
    try {
      verifiedUser = await verifyPersistedBrokerConnection({
        broker: canonicalBrokerName(key),
        userEmail: email,
        configData: runtimeConfig,
      });
    } catch (error) {
      verificationError = error;
    }

    // Reconcile unless verification positively CONTRADICTED the connect.
    // verifiedUser === null means we could not read the record at all, which
    // is not evidence of a bad save — treat it like the pre-gate behaviour and
    // still enqueue. Only a contradiction (verificationError) suppresses it,
    // because reconciling an unsaved selection would bind the account to the
    // wrong broker. Do not hold the successful-connect UI open: the endpoint
    // queues server work, while Calculate independently enforces the same
    // account barrier.
    if (!verificationError) {
      Promise.resolve(email)
        .then(accountEmail => {
          if (!accountEmail || !key) {
            return null;
          }
          return startAccountReconciliation(
            accountEmail,
            canonicalBrokerName(key),
            runtimeConfig,
          );
        })
        .catch(error => {
          console.warn(
            '[BrokerConnect] account reconciliation enqueue failed:',
            error?.message,
          );
        });
    }

    if (verificationError) {
      throw verificationError;
    }
    return {...(result || {}), verifiedUser};
  };
  const commonProps = {
    isVisible: true,
    onClose,
    setShowBrokerModal,
    fetchBrokerStatusModal: refreshAndReconcile,
    reauthConfig: reauthConfig || null,
    ...rest,
  };

  // Resolve which connect modal would normally show for this broker
  // (SDK lane vs legacy lane). Wrap Angel One specifically with the
  // pre-connect cautionary-listing warning sheet — fresh connects
  // see it once, re-auth (`reauthConfig` non-null) skips it.
  let modal;
  if (
    angelOnePerCustomer ||
    defineEdgeReauth ||
    (isSdkBrokerFlowEnabled() &&
      !secureTotpHostFlow &&
      !secureAliceBlueHostFlow &&
      !SDK_LEGACY_FALLBACK.has(key))
  ) {
    modal = defineEdgeReauth
      ? renderLegacyModal(key, commonProps)
      : <Phase3SdkBrokerModal {...commonProps} brokerName={key} />;
  } else {
    modal = renderLegacyModal(key, commonProps);
  }

  if (
    secureTotpHostFlow &&
    (key === 'Angel One' || key === 'Motilal' || key === 'Zerodha' || key === 'Fyers')
  ) {
    modal = (
      <DeviceTotpReconnectGate
        {...commonProps}
        brokerName={canonicalBrokerName(key)}
        fallback={modal}
      />
    );
  }

  return modal;
};

const renderLegacyModal = (key, commonProps) => {
  switch (key) {
    case 'ICICI':
      return <ICICIUPModal {...commonProps} />;
    case 'Upstox':
      return <UpstoxModal {...commonProps} />;
    case 'Motilal':
      return <MotilalModal {...commonProps} />;
    case 'Zerodha':
      return <ZerodhaConnectModal {...commonProps} />;
    case 'HDFC':
      return <HDFCconnectModal {...commonProps} />;
    case 'Dhan':
      return <DhanConnectModal {...commonProps} />;
    case 'AliceBlue':
      return <AliceBlueConnect {...commonProps} />;
    case 'Fyers':
      return <FyersConnect {...commonProps} />;
    case 'Kotak':
      return <KotakModal {...commonProps} />;
    case 'Groww':
      return <GrowwConnectModal {...commonProps} />;
    case 'Axis Securities':
      return <AxisConnectModal {...commonProps} />;
    case 'IIFL':
      return <IIFLModal {...commonProps} />;
    case 'Arihant Capital':
      return <ArihantConnectModal {...commonProps} />;
    case 'DefinEdge Securities':
      return <DefinEdgeConnectModal {...commonProps} />;
    default:
      return null;
  }
};

export default BrokerConnectModalDispatch;
export { normalizeBrokerKey };
