/**
 * Per-broker connect-walkthrough content for the green-stepper HelpModal.
 *
 * Single source of truth for the broker setup guides shown in
 * `HelpModal` (rendered via `BrokerHelpStepper`). Previously every
 * broker's steps were hand-rolled JSX inline in HelpModal.js (~600
 * lines, 9 near-identical blocks); this module makes the content
 * data-driven and the modal a thin themed renderer.
 *
 * Step model — a step is either:
 *   • a string, OR
 *   • an array of "segments", where a segment is:
 *       - a string (may contain "{app}" → white-label name, and "\n"),
 *       - { u: 'https://…', d?: 'display text' } → inline open+copy link
 *         (rendered with the shared <LinkifiedUrl/>),
 *       - { redirect: true } → inline link to the app's broker-connect
 *         Redirect URL (resolved at render from Config).
 *
 * Video IDs are the 2026-06 re-recorded walkthroughs (Upstox / ICICI /
 * HDFC / Fyers / Kotak refreshed; AliceBlue / Dhan / Motilal / Zerodha
 * keep their existing clips — no new recording).
 *
 * Keyed by the same `broker` strings HelpModal receives
 * ('ICICI' | 'AliceBlue' | 'Fyers' | 'Dhan' | 'HDFC' | 'Kotak' |
 *  'Upstox' | 'Motilal' | 'Zerodha').
 */

const MOTILAL_REDIRECT = 'https://ccxtprod.alphaquark.in/motilal-oswal/callback';

const BROKER_HELP = {
  ICICI: {
    title: 'ICICI Direct — get API & Secret Key',
    videoId: 'PFiVLkdIhk8',
    steps: [
      ['Visit ', { u: 'https://api.icicidirect.com/apiuser/home' },
        ' and log in with your username and password. Verify with the OTP and submit.'],
      ['Open the "Register an App" tab, then fill "App Name" with "{app}" (or any name). Enter the "Redirect URL" as ',
        { redirect: true },
        ' and click "Submit". Make sure the Redirect URL is entered exactly as shown.'],
      'Open the "View Apps" tab, copy your API Key and Secret Key, and enter them on the connect screen.',
    ],
  },

  AliceBlue: {
    title: 'AliceBlue — get User ID & API Key',
    videoId: 'm906oWzMe0o',
    steps: [
      ['Visit ', { u: 'https://ant.aliceblueonline.com/apps' },
        ' and log in with your phone number, password, and TOTP or mobile OTP.'],
      'If a Risk Disclosure pop-up appears, click "Proceed".',
      'In the "Apps" tab, select "API Key", click "Copy", and paste it on your platform. Note: this key is valid for 24 hours, so generate a new one daily.',
      'For your User ID, tap the profile icon, open "Your Profile / Settings", and copy the client ID under your name. Paste it on your platform.',
    ],
  },

  Fyers: {
    title: 'Fyers — get App ID & Secret ID',
    videoId: 'TdadXSWAxeY',
    steps: [
      ['Visit ', { u: 'https://fyers.in/web/api-dashboard/user-apps' },
        ' — the new Fyers API dashboard (required for static-IP whitelisting).'],
      'Log in using your phone number, TOTP, and 4-digit PIN.',
      ['Click "Create App". Enter an app name, paste the Redirect URL shown below, add a description, and delete the webhook.\n\n',
        '⚠️ You MUST tick the "Order Placement" permission — without it Fyers rejects every basket order with "algo orders are not allowed for this app". The checkbox is OFF by default.\n\n',
        'Tick any other permissions you want, accept the API Usage Terms, click "Create App", then on the next screen add your {app} egress IP under "IP Whitelist" (the address shown in the IP-whitelist callout on the connect page).'],
      'Scroll to the newly created app. Copy the App ID and Secret ID and paste them into your platform.',
    ],
  },

  Dhan: {
    title: 'Dhan — get Client ID & Access Token',
    videoId: 'MhAfqNQKSrQ',
    steps: [
      ['Go to ', { u: 'https://login.dhan.co' }, '.'],
      'Tap your profile picture and choose "My Profile on Dhan". Your "Client ID" is shown under the profile details.',
      'Select "Dhan HQ Trading APIs" from the menu.',
      'To generate an access token, click "+ New Token", name your app, set validity to 30 days, and click "Generate Token".',
      'Copy the access token and paste it into the designated field.',
    ],
  },

  HDFC: {
    title: 'HDFC Securities — get API & Secret Key',
    videoId: 'gNp76J0i45A',
    steps: [
      ['Go to ', { u: 'https://developer.hdfcsky.com/' }, '.'],
      'Log in with your ID, password, and OTP.',
      'Accept the Risk Disclosure.',
      ['Click "Create" to make a new app. Enter the app name, Redirect URL ',
        { redirect: true },
        ', and a description, then click "Create".'],
      'Copy the API Key and Secret Key and paste them into the {app} platform to connect your broker.',
    ],
  },

  Kotak: {
    title: 'Kotak — get Consumer Key & Secret',
    videoId: 'J15Z4dP19o8',
    steps: [
      ['Get NEO Trade API access.\n(i) If you use Kotak NEO, get your Client ID from your Kotak Neo account under account details.\n(ii) Then log in at ',
        { u: 'https://www.kotaksecurities.com/platform/kotak-neo-trade-api/' },
        '\nLog in with your mobile number and register for Kotak Neo Trade API. Enter your Client ID, email, and contact number, then click "Submit". You\'ll receive your User ID, password, and Neo Finkey by email within 30 minutes.\n(iii) If you use Kotak Stock Trader, switch to Neo at ',
        { u: 'https://www.kotaksecurities.com/switch-to-neo/' }],
      ['Get your Consumer Key & Secret.\n(i) Log in to the Kotak API portal at ',
        { u: 'https://napi.kotaksecurities.com/devportal/apis' },
        '\nUse the username and password you received by email.\n(ii) Create an application: open "Applications", click "Add New Application", use any app name (e.g. {app}), select Unlimited in Shared Quota, leave description & group empty, then save.\n(iii) Under "Subscriptions", click Subscribe APIs and subscribe to all available APIs.\n(iv) Open "Production Keys", click "Generate Keys" to get your Consumer Key & Secret. Copy them for the linking step.'],
      ['Register TOTP.\n(i) Go to ',
        { u: 'https://www.kotaksecurities.com/platform/kotak-neo-trade-api/totp-registration/' },
        '\nOn the Kotak Neo API Dashboard, click "TOTP Registration". Verify your mobile via OTP, select your account, scan the QR with an authenticator app (e.g. Google Authenticator), and submit the TOTP to register.'],
      'Link your account.\n(i) Open broker settings in your app, select Kotak, and enter your Unique Client Code (UCC), Consumer Key & Secret, and MPIN. Tip: your UCC is shown in your Kotak Neo Profile (or the "Select Client Code" prompt during TradeAPI setup).\n(ii) You\'ll provide a TOTP from your authenticator app while linking.',
    ],
  },

  Upstox: {
    title: 'Upstox — get API & Secret Key',
    videoId: 'qYgpZTYYdyk',
    steps: [
      ['Visit ', { u: 'https://shorturl.at/plWYJ' },
        ' and log in with your phone number. Verify with the OTP and continue.'],
      'Enter your 6-digit PIN and continue.',
      ['Click "New App". Fill "App Name" with "{app}" (or any name). Enter the "Redirect URL" as ',
        { redirect: true },
        '. You can skip the Postback URL and Description (optional). Accept the Terms & Conditions and click "Continue". Make sure the Redirect URL is entered exactly as shown.'],
      'Review the details (make sure you don\'t have more than 2 apps) and click "Confirm Plan". Your API is ready — click "Done".',
      'Click the newly created app, copy your API Key and Secret Key, and enter them on the connect screen.',
    ],
  },

  Motilal: {
    title: 'Motilal Oswal — get API & Secret Key',
    videoId: 'gGKedxU-sQ0',
    steps: [
      ['Visit ', { u: 'https://www.motilaloswal.com' }, ' in your browser.'],
      'Click "Customer Login" at the top right, then select the Older Version to log in.',
      'Click the Profile Icon at the top to find your Client Code.',
      'Click the hamburger menu (☰) at the top right.',
      'From the dropdown, select "Trading API".',
      ['On the Trading API page, click "Create an API Key". Enter an app name (e.g. {app}) and set the Redirect URL to ',
        { u: MOTILAL_REDIRECT },
        '. Copy this URL into the Redirect URL field, then click "Create".'],
      'Your API Key is created. Copy the API Key and your Client Code.',
      'Paste these details into our app to complete the connection.',
    ],
  },

  Zerodha: {
    title: 'Zerodha — get API & Secret Key',
    videoId: 'tqJTYfgkS04',
    steps: [
      ['Visit ', { u: 'https://developers.kite.trade/apps' }, ' and sign up / log in.'],
      'Click "Create New App" in the top-right of the dashboard.',
      ['Configure your app:\n- Select "Personal" for application type.\n- Enter a descriptive name.\n- Input your Zerodha Client ID.\n- Set the Redirect URL to ',
        { u: 'https://ccxtprod.alphaquark.in/zerodha/callback' },
        '\n- Set the Postback URL to ',
        { u: 'https://ccxtprod.alphaquark.in/zerodha/postback' },
        '\n- Add a brief description (e.g. "Trading advisory application for client portfolio management").\n- Click "Create".'],
      'Retrieve your credentials:\n- You\'ll be redirected to the apps dashboard.\n- Click your newly created app.\n- Locate your API Key.\n- Click "Show Secret" to reveal your API Secret.\n- Copy both the API Key and API Secret.',
      'Paste these details into our app to complete your Zerodha integration.',
    ],
  },
};

/** Returns the help config for a broker key, or null if none. */
export const getBrokerHelp = (broker) => BROKER_HELP[broker] || null;

export default BROKER_HELP;
