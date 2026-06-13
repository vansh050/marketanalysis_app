/**
 * ChangeAdvisor — container (Phase F batch 4, 2026-05-01)
 *
 * Owns RA-ID load (AsyncStorage + getRaId + getUserData fallback chain),
 * validation, updateRACodeAndConfig, and restart-app orchestration:
 * RNRestart.Restart → DevSettings.reload → softRestart (reloadConfigData +
 * getAllTrades + getModelPortfolioStrategyDetails + nav reset to Home).
 * Handlers preserved from pre-migration.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, NativeModules } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTrade } from '../TradeContext';
import { updateRACodeAndConfig, getRaId, getUserData } from '../../utils/storageUtils';
import { useComponent } from '../../design/useDesign';

let RNRestart = null;
try {
    RNRestart = require('react-native-restart').default;
} catch (e) {
    console.warn('react-native-restart not available:', e);
}

const ChangeAdvisor = () => {
    const [currentRAId, setCurrentRAId] = useState('');
    const [newRAId, setNewRAId] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = user?.email;
    const navigation = useNavigation();

    const { getAllTrades, getModelPortfolioStrategyDetails, reloadConfigData } = useTrade();

    useEffect(() => {
        const loadCurrentRAId = async () => {
            try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                let raId = await AsyncStorage.getItem('@app:raId');
                if (!raId) raId = await getRaId();
                if (!raId) {
                    const userData = await getUserData();
                    raId = userData?.raId;
                }
                setCurrentRAId(raId || '');
                setNewRAId(raId || '');
            } catch (e) {
                console.error('Error loading current RA ID:', e);
            } finally {
                setInitialLoading(false);
            }
        };
        loadCurrentRAId();
    }, []);

    const handleTextInputChange = useCallback((text) => {
        setNewRAId(text.replace(/\s/g, '').toUpperCase());
    }, []);

    const softRestart = useCallback(async () => {
        try {
            await reloadConfigData();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await getAllTrades();
            await getModelPortfolioStrategyDetails();
            navigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }),
            );
            Alert.alert('Success', 'Configuration updated successfully');
        } catch (e) {
            console.error('Error in soft restart:', e);
            Alert.alert('Info', 'Please restart the app manually');
        }
    }, [reloadConfigData, getAllTrades, getModelPortfolioStrategyDetails, navigation]);

    const alternativeRestart = useCallback(() => {
        try {
            if (__DEV__) {
                const { DevSettings } = NativeModules;
                if (DevSettings && DevSettings.reload) {
                    DevSettings.reload();
                } else {
                    softRestart();
                }
            } else {
                softRestart();
            }
        } catch (e) {
            console.error('Error with alternative restart:', e);
            softRestart();
        }
    }, [softRestart]);

    const restartApp = useCallback(() => {
        try {
            if (RNRestart && RNRestart.Restart) {
                setTimeout(() => RNRestart.Restart(), 1000);
            } else {
                alternativeRestart();
            }
        } catch (e) {
            console.error('Error with RNRestart:', e);
            alternativeRestart();
        }
    }, [alternativeRestart]);

    const performUpdate = useCallback(async (processedRAId) => {
        setLoading(true);
        try {
            const result = await updateRACodeAndConfig(processedRAId, userEmail);
            if (result.success) {
                Alert.alert(
                    'Success',
                    'RA ID updated successfully. The app will restart now.',
                    [{ text: 'Restart', onPress: () => restartApp() }],
                );
            } else {
                const errorMessage = result.error || 'Failed to update RA ID';
                if (
                    errorMessage.includes('Advisor not found') ||
                    errorMessage.includes('not found') ||
                    errorMessage.includes('invalid') ||
                    errorMessage.includes('wrong details')
                ) {
                    Alert.alert('Invalid RA ID', 'You have entered wrong details. Please check your RA ID and try again.');
                } else {
                    Alert.alert('Error', 'You have entered wrong details. Please check your RA ID and try again.');
                }
            }
        } catch (e) {
            console.error('Error in performUpdate:', e);
            if (
                e.message?.includes('Advisor not found') ||
                e.message?.includes('not found') ||
                e.message?.includes('Unable to verify advisor') ||
                e.message?.includes('wrong details')
            ) {
                Alert.alert('Invalid RA ID', 'You have entered wrong details. Please verify your RA ID and try again.');
            } else if (e.message?.includes('Network') || e.code === 'NETWORK_ERROR') {
                Alert.alert('Network Error', 'Please check your internet connection and try again.');
            } else {
                Alert.alert('Error', 'Failed to update RA ID. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [userEmail, restartApp]);

    const handleUpdateRACode = useCallback(() => {
        const trimmedAndUpperRAId = newRAId.trim().toUpperCase();

        if (!trimmedAndUpperRAId) {
            Alert.alert('Invalid Input', 'Please enter a valid RA ID without spaces');
            return;
        }
        if (trimmedAndUpperRAId.length < 2) {
            Alert.alert('Invalid Input', 'RA ID must be at least 2 characters long');
            return;
        }
        if (trimmedAndUpperRAId === currentRAId.trim().toUpperCase()) {
            Alert.alert('No Changes', 'New RA ID is the same as current RA ID');
            return;
        }

        setNewRAId(trimmedAndUpperRAId);

        Alert.alert(
            'Confirm Update',
            `Update RA ID to: ${trimmedAndUpperRAId}\n\nThis will refresh the app with new configuration. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Update', onPress: () => performUpdate(trimmedAndUpperRAId) },
            ],
        );
    }, [newRAId, currentRAId, performUpdate]);

    const Presentation = useComponent('screens.ChangeAdvisor');

    return (
        <Presentation
            viewModel={{
                currentRAId,
                newRAId,
                isLoading: loading,
                isInitialLoading: initialLoading,
            }}
            actions={{
                onNewRAIdChange: handleTextInputChange,
                onUpdateRACode: handleUpdateRACode,
                onBack: () => navigation?.goBack?.(),
                // Routes to the design-system NotificationListScreen
                // (HTML § "08 · Notifications" port). The legacy
                // PushNotificationScreen route is still registered but
                // no in-app bell points at it on the alphanomy fork.
                onOpenNotifications: () => navigation.navigate('NotificationListScreen'),
            }}
        />
    );
};

export default ChangeAdvisor;
