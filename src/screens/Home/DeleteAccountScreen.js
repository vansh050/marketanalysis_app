import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {getAuth, signOut} from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {clearAccountEmail} from '../../utils/accountEmail';
import {useConfig} from '../../context/ConfigContext';
import {useTrade} from '../TradeContext';
import server from '../../utils/serverConfig';
import {getAuthedHeaders} from '../../utils/courseAuthHeaders';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

const CONFIRM_WORD = 'DELETE';

const DeleteAccountScreen = ({navigation}) => {
  const config = useConfig();
  const Presentation = useComponent('screens.DeleteAccountScreen');
  const {
    setUserDetails,
    setIsProfileCompleted,
    setHasFetchedTrades,
    setFunds,
    setstockRecoNotExecutedfinal,
    setModelPortfolioStrategyfinal,
    setBroker,
  } = useTrade();
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const headers = await getAuthedHeaders();
        const response = await fetch(`${server.server.baseUrl}api/account/delete-account/preview`, {method: 'GET', headers});
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok && data?.success) setPreview(data);
      } catch (error) {
        console.warn('[DeleteAccount] preview failed:', error?.message);
      } finally {
        if (mounted) setLoadingPreview(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const finishLogout = async () => {
    try {
      try {
        await GoogleSignin.signOut();
      } catch {}
      await signOut(getAuth());
      await AsyncStorage.removeItem('cartItems');
      await clearAccountEmail();
    } catch (error) {
      console.warn('[DeleteAccount] post-delete signout:', error?.message);
    }
    setUserDetails?.(null);
    setHasFetchedTrades?.(false);
    setIsProfileCompleted?.(false);
    setFunds?.({});
    setBroker?.(null);
    setstockRecoNotExecutedfinal?.([]);
    setModelPortfolioStrategyfinal?.([]);
    navigation.replace('Login');
  };

  const doDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD || deleting) return;
    setDeleting(true);
    try {
      const headers = await getAuthedHeaders();
      const response = await fetch(`${server.server.baseUrl}api/account/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({confirmDeletion: true}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        Alert.alert(
          'Account deleted',
          'Your account has been deleted. You will now be signed out.',
          [{text: 'OK', onPress: finishLogout}],
          {cancelable: false},
        );
      } else if (response.status === 401 || data?.requiresReauth) {
        Alert.alert(
          'Please sign in again',
          'Your session has expired. Sign in again and retry deleting your account.',
          [{text: 'OK', onPress: () => navigation.replace('Login')}],
        );
      } else {
        setDeleting(false);
        Alert.alert('Could not delete account', data?.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setDeleting(false);
      Alert.alert('Could not delete account', 'Please check your connection and try again.');
    }
  };

  const confirmAndDelete = () => Alert.alert(
    'Delete account?',
    'This permanently deletes your account. This cannot be undone.',
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: doDelete},
    ],
  );

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;
  return (
    <Presentation
      viewModel={{
        primary: config?.gradient2 || config?.buttonColor || designColor('0056b7'),
        danger: designColor('d92d20'),
        loadingPreview,
        preview,
        confirmText,
        deleting,
        canDelete,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        onConfirmTextChange: setConfirmText,
        onConfirmDelete: confirmAndDelete,
      }}
    />
  );
};

export default DeleteAccountScreen;
