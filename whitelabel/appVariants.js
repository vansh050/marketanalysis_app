/**
 * ============================================================================
 * whitelabel/appVariants — TENANT CONFIG ROOT (fork: marketanalysis)
 * ============================================================================
 *
 * 🔴 PER-FORK FILE. NOT BYTE-IDENTICAL ACROSS REPOS. 🔴
 *
 * This is the marketanalysis fork's overlay of the upstream Alphab2bapp
 * `whitelabel/appVariants.js`. `src/utils/Config.js` is the upstream-managed
 * re-exporter (byte-identical across forks); this file holds the actual
 * values per repo.
 *
 * To keep `src/` byte-identical for future upstream syncs, all
 * marketanalysis-specific theme / RA code / Firebase OAuth client values
 * live HERE — never inside `src/`.
 *
 * See `docs/WHITELABEL_RECIPE.md` (upstream).
 * ============================================================================
 */

// SharedDefaultLogo is the fallback logo applied to every variant that
// doesn't explicitly override `logo`. See upstream's comment for the
// historical context (variant previously called `ZamzamLogo`).
import SharedDefaultLogo from '../src/assets/AppLogo/logo.png';
import AlphaQuarkLogo from '../src/assets/logo.png';
// Marketanalysis brand assets live under the variant overlay, NOT under
// src/assets/. That keeps src/assets/ byte-identical to upstream on every
// sync. See designs/marketanalysis/tokens/assets.js for the asset-token
// override that surfaces this through useTokens().assets.logoPng.
import MarketAnalysisLogo from '../designs/marketanalysis/assets/logo.png';

// Shared UI config — theme, colors, layout
const sharedUIConfig = {
  themeColor: '#ff0000',
  logo: SharedDefaultLogo,
  toolbarlogo: SharedDefaultLogo,
  homeScreenLayout: 'layout1',
  mainColor: '#0D021F',
  secondaryColor: '#ffffff',
  gradient1: '#F0F0F0',
  gradient2: '#773D9A',
  placeholderText: '#B893F1',
  CardborderWidth: 1.5,
  cardElevation: 0,
  basket1: '#6A29CA',
  basket2: '#4F0A9E',
  cardverticalmargin: 3,
  tabIconColor: '#fff',
  bottomTabBorderTopWidth: 0,
  bottomTabbg: '#242424',
  selectedTabcolor: '#8555EF',
  basketcolor: '#600CC0',
  basketsymbolbg: '#6D0DD6',
  googleWebClientId: '892331696104-e26pu9iotqrjk1o6jq4ifd4e95fasil1.apps.googleusercontent.com',
};

const APP_VARIANTS = {
  alphaquark: {
    themeColor: '#0000ff',
    logo: AlphaQuarkLogo,
    toolbarlogo: AlphaQuarkLogo,
    homeScreenLayout: 'layout2',
    mainColor: '#4CAAA0',
    secondaryColor: '#F0F0F0',
    gradient1: '#F0F0F0',
    gradient2: '#F0F0F0',
    placeholderText: '#FFFFFF',
    CardborderWidth: 0,
    cardElevation: 3,
    cardverticalmargin: 3,
    tabIconColor: '#000',
    bottomTabBorderTopWidth: 1.5,
    bottomTabbg: '#fff',
    selectedTabcolor: '#000',
    basketcolor: '#721E30',
    basketsymbolbg: '#8D2952',
    basket1: '#9D2115',
    basket2: '#6B1207',
    googleWebClientId: '892331696104-e26pu9iotqrjk1o6jq4ifd4e95fasil1.apps.googleusercontent.com',
    subdomain: 'prod',
    advisorRaCode: 'ALPHAQUARK',
    paymentModal: {
      headerBg: '#0056B7',
      stepActiveColor: '#0056B7',
      stepCompletedColor: '#29A400',
      buttonPrimaryBg: '#0056B7',
      buttonSecondaryBg: '#0056B7',
      accentColor: '#0056B7',
      checkboxActiveColor: '#29A400',
      linkColor: '#0056B7',
      progressBarColor: '#0056B7',
    },
  },
  zamzamcapital: {...sharedUIConfig, subdomain: 'zamzamcapital',   advisorRaCode: 'ZAMZAMCAPITAL'},
  rgxresearch:   {...sharedUIConfig, subdomain: 'rgxresearch',     advisorRaCode: 'RGXRESEARCH'},
  arfs:          {...sharedUIConfig, subdomain: 'arfs',            advisorRaCode: 'ARFS'},
  magnus:        {...sharedUIConfig, subdomain: 'zamzamcapital',   advisorRaCode: 'ZAMZAMCAPITAL'},

  // ──────────────────────────────────────────────────────────────────────
  // marketanalysis — the active tenant this fork ships.
  // googleWebClientId migrated 2026-06-06 from the decommissioned
  // 'marketanalysisacademy-4e595' (sender id 794163196580) to
  // 'marketanalysis-3a279' (sender id 675041319268). Must match the new
  // project's Web OAuth client, otherwise the ID token GoogleSignin
  // returns is signed for the wrong project and Firebase rejects
  // signInWithCredential with auth/invalid-credential.
  // ──────────────────────────────────────────────────────────────────────
  marketanalysis: {
    themeColor: '#2056DF',
    logo: MarketAnalysisLogo,
    toolbarlogo: MarketAnalysisLogo,
    homeScreenLayout: 'layout1',
    mainColor: '#0A0F1D',
    secondaryColor: '#FFFFFF',
    gradient1: '#1E9F40',
    gradient2: '#2056DF',
    placeholderText: '#9CA3AF',
    CardborderWidth: 0,
    cardElevation: 3,
    cardverticalmargin: 3,
    tabIconColor: '#FFFFFF',
    bottomTabBorderTopWidth: 1,
    bottomTabbg: '#0A0F1D',
    selectedTabcolor: '#1E9F40',
    basketcolor: '#2056DF',
    basketsymbolbg: '#1843C0',
    basket1: '#1E9F40',
    basket2: '#17803A',
    googleWebClientId: '675041319268-ao2ac85qabj8ohvonvqagoe6nck1mvu3.apps.googleusercontent.com',
    subdomain: 'marketanalysis',
    advisorRaCode: 'MARKETANALYSIS',
    paymentModal: {
      headerBg: '#2056DF',
      stepActiveColor: '#2056DF',
      stepCompletedColor: '#1E9F40',
      buttonPrimaryBg: '#2056DF',
      buttonSecondaryBg: '#1E9F40',
      accentColor: '#2056DF',
      checkboxActiveColor: '#1E9F40',
      linkColor: '#2056DF',
      progressBarColor: '#1E9F40',
    },
  },

  EmptyStateUi: {
    backgroundColor: '#6B1400',
    darkerColor: '#3A0B00',
    mediumColor: '#4D2418',
    brighterColor: '#8B2500',
    mutedColor: '#5A3327',
    lightColor: '#F8E8E5',
    mediumLightShade: '#F5DDD8',
    lightWarmColor: '#E4F1FE',
  },
};

export default APP_VARIANTS;
