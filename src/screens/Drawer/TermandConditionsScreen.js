/**
 * TermandConditionsScreen — container (Phase G, 2026-05-02)
 *
 * Owns URL validation + navigation guards. Renders presentation resolved
 * as `screens.TermandConditionsScreen`.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';
import Config from 'react-native-config';

import { designColor } from '../../design/literalTokens';

const TermsandConditionsScreen = () => {
    const { configData } = useTrade();
    const config = useConfig();
    const tncURL = configData?.config?.REACT_APP_ADVISOR_TERMS_AND_CONDITION || config?.termsAndConditions || config?.terms_and_condition || Config.REACT_APP_ADVISOR_TERMS_AND_CONDITION;
    const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
    const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';
    const mainColor = config?.mainColor || designColor('0056b7');
    const [isValidUrl, setIsValidUrl] = useState(true);
    const navigation = useNavigation();

    useEffect(() => {
        if (!tncURL) {
            setIsValidUrl(false);
            return;
        }

        const urlPattern =
            /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w-./?%&=]*)?$/i;
        setIsValidUrl(urlPattern.test(tncURL));
    }, [tncURL]);

    const handleShouldStartLoadWithRequest = useCallback(
        (request) => {
            if (request.url === tncURL) return true;
            if (
                request.url.startsWith(tncURL + '#') ||
                request.url === 'about:blank'
            )
                return true;
            navigation.goBack();
            return false;
        },
        [tncURL, navigation],
    );

    const Presentation = useComponent('screens.TermandConditionsScreen');

    return (
        <Presentation
            viewModel={{
                tncURL,
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

export default TermsandConditionsScreen;
