import React, {useState, useEffect, useRef} from 'react';
import {View, Image, StyleSheet, Dimensions} from 'react-native';
import ProgressBar from 'react-native-progress-bar-horizontal';
import Config from 'react-native-config';
import AlphaQuarkLogo from '../assets/logo.png';
import useTokens from '../theme/useTokens';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import {useNavigation} from '@react-navigation/native';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {SvgUri} from 'react-native-svg';
import {useConfig} from '../context/ConfigContext';
import {getAdvisorSubdomain, getBuildTenantSubdomain} from '../utils/variantHelper';
import {getAccountEmailAsync} from '../utils/accountEmail';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {checkAndFetchAdvisorConfig, getRaId, getUserData, setUserData, storeLoginData, tryResolveAdvisor, updateRACodeAndConfig} from '../utils/storageUtils';
import { designColor } from '../design/literalTokens';
import {useNavigationLayout} from '../navigation/useNavigationLayout';
export default function SplashScreen() {
  const [progress, setProgress] = useState(0.0);
  const hasRoutedRef = useRef(false);
  const screenWidth = Dimensions.get('window').width;
  const navigation = useNavigation();
  // First pre-login screen of the phone-first flow comes from the variant's
  // navigation manifest (`preLogin`); default = Onboarding carousel. Ref so
  // the delayed auth callback below reads it fresh (manifest is fixed per
  // build, but keep the ref pattern consistent with the config refs).
  const {preLoginRoute} = useNavigationLayout();
  const preLoginRouteRef = useRef(preLoginRoute);
  preLoginRouteRef.current = preLoginRoute;

  // Get logo from database via ConfigContext
  const config = useConfig();
  const tokens = useTokens();
  const {logo: LogoComponent, themeColor, configLoading} = config;

  console.log('SplashScreen config logo:', LogoComponent);
  console.log('SplashScreen logo type:', typeof LogoComponent);

  // Refs mirroring the latest config-loading/phoneFirstLoginEnabled state,
  // kept in sync via the effect below. Needed because the unauthenticated
  // branch of the auth-state-changed listener below fires inside a
  // `setTimeout`, well after this render — a plain closed-over `config`
  // value would be frozen at mount time (when ConfigContext's fetch usually
  // hasn't resolved yet) and would never observe the load actually
  // finishing. Refs mutate in place and are always read fresh. Mirrors
  // MPInvestNowModal.js's kycBlockingEnabledRef pattern (Alphab2bapp).
  const configLoadingRef = useRef(config?.configLoading);
  const phoneFirstLoginEnabledRef = useRef(config?.phoneFirstLoginEnabled === true);
  useEffect(() => {
    configLoadingRef.current = config?.configLoading;
    phoneFirstLoginEnabledRef.current = config?.phoneFirstLoginEnabled === true;
  }, [config?.configLoading, config?.phoneFirstLoginEnabled]);

  // Waits out a still-in-flight config load (up to 6s, matching the
  // provider's own frontend-config fetch timeout) before trusting
  // `phoneFirstLoginEnabled`. Without this, a fast device that reaches the
  // unauthenticated branch before ConfigContext's initial fetch resolves
  // would read the pre-fetch default (false) and silently skip the phone-
  // first flow even for an opted-in advisor. If config is still loading
  // after the wait, default OFF (standard Login) — never risk routing an
  // unauthenticated user to a screen we can't confirm is wanted.
  const resolvePhoneFirstLoginEnabled = async () => {
    if (!configLoadingRef.current) return phoneFirstLoginEnabledRef.current === true;
    const start = Date.now();
    while (configLoadingRef.current && Date.now() - start < 6000) {
      await new Promise(r => setTimeout(r, 150));
    }
    return phoneFirstLoginEnabledRef.current === true;
  };

  useEffect(() => {
    let mounted = true;
    const pendingTimers = new Set();
    const navigateOnce = (route, delay = 0) => {
      if (hasRoutedRef.current) return;
      hasRoutedRef.current = true;
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        if (mounted) navigation.replace(route);
      }, delay);
      pendingTimers.add(timer);
    };

    // Native auth normally emits immediately, but a delayed/missed callback
    // must never strand the customer on a completed progress bar. This final
    // escape uses the locally restored Firebase session only; protected data
    // still remains subject to the normal server-side authentication checks.
    const startupWatchdog = setTimeout(() => {
      if (hasRoutedRef.current) return;
      const restoredUser = auth().currentUser;
      console.warn('[SplashScreen] startup watchdog recovered stalled routing');
      navigateOnce(restoredUser ? 'Home' : 'Login');
    }, 12000);
    pendingTimers.add(startupWatchdog);

    const unsubscribe = auth().onAuthStateChanged(user => {
      // NOT `user.email` — an Apple "Hide My Email" user has none, which made
      // this cold-start gate fail closed: checkUserStatus never ran, so the
      // app never routed to Home or fetched advisor config on relaunch. The
      // identity is resolved inside (async) via getAccountEmailAsync().
      if (user) {
        const checkUserStatus = async () => {
          try {
            // Identity resolution can read native/AsyncStorage state and can
            // reject. Keep it inside this catch boundary so a damaged or
            // partially-restored install cannot leave Splash pending forever.
            const email = await getAccountEmailAsync();
            if (!email) {
              console.warn(
                '[SplashScreen] signed-in user has no resolvable account email — routing to auth flow',
              );
              navigateOnce('Login', 1000);
              return;
            }

            // First, check if we have a cached RA ID from AsyncStorage
            const cachedRaId = await getRaId();
            const cachedUserData = await getUserData();

            console.log('🔍 SplashScreen: Checking cached data...');
            console.log('✓ Current user email:', email);
            console.log('✓ Cached RA ID:', cachedRaId);
            console.log('✓ Cached User Data:', cachedUserData ? JSON.stringify(cachedUserData) : 'null');
            console.log('✓ Email match:', cachedUserData?.email === email);

            // If we have cached RA ID and it matches the current user's email, go directly to Home
            if (cachedRaId && cachedUserData?.email === email) {
              console.log('✅ Using cached advisor configuration for:', cachedRaId);
              navigateOnce('Home', 1000); // Shorter wait since we're using cache
              return;
            }

            // Log why cache is not being used
            if (!cachedRaId) console.log('⚠️ No cached RA ID found');
            if (!cachedUserData) console.log('⚠️ No cached user data found');
            if (cachedUserData?.email !== email) console.log('⚠️ Email mismatch:', cachedUserData?.email, 'vs', email);

            // Otherwise, fetch fresh user details from API with inline config
            console.log('Fetching fresh user details from API...');
            const response = await axios.get(
              `${server.server.baseUrl}api/user/getUser/${email}?includeAdvisorConfig=true`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                  'aq-encrypted-key': generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET,
                  ),
                },
                // A slow/unreachable API must degrade to the existing auth
                // fallback instead of holding the launch screen indefinitely.
                timeout: 8000,
              },
            );
            const userDetails = response.data.User;
            const advisorConfig = response.data.advisorConfig;
            const advisorRaCode = Config.ADVISOR_RA_CODE || userDetails?.advisor_ra_code;
            const hasAdvisorRaCode = !!advisorRaCode;

            // The inline advisorConfig blob is keyed to the user's mongo
            // advisor_ra_code, not the env-pinned Config.ADVISOR_RA_CODE.
            // For users registered under multiple advisors (cross-fork
            // signups), those two diverge — trusting the inline blob then
            // writes prod's REACT_APP_HEADER_NAME ("prod") into AsyncStorage
            // and every subsequent API call sends X-Advisor-Subdomain: prod,
            // returning the wrong tenant's plans/recos.
            const inlineMatchesEnvRa =
              !Config.ADVISOR_RA_CODE ||
              (userDetails?.advisor_ra_code || '').toUpperCase().trim() ===
                Config.ADVISOR_RA_CODE.toUpperCase().trim();

            // Store data so next cold start hits the fast cache path
            if (hasAdvisorRaCode && advisorConfig && inlineMatchesEnvRa) {
              await storeLoginData({
                raCode: advisorRaCode,
                userData: {email, advisor_ra_code: advisorRaCode, ...userDetails},
                advisorConfig,
              });
            } else if (hasAdvisorRaCode) {
              // Inline blob belongs to the wrong advisor — discard it and
              // fetch the correct config keyed to Config.ADVISOR_RA_CODE.
              await setUserData({
                email,
                advisor_ra_code: advisorRaCode,
                ...userDetails,
              });
              await checkAndFetchAdvisorConfig(advisorRaCode);
            }

            if (hasAdvisorRaCode) {
              navigateOnce('Home', 1000);
            } else {
              // Try auto-resolve before showing RA ID screen
              const resolveResult = await tryResolveAdvisor(email);
              if (resolveResult.resolved) {
                console.log('🎯 Splash: Auto-resolved advisor:', resolveResult.advisor_ra_code);
                const configResult = await updateRACodeAndConfig(
                  resolveResult.advisor_ra_code,
                  email,
                );
                if (configResult.success) {
                  navigateOnce('Home', 1000);
                } else {
                  navigateOnce('SignUpRADetails', 1000);
                }
              } else {
                navigateOnce('SignUpRADetails', 1000);
              }
            }
          } catch (error) {
            console.error('Error checking user status:', error.message);
            navigateOnce('Login', 1000);
          }
        };

        checkUserStatus(); // Call the async function
      } else {
        const unauthenticatedTimer = setTimeout(async () => {
          pendingTimers.delete(unauthenticatedTimer);
          // Phone-first login flow — per-advisor opt-in (default OFF, see
          // ConfigContext.js). Loading/off/error all resolve to the
          // standard Login screen, matching the app's existing behavior.
          const phoneFirst = await resolvePhoneFirstLoginEnabled();
          navigateOnce(phoneFirst ? preLoginRouteRef.current : 'Login');
        }, 2000);
        pendingTimers.add(unauthenticatedTimer);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, [navigation]);

  useEffect(() => {
    // Increment progress smoothly
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 1) {
          clearInterval(interval);
          return 1;
        }
        return prev + 0.1;
      });
    }, 300); // Adjust speed as needed

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Logo Section - Wait for config to load before showing logo */}
      <View style={styles.logoContainer}>
        {/*
          Logo cascade: advisor-provided logo (URL/SVG/require) wins; when
          none is set the final branch falls back to the variant's brand-mark
          asset token (default = AlphaQuark, alphanomy = its own PNG via
          designs/alphanomy/tokens/assets.js). No variant name is hardcoded
          here — see docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.
        */}
        {configLoading ? (
          // Show nothing or a placeholder while config is loading
          (<View style={{width: 150, height: 150}} />)
        ) : LogoComponent && typeof LogoComponent === 'function' ? (
          <LogoComponent width={200} height={200} />
        ) : LogoComponent && typeof LogoComponent === 'string' && LogoComponent.endsWith('.svg') ? (
          <SvgUri
            uri={LogoComponent}
            width={150}
            height={150}
          />
        ) : LogoComponent && typeof LogoComponent === 'string' ? (
          <Image
            source={{uri: LogoComponent}}
            style={{width: 150, height: 150, resizeMode: 'contain'}}
          />
        ) : LogoComponent && typeof LogoComponent === 'object' && LogoComponent.uri ? (
          <Image
            source={{uri: LogoComponent.uri}}
            style={{width: 150, height: 150, resizeMode: 'contain'}}
          />
        ) : LogoComponent && typeof LogoComponent === 'object' ? (
          <Image
            source={LogoComponent}
            style={{width: 150, height: 150, resizeMode: 'contain'}}
          />
        ) : (
          <Image
            source={tokens?.assets?.logoPng || AlphaQuarkLogo}
            style={{width: 150, height: 150, resizeMode: 'contain'}}
          />
        )}
      </View>
      {/* Progress Bar Section */}
      <View style={{marginBottom: 70}}>
        <ProgressBar
          progress={progress}
          borderWidth={1}
          fillColor={designColor('000')}
          unfilledColor={designColor('e9e9e9')}
          height={7}
          width={screenWidth * 0.5}
          borderColor={designColor('e9e9e9')}
          duration={150}
        />
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('fff'),
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    margin: 25,
  },
});
