// components/DhanConnectUI.js
import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import {
  EyeIcon,
  EyeOffIcon,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react-native';
import HelpModal from '../../components/BrokerConnectionModal/HelpModal';
import LinearGradient from 'react-native-linear-gradient';
import DhanHelpContent from './HelpUI/DhanHelpContent';
import dhanIcon from '../../assets/dhan.png';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

import { designColor, designFont } from '../../design/literalTokens';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

const DhanConnectUI = ({
  isVisible,
  onClose,
  cliendId,
  accessToken,
  setCliendId,
  setaccessToken,
  isPasswordVisible,
  isPasswordVisibleup,
  setIsPasswordVisible,
  setIsPasswordVisibleup,
  handleSubmit,
  loading,
  helpVisible,
  setHelpVisible,
}) => {
  const scrollViewRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  // Handle Android back button
  React.useEffect(() => {
    if (!isVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={onClose}>
      <View style={styles.fullScreen}>
        <View style={{flex: 1, paddingTop: insets.top}}>
          {/* Header */}
          <LinearGradient
            colors={[designColor('0b3d91'), designColor('0056b7')]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <ChevronLeft size={24} color={designColor('000')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Connect to Dhan</Text>
            </View>
            <Image source={dhanIcon} style={styles.headerIcon} />
          </LinearGradient>

          {/* Scrollable Content */}
          {expanded ? (
            /* Full Screen Help when expanded */
            (<View style={styles.fullScreenHelp}>
              <ScrollView
                ref={scrollViewRef}
                style={{flex: 1}}
                contentContainerStyle={{padding: 10, paddingBottom: 20}}
                showsVerticalScrollIndicator={true}>
                <DhanHelpContent expanded={expanded} />
                <View style={[styles.toggleWrapper, {marginTop: 15, paddingBottom: insets.bottom + 10}]}>
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setExpanded(false)}>
                    <Text style={styles.toggleText}>See Less</Text>
                    <View style={styles.toggleIconContainer}>
                      <ChevronUp size={14} color={designColor('000')} />
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>)
          ) : (
            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
              <ScrollView
                ref={scrollViewRef}
                style={{flex: 1}}
                contentContainerStyle={{padding: 10, paddingBottom: insets.bottom + 100}}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled">
                {/* Help Content */}
                <View style={[styles.guideBox, {maxHeight: 280}]}>
                  <DhanHelpContent expanded={expanded} />
                </View>

                {/* Read More */}
                <TouchableOpacity
                  style={styles.toggleContainer}
                  onPress={() => setExpanded(true)}>
                  <Text style={styles.toggleText}>Read More</Text>
                  <View style={styles.toggleIconContainer}>
                    <ChevronDown size={14} color={designColor('000')} />
                  </View>
                </TouchableOpacity>

                {/* Input Card */}
                <View style={styles.inputCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.connectLabel}>Connect to Dhan</Text>
                    <Image
                      source={dhanIcon}
                      style={styles.cardIcon}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Input Fields */}
                  <View style={styles.inputSection}>
                    {/* Client ID */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>Client ID:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={cliendId}
                          placeholder="Enter your Client ID"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setCliendId(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Access Token */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>Access Token:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={accessToken}
                          placeholder="Enter your Access Token"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setaccessToken(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Connect Button */}
                    <TouchableOpacity
                      style={[
                        styles.proceedButton,
                        {
                          backgroundColor:
                            cliendId && accessToken ? designColor('0056b7') : designColor('d3d3d3'),
                        },
                      ]}
                      onPress={handleSubmit}
                      disabled={!(cliendId && accessToken)}>
                      {loading ? (
                        <ActivityIndicator size={27} color={designColor('fff')} />
                      ) : (
                        <Text style={styles.proceedButtonText}>Connect</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          <HelpModal
            broker="Dhan"
            visible={helpVisible}
            onClose={() => setHelpVisible(false)}
          />
        </View>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: designColor('fff'),
  },
  headerIcon: {width: 35, height: 35, borderRadius: 3, backgroundColor: designColor('fff')},
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: designColor('fff'),
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('fff'),
    marginLeft: 10,
  },
  guideBox: {
    borderWidth: 1,
    borderColor: designColor('e8e9ec'),
    borderRadius: 8,
    padding: 10,
  },
  fullScreenHelp: {flex: 1, backgroundColor: designColor('fff')},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: designColor('e8e9ec'),
    backgroundColor: designColor('fff'),
    paddingVertical: 5,
  },
  toggleContainer: {flexDirection: 'row', alignItems: 'center', padding: 10},
  toggleText: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('0056b7'),
    marginLeft: 15,
  },
  toggleIconContainer: {
    marginLeft: 5,
    backgroundColor: designColor('fff'),
    borderRadius: 20,
    padding: 3,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: designColor('e8e9ec'),
    backgroundColor: designColor('fff'),
  },
  inputCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: designColor('e8e9ec'),
    borderRadius: 12,
    backgroundColor: designColor('fff'),
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: designColor('f5f5f5'),
    padding: 12,
  },
  cardIcon: {
    width: 30,
    height: 30,
    backgroundColor: designColor('fff'),
    borderRadius: 3,
  },
  inputSection: {
    padding: 15,
  },
  inputWrapper: {marginBottom: 10},
  headerLabel: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('000'),
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: designColor('ccc'),
    borderRadius: 8,
    paddingHorizontal: 10,
    height: commonHeight,
  },
  connectLabel: {
    fontSize: 16,
    color: designColor('000'),
    fontFamily: designFont('Poppins-SemiBold'),
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('000'),
    paddingVertical: 5,
  },
  proceedButton: {
    height: commonHeight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  proceedButtonText: {color: designColor('fff'), fontSize: 16, fontWeight: '600'},
});

export default DhanConnectUI;
