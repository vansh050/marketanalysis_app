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
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';

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
            if (inlineConfig) {
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
                                'X-Advisor-Subdomain': getAdvisorSubdomain(),
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
                                'X-Advisor-Subdomain': getAdvisorSubdomain(),
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

    const handleGoogleLogin = useCallback(async () => {
        try {
            setErrorShow(false);
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const { idToken } = await GoogleSignin.signIn();
            if (!idToken) throw new Error('No ID token returned');

            const googleCredential = auth.GoogleAuthProvider.credential(idToken);
            setLoading(true);
            const response = await auth().signInWithCredential(googleCredential);

            if (response) {
                const user = response.user;
                await axios.post(
                    `${server.server.baseUrl}api/user/`,
                    { email: user.email, name: user.displayName, imageUrl: user.photoURL },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getAdvisorSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                const userDetails = await axios.get(
                    `${server.server.baseUrl}api/user/getUser/${user.email}?includeAdvisorConfig=true`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getAdvisorSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                const subdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
                trackAppUser({ email: user.email, firebase_id: user.uid, name: user.displayName, login_method: 'google', advisor_subdomain: subdomain });
                logLoginAttempt({ email: user.email, firebase_id: user.uid, status: 'success', login_method: 'google', advisor_subdomain: subdomain });

                await handlePostLoginNavigation(userDetails, user.email);
            }
        } catch (e) {
            console.error('❌ Google login error:', e.code, e.message);
            if (e.code === 'SIGN_IN_CANCELLED' || e.code === '12501' || e.message?.toLowerCase().includes('cancel')) {
                setLoading(false);
                return;
            }

            const failedSubdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            logLoginAttempt({
                email: 'unknown',
                status: 'failed',
                login_method: 'google',
                failure_reason: 'google_auth_error',
                error_message: e.message,
                error_code: e.code,
                advisor_subdomain: failedSubdomain,
            });

            let userMessage = 'Google sign-in failed. Please try again.';
            const code = e.code || '';
            const msg = (e.message || '').toLowerCase();
            if (code === 'auth/network-request-failed' || code === 'PLAY_SERVICES_NOT_AVAILABLE' || msg.includes('network') || msg.includes('socket') || msg.includes('econnrefused') || msg.includes('unable to resolve host')) {
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

    const completeAppleSignIn = async (user, userEmail, fullName) => {
        try {
            setLoading(true);
            let displayName = user.displayName;
            if (!displayName && fullName) {
                const nameParts = [fullName.givenName, fullName.familyName].filter(Boolean);
                displayName = nameParts.join(' ') || 'Apple User';
            }
            displayName = displayName || 'Apple User';

            await axios.post(
                `${server.server.baseUrl}api/user/`,
                { email: userEmail, name: displayName, imageUrl: user.photoURL || null },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getAdvisorSubdomain(),
                        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                    },
                },
            );

            const userDetails = await axios.get(
                `${server.server.baseUrl}api/user/getUser/${userEmail}?includeAdvisorConfig=true`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getAdvisorSubdomain(),
                        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                    },
                },
            );

            const subdomain = config?.subdomain || config?.advisorRaCode?.toLowerCase();
            trackAppUser({ email: userEmail, firebase_id: user.uid, name: displayName, login_method: 'apple', advisor_subdomain: subdomain });
            logLoginAttempt({ email: userEmail, firebase_id: user.uid, status: 'success', login_method: 'apple', advisor_subdomain: subdomain });

            await handlePostLoginNavigation(userDetails, userEmail);
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
            const appleAuthRequestResponse = await appleAuth.performRequest({
                requestedOperation: appleAuth.Operation.LOGIN,
                requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
            });
            const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);
            if (credentialState !== appleAuth.State.AUTHORIZED) {
                throw new Error('Apple Sign-In was not authorized');
            }
            const { identityToken, nonce, fullName, email: appleEmail } = appleAuthRequestResponse;
            if (!identityToken) throw new Error('Apple Sign-In failed - no identity token returned');

            const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
            const response = await auth().signInWithCredential(appleCredential);

            if (response) {
                const user = response.user;
                let userEmail = appleEmail || user.email;
                if (!userEmail) {
                    setLoading(false);
                    navigation.navigate('EmailScreenAppleLogin', {
                        onSubmit: async (collectedEmail) => {
                            if (collectedEmail) await completeAppleSignIn(user, collectedEmail, fullName);
                        },
                    });
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
    );
};

export default LoginScreen;
