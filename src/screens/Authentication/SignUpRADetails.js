/**
 * SignUpRADetails — container (Phase F batch 3, 2026-05-01)
 *
 * Owns RA-ID validation + updateRACodeAndConfig + reload + tracking +
 * post-success navigation. Handlers preserved from pre-migration.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import Config from '../../utils/safeConfig';
import APP_VARIANTS from '../../utils/Config';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../TradeContext';
import { updateRACodeAndConfig } from '../../utils/storageUtils';
import { logLoginAttempt, trackAppUser } from '../../FunctionCall/services/LoginLoggingService';
import { useComponent } from '../../design/useDesign';

const validateRaId = (raId) => {
    if (!raId || raId.trim().length < 4) {
        return { isValid: false, message: 'RA ID must be at least 4 characters long' };
    }
    if (!/^[A-Za-z0-9]+$/.test(raId.trim())) {
        return { isValid: false, message: 'RA ID contains invalid characters' };
    }
    return { isValid: true };
};

const SignUpRADetails = ({ route }) => {
    const { reloadConfigData, getAllTrades, getModelPortfolioStrategyDetails } = useTrade();
    const navigation = useNavigation();
    const config = useConfig();
    const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
    const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
    const fallbackConfig = APP_VARIANTS[validVariant] || {};

    const logo = config?.logo || fallbackConfig.logo;
    const appName = config?.appName || Config.REACT_APP_WHITE_LABEL_TEXT || 'RGX Research';
    const gradient1 = config?.gradient1 || fallbackConfig.gradient1 || '#03275B';
    const gradient2 = config?.gradient2 || fallbackConfig.gradient2 || '#0156B7';

    const [raId, setRaId] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = user?.email || route?.params?.userEmail;

    const handleCreateAccount = useCallback(async () => {
        try {
            if (!raId) {
                Alert.alert('Error', 'Please enter your RA ID');
                return;
            }
            if (!userEmail) {
                Alert.alert('Error', 'User email not found. Please login again.');
                return;
            }
            const validation = validateRaId(raId);
            if (!validation.isValid) {
                Alert.alert('Invalid RA ID', validation.message);
                return;
            }

            setLoading(true);
            setStatusMessage('Verifying advisor details...');

            const result = await updateRACodeAndConfig(raId.trim(), userEmail);

            if (result.success) {
                setStatusMessage('Configuration stored successfully!');

                const advisorSubdomain =
                    result.configData?.config?.REACT_APP_HEADER_NAME ||
                    result.configData?.config?.subdomain ||
                    result.configData?.subdomain ||
                    raId.toLowerCase().trim();

                if (advisorSubdomain && user) {
                    trackAppUser({
                        email: userEmail,
                        firebase_id: user.uid,
                        name: user.displayName,
                        login_method: 'email',
                        advisor_subdomain: advisorSubdomain,
                    });
                    logLoginAttempt({
                        email: userEmail,
                        firebase_id: user.uid,
                        status: 'success',
                        login_method: 'email',
                        advisor_subdomain: advisorSubdomain,
                    });
                }

                await reloadConfigData();
                getAllTrades().catch((err) => console.error('Trade load error:', err));
                getModelPortfolioStrategyDetails().catch((err) => console.error('Portfolio load error:', err));

                setSuccessModalVisible(true);
            } else if (result.advisorExists === false) {
                Alert.alert(
                    'Invalid RA ID',
                    'The RA ID you entered is not registered in our system. Please contact your financial advisor for the correct RA ID.',
                    [{ text: 'OK' }],
                );
                setStatusMessage('');
            } else if (result.error?.includes('Network Error')) {
                Alert.alert('Network Error', 'Please check your internet connection and try again.', [{ text: 'OK' }]);
                setStatusMessage('');
            } else if (result.error?.includes('Server Error: 400')) {
                Alert.alert('Error', 'Invalid RA ID format. Please check and try again.', [{ text: 'OK' }]);
                setStatusMessage('');
            } else if (result.error?.includes('Server Error: 409')) {
                Alert.alert('Error', 'This RA ID is already registered. Please use a different one or contact support.', [{ text: 'OK' }]);
                setStatusMessage('');
            } else {
                Alert.alert('Error', result.error || 'Failed to create account. Please try again.', [{ text: 'OK' }]);
                setStatusMessage('');
            }
        } catch (e) {
            console.error('❌ Unexpected error in handleCreateAccount:', e);
            Alert.alert('Error', 'An unexpected error occurred. Please try again.', [{ text: 'OK' }]);
            setStatusMessage('');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raId, userEmail]);

    useEffect(() => {
        if (statusMessage && !loading) {
            const timer = setTimeout(() => setStatusMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage, loading]);

    const onSuccessModalOk = useCallback(async () => {
        setModalLoading(true);
        await new Promise((res) => setTimeout(res, 1000));
        setModalLoading(false);
        setSuccessModalVisible(false);
        navigation.replace('Home');
    }, [navigation]);

    const Presentation = useComponent('screens.SignUpRADetails');

    return (
        <Presentation
            viewModel={{
                raId,
                isLoading: loading,
                statusMessage,
                isSuccessModalVisible: successModalVisible,
                isModalLoading: modalLoading,
                gradient: { start: gradient1, end: gradient2 },
                logo,
                appName,
            }}
            actions={{
                onRaIdChange: setRaId,
                onCreateAccount: handleCreateAccount,
                onSuccessModalOk,
                onCloseSuccessModal: () => setSuccessModalVisible(false),
            }}
        />
    );
};

export default SignUpRADetails;
