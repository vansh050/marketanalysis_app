/**
 * brokerDdpiHelp.js
 *
 * Single source of truth for per-broker DDPI activation guidance. Consumed by
 * `src/components/BrokerDdpiHelpModal.js` and indirectly by any screen that
 * needs to nudge the user toward DDPI. Don't duplicate this content inline
 * in a modal or screen — import from here. See
 * `docs/BROKER_CONNECTION.md § DDPI/EDIS Help module` for the full contract.
 *
 * Schema:
 *   title           — modal header, broker-specific (e.g. "Zerodha — Enable DDPI")
 *   intro           — ONE paragraph, broker-specific, explaining what DDPI is
 *                     and why this particular user should enable it right now.
 *                     For brokers with online EDIS (Angel One, Dhan), the intro
 *                     still pushes DDPI — EDIS is per-day, DDPI is one-time.
 *   steps[]         — numbered user-facing steps. Each step is a short string,
 *                     can embed a URL — the modal renders URLs as tappable
 *                     links via LinkifiedText.
 *   directLink      — single URL the "Open {broker}'s DDPI page" CTA opens.
 *                     If null, CTA falls back to the broker's generic portal.
 *   portalUrl       — (optional) broker's main portal. Used as fallback CTA.
 *   hasOnlineEdis   — true if broker supports online EDIS (TPIN) as an
 *                     alternative. Modal shows a "Why DDPI over EDIS?" callout
 *                     for these brokers to convince users it's still worth
 *                     the one-time effort.
 *   customerCare    — (optional) { email, phone, whatsapp }. Displayed as a
 *                     footer block for brokers that require phone/email
 *                     activation (HDFC, some Kotak accounts).
 *   videoId         — (optional) YouTube video ID for an embedded walkthrough.
 *
 * When adding a new broker:
 *  - Ship the directLink from the broker's OWN support portal (not a third-
 *    party blog — those rot). If the broker has no online self-serve flow,
 *    set directLink to null and list the customer-care contacts instead.
 *  - Make the `intro` actually persuasive — users don't know what DDPI is
 *    and many have been burned by EDIS auth failures. "DDPI is a one-time,
 *    SEBI-approved authorization that replaces the daily TPIN/EDIS hassle"
 *    is the nudge that works.
 */

const GENERIC_DDPI_INTRO =
  'DDPI (Demat Debit & Pledge Instruction) is a one-time SEBI-approved authorization that lets your broker debit shares from your demat for every sell order you place. Without it, you have to authorize every sell manually via EDIS/TPIN — a per-day, per-session step that often fails when you try to sell from a third-party app like this one. Activate DDPI once and sells flow through cleanly forever.';

const EDIS_ALTERNATIVE_NUDGE =
  "This broker supports online EDIS (TPIN). It works — but it's per-day: every time you sell, you get redirected to the broker's portal, type a 6-digit TPIN, and wait. DDPI is a one-time activation that removes that step permanently. Worth the 5-minute setup.";

const brokerDdpiHelp = {
  Zerodha: {
    title: 'Zerodha — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Zerodha activates DDPI via Console (not Kite). One-time ₹100 + GST fee, activates within 24 working hours.',
    steps: [
      '1. Log in to console.zerodha.com on your browser.',
      '2. Go to Account → click the arrow → Demat → Enable DDPI.',
      '3. Accept the Terms & Conditions → click Continue → Proceed.',
      '4. Click Sign Now → enter Aadhaar → Send OTP → verify.',
      '5. Fee: ₹100 + 18% GST (auto-deducted from account balance).',
      '6. Activates within 24 working hours.',
    ],
    directLink:
      'https://support.zerodha.com/category/your-zerodha-account/your-profile/ddpi/articles/activate-ddpi',
    portalUrl: 'https://console.zerodha.com',
    hasOnlineEdis: false,
    customerCare: null,
  },

  'Angel One': {
    title: 'Angel One — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Angel One supports TPIN-based EDIS, but DDPI lets you skip the per-sell TPIN prompt forever. Completely free — no charges.',
    steps: [
      '1. Log in to the Angel One app or angelone.in.',
      '2. Go to Account → Profile → DDPI Status.',
      '3. Tap Proceed to E-Sign.',
      '4. Enter Aadhaar → verify OTP.',
      '5. Completely free — no charges or fees.',
      '6. Activates within 1-2 working days.',
    ],
    directLink:
      'https://www.angelone.in/knowledge-center/demat-account/how-to-set-up-ddpi-on-angel-one',
    portalUrl: 'https://www.angelone.in',
    hasOnlineEdis: true,
    customerCare: {
      email: 'support@angelbroking.com',
      phone: '1800-120-7777',
    },
  },

  Upstox: {
    title: 'Upstox — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Upstox does not offer online EDIS for third-party apps — DDPI is effectively required for any sell order placed from here.',
    steps: [
      '1. Open the Upstox app → tap the Upstox icon (top-left).',
      '2. Go to My Account → Profile → "Sell instantly with DDPI".',
      '3. Tap Continue to enable DDPI → accept T&C.',
      '4. Pay ₹150 (stamp duty + GST, auto-deducted from wallet).',
      '5. E-sign via Aadhaar OTP.',
      '6. Activates next trading day (T+1 if before 8 PM, T+2 if after).',
    ],
    directLink: 'https://upstox.com/help-center/t-260205/',
    portalUrl: 'https://pro.upstox.com',
    hasOnlineEdis: false,
    customerCare: null,
  },

  Fyers: {
    title: 'Fyers — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Online DDPI activation on Fyers is completely free.',
    steps: [
      '1. App: Menu → My Profile → Segments → DDPI → Activate.',
      '   Web: Profile icon → Profile → Segments tab → DDPI → Activate → Proceed to e-Sign.',
      '2. Enter Aadhaar or VID on the Digio page.',
      '3. Complete e-Sign.',
      '4. Free for online activation (offline costs ₹150).',
      '5. Activates within 24-48 working hours.',
    ],
    directLink:
      'https://support.fyers.in/portal/en/kb/articles/how-do-i-activate-ddpi-on-fyers-online-and-offline',
    portalUrl: 'https://app.fyers.in',
    hasOnlineEdis: true,
    customerCare: {email: 'support@fyers.in', phone: '+91-80-6880-9999'},
  },

  Dhan: {
    title: 'Dhan — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Dhan supports online TPIN-based EDIS, but DDPI is a one-time activation that replaces the daily TPIN prompt.',
    steps: [
      '1. App: Portfolio → Manage Portfolio → "DDPI for Fast Sell" → e-Sign with Aadhaar OTP.',
      '   Web: web.dhan.co → Money → Trader\'s Controls → Enable DDPI for Fast Sell → e-Sign.',
      '2. Pay ₹100 one-time fee.',
      '3. Activates within 1-2 working days.',
    ],
    directLink:
      'https://dhan.freshdesk.com/support/solutions/articles/82000900258-from-where-ddpi-service-can-be-activated-',
    portalUrl: 'https://web.dhan.co',
    hasOnlineEdis: true,
    customerCare: {email: 'help@dhan.co', whatsapp: '+91-81-3000-0320'},
  },

  AliceBlue: {
    title: 'AliceBlue — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' AliceBlue requires DDPI for sell orders placed via their trading API — without it, every sell from this app fails the authorization check.',
    steps: [
      '1. Log in to bot.aliceblueonline.com (BOT platform).',
      '2. Go to Profile → My Account → DDPI → Activate DDPI.',
      '3. Review the PDF → Proceed.',
      '4. ₹177 auto-deducted from trading ledger.',
      '5. E-sign page → Sign Now → Aadhaar → OTP verification.',
      '6. Status shows "Pending" until KYC team verifies.',
    ],
    directLink:
      'https://wp.aliceblueonline.com/support/account-opening/ddpi-activation-guide/',
    portalUrl: 'https://bot.aliceblueonline.com',
    hasOnlineEdis: false,
    customerCare: {
      email: 'support@aliceblueindia.com',
      phone: '080-46086801',
    },
  },

  'ICICI Direct': {
    title: 'ICICI Direct — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' ICICI Direct now offers fully online DDPI activation with e-sign — no physical form needed.',
    steps: [
      '1. Log in to icicidirect.com.',
      '2. Go to Self Help → Place service request → Enable DDPI.',
      '3. Provide consent → complete e-stamping.',
      '4. OTP-based e-sign with Aadhaar.',
      '5. Fee: ₹100 + 18% GST (deducted from equity allocated funds).',
      '6. Activates within 2 working days.',
    ],
    directLink:
      'https://www.icicidirect.com/faqs/my-account/how-can-i-activate-ddpi-with-icici-securities',
    portalUrl: 'https://www.icicidirect.com',
    hasOnlineEdis: false,
    customerCare: {
      email: 'helpdesk@icicidirect.com',
      phone: '1860-123-1122',
    },
  },

  'Hdfc Securities': {
    title: 'HDFC Securities — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' HDFC Securities offers online DDPI activation for most accounts. Free — no charges.',
    steps: [
      '1. Log in to your HDFC Securities trading account.',
      '2. Navigate to the DDPI option → read consent form.',
      '3. Sign electronically via Aadhaar OTP.',
      '4. Free — no charges.',
      '5. Activates within 2-3 working days.',
      '6. If the online option is not visible, contact support@hdfcsec.com or call 022-6246-5555 for a DDPI activation link.',
    ],
    directLink: 'https://www.hdfcsec.com/Products/FAQ/2633',
    portalUrl: 'https://www.hdfcsec.com',
    hasOnlineEdis: false,
    customerCare: {email: 'support@hdfcsec.com', phone: '022-6246-5555'},
  },

  'IIFL Securities': {
    title: 'IIFL Securities — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' IIFL requires DDPI for trades placed via their API — without it, sell orders from this app will fail at the broker-side authorization step.',
    steps: [
      '1. Log in to your IIFL trading platform.',
      '2. Go to Profile → Submit DDPI.',
      '3. Enter demat account details → complete e-stamp.',
      '4. E-sign via Aadhaar OTP.',
      '5. Processing: 3-4 working days.',
    ],
    directLink:
      'https://www.indiainfoline.com/knowledge-center/demat-account/demat-debit-and-pledge-instruction',
    portalUrl: 'https://ttweb.indiainfoline.com',
    hasOnlineEdis: false,
    customerCare: {email: 'cs@iifl.com', phone: '022-4103-5000'},
  },

  'Motilal Oswal': {
    title: 'Motilal Oswal — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Motilal Oswal does not support online EDIS for their OpenAPI — DDPI is required for any sell placed from this app.',
    steps: [
      '1. Log in to invest.motilaloswal.com.',
      '2. Go to Profile → DDPI section.',
      '3. Enter demat account details → submit e-stamp.',
      '4. E-sign via Aadhaar OTP.',
      '5. Processing: approx. 3 business days.',
      '6. Offline option: submit form at nearest Motilal Oswal office.',
    ],
    directLink:
      'https://www.motilaloswal.com/learning-centre/2025/1/what-is-ddpi-the-role-of-demat-debit-and-pledge-instructions',
    portalUrl: 'https://invest.motilaloswal.com',
    hasOnlineEdis: false,
    customerCare: {
      email: 'query@motilaloswal.com',
      phone: '022-6160-2500',
    },
  },

  Kotak: {
    title: 'Kotak Securities — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Kotak requires DDPI for orders placed via the Neo Trade API (this app\'s path). Without it, every sell attempt triggers the POA/TPIN wall on their side.',
    steps: [
      '1. Log in to neo.kotaksecurities.com or the Neo app.',
      '2. Go to Profile/Account → DDPI → Enable DDPI.',
      '3. Accept T&C → e-sign via Aadhaar OTP.',
      '4. Pay ₹100 + GST.',
      '5. Activates within 1-4 working days.',
    ],
    directLink:
      'https://www.kotakneo.com/investing-guide/share-market/what-is-ddpi/',
    portalUrl: 'https://neo.kotaksecurities.com',
    hasOnlineEdis: false,
    customerCare: {
      email: 'service.securities@kotak.com',
      phone: '1800-209-9191',
      whatsapp: '+91-77389-88888',
    },
  },

  'Axis Securities': {
    title: 'Axis Securities — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Axis Securities requires DDPI for API-placed sells — without it, the broker blocks every sell with an authorization prompt.',
    steps: [
      '1. Log in to simplehai.axisdirect.in on your browser.',
      '2. Go to My Account → Demat Services → DDPI.',
      '3. Fill the DDPI form.',
      '4. Pay the stamp duty via online payment.',
      '5. E-sign via Aadhaar OTP. Activation in 1-2 working days.',
    ],
    directLink:
      'https://simplehai.axisdirect.in/544-faqs-ri/demat-account/6396-what-is-demat-debit-pledge-instruction-ddpi-how-to-download-it',
    portalUrl: 'https://simplehai.axisdirect.in',
    hasOnlineEdis: false,
    customerCare: {
      email: 'helpdesk@axisdirect.in',
      phone: '1800-419-5555',
    },
  },

  Groww: {
    title: 'Groww — Enable DDPI',
    intro:
      GENERIC_DDPI_INTRO +
      ' Groww requires DDPI for Trade API orders — without it, sells from this app are blocked on authorization.',
    steps: [
      '1. Open Groww app → Stocks Holdings → three-dot menu → DDPI.',
      '   Or: Account Details → Sell Authorization → Activate DDPI.',
      '2. Pay ₹100 + 18% GST.',
      '3. Aadhaar e-Sign.',
      '4. Activates within 24 hours.',
    ],
    directLink:
      'https://groww.in/help/stocks,-f&o,-ipo-&-mtf/searchable/how-can-i-opt-for-ddpi--60',
    portalUrl: 'https://groww.in',
    hasOnlineEdis: false,
    customerCare: {email: 'support@groww.in', phone: '91-9108-800-800'},
  },
};

/**
 * Lookup helper — broker names from user doc come in various casings
 * ("Zerodha", "ICICI Direct", "Hdfc Securities", etc.). Do exact match
 * first, then case-insensitive. Returns null if no entry — caller is
 * expected to gracefully degrade (hide the modal, show a generic
 * "contact your broker" message).
 */
export const getBrokerDdpiHelp = broker => {
  if (!broker) return null;
  if (brokerDdpiHelp[broker]) return brokerDdpiHelp[broker];
  const lower = broker.toLowerCase();
  for (const key of Object.keys(brokerDdpiHelp)) {
    if (key.toLowerCase() === lower) return brokerDdpiHelp[key];
  }
  return null;
};

export {brokerDdpiHelp, GENERIC_DDPI_INTRO, EDIS_ALTERNATIVE_NUDGE};
export default brokerDdpiHelp;
