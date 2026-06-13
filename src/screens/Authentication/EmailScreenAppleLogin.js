/**
 * EmailScreenAppleLogin — container (Phase F, 2026-05-01)
 *
 * Owns email input state, validation, and the route.params.onSubmit
 * dispatch. Renders the presentation resolved via
 * `screens.EmailScreenAppleLogin`.
 */

import React, { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const EmailScreenAppleLogin = ({ route }) => {
    const navigation = useNavigation();
    const config = useConfig();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { onSubmit } = route?.params || {};

    const handleSubmit = useCallback(async () => {
        if (!email.trim()) {
            Toast.show({ type: 'error', text1: '', text2: 'Please enter your email address' });
            return;
        }
        if (!validateEmail(email)) {
            Toast.show({ type: 'error', text1: '', text2: 'Please enter a valid email address' });
            return;
        }
        try {
            setIsLoading(true);
            if (onSubmit) onSubmit(email.toLowerCase());
            navigation.goBack();
        } catch (error) {
            console.error('Error submitting email:', error);
            Toast.show({ type: 'error', text1: '', text2: 'Something went wrong. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    }, [email, navigation, onSubmit]);

    const handleCancel = useCallback(() => {
        if (onSubmit) onSubmit(null);
        navigation.goBack();
    }, [navigation, onSubmit]);

    const Presentation = useComponent('screens.EmailScreenAppleLogin');

    return (
        <Presentation
            viewModel={{
                email,
                isLoading,
                gradient: { start: config?.gradient1, end: config?.gradient2 },
            }}
            actions={{
                onEmailChange: setEmail,
                onSubmit: handleSubmit,
                onCancel: handleCancel,
            }}
        />
    );
};

export default EmailScreenAppleLogin;
