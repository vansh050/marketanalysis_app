import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { Info, Eye, EyeOff, X } from "lucide-react-native";
import server from '../utils/serverConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import Config from 'react-native-config';
import useModalStore from '../GlobalUIModals/modalStore';
import { refreshGrowwSession } from '../utils/growwRefresh';

// OAuth/re-consent brokers — the reconnect modal renders a single
// "Reconnect {broker}" button for each. Groww is NOT in this list as
// of 2026-04-21: it migrated to credential + TOTP-seed and has its
// own dedicated branch (see broker === 'Groww' render block below)
// that renders "Refresh Groww session" and calls refreshGrowwSession.
const OAUTH_BROKERS = ['Zerodha', 'Angel One', 'Dhan', 'Fyers', 'Upstox', 'AliceBlue', 'Hdfc Securities', 'Motilal Oswal', 'Axis Securities'];

const TokenExpireBrokerModal = ({
  openTokenExpireModel,
  setOpenTokenExpireModel,
  userId,
  apiKey,
  secretKey,
  checkValidApiAnSecret,
  clientCode,
  my2pin,
  panNumber,
  mobileNumber,
  getUserDetails,
  broker,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
  const [openOtpBox, setOpenOtpBox] = useState(false);
  const [storeResponse, setStoreResponse] = useState(null);
  const [showMpin, setShowMpin] = useState(false);
  const [mpin, setMpin] = useState('');
  const [otp, setOtp] = useState('');

  const handleIiflLogin = () => {
    setLoginLoading(true);
    const data = JSON.stringify({
      clientCode,
      password,
      my2pin,
      userId,
    });

    axios.post(`${server.server.baseUrl}api/iifl/generate-session`, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': Config.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    })
      .then(response => {
        setLoginLoading(false);
        if (getUserDetails) getUserDetails();
        Toast.show({
          type: 'success',
          text1: 'You have been successfully logged in to IIFL Securities',
          position: 'bottom',
          visibilityTime: 5000,
          autoHide: true,
          topOffset: 50,
        });
        setOpenTokenExpireModel(false);
      })
      .catch(error => {
        setLoginLoading(false);
        const result = error.response?.data?.response || {};
        Toast.show({
          type: 'error',
          text1: result.message || 'Login failed. Please check your credentials.',
          position: 'bottom',
          visibilityTime: 5000,
          autoHide: true,
          topOffset: 50,
        });
      });
  };

  const updateKotakSecretKey = () => {
    setLoginLoading(true);
    const data = {
      uid: userId,
      apiKey,
      secretKey,
      ...(password && { password }),
      ...(mobileNumber && { mobileNumber: mobileNumber.toString() }),
      ...(panNumber && { pan: panNumber }),
    };

    axios.post(`${server.server.baseUrl}api/kotak/update-key`, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': Config.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    })
      .then(response => {
        setLoginLoading(false);
        setStoreResponse(response.data.response);
        setOpenOtpBox(true);
      })
      .catch(() => {
        setLoginLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Incorrect credential. Please try again',
          position: 'bottom',
          visibilityTime: 5000,
          autoHide: true,
          topOffset: 50,
        });
      });
  };

  const handleKotakLogin = () => {
    setLoginLoading(true);
    const data = {
      uid: userId,
      apiKey,
      secretKey,
      jwtToken: storeResponse.access_token,
      password,
      otp,
      sid: storeResponse.sid,
      viewToken: storeResponse.view_token,
      ...(panNumber && { pan: panNumber }),
      ...(mobileNumber && { mobileNumber: mobileNumber }),
    };

    axios.put(`${server.server.baseUrl}api/kotak/connect-broker`, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': Config.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    })
      .then(() => {
        setLoginLoading(false);
        Toast.show({
          type: 'success',
          text1: 'You have been successfully logged in to your broker.',
          position: 'bottom',
          visibilityTime: 3000,
          autoHide: true,
          topOffset: 50,
        });
        setOpenTokenExpireModel(false);
      })
      .catch(() => {
        setLoginLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Incorrect credential. Please try again',
          position: 'bottom',
          visibilityTime: 5000,
          autoHide: true,
          topOffset: 50,
        });
      });
  };

  const handleOAuthReconnect = () => {
    setOpenTokenExpireModel(false);
    if (checkValidApiAnSecret) {
      checkValidApiAnSecret(broker);
    }
  };

  // Groww takes a different steady-state path than the other
  // OAuth brokers: we already store the customer's TOTP seed
  // server-side (AES-256 at rest), so daily refresh is a single
  // POST to /api/groww/refresh-token — no browser redirect, no
  // re-pasting creds. Fall through to the connect modal only
  // when the stored seed is missing (NO_TOTP_SEED → legacy
  // upgrade) or rejected (INVALID_SEED → revoked key recovery).
  const showModalAlert = useModalStore((state) => state.showAlert);
  const handleGrowwRefresh = async () => {
    setLoginLoading(true);
    try {
      await refreshGrowwSession({
        userId,
        advisorSubdomain: Config.REACT_APP_HEADER_NAME,
        showAlert: showModalAlert,
        onClose: () => setOpenTokenExpireModel(false),
        onSuccess: () => {
          if (getUserDetails) getUserDetails();
        },
        // NO_TOTP_SEED / INVALID_SEED → re-open the Groww connect
        // modal so the customer can capture (or recapture) a seed.
        onOpenConnectModal: () => {
          if (checkValidApiAnSecret) {
            checkValidApiAnSecret('Groww');
          }
        },
      });
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (showSuccessMsg) {
      const timer = setTimeout(() => {
        setShowSuccessMsg(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMsg]);

  const isOAuthBroker = OAUTH_BROKERS.includes(broker);

  if (!openTokenExpireModel) return null;

  return (
    <Modal
      visible={!!openTokenExpireModel}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setOpenTokenExpireModel(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setOpenTokenExpireModel(false)}
          >
            <X size={20} color="#666" />
          </TouchableOpacity>
          <View style={styles.iconContainer}>
            <Info size={48} color="#00000080" />
          </View>
          <Text style={styles.title}>
            {broker === 'Zerodha'
              ? 'Your Zerodha session has expired. Please reconnect to Kite to continue.'
              : broker === 'Groww'
                ? 'Your Groww session has expired. Tap Refresh — no re-pasting credentials.'
                : isOAuthBroker
                  ? `Your ${broker} session has expired. Please reconnect to continue.`
                  : 'Please login to your broker to continue investments'}
          </Text>
          <View style={styles.inputContainer}>
            {broker === 'Groww' ? (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleGrowwRefresh}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Refresh Groww session</Text>
                )}
              </TouchableOpacity>
            ) : isOAuthBroker && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleOAuthReconnect}
                disabled={loginLoading}
              >
                <Text style={styles.submitButtonText}>Reconnect {broker}</Text>
              </TouchableOpacity>
            )}
            {broker === 'IIFL Securities' && (
              <View>
                <TextInput
                  style={styles.input}
                  value={clientCode}
                  placeholder="Client Code"
                  placeholderTextColor="#999"
                  editable={false}
                />
                <Text style={styles.label}>Client Code</Text>
                <TextInput
                  style={styles.input}
                  value={my2pin}
                  placeholder="My2Pin"
                  placeholderTextColor="#999"
                  editable={false}
                />
                <Text style={styles.label}>My2Pin</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(prev => !prev)}
                  >
                    {showPassword ? <Eye size={24} color="#00000060" /> : <EyeOff size={24} color="#00000060" />}
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  style={[styles.submitButton, loginLoading && styles.submitButtonDisabled]}
                  onPress={handleIiflLogin}
                  disabled={loginLoading || !password}
                >
                  {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Login</Text>}
                </TouchableOpacity>
              </View>
            )}
            {broker === 'Kotak' && (
              <View>
                <TextInput
                  style={styles.input}
                  value={panNumber || mobileNumber}
                  placeholder={panNumber ? 'Pan Number' : 'Mobile Number'}
                  placeholderTextColor="#999"
                  editable={false}
                />
                <Text style={styles.label}>{panNumber ? 'Pan Number' : 'Mobile Number'}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(prev => !prev)}
                  >
                    {showPassword ? <Eye size={24} color="#00000060" /> : <EyeOff size={24} color="#00000060" />}
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Password</Text>
                {openOtpBox && (
                  <>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={mpin}
                        onChangeText={setMpin}
                        placeholder="Mpin"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        secureTextEntry={!showMpin}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowMpin(prev => !prev)}
                      >
                        {showMpin ? <Eye size={24} color="#00000060" /> : <EyeOff size={24} color="#00000060" />}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.label}>Mpin</Text>
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Otp"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    <Text style={styles.label}>Otp</Text>
                    <TouchableOpacity
                      style={[styles.submitButton, loginLoading && styles.submitButtonDisabled]}
                      onPress={handleKotakLogin}
                      disabled={loginLoading}
                    >
                      {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
                    </TouchableOpacity>
                  </>
                )}
                {!openOtpBox && (
                  <TouchableOpacity
                    style={[styles.submitButton, loginLoading && styles.submitButtonDisabled]}
                    onPress={updateKotakSecretKey}
                    disabled={loginLoading || !password}
                  >
                    {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Update Key</Text>}
                  </TouchableOpacity>
                )}
              </View>
            )}
            {broker === 'ICICI Direct' && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleOAuthReconnect}
                disabled={loginLoading}
              >
                {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Reconnect ICICI Direct</Text>}
              </TouchableOpacity>
            )}
          </View>
          {showSuccessMsg && (
            <Text style={styles.successMessage}>Login successful</Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    alignSelf: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 5,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
    fontFamily: 'Satoshi-Medium',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 10,
    padding: 10,
    color: '#000',
  },
  label: {
    fontSize: 12,
    color: '#777',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
  },
  successMessage: {
    color: 'green',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default TokenExpireBrokerModal;
