/**
 * EmailScreenAppleLogin — container (Phase F, 2026-05-01;
 * OTP verification added 2026-07-20)
 *
 * Two steps now:
 *   1. the user types the email their account lives under
 *   2. they enter the 6-digit code we mail to it
 *
 * Step 2 exists for security, not ceremony. Apple "Hide My Email" leaves
 * Firebase without a usable address, so this screen's value is what the whole
 * session is keyed to — and it used to be trusted verbatim. That meant anyone
 * could sign in with Apple, type a victim's address, and have the app fetch
 * and render that victim's account, because the customer data routes are
 * gated only by the shared static key every install ships with. Verifying
 * ownership (and binding the address to the Firebase user server-side) closes
 * that path.
 *
 * The `route.params.onSubmit(email | null)` contract is UNCHANGED — it now
 * fires only after the code is confirmed, so callers (LoginScreen's
 * completeAppleSignIn) need no changes and can still treat the value as
 * "an account this user has proven they own".
 */

import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { getAuth } from '@react-native-firebase/auth';
import { clearAccountEmail } from '../../utils/accountEmail';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';
import {
    requestEmailOtp,
    verifyEmailOtp,
    messageForError,
} from '../../services/AppleEmailVerifyService';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const EmailScreenAppleLogin = ({ route }) => {
    const navigation = useNavigation();
    const config = useConfig();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('email'); // 'email' | 'otp'
    const [isLoading, setIsLoading] = useState(false);
    const { onSubmit } = route?.params || {};

    const fail = useCallback((text2) => {
        Toast.show({ type: 'error', text1: '', text2 });
    }, []);

    // Step 1 — send the code.
    const handleSubmitEmail = useCallback(async () => {
        const value = email.trim().toLowerCase();
        if (!value) {
            fail('Please enter your email address');
            return;
        }
        if (!validateEmail(value)) {
            fail('Please enter a valid email address');
            return;
        }
        setIsLoading(true);
        const res = await requestEmailOtp(value);
        setIsLoading(false);
        if (!res.ok) {
            fail(messageForError(res.error, { retryAfterMs: res.retryAfterMs }));
            return;
        }
        setStep('otp');
        Toast.show({
            type: 'success',
            text1: '',
            text2: `We sent a 6-digit code to ${value}`,
        });
    }, [email, fail]);

    // Step 2 — confirm the code. Only now is the identity handed back.
    const handleSubmitOtp = useCallback(async () => {
        const code = otp.trim();
        if (!/^\d{6}$/.test(code)) {
            fail('Enter the 6-digit code');
            return;
        }
        setIsLoading(true);
        const res = await verifyEmailOtp(email.trim().toLowerCase(), code);
        setIsLoading(false);
        if (!res.ok) {
            fail(messageForError(res.error, { remainingAttempts: res.remainingAttempts }));
            // A dead code can't be retried — send them back to request a new one.
            if (['too_many_attempts', 'expired', 'already_used'].includes(res.error)) {
                setOtp('');
                setStep('email');
            }
            return;
        }

        // The backend merged this throwaway Apple user into the account that
        // already owned the email. The local Firebase session now points at a
        // DELETED uid, so we must NOT continue the sign-in with it — tear it
        // down and let the user re-run Apple sign-in, which now resolves to
        // their real account (Apple is a linked provider on it).
        if (res.reauthRequired) {
            Alert.alert(
                'Account linked',
                `${email.trim().toLowerCase()} already had an account. We've linked Apple sign-in to it — please sign in with Apple once more to continue.`,
                [
                    {
                        text: 'OK',
                        onPress: async () => {
                            try {
                                await clearAccountEmail();
                                await getAuth().signOut();
                            } catch (_) {
                                // Signing out is best-effort; the dead session
                                // fails closed on its next call regardless.
                            }
                            if (onSubmit) onSubmit(null);
                            navigation.goBack();
                        },
                    },
                ],
                { cancelable: false },
            );
            return;
        }

        if (onSubmit) onSubmit(email.trim().toLowerCase());
        navigation.goBack();
    }, [otp, email, onSubmit, navigation, fail]);

    const handleResend = useCallback(async () => {
        setIsLoading(true);
        const res = await requestEmailOtp(email.trim().toLowerCase());
        setIsLoading(false);
        Toast.show({
            type: res.ok ? 'success' : 'error',
            text1: '',
            text2: res.ok
                ? 'A new code is on its way'
                : messageForError(res.error, { retryAfterMs: res.retryAfterMs }),
        });
    }, [email]);

    const handleEditEmail = useCallback(() => {
        setOtp('');
        setStep('email');
    }, []);

    const handleCancel = useCallback(() => {
        if (onSubmit) onSubmit(null);
        navigation.goBack();
    }, [navigation, onSubmit]);

    const Presentation = useComponent('screens.EmailScreenAppleLogin');

    return (
        <Presentation
            viewModel={{
                email,
                otp,
                step,
                isLoading,
                gradient: { start: config?.gradient1, end: config?.gradient2 },
            }}
            actions={{
                onEmailChange: setEmail,
                onOtpChange: setOtp,
                // `onSubmit` stays wired for presentations that predate the OTP
                // step — it targets whichever field is currently visible.
                onSubmit: step === 'email' ? handleSubmitEmail : handleSubmitOtp,
                onSubmitEmail: handleSubmitEmail,
                onSubmitOtp: handleSubmitOtp,
                onResend: handleResend,
                onEditEmail: handleEditEmail,
                onCancel: handleCancel,
            }}
        />
    );
};

export default EmailScreenAppleLogin;
