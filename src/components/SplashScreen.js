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
import {getAdvisorSubdomain} from '../utils/variantHelper';
import {getAccountEmailAsync} from '../utils/accountEmail';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getRaId, getUserData, storeLoginData, tryResolveAdvisor, updateRACodeAndConfig} from '../utils/storageUtils';
export default function SplashScreen() {
  const [progress, setProgress] = useState(0.0);
  const screenWidth = Dimensions.get('window').width;
  const navigation = useNavigation();

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
    const unsubscribe = auth().onAuthStateChanged(user => {
      // NOT `user.email` — an Apple "Hide My Email" user has none, which made
      // this cold-start gate fail closed: checkUserStatus never ran, so the
      // app never routed to Home or fetched advisor config on relaunch. The
      // identity is resolved inside (async) via getAccountEmailAsync().
      if (user) {
        const checkUserStatus = async () => {
          const email = await getAccountEmailAsync();
          if (!email) {
            // Signed in but no resolvable identity yet (Apple user who hasn't
            // completed the email screen). Let the normal navigation flow
            // take them there rather than hanging on the splash.
            console.warn(
              '[SplashScreen] signed-in user has no resolvable account email — routing to auth flow',
            );
            setTimeout(() => navigation.replace('Login'), 1000);
            return;
          }
          try {
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
              setTimeout(() => {
                navigation.replace('Home');
              }, 1000); // Shorter wait since we're using cache
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
                  'X-Advisor-Subdomain': getAdvisorSubdomain(),
                  'aq-encrypted-key': generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET,
                  ),
                },
              },
            );
            const userDetails = response.data.User;
            const advisorConfig = response.data.advisorConfig;
            const advisorRaCode = Config.ADVISOR_RA_CODE || userDetails?.advisor_ra_code;
            const hasAdvisorRaCode = !!advisorRaCode;

            // Store data so next cold start hits the fast cache path
            if (hasAdvisorRaCode && advisorConfig) {
              await storeLoginData({
                raCode: advisorRaCode,
                userData: {email, advisor_ra_code: advisorRaCode, ...userDetails},
                advisorConfig,
              });
            }

            if (hasAdvisorRaCode) {
              setTimeout(() => navigation.replace('Home'), 2000);
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
                  setTimeout(() => navigation.replace('Home'), 2000);
                } else {
                  setTimeout(() => navigation.replace('SignUpRADetails'), 2000);
                }
              } else {
                setTimeout(() => navigation.replace('SignUpRADetails'), 2000);
              }
            }
          } catch (error) {
            console.error('Error checking user status:', error.message);
            setTimeout(() => navigation.replace('Login'), 2000);
          }
        };

        checkUserStatus(); // Call the async function
      } else {
        setTimeout(async () => {
          // Phone-first login flow — per-advisor opt-in (default OFF, see
          // ConfigContext.js). Loading/off/error all resolve to the
          // standard Login screen, matching the app's existing behavior.
          const phoneFirst = await resolvePhoneFirstLoginEnabled();
          navigation.replace(phoneFirst ? 'Onboarding' : 'Login');
        }, 2000);
      }
    });

    return unsubscribe; // Clean up listener
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
          <View style={{width: 150, height: 150}} />
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
          fillColor="#000"
          unfilledColor="#E9E9E9"
          height={7}
          width={screenWidth * 0.5}
          borderColor="#E9E9E9"
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
    backgroundColor: '#fff',
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
