/**
 * LogOutScreen — container (Phase F, 2026-05-01)
 *
 * Owns the full logout orchestration: GoogleSignin.signOut (best-effort) →
 * Firebase signOut → AsyncStorage clear → context state reset → navigate to
 * Login. Renders the presentation resolved from the registry as
 * `screens.LogOutScreen`.
 */

import React, { useEffect } from 'react';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';

const LogoutScreen = ({ navigation }) => {
    const config = useConfig();
    const {
        setUserDetails,
        setIsProfileCompleted,
        setHasFetchedTrades,
        setFunds,
        setstockRecoNotExecutedfinal,
        setModelPortfolioStrategyfinal,
        setBroker,
    } = useTrade();

    const auth = getAuth();

    useEffect(() => {
        if (config?.googleWebClientId) {
            GoogleSignin.configure({
                webClientId: config.googleWebClientId,
                // iOS-only client ID, sourced per-tenant from config (see
                // LoginScreen for the full rationale). No-op when unset.
                ...(config.googleIosClientId
                    ? { iosClientId: config.googleIosClientId }
                    : {}),
            });
        }
    }, [config?.googleWebClientId]);

    useEffect(() => {
        const handleLogout = async () => {
            try {
                try {
                    await GoogleSignin.signOut();
                } catch {
                    // Google may not have been used — ignore.
                }
                await signOut(auth);
                await AsyncStorage.removeItem('cartItems');
                setUserDetails(null);
                setHasFetchedTrades(false);
                setIsProfileCompleted(false);
                setFunds({});
                setBroker(null);
                setstockRecoNotExecutedfinal([]);
                setModelPortfolioStrategyfinal([]);
                navigation.replace('Login');
            } catch (error) {
                console.error('Error signing out: ', error);
                navigation.replace('Login');
            }
        };
        handleLogout();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const Presentation = useComponent('screens.LogOutScreen');

    return (
        <Presentation
            viewModel={{
                gradient: { start: config?.gradient1, end: config?.gradient2 },
            }}
            actions={{}}
        />
    );
};

export default LogoutScreen;
