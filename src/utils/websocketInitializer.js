// Add this at the end of the same file or create useWebSocketInitializer.js
import { useEffect } from 'react';

import { getAuth } from '@react-native-firebase/auth';
import { useTrade } from '../screens/TradeContext';
import WebSocketManager from '../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import { getAccountEmail } from './accountEmail';

export const useWebSocketInitializer = () => {
  const { configData } = useTrade();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = getAccountEmail();

    // Initialize WebSocketManager with config data
    WebSocketManager.initialize(configData, userEmail);
  }, [configData]);
};