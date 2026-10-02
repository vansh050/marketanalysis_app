/**
 * PhoneNumberScreen — container (Phase F batch 3, 2026-05-01)
 *
 * Owns phone validation + axios profile-update + post-success navigation.
 * Handlers preserved from pre-migration, with one incidental fix: the legacy
 * file referenced `Config.REACT_APP_AQ_KEYS` / `Config.REACT_APP_AQ_SECRET`
 * without importing `Config` (a pre-existing ReferenceError bug). Added the
 * `import Config from 'react-native-config'` line to make the call actually
 * work. Noted in CHANGELOG.
 */

import React, { useCallback, useState } from 'react';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import { useTrade } from '../TradeContext';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useConfig } from '../../context/ConfigContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import { useComponent } from '../../design/useDesign';
import { normalizePaymentPhone } from '../../utils/paymentPhone';
import LogoSection from '../../components/LogoSection';

import { designFont } from '../../design/literalTokens';

const calculateProfileCompletion = (email, name, phone, telegram = false, telegramId = '') => {
    let completedFields = 0;
    const totalFields = 3;
    if (email) completedFields++;
    if (name) completedFields++;
    if (phone) completedFields++;
    if (telegram && telegramId) completedFields++;
    return Math.round((completedFields / totalFields) * 100);
};

const PhoneNumberScreen = () => {
    const config = useConfig();
    const advisorName = config?.appName || config?.apiKeys?.advisorSpecificTag || getAdvisorSubdomain();
    const { userEmail, setIsProfileCompleted } = useTrade();
    const navigation = useNavigation();

    const [countryCode, setCountryCode] = useState('+91');
    const [country, setCountry] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showTelegram, setShowTelegram] = useState(false);
    const [userTelegram, setUserTelegram] = useState('');
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const auth = getAuth();
    const user = auth.currentUser;
    void user;

    const showToast = (message1, type, message2) => {
        Toast.show({
            type,
            text2: message2 + ' ' + message1,
            position: 'top',
            text1Style: { color: 'black', fontSize: 11, fontFamily: designFont('Poppins-Medium') },
            text2Style: { color: 'black', fontSize: 12, fontFamily: designFont('Poppins-Regular') },
        });
    };

    const handleProceed = useCallback(async () => {
        try {
            const normalizedPhone = normalizePaymentPhone(phoneNumber, countryCode);
            if (!normalizedPhone.e164) {
                Toast.show({ type: 'error', text1: '', text2: 'Please enter a valid phone number.' });
                return;
            }

            setIsLoading(true);

            const profileCompletion = calculateProfileCompletion(
                userEmail,
                userName,
                normalizedPhone.nationalNumber,
                showTelegram,
                showTelegram ? userTelegram : '',
            );

            const response = await axios.put(
                `${server.server.baseUrl}api/user/update-profile`,
                {
                    email: userEmail,
                    advisorName,
                    phoneNumber: normalizedPhone.nationalNumber,
                    countryCode: normalizedPhone.countryCode,
                    telegramId: showTelegram ? userTelegram : '',
                    userName,
                    profileCompletion,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getTenantSubdomain(),
                        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                    },
                },
            );

            if (response.status === 200) {
                setIsProfileCompleted(true);
                showToast('Phone Number Updated Successfully', 'success', '');
                navigation.navigate('Home');
            } else {
                Toast.show({ type: 'error', text1: '', text2: 'Something went wrong. Please try again.' });
            }
        } catch (e) {
            console.error('Error updating profile:', e);
            Toast.show({ type: 'error', text1: '', text2: 'Failed to update profile.' });
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phoneNumber, userName, userEmail, showTelegram, userTelegram, countryCode, advisorName]);

    const Presentation = useComponent('screens.PhoneNumberScreen');

    return (
        <Presentation
            viewModel={{
                countryCode,
                country,
                phoneNumber,
                userName,
                showTelegram,
                userTelegram,
                isLoading,
            }}
            actions={{
                onCountryCodeChange: setCountryCode,
                onCountryChange: setCountry,
                onPhoneChange: setPhoneNumber,
                onUserNameChange: setUserName,
                onTelegramToggle: setShowTelegram,
                onTelegramChange: setUserTelegram,
                onProceed: handleProceed,
            }}
            slots={{ LogoSection }}
        />
    );
};

export default PhoneNumberScreen;
