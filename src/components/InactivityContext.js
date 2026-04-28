import React, { createContext, useEffect, useState, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

const InactivityContext = createContext();

const InactivityProvider = ({ children, onAppForeground }) => {
  const [appState, setAppState] = useState(AppState.currentState);
  const logoutTime = 30 * 60 * 1000; // 30 minutes in milliseconds

  const saveLastActiveTime = async () => {
    const currentTime = Date.now();
    await AsyncStorage.setItem('lastActiveTime', currentTime.toString());
  };

  const checkInactivity = useCallback(async () => {
    const lastActiveTime = await AsyncStorage.getItem('lastActiveTime');
    const currentTime = Date.now();

    if (lastActiveTime && currentTime - parseInt(lastActiveTime, 10) > logoutTime) {
      handleLogout();
    } else {
      saveLastActiveTime();
      // Refresh broker status when app comes to foreground
      if (onAppForeground) {
        console.log('🔄 App came to foreground, refreshing broker status...');
        onAppForeground();
      }
    }
  }, [onAppForeground]);

  const handleLogout = () => {
    auth().signOut().then(() => {
      Alert.alert('Logged out', 'You have been logged out due to inactivity.');
    }).catch(error => {
      console.error('Error during sign out:', error);
    });
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        checkInactivity();
      } else if (nextAppState === 'background') {
        saveLastActiveTime();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, checkInactivity]);

  return (
    <InactivityContext.Provider value={{}}>
      {children}
    </InactivityContext.Provider>
  );
};

export { InactivityContext, InactivityProvider };
