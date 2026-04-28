import React, {useEffect} from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {getAuth, signOut} from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LogoutScreen = ({navigation}) => {
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0056B7';
  const {
    setUserDetails,
    setIsProfileCompleted,
    setHasFetchedTrades,
    setFunds,
    setstockRecoNotExecutedfinal,
    setModelPortfolioStrategyfinal,
    setBroker,
  } = useTrade();

  const auth = getAuth();

  // Configure Google Sign-In with webClientId from config (matches LoginScreen)
  useEffect(() => {
    if (config?.googleWebClientId) {
      GoogleSignin.configure({
        webClientId: config.googleWebClientId,
      });
    }
  }, [config?.googleWebClientId]);

  const handleLogout = async () => {
    try {
      // Try to sign out from Google (may fail if user signed in with Apple/email)
      try {
        await GoogleSignin.signOut();
      } catch (googleError) {
        // Ignore - user may not have signed in with Google
        console.log('Google signOut skipped (user may not have used Google)');
      }

      // Sign out from Firebase (handles all auth providers)
      await signOut(auth);
      await AsyncStorage.removeItem('cartItems');

      // Reset state
      setUserDetails(null);
      setHasFetchedTrades(false);
      setIsProfileCompleted(false);
      setFunds({});
      setBroker(null);
      setstockRecoNotExecutedfinal([]);
      setModelPortfolioStrategyfinal([]);

      navigation.replace('Login');
    } catch (error) {
      console.error('Error signing out: ', error);
      // Still navigate to login even if there's an error
      navigation.replace('Login');
    }
  };

  useEffect(() => {
    handleLogout();
  }, []);

  return (
    <LinearGradient
      colors={[gradient1, gradient2]}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>Logging out...</Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginRight: 20,
    fontFamily: 'Poppins-Medium',
  },
});

export default LogoutScreen;
