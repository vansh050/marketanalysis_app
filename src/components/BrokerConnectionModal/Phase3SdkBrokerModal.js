/**
 * Phase3SdkBrokerModal — opt-in SDK-primary broker connect entry.
 *
 * Replaces the per-broker legacy modals (AliceBlueConnect,
 * DhanConnectModal, KotakModal, ZerodhaConnectModal, etc.) when
 * `REACT_APP_USE_SDK_BROKER_FLOW=true` in `.env`. Mounted from
 * `ModalManager.js` behind the same flag, so flipping it to false
 * reverts to the legacy flow with no other change.
 *
 * Mirror of `tidi_new`'s Phase3SdkConnectScreen (Flutter). Same
 * design rationale and same per-broker expectations — see
 * tidi_new/tidistockmobileapp/lib/components/home/portfolio/
 * Phase3SdkConnectScreen.dart for the long-form docstring.
 *
 * What this modal does, per broker flow kind from the SDK schema
 * (`@alphaquark/mobile-sdk` brokerFormSchema.ts):
 *
 *   - flow == credentials | credentials_totp:
 *       Renders <BrokerCredentialForm> with the SDK schema fields.
 *       On submit the form calls `client.connectBroker` (Dhan,
 *       AliceBlue, Groww-creds — submitEndpoint=connect) or
 *       `client.updateBrokerCredentials` (Kotak, IIFL, Angel One
 *       post-2026-04-28 — submitEndpoint=update-credentials). Backend
 *       routes /connect and /update-credentials proxy through to
 *       legacy validate-and-persist endpoints (aq_backend_github
 *       commits 0e2ef25 + 6f25766) so credentials are validated via
 *       ccxt before persistence.
 *
 *   - flow == oauth:
 *       Renders <BrokerCredentialForm> first to collect any
 *       apiKey/secretKey/clientCode the broker dev portal requires
 *       for the OAuth round-trip. Zerodha is empty-fields so the
 *       form auto-skips to onContinueToOauth with `{}`. The form's
 *       onContinueToOauth callback hands off to
 *       <WebViewBrokerAuthFlow> which:
 *         1. POSTs collected apiKey/secret to
 *            /sdk/v1/connections/:broker/login-url to get the OAuth URL.
 *         2. Opens a WebView at that URL.
 *         3. Captures the redirect-URL navigation matching
 *            `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from `.env`.
 *         4. POSTs the captured query params + extraExchangeBody to
 *            /sdk/v1/connections/:broker/exchange-token.
 *         5. Returns BrokerExchangeResult.
 *       On success → fetchBrokerStatusModal() then onClose. On error
 *       → reset to form with the error inline.
 *
 *   - flow == stub (DummyBroker):
 *       The form auto-succeeds without persistence.
 *
 * KNOWN GAP — useSharedAngelOneKey dual-mode:
 *   When `config.useSharedAngelOneKey === true` (per-advisor backend
 *   config), Angel One uses platform-shared OAuth via ccxt
 *   /angelone/login-url with the env REACT_APP_ANGEL_ONE_API_KEY.
 *   The SDK route family doesn't yet expose a shared-key path —
 *   shared-key advisors should disable Phase 3 Angel One until
 *   /sdk/v1/connections/Angel%20One/login-url has shared-mode
 *   awareness. Tracked separately. Per-customer mode (the new flow
 *   from prod-alphaquark-github 0202f27c) works through this modal.
 *
 * SUCCESS CONTRACT — onSuccess calls fetchBrokerStatusModal (existing
 * pattern from every legacy modal) which refreshes the connected-
 * brokers list and updates the user's UI. Then onClose dismisses
 * the modal. Identical visible behaviour to the legacy modals.
 */

import React, {useState, useMemo, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, ActivityIndicator} from 'react-native';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';
import {
  BrokerCredentialForm,
  WebViewBrokerAuthFlow,
} from '@alphaquark/mobile-sdk';
import {useTrade} from '../../screens/TradeContext';
import EgressIpCallout from './EgressIpCallout';
import Phase3BrokerHelp from './Phase3BrokerHelp';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import {getStoredBrokerCreds} from '../../utils/brokerCredentials';
import {humanizeSdkError} from '../../utils/sdkErrorHumanize';

// Brokers that the broker's API requires to call from a whitelisted
// static IP. Same set EgressIpCallout's internal dispatch uses, but
// duplicated here so we can decide whether to GATE the SDK form
// (block submit until the user claims an IP and acknowledges).
//
// Audit derived (docs/BROKER_FLOW_AUDIT.md § Cross-cutting findings #2):
// every legacy modal that gates on `egressReady` belongs in this set.
// Per audit:
//   - Kotak (KotakModal:108-109)
//   - Groww (GrowwConnectModal:110)
//   - AliceBlue: legacy DOES NOT gate; kept because Phase 3 historically
//     did. Verify against AliceBlueConnect.js — if no egressReady gate
//     in legacy, remove from this set during AliceBlue migration.
//   - ICICI / ICICI Direct (icicimodal.js:264-265)
//   - HDFC (HDFCconnectModal:303 — egressReady gate)
//   - Upstox (upstoxModal.js:130 — egressReady gate)
//   - Fyers (FyersConnect.js — egressReady gate)
//   - Motilal Oswal (MotilalModal.js:120 — egressReady gate)
// AliceBlue removed 2026-04-29 — legacy AliceBlueConnect.js opens the
// OAuth WebView immediately with no IP gate. Adding it here introduced
// a friction step the legacy never had. User reported "should directly
// take to oauth - instructions etc not relevant".
const IP_WHITELIST_BROKERS = new Set([
  'Kotak',
  'Groww',
  'ICICI',
  'ICICI Direct',
  'HDFC',
  'Hdfc Securities',
  'Upstox',
  'Motilal Oswal',
  'Fyers',
]);

// EgressIpCallout expects the lowercase backend broker_key (the same
// key the legacy *ConnectUI callers pass: "icicidirect", "hdfcsec",
// "motilaloswal", …) and short-circuits to brokerState="partner"
// (renders nothing) for anything not in its WHITELIST_BROKERS set.
// This modal's `brokerName` is the DISPLAY name ("ICICI Direct"), which
// lowercases to "icici direct" (with a space) — NOT in the set — so the
// IP panel silently disappeared for the multi-word brokers (ICICI Direct,
// Hdfc Securities, Motilal Oswal). bug-81: user reported "I can't see the
// IP field for ICICI" while the instructions still referenced the
// missing "IP-whitelist panel above". Single-word brokers (Upstox/Fyers/
// Kotak/Groww) lowercased to the right key by accident, masking the bug.
// Map every IP broker explicitly so the callout resolves correctly.
const EGRESS_BROKER_KEY = {
  Upstox: 'upstox',
  Fyers: 'fyers',
  Kotak: 'kotak',
  Groww: 'groww',
  ICICI: 'icicidirect',
  'ICICI Direct': 'icicidirect',
  HDFC: 'hdfcsec',
  'Hdfc Securities': 'hdfcsec',
  'Motilal Oswal': 'motilaloswal',
  'Angel One': 'angelone',
  'IIFL Securities': 'iifl',
};

const REDIRECT_URL =
  Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
  'https://prod.alphaquark.in/stock-recommendation';

/**
 * Encrypt a credential field with the same `ApiKeySecret` envelope
 * every legacy modal uses (KotakModal:46, MotilalModal:50, etc.). The
 * legacy backend `/api/<broker>/update-key` and `/api/user/connect-
 * broker` both decrypt with the same passphrase, so the SDK proxy
 * forwards the same blob to either path.
 */
const encryptField = async (_fieldName, raw) =>
  CryptoJS.AES.encrypt(raw, 'ApiKeySecret').toString();

/**
 * Normalise a Kotak mobile number into the canonical `+919876543210`
 * shape regardless of how the user typed/pasted it. Used as the SDK
 * field's `transformValue` — applied on every keystroke + paste so the
 * SAME canonical value is what the user sees, what gets validated
 * against the strict `^\+91\d{10}$` regex, and what gets submitted.
 *
 * Idempotent: `f(f(x)) === f(x)` per the SDK's contract for
 * transformValue.
 *
 * Mirror of tidi_new `_normaliseKotakMobile`
 * (Phase3SdkConnectScreen.dart) and Alphab2bapp legacy KotakModal's
 * mobile normalisation (KotakModal.js:171-196). Returns the raw input
 * unchanged when it can't be reduced to 10 digits, so the strict
 * pattern still rejects malformed values with the existing
 * patternError.
 */
const normaliseKotakMobile = (input) => {
  if (typeof input !== 'string') return '';
  const digits = input.replace(/\D/g, '');
  let tenDigits;
  if (/^91\d{10}$/.test(digits)) {
    tenDigits = digits.slice(2);
  } else if (/^0\d{10}$/.test(digits)) {
    tenDigits = digits.slice(1);
  } else if (/^\d{10}$/.test(digits)) {
    tenDigits = digits;
  } else {
    return input;
  }
  return `+91${tenDigits}`;
};

/**
 * Brokers whose Phase 3 SDK schema is `flow: "oauth"`. On re-auth we
 * skip rendering BrokerCredentialForm entirely and jump straight to
 * WebViewBrokerAuthFlow with stored creds as `extraExchangeBody`. This
 * matches legacy modal behaviour (UpstoxModal:417-432, MotilalModal:
 * 318-325, FyersConnect:343-355, HDFCconnectModal:291-300, icicimodal:
 * 99-110) where `reauthConfig.authUrl` short-circuited the form so the
 * user landed straight on the broker's login page (often only needing
 * a TOTP since cookies persist). Angel One is excluded because it's in
 * SDK_LEGACY_FALLBACK in BrokerConnectModalDispatch (shared-mode is the
 * default and the SDK doesn't yet do shared-key OAuth) — the legacy
 * AngleOneBookingTrueSheet is what runs for Angel One reauth today.
 */
const OAUTH_REAUTH_AUTOJUMP_BROKERS = new Set([
  'Zerodha',
  'Upstox',
  'ICICI Direct',
  'Hdfc Securities',
  'Motilal Oswal',
  'Fyers',
  'Dhan',
  'AliceBlue',
  'Axis Securities',
]);

/**
 * Build the `extraExchangeBody` for an OAuth-flow re-auth from stored
 * credentials. The SDK's WebViewBrokerAuthFlow forwards this to
 * /sdk/v1/connections/:broker/login-url so the backend can mint a
 * fresh OAuth URL using the user's saved apiKey + secretKey instead of
 * asking them to re-paste. Empty-fields brokers (Dhan, AliceBlue, Axis
 * Securities) need no extras — backend ignores irrelevant fields.
 * Zerodha is empty-fields too but seeds apiKey from env because ccxt-
 * india's gen-access-token requires it alongside requestToken.
 */
const buildOauthReauthExtras = (brokerName, stored, configData) => {
  const extras = {};
  // CryptoJS.AES.encrypt with the same 'ApiKeySecret' passphrase the
  // legacy modals + SDK form's `encryptField` use. Backend
  // /sdk/v1/connections/<broker>/login-url proxies these extras to
  // /api/<broker>/update-key which calls checkValidApiAnSecret to
  // decrypt — sending plaintext makes the decrypt return garbage and
  // ccxt's downstream call hangs (25s timeout, "unexpected error" UX).
  // Mirrors `encryptField` above (line ~129) — kept inline because this
  // helper is used outside the React component scope.
  const enc = (raw) =>
    raw ? CryptoJS.AES.encrypt(raw, 'ApiKeySecret').toString() : '';

  if (brokerName === 'Zerodha') {
    // Zerodha apiKey is the platform's broker-public dev-portal key —
    // sent plaintext as a query string param to kite.zerodha.com/connect
    // /login. Backend /sdk/v1/connections/Zerodha/login-url builds the
    // URL directly without calling /update-key, so no decrypt step on
    // this path. Pass through unencrypted.
    extras.apiKey =
      Config?.REACT_APP_ZERODHA_API_KEY ||
      configData?.config?.REACT_APP_ZERODHA_API_KEY ||
      '';
    return extras;
  }
  if (
    brokerName === 'Dhan' ||
    brokerName === 'AliceBlue' ||
    brokerName === 'Axis Securities'
  ) {
    // Partner-OAuth — backend uses platform-level partner ID/appcode
    // from env / config; no per-user creds to forward.
    return {};
  }
  if (!stored) return {};
  if (brokerName === 'Fyers') {
    // Fyers field-naming inversion. Backend Fyers /update-key reads:
    //   data.clientCode      → plaintext App ID (clientId)
    //   data.secretKey       → AES-encrypted OAuth secret (decrypted)
    // Mobile-side `getStoredBrokerCreds` returns:
    //   stored.apiKey        → DECRYPTED OAuth secret (was DB secretKey)
    //   stored.clientCode    → plaintext App ID
    // So the autojump must put the (re-encrypted) OAuth secret back
    // into `extras.secretKey` (NOT extras.apiKey — that's where the
    // form path puts it for UI display only; the backend uses the
    // legacy DB-side names). Mirror of FyersConnect.js:343-355 reauth.
    if (stored.apiKey) extras.secretKey = enc(stored.apiKey);
    if (stored.clientCode) extras.clientCode = stored.clientCode;
    return extras;
  }
  // Upstox / ICICI Direct / Hdfc Securities / Motilal Oswal: apiKey +
  // (secretKey | clientCode). Backend /update-key decrypts apiKey and
  // (for Upstox/ICICI/HDFC) secretKey via checkValidApiAnSecret —
  // re-encrypt both with the same envelope. clientCode (Motilal) is
  // plaintext pass-through.
  if (stored.apiKey) extras.apiKey = enc(stored.apiKey);
  if (stored.secretKey) extras.secretKey = enc(stored.secretKey);
  if (stored.clientCode) extras.clientCode = stored.clientCode;
  return extras;
};

/**
 * Build a per-broker schema override carrying `initialValue` (and for
 * Kotak `transformValue`) from stored creds. Mirror of tidi_new
 * `_buildKotakSchemaOverride` / `_buildAngelOneSharedSchemaOverride`
 * (Phase3SdkConnectScreen.dart) — when the user reconnects a broker
 * we pre-fill the stable fields from `connected_brokers[broker]` so
 * they don't re-paste apiKey + secretKey + clientCode every session.
 *
 * First-connect (no stored entry): stored is null, every initialValue
 * resolves to '' and the SDK's `useState` initialiser leaves the
 * controllers empty — same UX as today.
 *
 * Re-auth + credentials_totp (Kotak): in addition to pre-filling we
 * mark stable fields with `hideFromUi: true` so only the dynamic
 * mpin + totp render. Mirror of legacy reauthConfig path which only
 * showed the WebView (for OAuth) — for Kotak the dynamic fields can't
 * be skipped (mpin = PIN, totp rotates 30s) so the closest equivalent
 * is "show only the unavoidable fields". `hideFromUi` keeps the
 * stored value flowing into buildBody but drops the row from render.
 *
 * What we deliberately DO NOT pre-fill, per legacy Kotak (KotakModal:
 * 56-69):
 *   - mpin: backend never persists it (security: personal PIN). User
 *     must type every reconnect.
 *   - totp: rotates every 30s, pre-fill would always be stale.
 *
 * Per-broker mapping mirrors `getStoredBrokerCreds` shape in
 * `src/utils/brokerCredentials.js` (which itself mirrors the legacy
 * modals' field-naming inversions, e.g. Fyers).
 *
 * Returns `null` for OAuth-only brokers (Zerodha, Dhan, AliceBlue,
 * Axis Securities) — no fields to override; SDK uses the default
 * empty-fields schema.
 */
const buildSchemaOverride = (brokerName, userDetails) => {
  if (!userDetails) return null;
  const stored = getStoredBrokerCreds(userDetails, brokerName);

  // OAuth-only brokers — empty fields schema, nothing to pre-fill.
  if (
    brokerName === 'Zerodha' ||
    brokerName === 'Dhan' ||
    brokerName === 'AliceBlue' ||
    brokerName === 'Axis Securities'
  ) {
    return null;
  }

  // Kotak NEO — 5 fields, 3 pre-fillable (apiKey, ucc, mobileNumber).
  // Mobile sourced from userDetails.phone_number (top-level user doc),
  // not connected_brokers — same as legacy KotakModal:90.
  //
  // On re-auth (stored entry present) the 3 stable fields are also
  // marked `hideFromUi: true` so the user sees ONLY mpin + totp — the
  // two fields that genuinely can't be persisted (mpin is a PIN, totp
  // rotates 30s). Stored values still flow into the submit body via
  // BrokerCredentialForm.buildBody (which iterates schema.fields, not
  // the rendered set). This matches the user-stated expectation that
  // "kotak re-auth should ask only mpin/totp" — same idea as legacy
  // OAuth brokers' reauthConfig.authUrl skipping the form entirely,
  // adapted for a credentials_totp broker where mpin/totp are
  // unavoidable user input.
  if (brokerName === 'Kotak') {
    const mobileSource = userDetails.phone_number || '';
    const normalisedMobile = normaliseKotakMobile(mobileSource);
    const isReauth = !!stored;
    const hasMobile = /^\+91\d{10}$/.test(normalisedMobile);
    // CRITICAL: SDK form merges schema via shallow `{...base, ...override}`,
    // so override.fields REPLACES base.fields (does NOT merge by name).
    // Every field that should render in re-auth MUST appear here, even
    // ones we just want to pass through unchanged. Omitting mpin / totp
    // here drops them from `schema.fields` and they never render —
    // user sees only mobileNumber and can't submit (2026-05-01 user-
    // reported regression on testaccount@gmail.com Kotak re-auth: form
    // showed mobileNumber-only with no MPIN / TOTP inputs because
    // `hasMobile` evaluated false for an unnormalised phone_number).
    const overrideFields = [
      {
        name: 'apiKey',
        initialValue: stored?.apiKey || '',
        hideFromUi: isReauth && !!stored?.apiKey,
      },
      {
        name: 'mobileNumber',
        initialValue: hasMobile ? normalisedMobile : '',
        transformValue: normaliseKotakMobile,
        hideFromUi: isReauth && hasMobile,
      },
      // mpin: never pre-filled (security — backend never persists it),
      // never hidden. Re-typed every reconnect.
      {name: 'mpin'},
      {
        name: 'ucc',
        initialValue: stored?.ucc || '',
        hideFromUi: isReauth && !!stored?.ucc,
      },
      // totp: never pre-filled (rotates every 30s), never hidden.
      {name: 'totp'},
    ];
    if (isReauth) {
      // Re-auth UX: drop the first-connect onboarding text (intro +
      // prerequisites) since the user already completed all that
      // setup. Replace with a brief one-liner so the user has a
      // single sentence of context. The user's stored apiKey + ucc +
      // mobileNumber are passed through invisibly via initialValue;
      // they only need to type MPIN + TOTP.
      return {
        fields: overrideFields,
        intro: 'Enter your MPIN and a fresh TOTP from your authenticator app to reconnect.',
        prerequisites: [],
        submitLabel: 'Reconnect Kotak',
      };
    }
    return {fields: overrideFields};
  }

  // Groww — 2 fields, both pre-fillable when reconnecting.
  // `getStoredBrokerCreds` returns {apiKey, totpToken}; SDK schema
  // field name is `growwTotpSeed`.
  if (brokerName === 'Groww') {
    return {
      fields: [
        {name: 'apiKey', initialValue: stored?.apiKey || ''},
        {name: 'growwTotpSeed', initialValue: stored?.totpToken || ''},
      ],
    };
  }

  // Motilal Oswal — 2 fields: apiKey + clientCode.
  if (brokerName === 'Motilal Oswal') {
    return {
      fields: [
        {name: 'apiKey', initialValue: stored?.apiKey || ''},
        {name: 'clientCode', initialValue: stored?.clientCode || ''},
      ],
    };
  }

  // Fyers — apiKey + secretKey + clientCode. Note `getStoredBrokerCreds`
  // already inverts Fyers' DB naming (DB.secretKey → modal.apiKey,
  // DB.clientCode → modal.secretKey + modal.clientCode); see
  // brokerCredentials.js:46-53. We pass through what it returns.
  if (brokerName === 'Fyers') {
    return {
      fields: [
        {name: 'apiKey', initialValue: stored?.apiKey || ''},
        {name: 'secretKey', initialValue: stored?.secretKey || ''},
        {name: 'clientCode', initialValue: stored?.clientCode || ''},
      ],
    };
  }

  if (brokerName === 'Angel One') {
    const sharedKey = Config?.REACT_APP_ANGEL_ONE_API_KEY;
    if (sharedKey) {
      return { fields: [], prerequisites: [], intro: null };
    }
    return {
      fields: [
        {name: 'apiKey', initialValue: stored?.apiKey || ''},
        {name: 'secretKey', initialValue: stored?.secretKey || ''},
        {name: 'clientCode', initialValue: stored?.clientCode || ''},
      ],
    };
  }

  // Default credential brokers — Upstox, ICICI Direct, Hdfc Securities.
  // Two fields: apiKey + secretKey.
  if (
    brokerName === 'Upstox' ||
    brokerName === 'ICICI Direct' ||
    brokerName === 'Hdfc Securities'
  ) {
    return {
      fields: [
        {name: 'apiKey', initialValue: stored?.apiKey || ''},
        {name: 'secretKey', initialValue: stored?.secretKey || ''},
      ],
    };
  }

  // IIFL Securities — currently routed legacy by upstream audit
  // (schema mismatch). If ever promoted, override apiKey + clientCode +
  // password + dob here. For now no-op — SDK default schema is used,
  // first-connect form is what renders.

  return null;
};

/**
 * Map the visibleModal string from Zustand store → BrokerName wire-name
 * the SDK accepts. The legacy ModalManager keys ("ICICI", "HDFC",
 * "Angel One", "Axis Securities", "IIFL"/"IIFL Securities") don't all
 * line up with the SDK's BrokerName enum values (all 14 wire-names
 * match exactly per brokerFormSchema.ts). Translate explicitly so a
 * future rename on either side doesn't silently break this modal.
 */
function visibleModalToBrokerName(visibleModal) {
  switch (visibleModal) {
    case 'ICICI':
      return 'ICICI Direct';
    case 'HDFC':
      return 'Hdfc Securities';
    case 'Motilal':
      return 'Motilal Oswal';
    case 'IIFL':
      return 'IIFL Securities';
    // The rest are wire-name-identical: Zerodha, Upstox, Fyers,
    // Kotak, Dhan, AliceBlue, Groww, Angel One, Axis Securities,
    // IIFL Securities, DummyBroker.
    default:
      return visibleModal;
  }
}

const Phase3SdkBrokerModal = ({
  isVisible,
  onClose,
  brokerName: brokerNameProp,
  // ModalManager passes these via commonProps
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData, userEmail: emailFromCtx} = useTrade();
  const [oauthExtraBody, setOauthExtraBody] = useState(null);
  // errorInfo is a structured shape `{title, body, technical}` produced by
  // `humanizeSdkError`. Previously this was a flat string built from the
  // wrong `SdkError` fields (`code` / `httpStatus` — neither exists on the
  // SDK type, which uses `error` / `detail` / `httpStatus`). The bug caused
  // every SDK error to render as the literal `sdk_error: <detail>` for every
  // broker. Now the modal renders a user-readable title + body + a small
  // `technical` breadcrumb caption for support diagnostics.
  const [errorInfo, setErrorInfo] = useState(null);

  const brokerName = useMemo(
    () => visibleModalToBrokerName(brokerNameProp || ''),
    [brokerNameProp],
  );

  // Smart-prefill: fetch userDetails once on mount; build a per-broker
  // schemaOverride that pre-fills `initialValue` on stable fields. On
  // reconnect this skips re-typing apiKey/secretKey/clientCode/etc; on
  // first-connect (no stored entry) every initialValue resolves to ''
  // so the form renders empty — same UX as before.
  //
  // We gate the form's pointer events on `schemaOverridePending` only
  // when the broker has an override builder; OAuth-only brokers
  // (Zerodha, Dhan, AliceBlue, Axis Securities) skip the gate entirely
  // because their schemaOverride is null and there's nothing to wait
  // for. Mirror of tidi_new `_brokerNeedsSchemaOverride` gate (Phase3
  // SdkConnectScreen.dart:186).
  const [userDetails, setUserDetails] = useState(null);
  const [schemaOverride, setSchemaOverride] = useState(null);
  const [schemaOverridePending, setSchemaOverridePending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!emailFromCtx) {
      // No email yet — bail. The form will render with the SDK's
      // default schema (no pre-fill). Common during early auth flow.
      setSchemaOverridePending(false);
      return () => {
        cancelled = true;
      };
    }
    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain':
        configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${emailFromCtx}`, {
        headers,
      })
      .then((res) => {
        if (cancelled) return;
        const u = res?.data?.User || null;
        setUserDetails(u);
        setSchemaOverride(buildSchemaOverride(brokerName, u));
        setSchemaOverridePending(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(
          '[Phase3SdkBrokerModal] userDetails fetch failed (no pre-fill):',
          err?.message,
        );
        // Fall through with no override — form renders empty. Don't
        // block the user on a non-fatal pre-fill failure.
        setSchemaOverridePending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [emailFromCtx, brokerName, configData]);

  // Re-auth direct-to-OAuth jump. Once userDetails resolves, if the user
  // already has a connected_brokers entry for this broker AND the broker
  // is OAuth-flow (Zerodha/Upstox/ICICI Direct/Hdfc Securities/Motilal
  // Oswal/Fyers/Dhan/AliceBlue/Axis Securities), bypass the credential
  // form and hand stored apiKey + secretKey directly to
  // WebViewBrokerAuthFlow as `extraExchangeBody`. The SDK's /login-url
  // route mints a fresh OAuth URL from those creds, the WebView opens
  // the broker's login page, and the user is usually one TOTP / one tap
  // away from done — exactly the legacy `reauthConfig.authUrl` UX.
  //
  // Single-fire — `reauthJumpFiredRef` so a userDetails refresh during
  // the WebView phase doesn't re-jump and lose the user's progress.
  // The form path remains for first-connect (no stored entry) and for
  // credentials / credentials_totp brokers (Kotak / Groww / IIFL) which
  // need user input every time.
  const reauthJumpFiredRef = useRef(false);
  useEffect(() => {
    if (schemaOverridePending) return;
    if (reauthJumpFiredRef.current) return;
    if (oauthExtraBody) return; // already in OAuth phase
    if (errorInfo) return; // user is reading an error; don't yank them
    if (!OAUTH_REAUTH_AUTOJUMP_BROKERS.has(brokerName)) return;
    const stored = getStoredBrokerCreds(userDetails, brokerName);
    if (!stored) return;
    // Treat any non-empty entry as re-auth. brokerCredentials returns
    // null when connected_brokers[broker] doesn't exist, so a present
    // result means the user has connected this broker before.
    reauthJumpFiredRef.current = true;
    const extras = buildOauthReauthExtras(brokerName, stored, configData);
    setOauthExtraBody(extras);
  }, [
    schemaOverridePending,
    userDetails,
    brokerName,
    configData,
    oauthExtraBody,
    errorInfo,
  ]);

  // IP-whitelist gate state. EgressIpCallout fires
  // onAcknowledgeChange(true) only when (a) the broker doesn't need
  // a dedicated IP at all (callout is a no-op and self-acks) OR
  // (b) the user has claimed an IP and ticked the acknowledgment.
  // We block the SDK form submit (via IgnorePointer + opacity) until
  // ready. Mirror of legacy modals' egressReady gate.
  const [egressReady, setEgressReady] = useState(
    !IP_WHITELIST_BROKERS.has(brokerName),
  );

  // When the user interacts with the still-locked form, flash the
  // EgressIpCallout acknowledgment checkbox (showUnmetAck) and scroll
  // back up to it. Replaces the old behaviour where the form was just
  // dimmed to opacity 0.45 with no explanation — users reported the
  // screen looked like it had a "white transparent layer" with no clue
  // that the IP-whitelist checkbox above was the thing blocking them.
  const [unmetAck, setUnmetAck] = useState(false);
  const scrollRef = useRef(null);
  const nudgeEgressAck = () => {
    setUnmetAck(true);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  };

  if (!isVisible) return null;

  const onSuccess = async () => {
    try {
      await fetchBrokerStatusModal?.();
    } catch (e) {
      // Refresh failure shouldn't block the success flow — modal
      // dismisses regardless and user sees the new connection on
      // the next portfolio refresh.
    }
    setShowBrokerModal?.(false);
    onClose?.();
  };

  const onError = (sdkError) => {
    // SdkError shape from `@alphaquark/mobile-sdk`:
    //   { error: string, detail?: string, httpStatus?: number, upstream?: any }
    // Pass through humanizeSdkError so users see actionable copy instead of
    // raw machine codes. The technical breadcrumb is rendered as a small
    // caption underneath so support can still triage without the user
    // re-opening developer tools.
    setErrorInfo(humanizeSdkError(sdkError, brokerName));
    // Reset OAuth phase if we were in WebView, so user can fix and retry.
    setOauthExtraBody(null);
  };

  // Header with a close X — common to both phases. Without this the
  // user can get stuck on an error state with no way to dismiss.
  // Mirrors the legacy modals' top-right close affordance.
  const Header = ({title}) => (
    <View style={styles.header}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        onPress={() => {
          setShowBrokerModal?.(false);
          onClose?.();
        }}
        hitSlop={{top: 12, right: 12, bottom: 12, left: 12}}
        accessibilityLabel="Close"
        accessibilityRole="button">
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  // OAuth phase — render WebView round-trip after form collected creds.
  if (oauthExtraBody) {
    // Touch architecture (sibling-Pressable pattern):
    //   <View scrim>          ← dim background, no touch handler
    //     <Pressable absoluteFill /> ← BEHIND panel, catches taps in dim area → dismiss
    //     <View panel>        ← rendered AFTER, on top in z-order. No touch handler.
    //       <Header />        ← TouchableOpacity inside Header handles ✕ tap
    //       <WebView />       ← native taps reach here unimpeded
    //     </View>
    //   </View>
    //
    // Why this is the third attempt at this layout:
    //   v1 — `<Pressable scrim onPress=dismiss>` with `<Pressable panel onPress={()=>{}}>`
    //   inner. Inner Pressable's gesture-responder press-tracking ate
    //   WebView/TextInput taps on Android (2026-04-30 user-reported on
    //   Connect Dhan / Connect Upstox).
    //   v2 — `<Pressable scrim>` with `<View panel onStartShouldSetResponder=true>`.
    //   Same parent-Pressable; responder claim at JS layer was supposed to
    //   keep native WebView dispatch intact. Empirically still broken on
    //   Upstox login page (2026-05-01 user-reported on testaccount@gmail.com).
    //   The View's responder claim still interferes with the embedded
    //   WebView's MotionEvent handling on Android in some cases.
    //   v3 (this) — Pressable is a SIBLING of panel, not a parent. No
    //   responder/touch handler on panel itself. Z-order: panel rendered
    //   after Pressable, so panel area hit-tests to panel (and bubbles
    //   to WebView native handling) while dim area hit-tests to Pressable
    //   (dismiss). No JS responder claim anywhere in the chain over the
    //   WebView's bounding box.
    return (
      <View style={styles.scrim} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            setShowBrokerModal?.(false);
            onClose?.();
          }}
        />
        <View style={styles.panel}>
          <Header title={`Connect ${brokerName}`} />
          <WebViewBrokerAuthFlow
            broker={brokerName}
            redirectUrl={REDIRECT_URL}
            extraExchangeBody={oauthExtraBody}
            onSuccess={onSuccess}
            onError={onError}
            onClose={() => {
              // User backed out of WebView — drop back to the form so
              // they can retry, don't dismiss the whole modal.
              setOauthExtraBody(null);
            }}
            // Suppress the SDK widget's default header — this modal
            // already renders its own <Header> above (close ✕ + title).
            // Without this override, both render and users see two
            // stacked title bars on the WebView screen. Documented as
            // a parity bug in docs/SDK_PARITY_AUDIT.md.
            renderHeader={() => null}
          />
        </View>
      </View>
    );
  }

  // Form phase — credential entry / OAuth handoff trigger.
  return (
    <Pressable
      style={styles.scrim}
      onPress={() => {
        setShowBrokerModal?.(false);
        onClose?.();
      }}>
      <View
        style={styles.panel}
        // See OAuth-phase comment above — same rationale.
        // Empty-onPress Pressable wrapper was eating WebView and TextInput
        // touches on Android via gesture-responder press-tracking. Plain
        // View + onStartShouldSetResponder claim is the safe equivalent.
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}>
        <Header title={`Connect ${brokerName}`} />
        {schemaOverridePending ? (
          // Pre-fill in flight — render a small loader inside the
          // outer scroll so a fast user can't submit against the SDK
          // default before the smart-prefill kicks in. Resolves in
          // <500ms typical (one cached /api/user/getUser GET).
          <ScrollView contentContainerStyle={styles.scrollPad}>
            {errorInfo ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{errorInfo.title}</Text>
                <Text style={styles.errorBody}>{errorInfo.body}</Text>
                {errorInfo.technical ? (
                  <Text style={styles.errorTechnical}>
                    {errorInfo.technical}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.prefillLoader}>
              <ActivityIndicator />
              <Text style={styles.prefillLoaderText}>
                Loading saved credentials…
              </Text>
            </View>
          </ScrollView>
        ) : (
          // Form phase — outer ScrollView wrapping everything so the
          // full page scrolls as one unit. The SDK form's own
          // internal ScrollView is disabled via nestedScrollEnabled.
          <ScrollView
            ref={scrollRef}
            style={styles.formScroll}
            contentContainerStyle={styles.scrollPad}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled">
          {errorInfo ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>{errorInfo.title}</Text>
              <Text style={styles.errorBody}>{errorInfo.body}</Text>
              {errorInfo.technical ? (
                <Text style={styles.errorTechnical}>
                  {errorInfo.technical}
                </Text>
              ) : null}
            </View>
          ) : null}

          {IP_WHITELIST_BROKERS.has(brokerName) ? (
            <View style={styles.calloutWrap}>
              <EgressIpCallout
                broker={
                  EGRESS_BROKER_KEY[brokerName] ||
                  String(brokerName).toLowerCase()
                }
                customerEmail={emailFromCtx || ''}
                onAcknowledgeChange={(ready) => setEgressReady(!!ready)}
                showUnmetAck={unmetAck}
                onUnmetAckHandled={() => setUnmetAck(false)}
              />
            </View>
          ) : null}

          {brokerName !== 'Zerodha' ? (
            <Phase3BrokerHelp brokerName={brokerName} />
          ) : null}

          {!egressReady && IP_WHITELIST_BROKERS.has(brokerName) ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={nudgeEgressAck}
              accessibilityRole="button"
              accessibilityLabel="Whitelist your IP to unlock the connect form"
              style={styles.lockNotice}>
              <Text style={styles.lockNoticeText}>
                🔒 One step left — tick the “I’ve added … to my{' '}
                {brokerName} developer portal whitelist” box above to unlock the
                form below. Tap here to jump back to it.
              </Text>
            </TouchableOpacity>
          ) : null}

          <View
            style={[styles.formWrap, !egressReady && styles.formWrapLocked]}
            pointerEvents={
              !egressReady && IP_WHITELIST_BROKERS.has(brokerName)
                ? 'none'
                : 'auto'
            }>
            <BrokerCredentialForm
              broker={brokerName}
              schemaOverride={schemaOverride || undefined}
              key={`${brokerName}-${schemaOverride ? 'pre' : 'fresh'}`}
              encrypt={encryptField}
              onContinueToOauth={(collected) => {
                const extras = {...collected};
                if (brokerName === 'Zerodha') {
                  extras.apiKey =
                    extras.apiKey ||
                    Config?.REACT_APP_ZERODHA_API_KEY ||
                    configData?.config?.REACT_APP_ZERODHA_API_KEY ||
                    '';
                }
                setOauthExtraBody(extras);
                setErrorInfo(null);
              }}
              onSuccess={onSuccess}
              onError={onError}
            />
          </View>
        </ScrollView>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // Take nearly the full screen — the SDK widgets render rich content
    // (BrokerCredentialForm with prerequisites + 3-5 fields, or a
    // WebViewBrokerAuthFlow which needs full-height to be usable).
    // The previous minHeight 60% / maxHeight 92% squeezed the WebView
    // into a tiny strip that didn't fit the broker's OAuth login UI.
    height: '95%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeIcon: {
    fontSize: 20,
    color: '#6B7280',
    paddingHorizontal: 8,
  },
  // formScroll fills the panel's remaining height (below the Header) so
  // the content container's flexGrow has a bounded parent to grow into.
  // Without flex:1 here the ScrollView sized to content, and a flex:1
  // child (formWrap) collapsed to 0 height — leaving empty-field brokers
  // with no callout/help (Dhan, AliceBlue) showing a blank body (bug 78).
  formScroll: {
    flex: 1,
  },
  scrollPad: {
    paddingBottom: 24,
    // flexGrow lets the content fill at least the viewport so formWrap's
    // flex:1 resolves to a real height for short brokers, while taller
    // brokers (callout + help + form) still overflow and scroll.
    flexGrow: 1,
  },
  calloutWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  formWrap: {
    flex: 1,
  },
  // Disabled-pending-IP-whitelist state. A gentle dim (not the old
  // unexplained 0.45) PAIRED with the lockNotice banner above so the
  // form reads as "intentionally locked until you finish a step",
  // never as a mysterious translucent overlay.
  formWrapLocked: {
    opacity: 0.55,
  },
  lockNotice: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
  },
  lockNoticeText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  cautionaryBox: {
    margin: 16,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
  },
  cautionaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  cautionaryBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  errorTitle: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorBody: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  errorTechnical: {
    color: '#7F1D1D',
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'monospace',
    opacity: 0.75,
  },
  prefillLoader: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefillLoaderText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
});

export default Phase3SdkBrokerModal;
