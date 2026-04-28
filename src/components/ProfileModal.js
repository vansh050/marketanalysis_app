// ProfileModal.js
import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import Modal from 'react-native-modal';
import {CountryCode} from '../utils/CountryCode';
import {XIcon, ChevronDown, X, Pencil} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import server from '../utils/serverConfig';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import {generateToken} from '../utils/SecurityTokenManager';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';
const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;

const ProfileModal = ({
  showModal,
  setShowModal,
  setModalHelp,
  userEmail,
  getUserDeatils,
}) => {
  const navigation = useNavigation();
  const {configData} = useTrade();
  const [showCountryCode, setShowCountryCode] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [userTelegram, setUserTelegram] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
  const [userDetails, setuserDetails] = useState(null);

  const advisorName = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || configData?.appName || getAdvisorSubdomain();
  const showTelegram = '0';
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (showModal && userEmail) {
      fetchUserProfile();
    }
  }, [showModal, userEmail]);

  const fetchUserProfile = async () => {
    if (!userEmail) return;
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      const profile = response.data?.User;
      if (!profile) return;
      setuserDetails(profile);
      setUserName(profile.name || '');
      const phoneNumber = String(profile.phone_number || '')
        .replace(/^(91)+/, '')
        .replace(/^\+?91/, '');
      setUserPhoneNumber(phoneNumber);
      setUserTelegram(profile.telegram_id || '');
    } catch (error) {
      console.error(
        'Error fetching profile:',
        error.response?.data || error.message,
      );
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch profile. Please try again.',
      });
    }
  };

  const calculateProfileCompletion = (email, name, phone, telegram = false) => {
    let completedFields = 0;
    let totalFields = 4;
    if (email) completedFields++;
    if (name) completedFields++;
    if (phone) completedFields++;
    if (telegram && userTelegram) completedFields++;
    return Math.round((completedFields / totalFields) * 100);
  };

  const handleUserProfile = useCallback(async () => {
    if (!userPhoneNumber.trim()) {
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Please enter a phone number.',
      });
      return;
    }
    if (![9, 10, 11].includes(userPhoneNumber.length)) {
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Phone number must be between 9 and 11 digits.',
      });
      return;
    }

    setLoading(true);
    try {
      const phoneNumber = userPhoneNumber;
      const profileCompletion = calculateProfileCompletion(
        userEmail,
        userName,
        phoneNumber,
        showTelegram,
      );

      const response = await axios.put(
        `${server.server.baseUrl}api/user/update-profile`,
        {
          email: userEmail,
          advisorName,
          phoneNumber,
          countryCode,
          telegramId: showTelegram ? userTelegram : '',
          userName,
          profileCompletion,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      if (response.data?.success) {
        getUserDeatils?.();
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Profile updated.',
        });
        setShowSuccessMsg(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed',
          text2: response.data?.message || 'Failed to update profile.',
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to update profile.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    userPhoneNumber,
    userEmail,
    userName,
    userTelegram,
    showTelegram,
    countryCode,
    advisorName,
    getUserDeatils,
  ]);

  useEffect(() => {
    if (showSuccessMsg) {
      const id = setTimeout(() => {
        setShowSuccessMsg(false);
        setShowModal(false);
      }, 1800);
      return () => clearTimeout(id);
    }
  }, [showSuccessMsg, setShowModal]);

  const filteredCountryCodes = CountryCode.filter(ele =>
    `${ele.value} ${ele.label}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  // derived values for progress ring
  const profileCompletion = calculateProfileCompletion(
    userEmail,
    userName,
    userPhoneNumber,
    showTelegram,
  );
  const strokeDashoffset =
    circumference - (profileCompletion / 100) * circumference;

  if (!showModal) return null;

  return (
    <Modal
      isVisible={showModal}
      onBackdropPress={() => setShowModal(false)}
      style={styles.modal}
      backdropOpacity={0.45}
      useNativeDriver={false}
      useNativeDriverForBackdrop={false}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={['down']}
      onSwipeComplete={() => setShowModal(false)}
      statusBarTranslucent
      propagateSwipe>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.centeredView}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {(userDetails?.name && userDetails.name[0]) ||
                    userEmail?.[0] ||
                    'U'}
                </Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>Complete your profile</Text>
                <Text style={styles.subtitle}>
                  A few details help us personalize your experience.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              accessible
              accessibilityLabel="Close"
              style={styles.closeButton}
              onPress={() => setShowModal(false)}>
              <XIcon size={22} color="#222" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Card */}
            <View style={styles.card}>
              {/* Profile progress row */}
              <View style={styles.progressRow}>
                <View style={styles.progressSvgWrap}>
                  <Svg height="86" width="86" viewBox="0 0 86 86">
                    <Circle
                      cx="43"
                      cy="43"
                      r={radius}
                      stroke="#eef2f6"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <Circle
                      cx="43"
                      cy="43"
                      r={radius}
                      stroke="url(#grad)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                      fill="transparent"
                      rotation="-90"
                      origin="43, 43"
                    />
                    <Defs>
                      <LinearGradient
                        id="grad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%">
                        <Stop offset="0%" stopColor="rgba(0, 86, 183, 1)" />
                        <Stop offset="100%" stopColor="rgba(0, 38, 81, 1)" />
                      </LinearGradient>
                    </Defs>
                  </Svg>
                  <View style={styles.progressInner}>
                    <Text style={styles.progressInnerNumber}>
                      {profileCompletion}%
                    </Text>
                    <Text style={styles.progressInnerLabel}>Complete</Text>
                  </View>
                </View>
              </View>

              {/* Inputs */}
              <View style={styles.form}>
                <View style={styles.field}>
                  <View style={styles.emailLabelRow}>
                    <Text style={styles.label}>Email ID</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowModal(false);
                        navigation.navigate('UpdateEmailScreen');
                      }}
                      style={styles.updateEmailButton}>
                      <Pencil size={14} color="#0056B7" />
                      <Text style={styles.updateEmailText}>Update</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.inputBox}
                    value={userEmail || ''}
                    editable={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={userName}
                    onChangeText={setUserName}
                    placeholder="Enter your name"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View
                  style={[
                    styles.row,
                    {
                      alignItems: 'center',
                      alignContent: 'center',
                      alignSelf: 'center',
                    },
                  ]}>
                  <Pressable
                    style={styles.countryButton}
                    onPress={() => setShowCountryCode(s => !s)}>
                    <Text style={styles.countryText}>{countryCode}</Text>
                    <ChevronDown size={18} />
                  </Pressable>

                  <View style={{flex: 1}}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      style={styles.inputBox}
                      value={userPhoneNumber}
                      onChangeText={v =>
                        setUserPhoneNumber(v.replace(/\D/g, ''))
                      }
                      keyboardType="phone-pad"
                      placeholder="Enter phone"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Telegram username (optional)</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={userTelegram}
                    onChangeText={setUserTelegram}
                    placeholder="Enter Telegram username"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {/* Country code dropdown */}
                {showCountryCode && (
                  <View style={styles.countryListWrap}>
                    <View style={styles.countrySearchRow}>
                      <TextInput
                        placeholder="Search country or code"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.countrySearchInput}
                        placeholderTextColor="#9aa0a6"
                      />
                      <TouchableOpacity
                        style={styles.countryClose}
                        onPress={() => {
                          setShowCountryCode(false);
                          setSearchQuery('');
                        }}>
                        <X size={18} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      style={styles.countryScroll}
                      nestedScrollEnabled>
                      {filteredCountryCodes.map(cc => (
                        <TouchableOpacity
                          key={cc.value + cc.label}
                          style={styles.countryItem}
                          onPress={() => {
                            setCountryCode(cc.value);
                            setShowCountryCode(false);
                            setSearchQuery('');
                          }}>
                          <Text style={styles.countryItemText}>
                            {cc.value} — {cc.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer / Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                loading ? styles.buttonDisabled : null,
              ]}
              onPress={handleUserProfile}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Save profile">
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  {/* <Icon
                    name="save"
                    size={18}
                    color="#fff"
                    style={{marginRight: 8}}
                  /> */}
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    minHeight: screenHeight * 0.55,
    maxHeight: screenHeight * 0.95,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0056B7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  headerTextWrap: {
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingBottom: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'center',
  },
  progressSvgWrap: {
    width: 86,
    height: 86,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressInner: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressInnerNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0056B7',
  },
  progressInnerLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  form: {
    marginTop: 6,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    minWidth: 88,
    justifyContent: 'space-between',
  },
  countryText: {
    fontSize: 15,
    color: '#111827',
    marginRight: 6,
  },
  countryListWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e6e9ef',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 210,
    overflow: 'hidden',
  },
  countrySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  countrySearchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  countryClose: {
    padding: 6,
    marginLeft: 8,
  },
  countryScroll: {
    paddingHorizontal: 6,
  },
  countryItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
  },
  countryItemText: {
    fontSize: 14,
    color: '#111827',
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
    backgroundColor: '#f8fafc',
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0056B7',
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emailLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  updateEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EBF5FF',
  },
  updateEmailText: {
    color: '#0056B7',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default ProfileModal;
