/**
 * SignupScreen — container (Phase F batch 2, 2026-05-01)
 *
 * Owns Firebase email signup + post-signup orchestration. Handlers
 * preserved as-is from the pre-migration file.
 */

import React, { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useComponent } from '../../design/useDesign';
import {
    checkAndFetchAdvisorConfig,
    setUserData,
    refreshAllAppData,
    updateRACodeAndConfig,
    tryResolveAdvisor,
} from '../../utils/storageUtils';
import { logLoginAttempt, trackAppUser } from '../../FunctionCall/services/LoginLoggingService';

const SignupScreen = () => {
    const { reloadConfigData, setIsProfileCompleted, getAllTrades, getModelPortfolioStrategyDetails } = useTrade();
    const config = useConfig();
    const { logo: LogoComponent, configLoading } = config || {};

    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorShow, setErrorShow] = useState(false);
    const [success] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isChecked, setIsChecked] = useState(false);

    const storeLoginTime = async () => {
        try {
            const now = moment().toISOString();
            await AsyncStorage.setItem('lastActiveTime', now);
        } catch (e) {
            console.error('❌ Error storing login time:', e);
        }
    };

    const handlePostSignupNavigation = async (userDetails, userEmail) => {
        try {
            const hasAdvisorRaCode = Config?.ADVISOR_RA_CODE
                ? Config?.ADVISOR_RA_CODE
                : !!userDetails?.data?.User?.advisor_ra_code;

            setIsProfileCompleted(hasAdvisorRaCode);
            await storeLoginTime();

            if (hasAdvisorRaCode) {
                const advisorRaCode = Config?.ADVISOR_RA_CODE
                    ? Config?.ADVISOR_RA_CODE
                    : userDetails.data.User.advisor_ra_code;

                await setUserData({
                    email: userEmail,
                    advisor_ra_code: advisorRaCode,
                    profileCompleted: true,
                    ...userDetails.data.User,
                });

                const configResult = await checkAndFetchAdvisorConfig(advisorRaCode);

                if (configResult.success) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const refreshResult = await refreshAllAppData();
                    await reloadConfigData();
                    if (refreshResult.isComplete) {
                        await getAllTrades();
                        await getModelPortfolioStrategyDetails();
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        navigation.replace('Home');
                    } else {
                        await getAllTrades();
                        await getModelPortfolioStrategyDetails();
                        navigation.replace('Home');
                    }
                } else if (configResult.advisorExists === false) {
                    navigation.replace('SignUpRADetails', { userEmail });
                } else {
                    await getAllTrades();
                    await getModelPortfolioStrategyDetails();
                    navigation.replace('Home');
                }
            } else {
                await setUserData({
                    email: userEmail,
                    profileCompleted: false,
                    ...userDetails?.data?.User,
                });

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

                await getModelPortfolioStrategyDetails();
                navigation.replace('SignUpRADetails', { userEmail });
            }
        } catch {
            await getModelPortfolioStrategyDetails();
            navigation.replace('SignUpRADetails', { userEmail });
        }
    };

    const showTermsToast = () => {
        Toast.show({ type: 'error', text1: '', text2: 'Please agree to the Terms & Conditions' });
    };

    const handleSignup = useCallback(async () => {
        if (!isChecked) {
            showTermsToast();
            return;
        }
        setLoading(true);
        setErrorShow(false);

        if (!email || !password) {
            setError('Both fields are required');
            setErrorShow(true);
            setLoading(false);
            return;
        }
        if (!name || name.trim().length < 2) {
            setError('Please enter a valid name');
            setErrorShow(true);
            setLoading(false);
            return;
        }

        try {
            const response = await auth().createUserWithEmailAndPassword(email, password);
            if (response) {
                const user = response.user;

                await axios.post(
                    `${server.server.baseUrl}api/user/`,
                    {
                        email: user.email,
                        name: name.trim() || user?.displayName || '',
                        firebaseId: user.uid,
                        phoneNumber: 0,
                        telegramId: '',
                        profileCompletion: 50,
                        user_onBoard_from: Config?.REACT_APP_WHITE_LABEL_TEXT,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getAdvisorSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                const userDetails = await axios.get(
                    `${server.server.baseUrl}api/user/getUser/${user.email}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain': getAdvisorSubdomain(),
                            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                        },
                    },
                );

                trackAppUser({ email: user.email, firebase_id: user.uid, name: name.trim() || user.displayName, login_method: 'email' });
                logLoginAttempt({ email: user.email, firebase_id: user.uid, status: 'success', login_method: 'email' });

                await handlePostSignupNavigation(userDetails, email);
            }
        } catch (e) {
            console.error('❌ Signup error:', e);
            logLoginAttempt({
                email: email || 'unknown',
                status: 'failed',
                login_method: 'email',
                failure_reason: e.code?.includes('auth/') ? 'firebase_error' : 'api_error',
                error_message: e.message,
                error_code: e.code,
            });

            let errorMessage = 'Failed to create account';
            if (e.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please use a different email or sign in.';
            } else if (e.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use a stronger password.';
            } else if (e.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (e.response?.status === 409) {
                errorMessage = 'An account with this email already exists.';
            } else if (e.message) {
                errorMessage = e.message;
            }

            setError(errorMessage);
            setErrorShow(true);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email, password, name, isChecked]);

    const dismissError = useCallback(() => {
        setErrorShow(false);
        Keyboard.dismiss();
    }, []);

    const Presentation = useComponent('screens.SignupScreen');

    return (
        <Presentation
            viewModel={{
                email,
                name,
                password,
                isPasswordVisible,
                isChecked,
                error,
                errorShow,
                success,
                isLoading: loading,
                gradient: { start: config?.gradient1, end: config?.gradient2 },
                logoComponent: LogoComponent,
                configLoading,
                whiteLabelText: Config?.REACT_APP_WHITE_LABEL_TEXT,
                // Variant-facing tagline overrides — alphanomy reads these
                // to swap its built-in tenant copy. See
                // src/context/ConfigContext.js § TENANT TAGLINES for the shape.
                taglines: config?.taglines?.signup || null,
            }}
            actions={{
                onEmailChange: setEmail,
                onNameChange: setName,
                onPasswordChange: setPassword,
                onPasswordVisibilityToggle: () => setIsPasswordVisible((p) => !p),
                onTermsToggle: () => setIsChecked((c) => !c),
                onSignup: handleSignup,
                dismissError,
                onNavigateToLogin: () => navigation.navigate('Login'),
                onOpenTerms: () => navigation.navigate('Terms & Conditions'),
                onOpenPrivacy: () => navigation.navigate('Privacy Policy'),
            }}
        />
    );
};

export default SignupScreen;
