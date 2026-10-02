/**
 * LoginScreen — container (Phase F batch 2, 2026-05-01)
 *
 * Owns the entire auth orchestration. Handlers preserved as-is from the
 * pre-migration file:
 *   - signInWithEmail (Firebase email auth + getUser/createUser + tracking
 *     + handlePostLoginNavigation)
 *   - handleGoogleLogin (GoogleSignin + Firebase credential exchange +
 *     backend create/get + tracking + handlePostLoginNavigation)
 *   - handleAppleLogin (appleAuth + Firebase credential exchange +
 *     completeAppleSignIn helper)
 *   - completeAppleSignIn (backend create/get + tracking + nav)
 *   - handlePostLoginNavigation (3-path orchestrator: auto-resolve advisor,
 *     fallback to RA details, direct to Home)
 *
 * Renders presentation resolved from `screens.LoginScreen`.
 */

import React, { useCallback, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import Config from 'react-native-config';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import axios from 'axios';
import server from '../../utils/serverConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { useTrade } from '../TradeContext';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getBuildTenantSubdomain} from '../../utils/variantHelper';
import { setAccountEmail, isPlaceholderName } from '../../utils/accountEmail';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';
import GoogleWebSignInModal from './GoogleWebSignInModal';

import {
    storeLoginData,
    checkAndFetchAdvisorConfig,
    setUserData,
    updateRACodeAndConfig,
    tryResolveAdvisor,
} from '../../utils/storageUtils';
import {
    logLoginAttempt,
    trackAppUser,
} from '../../FunctionCall/services/LoginLoggingService';

const LoginScreen = () => {
    const config = useConfig();
    const { logo: LogoComponent, configLoading } = config || {};

    const { reloadConfigData, setIsProfileCompleted, getAllTrades, getModelPortfolioStrategyDetails } = useTrade();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorShow, setErrorShow] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [googleWebSignInVisible, setGoogleWebSignInVisible] = useState(false);
    const navigation = useNavigation();

    React.useEffect(() => {
        if (config?.googleWebClientId) {
            GoogleSignin.configure({
                webClientId: config.googleWebClientId,
                // iOS GoogleSignIn needs the project's OWN client ID (NOT the web
                // client ID) or GIDSignIn raises an NSException and crashes on
                // signIn(). Sourced per-tenant from config.googleIosClientId
                // (backend appadvisors.googleIosClientId or the variant's
                // googleIosClientId). Omitted when unset — a harmless no-op on
                // Android and for tenants without an iOS build.
                ...(config.googleIosClientId
                    ? { iosClientId: config.googleIosClientId }
                    : {}),
            });
        }
    }, [config?.googleWebClientId]);

    const storeLoginTime = async () => {
        try {
            const now = moment().toISOString();
            await AsyncStorage.setItem('lastActiveTime', now);
        } catch (e) {
            console.error('❌ Error storing login time:', e);
        }
    };

    const handlePostLoginNavigation = async (userDetails, userEmail) => {
        try {
            const userData = userDetails.data?.User;
            const advisorRaCode = Config?.ADVISOR_RA_CODE || userData?.advisor_ra_code;
            const hasAdvisorRaCode = !!advisorRaCode;

            setIsProfileCompleted(hasAdvisorRaCode);
            await storeLoginTime();

            if (!hasAdvisorRaCode) {
                await setUserData({ email: userEmail, profileCompleted: false, ...userData });

                const resolveResult = await tryResolveAdvisor(userEmail);
                if (resolveResult.resolved) {
                    const configResult = await updateRACodeAndConfig(resolveResult.advisor_ra_code, userEmail);
                    if (configResult.success) {
                        await reloadConfigData();
                        getAllTrades().catch((err) => console.error('Trade load error:', err));
                        getModelPortfolioStrategyDetails().catch((err) => console.error('Portfolio load error:', err));
                        navigation.replace('Home');
                        return;
                    }
                }

                navigation.replace('SignUpRADetails', { userEmail });
                return;
            }

            const inlineConfig = userDetails.data?.advisorConfig;
            // The inline advisorConfig blob is keyed to the user's mongo
            // advisor_ra_code, not the env-pinned Config.ADVISOR_RA_CODE.
            // For users registered under multiple advisors (cross-fork
            // signups), those two diverge — trusting the inline blob then
            // writes prod's REACT_APP_HEADER_NAME ("prod") into AsyncStorage
            // and every subsequent API call sends X-Advisor-Subdomain: prod.
            const inlineMatchesEnvRa =
                !Config?.ADVISOR_RA_CODE ||
                (userData?.advisor_ra_code || '').toUpperCase().trim() ===
                    Config.ADVISOR_RA_CODE.toUpperCase().trim();
            if (inlineConfig && inlineMatchesEnvRa) {
                await storeLoginData({
                    raCode: advisorRaCode,
                    userData: { email: userEmail, advisor_ra_code: advisorRaCode, profileCompleted: true, ...userData },
                    advisorConfig: inlineConfig,
                });
            } else {
                await setUserData({
                    email: userEmail,
                    advisor_ra_code: advisorRaCode,
                    profileCompleted: true,
                    ...userData,
                });
                const configResult = await checkAndFetchAdvisorConfig(advisorRaCode);
                if (!configResult.success && configResult.advisorExists === false) {
                    navigation.replace('SignUpRADetails', { userEmail });
                    return;
                }
            }

            await reloadConfigData();
            getAllTrades().catch((err) => console.error('Trade load error:', err));
            getModelPortfolioStrategyDetails().catch((err) => console.error('Portfolio load error:', err));
            navigation.replace('Home');
        } catch (e) {
            console.error('Login error:', e);
            navigation.replace('Home');
        }
    };

    const signInWithEmail = useCallback(async () => {
        setLoading(true);
        setErrorShow(false);
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setError('Email and password are required');
            setErrorShow(true);
            setLoading(false);
            return;
        }
        try {
            const response = await auth().signInWithEmailAndPassword(trimmedEmail, password);
            const user = response.user;
            if (user) {
                let userDetails = null;
                try {
                    userDetails = await axios.get(
                        `${server.server.baseUrl}api/user/getUser/${trimmedEmail}?includeAdvisorConfig=true`,
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                            },
                            timeout: 10000,
                        },
                    );
                } catch {
                    await axios.post(
                        `${server.server.baseUrl}api/user/`,
                        { email: user.email, name: user.displayName || 'New User', firebaseId: user.uid },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                            },
                            timeout: 10000,
                        },
                    );
                    userDetails = { data: { User: { email: user.email, name: user.displayName || 'New User' } } };
                }

                const advisorSubdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
                trackAppUser({ email: trimmedEmail, firebase_id: user.uid, name: user.displayName, login_method: 'email', advisor_subdomain: advisorSubdomain });
                logLoginAttempt({ email: trimmedEmail, firebase_id: user.uid, status: 'success', login_method: 'email', advisor_subdomain: advisorSubdomain });

                await handlePostLoginNavigation(userDetails, trimmedEmail);
            }
        } catch (e) {
            console.error('Login error:', e.code, e.message);
            const failedSubdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            logLoginAttempt({
                email: trimmedEmail,
                status: 'failed',
                login_method: 'email',
                failure_reason: e.code?.includes('auth/') ? 'firebase_error' : 'api_error',
                error_message: e.message,
                error_code: e.code,
                advisor_subdomain: failedSubdomain,
            });

            let userMessage = 'Something went wrong. Please try again.';
            if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
                userMessage = 'Invalid email or password. Please check your credentials and try again.';
                // A wrong password and "this account never set a password"
                // both surface as invalid-credential. Ask the backend which
                // providers the account has; if it's Google-only, point the
                // user at Google sign-in instead of retrying a password that
                // was never set. Best-effort, async override (web parity:
                // prod-alphaquark-github SignInEmail.js checkProviderForHint).
                (async () => {
                    try {
                        const resp = await axios.post(
                            `${server.server.baseUrl}api/auth/check-provider`,
                            { email: trimmedEmail },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                                    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                                },
                                timeout: 8000,
                            },
                        );
                        const data = resp?.data || {};
                        if (data.hasGoogle && !data.hasPassword) {
                            setError('This account signed up with Google. Please use "Continue with Google" to sign in.');
                            setErrorShow(true);
                        }
                    } catch (_) {
                        // best-effort hint only — generic message already shown
                    }
                })();
            } else if (e.code === 'auth/user-not-found') {
                userMessage = 'No account found with this email. Please sign up first.';
            } else if (e.code === 'auth/invalid-email') {
                userMessage = 'Please enter a valid email address.';
            } else if (e.code === 'auth/too-many-requests') {
                userMessage = 'Too many failed attempts. Please try again later.';
            } else if (e.code === 'auth/user-disabled') {
                userMessage = 'This account has been disabled. Please contact support.';
            } else if (e.code === 'auth/network-request-failed') {
                userMessage = 'Network error. Please check your internet connection.';
            }
            setError(userMessage);
            setErrorShow(true);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email, password]);

    const completeGoogleSignIn = useCallback(async ({
        idToken,
        googleEmail = null,
        googleName = null,
        googlePhoto = null,
        loginMethod = 'google',
    }) => {
        try {
            setLoading(true);
            if (!idToken) throw new Error('No ID token returned');

            const googleCredential = auth.GoogleAuthProvider.credential(idToken);
            const response = await auth().signInWithCredential(googleCredential);

            if (response) {
                const user = response.user;
                const effectiveEmail = String(user?.email || googleEmail || '')
                    .trim()
                    .toLowerCase();
                if (!effectiveEmail) {
                    throw new Error('Google did not return an email for this account. Please try again.');
                }
                const effectiveName = user?.displayName || googleName || null;
                const effectivePhoto = user?.photoURL || googlePhoto || null;
                await setAccountEmail(effectiveEmail);

                await axios.post(
                    `${server.server.baseUrl}api/user/`,
                    { email: effectiveEmail, name: effectiveName, imageUrl: effectivePhoto, firebaseId: user.uid },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                const userDetails = await axios.get(
                    `${server.server.baseUrl}api/user/getUser/${effectiveEmail}?includeAdvisorConfig=true`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                const subdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
                trackAppUser({ email: effectiveEmail, firebase_id: user.uid, name: effectiveName, login_method: loginMethod, advisor_subdomain: subdomain });
                logLoginAttempt({ email: effectiveEmail, firebase_id: user.uid, status: 'success', login_method: loginMethod, advisor_subdomain: subdomain });

                await handlePostLoginNavigation(userDetails, effectiveEmail);
            }
        } catch (e) {
            console.error('❌ Google login completion error:', e.code, e.message);
            const failedSubdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            logLoginAttempt({
                email: 'unknown',
                status: 'failed',
                login_method: loginMethod,
                failure_reason: 'google_auth_error',
                error_message: e.message,
                error_code: e.code,
                advisor_subdomain: failedSubdomain,
            });

            let userMessage = 'Google sign-in failed. Please try again.';
            const code = e.code || '';
            const msg = (e.message || '').toLowerCase();
            if (code === 'auth/network-request-failed' || msg.includes('network') || msg.includes('socket') || msg.includes('econnrefused') || msg.includes('unable to resolve host')) {
                userMessage = 'No internet connection. Please check your network and try again.';
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
                userMessage = 'Connection timed out. Please try again.';
            } else if (code === 'auth/account-exists-with-different-credential') {
                userMessage = 'An account with this email already exists. Please sign in with your original method.';
            } else if (code === 'auth/user-disabled') {
                userMessage = 'This account has been disabled. Please contact support.';
            } else if (code === 'auth/too-many-requests') {
                userMessage = 'Too many attempts. Please try again later.';
            } else if (e.response?.status >= 500) {
                userMessage = 'Server error. Please try again in a moment.';
            } else if (e.response?.status === 401) {
                userMessage = 'Authentication failed. Please try again.';
            }
            setError(userMessage);
            setErrorShow(true);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoogleLogin = useCallback(async () => {
        if (loading) return;
        setErrorShow(false);

        // MarketAnalysis keeps the Web OAuth fallback on Android until every
        // production signing certificate is registered in its Firebase app.
        // The Web client ID is not bound to an APK certificate fingerprint.
        if (Platform.OS === 'android') {
            if (!config?.googleWebClientId) {
                setError('Google sign-in is not configured for this app.');
                setErrorShow(true);
                return;
            }
            setGoogleWebSignInVisible(true);
            return;
        }

        try {
            setLoading(true);
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult?.idToken || signInResult?.data?.idToken || null;
            await completeGoogleSignIn({
                idToken,
                googleEmail: signInResult?.user?.email || signInResult?.data?.user?.email || null,
                googleName: signInResult?.user?.name || signInResult?.data?.user?.name || null,
                googlePhoto: signInResult?.user?.photo || signInResult?.data?.user?.photo || null,
                loginMethod: 'google_native',
            });
        } catch (e) {
            if (e.code === 'SIGN_IN_CANCELLED' || e.code === '12501' || e.message?.toLowerCase().includes('cancel')) {
                setLoading(false);
                return;
            }
            console.error('❌ Google login error:', e.code, e.message);
            setError('Google sign-in failed. Please try again.');
            setErrorShow(true);
            setLoading(false);
        }
    }, [completeGoogleSignIn, config?.googleWebClientId, loading]);

    const handleGoogleWebIdToken = useCallback(async (idToken) => {
        setGoogleWebSignInVisible(false);
        await completeGoogleSignIn({idToken, loginMethod: 'google_web'});
    }, [completeGoogleSignIn]);

    const handleGoogleWebError = useCallback((e) => {
        console.error('❌ Google web sign-in error:', e?.message);
        setGoogleWebSignInVisible(false);
        setError('Google sign-in was cancelled or failed. Please try again.');
        setErrorShow(true);
    }, []);

    const completeAppleSignIn = async (user, userEmail, fullName) => {
        try {
            setLoading(true);
            // Apple returns `fullName` ONLY on the first-ever authorization
            // for an Apple ID — on any re-install or re-login it is null. The
            // old code fell through to the literal 'Apple User', wrote it onto
            // the Firebase profile AND POSTed it as the backend account name,
            // so `userDetails.name` itself became "Apple User" and every
            // greeting rendered it permanently. Never persist a placeholder:
            // fall back to the typed email's local part, which is a real,
            // user-recognisable identity.
            const nameFromEmail = String(userEmail || '').split('@')[0].trim();
            let displayName = user.displayName;
            if (isPlaceholderName(displayName)) {
                displayName = null;
            }
            if (!displayName && fullName) {
                const nameParts = [fullName.givenName, fullName.familyName].filter(Boolean);
                displayName = nameParts.join(' ') || null;
            }
            displayName = displayName || nameFromEmail || '';

            // Persist displayName onto the Firebase user so downstream reads
            // (TradeContext auth.currentUser.displayName, Home greeting) have
            // it. Apple's identityToken doesn't carry displayName the way
            // Google's credential does — without updateProfile the Firebase
            // user stays permanently nameless, which is why the Home header
            // renders "Hello," with no name after Apple sign-in even when
            // the backend user was created with the right name.
            try {
                // Also repair a profile that already carries the old
                // 'Apple User' placeholder from a previous build.
                if (
                    displayName &&
                    (!user.displayName ||
                        isPlaceholderName(user.displayName) ||
                        user.photoURL == null)
                ) {
                    await user.updateProfile({
                        displayName,
                        photoURL: user.photoURL || null,
                    });
                }
            } catch (updateErr) {
                console.warn('Apple: user.updateProfile failed (non-fatal):', updateErr?.message);
            }

            // CRITICAL: lowercase the email before every backend call.
            // The backend's POST /api/user/ (aq_backend_github/Routes/userRoutes.js:381)
            // stores email VERBATIM but its GET /api/user/getUser/:email
            // (same file line 278) lowercases the URL param before the mongo
            // lookup. Apple's identityToken can carry a mixed-case email
            // (Firebase preserves the case) — if we POST as-is, backend
            // stores "Pratik@Gmail.com"; when the downstream
            // TradeContext.getUserDeatils() GETs, backend lowercases the
            // URL to "pratik@gmail.com" and returns 404 because the stored
            // email doesn't match. Google's flow doesn't hit this because
            // Google always issues lowercase emails.
            // Normalize once, use everywhere so POST and every GET agree.
            // The PASSED userEmail wins over Firebase's user.email: for
            // Apple "Hide My Email" flows user.email is a
            // @privaterelay.appleid.com alias (or null) and userEmail is
            // the real address the user typed on EmailScreenAppleLogin —
            // creating the record under the relay alias orphans the user
            // from their subscription/plans (2026-07-20).
            const effectiveEmail = String(userEmail || user.email).trim().toLowerCase();

            // Persist the resolved account identity: every consumer of
            // utils/accountEmail (TradeContext, App.js, SplashScreen, and
            // every screen using useAccountEmail/getAccountEmail) cannot
            // rely on auth.currentUser.email for Apple sign-ins — it stays
            // null / relay-aliased for the life of the Firebase user.
            // setAccountEmail persists AND updates the in-memory cache that
            // getAccountEmail() serves synchronously, then emits
            // ACCOUNT_EMAIL_EVENT so already-mounted screens (whose auth
            // listener fired BEFORE this point, at signInWithCredential,
            // and read an empty key) hydrate without waiting for another
            // auth-state change.
            try {
                await setAccountEmail(effectiveEmail);
            } catch (persistErr) {
                console.warn('aq_account_email persist failed (non-fatal):', persistErr?.message);
            }

            await axios.post(
                `${server.server.baseUrl}api/user/`,
                {
                    email: effectiveEmail,
                    name: displayName,
                    imageUrl: user.photoURL || null,
                    firebaseId: user.uid,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                    },
                },
            );

            const userDetails = await axios.get(
                `${server.server.baseUrl}api/user/getUser/${effectiveEmail}?includeAdvisorConfig=true`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getBuildTenantSubdomain(),
                        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                    },
                },
            );

            const subdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            trackAppUser({ email: effectiveEmail, firebase_id: user.uid, name: displayName, login_method: 'apple', advisor_subdomain: subdomain });
            logLoginAttempt({ email: effectiveEmail, firebase_id: user.uid, status: 'success', login_method: 'apple', advisor_subdomain: subdomain });

            await handlePostLoginNavigation(userDetails, effectiveEmail);
        } catch (e) {
            console.error('Error completing Apple Sign-In:', e);
            setError(e.message || 'Failed to complete sign in');
            setErrorShow(true);
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = useCallback(async () => {
        if (Platform.OS !== 'ios') return;
        try {
            setErrorShow(false);
            setLoading(true);
            if (!appleAuth.isSupported) {
                throw new Error('Sign in with Apple is not supported on this device.');
            }
            const appleAuthRequestResponse = await appleAuth.performRequest({
                requestedOperation: appleAuth.Operation.LOGIN,
                requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
            });
            const { identityToken, nonce, fullName, email: appleEmail } = appleAuthRequestResponse;
            if (!identityToken) throw new Error('Apple Sign-In failed - no identity token returned');
            // getCredentialStateForUser is best-effort: on some devices (esp. iPad)
            // it can return NOT_FOUND immediately after a successful login even
            // though the identityToken is valid. Log and continue rather than
            // erroring out — Firebase will reject the token if it's actually bad.
            try {
                const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);
                if (credentialState !== appleAuth.State.AUTHORIZED) {
                    console.warn('Apple credentialState was not AUTHORIZED:', credentialState);
                }
            } catch (stateErr) {
                console.warn('Apple credentialState check failed:', stateErr?.message);
            }

            const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
            const response = await auth().signInWithCredential(appleCredential);

            if (response) {
                const user = response.user;
                // Apple ALWAYS returns an email — either the real address
                // ("Share My Email") or a @privaterelay.appleid.com alias
                // ("Hide My Email"). The relay is a real, forwarding address
                // and therefore a valid, STABLE account identity (it is the
                // same alias on every login for this Apple ID + app). Per App
                // Store Review Guideline 4 (Design → Sign in with Apple) we
                // MUST use the email the Authentication Services framework
                // provides and MUST NOT require the user to type it — so we
                // accept whatever Apple gives, relay included, as the identity.
                //   • appleEmail is populated ONLY on the first authorization.
                //   • user.email (Firebase) carries it on every subsequent
                //     login, since Firebase persists the address from first
                //     sign-in.
                // Account-linking to a different (real-email) account is a
                // separate, OPTIONAL, user-initiated flow after login — never
                // a gate here (that mandatory email screen is exactly what
                // Guideline 4 rejects).
                const userEmail = user.email || appleEmail || null;
                if (!userEmail) {
                    // Should not happen after a valid first authorization
                    // (Apple always supplies an email and Firebase persists
                    // it). If it somehow does, surface an error rather than
                    // blocking on an email-entry screen (Guideline 4).
                    setLoading(false);
                    setError('Apple did not return an email for this account. Please try signing in again.');
                    setErrorShow(true);
                    return;
                }
                await completeAppleSignIn(user, userEmail, fullName);
            }
        } catch (e) {
            console.error('Apple login error:', e);
            if (e.code === appleAuth.Error.CANCELED) {
                setLoading(false);
                return;
            }
            const failedSubdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            logLoginAttempt({
                email: 'unknown',
                status: 'failed',
                login_method: 'apple',
                failure_reason: 'apple_auth_error',
                error_message: e.message,
                error_code: e.code,
                advisor_subdomain: failedSubdomain,
            });

            let userMessage = 'Apple sign-in failed. Please try again.';
            const code = e.code || '';
            const msg = (e.message || '').toLowerCase();
            if (code === 'auth/network-request-failed' || msg.includes('network') || msg.includes('socket') || msg.includes('econnrefused') || msg.includes('unable to resolve host')) {
                userMessage = 'No internet connection. Please check your network and try again.';
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
                userMessage = 'Connection timed out. Please try again.';
            } else if (code === 'auth/account-exists-with-different-credential') {
                userMessage = 'An account with this email already exists. Please sign in with your original method.';
            } else if (code === 'auth/user-disabled') {
                userMessage = 'This account has been disabled. Please contact support.';
            } else if (e.response?.status >= 500) {
                userMessage = 'Server error. Please try again in a moment.';
            } else if (e.response?.status === 401) {
                userMessage = 'Authentication failed. Please try again.';
            }
            setError(userMessage);
            setErrorShow(true);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]);

    const dismissKeyboard = useCallback(() => {
        setErrorShow(false);
        Keyboard.dismiss();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            return () => setErrorShow(false);
        }, []),
    );

    const Presentation = useComponent('screens.LoginScreen');

    return (
        <>
            <Presentation
                viewModel={{
                    email,
                    password,
                    isPasswordVisible,
                    error,
                    errorShow,
                    isLoading: loading,
                    logoComponent: LogoComponent,
                    configLoading,
                    whiteLabelText: Config?.REACT_APP_WHITE_LABEL_TEXT,
                    showAppleButton: Platform.OS === 'ios',
                    // Variant-facing tagline overrides — alphanomy reads these
                    // to swap its built-in tenant copy. See
                    // src/context/ConfigContext.js § TENANT TAGLINES for the shape.
                    taglines: config?.taglines?.login || null,
                }}
                actions={{
                    onEmailChange: setEmail,
                    onPasswordChange: setPassword,
                    onPasswordVisibilityToggle: () => setIsPasswordVisible((p) => !p),
                    onLogin: signInWithEmail,
                    onGoogleLogin: handleGoogleLogin,
                    onAppleLogin: handleAppleLogin,
                    onForgotPassword: () => navigation.navigate('ResetPassword'),
                    onNavigateToSignup: () => navigation.navigate('Signup'),
                    dismissKeyboard,
                }}
            />
            <GoogleWebSignInModal
                visible={googleWebSignInVisible}
                onClose={() => setGoogleWebSignInVisible(false)}
                onIdToken={handleGoogleWebIdToken}
                onError={handleGoogleWebError}
                webClientId={config?.googleWebClientId}
                firebaseAuthDomain={
                    Config?.REACT_APP_FIREBASE_AUTH_DOMAIN ||
                    (Config?.REACT_APP_FIREBASE_PROJECT_ID
                        ? `${Config.REACT_APP_FIREBASE_PROJECT_ID}.firebaseapp.com`
                        : '')
                }
            />
        </>
    );
};

export default LoginScreen;
