/**
 * ResetPassword — container (Phase F, 2026-05-01)
 *
 * Owns the password-reset request + form state. Renders presentation
 * resolved as `screens.ResetPassword`.
 *
 * 2026-07-18: reset requests now go through the backend
 * (POST /api/auth/send-password-reset) instead of the client-side
 * Firebase sendPasswordResetEmail(). The backend generates the same
 * Firebase-hosted reset link but delivers it via the advisor-branded
 * Zepto pipeline (proper sender domain + SPF/DKIM) and records every
 * send in <advisor_db>.password_reset_audit — client-side Firebase
 * sends were invisible to ops and went out from
 * noreply@<project>.firebaseapp.com. The client-side call is kept ONLY
 * as a fallback when the backend is unreachable (fail-open).
 */

import React, { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';
import auth from '@react-native-firebase/auth';
import Config from 'react-native-config';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';

const ResetPasswordScreen = () => {
    const config = useConfig();
    const { logo: LogoComponent, themeColor, mainColor, configLoading } = config || {};
    const iconColor = mainColor || themeColor || 'rgba(100, 199, 59, 1)';

    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorShow, setErrorShow] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = useCallback(async () => {
        setLoading(true);
        setErrorShow(false);
        setSuccess(false);
        if (!email) {
            setError('Email is required');
            setErrorShow(true);
            setLoading(false);
            return;
        }
        const trimmedEmail = email.trim();
        try {
            const response = await axios.post(
                `${server.server.baseUrl}api/auth/send-password-reset`,
                { email: trimmedEmail },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getAdvisorSubdomain(),
                        'aq-encrypted-key': generateToken(
                            Config.REACT_APP_AQ_KEYS,
                            Config.REACT_APP_AQ_SECRET,
                        ),
                    },
                    timeout: 15000,
                },
            );
            if (response.data?.success === false) {
                setError(
                    response.data?.message ||
                        'Could not send reset email. Please try again.',
                );
                setErrorShow(true);
            } else {
                setSuccess(true);
            }
        } catch (e) {
            // Backend rejected the request outright (4xx, e.g. malformed
            // email) — surface its message, no fallback.
            if (e.response && e.response.status < 500) {
                setError(
                    e.response.data?.message ||
                        'Could not send reset email. Please try again.',
                );
                setErrorShow(true);
            } else {
                // Backend unreachable / 5xx — fall back to the client-side
                // Firebase sender so the user isn't stranded.
                try {
                    await auth().sendPasswordResetEmail(trimmedEmail);
                    setSuccess(true);
                } catch (fbErr) {
                    setError(fbErr.message);
                    setErrorShow(true);
                }
            }
        } finally {
            setLoading(false);
        }
    }, [email]);

    const dismissError = useCallback(() => {
        setErrorShow(false);
        Keyboard.dismiss();
    }, []);

    const Presentation = useComponent('screens.ResetPassword');

    return (
        <Presentation
            viewModel={{
                email,
                error,
                errorShow,
                success,
                isLoading: loading,
                gradient: { start: config?.gradient1, end: config?.gradient2 },
                logoComponent: LogoComponent,
                whiteLabelText: config?.REACT_APP_WHITE_LABEL_TEXT,
                iconColor,
                configLoading,
            }}
            actions={{
                onEmailChange: setEmail,
                onSubmit: handleResetPassword,
                onDismissError: dismissError,
                onNavigateBack: () => navigation.navigate('Login'),
            }}
        />
    );
};

export default ResetPasswordScreen;
