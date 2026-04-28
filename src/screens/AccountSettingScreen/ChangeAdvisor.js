import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  NativeModules,
  Platform,
  SafeAreaView,
  Image,
} from 'react-native';
import {ChevronLeft, Bell} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {getAuth} from '@react-native-firebase/auth';
import {useTrade} from '../TradeContext';
import {useNavigation, CommonActions} from '@react-navigation/native';
import logo from '../../assets/fadedlogo.png';

import {
  updateRACodeAndConfig,
  getRaId,
  getUserData,
} from '../../utils/storageUtils';

// Try to import RNRestart safely
let RNRestart = null;
try {
  RNRestart = require('react-native-restart').default;
} catch (error) {
  console.warn('react-native-restart not available:', error);
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

  const {getAllTrades, getModelPortfolioStrategyDetails, reloadConfigData} = useTrade();

  useEffect(() => {
    loadCurrentRAId();
  }, []);

  const loadCurrentRAId = async () => {
    try {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
      let raId = await AsyncStorage.getItem('@app:raId');

      // If not found, try other methods
      if (!raId) {
        raId = await getRaId();
        console.log('RA ID from getRaId:', raId);
      }

      if (!raId) {
        const userData = await getUserData();
        raId = userData?.raId;
      }

      setCurrentRAId(raId || '');
      setNewRAId(raId || '');
    } catch (error) {
      console.error('Error loading current RA ID:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleTextInputChange = text => {
    const processedText = text.replace(/\s/g, '').toUpperCase();
    setNewRAId(processedText);
  };

  const handleUpdateRACode = async () => {
    // ✅ Trim spaces and convert to uppercase
    const trimmedAndUpperRAId = newRAId.trim().toUpperCase();

    // ✅ Validate input
    if (!trimmedAndUpperRAId || trimmedAndUpperRAId === '') {
      Alert.alert('Invalid Input', 'Please enter a valid RA ID without spaces');
      return;
    }

    // ✅ Additional validation for minimum length (optional)
    if (trimmedAndUpperRAId.length < 2) {
      Alert.alert('Invalid Input', 'RA ID must be at least 2 characters long');
      return;
    }

    // ✅ Check if same as current (after processing)
    const currentProcessed = currentRAId.trim().toUpperCase();
    if (trimmedAndUpperRAId === currentProcessed) {
      Alert.alert('No Changes', 'New RA ID is the same as current RA ID');
      return;
    }

    // ✅ Update the state with processed value
    setNewRAId(trimmedAndUpperRAId);

    Alert.alert(
      'Confirm Update',
      `Update RA ID to: ${trimmedAndUpperRAId}\n\nThis will refresh the app with new configuration. Continue?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Update', onPress: () => performUpdate(trimmedAndUpperRAId)},
      ],
    );
  };

  // ✅ Updated performUpdate to accept processed value
  const performUpdate = async processedRAId => {
    setLoading(true);

    try {
      const result = await updateRACodeAndConfig(processedRAId, userEmail);

      if (result.success) {
        Alert.alert(
          'Success',
          'RA ID updated successfully. The app will restart now.',
          [{text: 'Restart', onPress: () => restartApp()}],
        );
      } else {
        // ✅ Enhanced error handling for wrong details
        const errorMessage = result.error || 'Failed to update RA ID';

        if (
          errorMessage.includes('Advisor not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('wrong details')
        ) {
          Alert.alert(
            'Invalid RA ID',
            'You have entered wrong details. Please check your RA ID and try again.',
          );
        } else {
          Alert.alert(
            'Error',
            'You have entered wrong details. Please check your RA ID and try again.',
          );
        }
      }
    } catch (error) {
      console.error('Error in performUpdate:', error);

      // ✅ Enhanced error handling
      if (
        error.message.includes('Advisor not found') ||
        error.message.includes('not found') ||
        error.message.includes('Unable to verify advisor') ||
        error.message.includes('wrong details')
      ) {
        Alert.alert(
          'Invalid RA ID',
          'You have entered wrong details. Please verify your RA ID and try again.',
        );
      } else if (
        error.message.includes('Network') ||
        error.code === 'NETWORK_ERROR'
      ) {
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.',
        );
      } else {
        Alert.alert('Error', 'Failed to update RA ID. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Method 1: Try RNRestart if available
  const restartApp = () => {
    try {
      if (RNRestart && RNRestart.Restart) {
        console.log('Using RNRestart.Restart()');
        setTimeout(() => {
          RNRestart.Restart();
        }, 1000);
      } else {
        console.log('RNRestart not available, using alternative');
        alternativeRestart();
      }
    } catch (error) {
      console.error('Error with RNRestart:', error);
      alternativeRestart();
    }
  };

  // Method 2: Alternative restart methods
  const alternativeRestart = () => {
    try {
      if (__DEV__) {
        // Development mode - reload JS bundle
        const {DevSettings} = NativeModules;
        if (DevSettings && DevSettings.reload) {
          DevSettings.reload();
        } else {
          // Fallback for development
          console.warn('DevSettings.reload not available');
          softRestart();
        }
      } else {
        // Production mode - use soft restart
        softRestart();
      }
    } catch (error) {
      console.error('Error with alternative restart:', error);
      softRestart();
    }
  };

  // Method 3: Soft restart by refreshing data and navigation
  const softRestart = async () => {
    try {
      // CRITICAL: Reload config data first before fetching trades/portfolios
      // This ensures TradeContext has the new advisor's config loaded
      console.log('🔄 Reloading config data after advisor change...');
      await reloadConfigData();

      // Wait a bit for config to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear and reload all data with new config
      console.log('🔄 Fetching trades and portfolios with new config...');
      await getAllTrades();
      await getModelPortfolioStrategyDetails();

      // Reset navigation stack to Home
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'Home'}],
        }),
      );

      Alert.alert('Success', 'Configuration updated successfully');
    } catch (error) {
      console.error('Error in soft restart:', error);
      Alert.alert('Info', 'Please restart the app manually');
    }
  };

  const handleBack = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  if (initialLoading) {
    return (
      <LinearGradient
        colors={['#002651', '#0056B7']}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#002651', '#0056B7']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#002651" />

        <View style={styles.logoContainer} pointerEvents="none">
          <Image
            source={logo}
            style={[styles.logo, {tintColor: '#FFFFFF'}]}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manager Settings</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PushNotificationScreen')}
              style={styles.iconButton}>
              <View style={styles.iconCircle}>
                <Bell size={18} color="#FFFFFF" />
                <View style={styles.notificationDot} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.container1}>
          <Text style={styles.title}>Change Manager</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Current RA ID:</Text>
            <Text style={styles.currentValue}>{currentRAId || 'Not Set'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>New RA ID:</Text>
            <TextInput
              style={styles.input}
              value={newRAId}
              onChangeText={handleTextInputChange} // ✅ Updated handler
              placeholder="Enter new RA ID"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              // ✅ Additional props to prevent spaces
              keyboardType="ascii-capable"
              maxLength={20} // ✅ Reasonable limit
            />
            <Text style={styles.helpText}>
              Spaces will be removed automatically and converted to uppercase
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUpdateRACode}
            disabled={loading}>
            {loading ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.buttonText, {marginLeft: 10}]}>
                  Updating...
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Update RA ID</Text>
            )}
          </TouchableOpacity>

          {/* ✅ Additional info section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              • RA ID must be provided by your financial advisor
            </Text>
            <Text style={styles.infoText}>
              • Spaces and lowercase letters will be automatically corrected
            </Text>
            <Text style={styles.infoText}>
              • App will restart after successful update
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  logoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 0,
    opacity: 0.1,
  },
  logo: {
    width: 220,
    height: 220,
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  container1: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#ffffff',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#ffffff',
  },
  currentValue: {
    fontSize: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    color: '#000000',
    fontSize: 16,
    backgroundColor: '#fff',
    textTransform: 'uppercase', // ✅ Visual uppercase hint
    letterSpacing: 1, // ✅ Better spacing for uppercase text
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
    lineHeight: 16,
  },
});

export default ChangeAdvisor;
