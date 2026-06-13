/**
 * ResetPassword — container (Phase F, 2026-05-01)
 *
 * Owns the Firebase sendPasswordResetEmail call + form state. Renders
 * presentation resolved as `screens.ResetPassword`.
 */

import React, { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
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
        try {
            await auth().sendPasswordResetEmail(email.trim());
            setSuccess(true);
        } catch (e) {
            setError(e.message);
            setErrorShow(true);
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
