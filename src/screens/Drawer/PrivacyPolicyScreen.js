/**
 * PrivacyPolicyScreen — container (Phase G, 2026-05-02)
 *
 * Owns URL validation + navigation guards. Renders presentation resolved
 * as `screens.PrivacyPolicyScreen`.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';
import Config from 'react-native-config';

import { designColor } from '../../design/literalTokens';

const PrivacyPolicyScreen = () => {
    const { configData } = useTrade();
    const navigation = useNavigation();
    const config = useConfig();
    const privacyURL = configData?.config?.REACT_APP_ADVISOR_PRIVACY_POLICY || config?.privacyPolicy || config?.privacy_policy || Config.REACT_APP_ADVISOR_PRIVACY_POLICY;
    const gradient1 = config?.gradient1 || designColor('0056b7');
    const gradient2 = config?.gradient2 || designColor('002651');
    const mainColor = config?.mainColor || designColor('0056b7');
    const [isValidUrl, setIsValidUrl] = useState(true);

    useEffect(() => {
        const urlPattern =
            /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w- ./?%&=]*)?$/i;

        if (!privacyURL || !urlPattern.test(privacyURL)) {
            setIsValidUrl(false);
        } else {
            setIsValidUrl(true);
        }
    }, [privacyURL]);

    const handleShouldStartLoadWithRequest = useCallback(
        (request) => {
            if (request.url === privacyURL) return true;
            if (
                request.url.startsWith(privacyURL + '#') ||
                request.url === 'about:blank'
            )
                return true;
            navigation.goBack();
            return false;
        },
        [privacyURL, navigation],
    );

    const Presentation = useComponent('screens.PrivacyPolicyScreen');

    return (
        <Presentation
            viewModel={{
                privacyURL,
                isValidUrl,
                gradient: { start: gradient1, end: gradient2 },
                mainColor,
            }}
            actions={{
                onGoBack: () => navigation.goBack(),
                onShouldStartLoadWithRequest: handleShouldStartLoadWithRequest,
            }}
        />
    );
};

export default PrivacyPolicyScreen;
