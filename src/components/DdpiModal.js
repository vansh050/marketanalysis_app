import React, {useState, useEffect, useRef} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Linking,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import DDPI from '../assets/DDPI.png';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import WebView from 'react-native-webview';
import Config from 'react-native-config';
import YoutubePlayer from 'react-native-youtube-iframe';
import axios from 'axios';
import server from '../utils/serverConfig';
import {getPlatformDisplayName} from '../utils/advisorContentProfile';

import {generateToken} from '../utils/SecurityTokenManager';
import {
  AlertTriangle,
  BadgeAlertIcon,
  XIcon,
  Check,
  ChevronLeft,
  X,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useModalStore from '../GlobalUIModals/modalStore';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';
import {getAccountEmail} from '../utils/accountEmail';
import {tagSellAuthorizationRetryCalculation} from '../utils/rebalanceHelpers';
import {
  getDhanSellTrades,
  isDhanSellAuthorizationReady,
} from '../utils/dhanEdis';
import PublisherWebViewOverlay from './PublisherWebViewOverlay';
import SellAuthGuideCard from './SellAuth/SellAuthGuideCard';
import { designColor, designFont } from '../design/literalTokens';
const {height: screenHeight, width: screenWidth} = Dimensions.get('window');
const checkValidApiAnSecret = data => {
  if (!data) return null;
  const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
  const Key = bytesKey.toString(CryptoJS.enc.Utf8);
  if (Key) {
    return Key;
  }
};

export default function DdpiModal({
  sellOrders = [],
  isOpen = false,
  setIsOpen = () => {},
  userDetails,
  reopenRebalanceModal,
  getUserDetails,
}) {
  if (userDetails?.user_broker === 'Upstox') {
    setIsOpen(false);
    return null;
  }
  console.log('opened');
  const [authUrl, setAuthUrl] = useState(null); // Holds the URL for authentication
  const [loading, setLoading] = useState(false); // Loading state for API call
  const [showTpinConfirmation, setShowTpinConfirmation] = useState(false);
  const [tpinCompleted, setTpinCompleted] = useState(false);
  const { configData } = useTrade();

  const proceedWithTpin = async () => {
    try {
      setLoading(true); // Show loading indicator

      const response = await fetch(
        `${server.ccxtServer.baseUrl}zerodha/auth-sell`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          body: JSON.stringify({
            accessToken: userDetails?.jwtToken,
            userEmail: userDetails?.email,
          }),
        },
      );

      setLoading(false); // Hide loading indicator

      if (!response.ok) {
        throw new Error('Response was not ok');
      }

      const data = await response.json();
      //  console.log("API Response:", data);

      if (data.status === 0) {
        setAuthUrl(data.auth_url); // Set the authentication URL to open in WebView
        // Do NOT show confirmation overlay yet — user needs to complete
        // the CDSL TPIN + OTP flow in the WebView first. The overlay
        // shows when the user closes the WebView (onClose callback).
      } else {
        console.error('Error in response:', data.message);
        // Alert.alert("Error", data.message || "An error occurred.");
      }
    } catch (error) {
      setLoading(false); // Hide loading indicator
      console.error('Error in API call:', error);
      //Alert.alert("Error", "Failed to proceed with authentication.");
    }
  };

  const handleProceed = async () => {
    try {
      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
      setIsOpen(false);
      setShowTpinConfirmation(false);
      setTpinCompleted(false);
      if (reopenRebalanceModal) reopenRebalanceModal();
    } catch (error) {
      console.error('Error updating EDIS status:', error);
      // The server confirms a Zerodha claim against Kite holdings before it
      // stores it. EDIS_NOT_CONFIRMED means CDSL has no authorization for this
      // demat account — the CDSL window was closed before the TPIN + OTP
      // completed. Drop back to the "Proceed with Authorization to Sell" sheet
      // so the customer re-runs the CDSL step instead of leaving with a sell
      // the exchange will reject.
      const notConfirmed =
        error?.response?.data?.code === 'EDIS_NOT_CONFIRMED';
      if (notConfirmed) {
        setShowTpinConfirmation(false);
        setTpinCompleted(false);
      }
      Toast.show({
        type: 'error',
        text1: notConfirmed ? 'CDSL authorization not confirmed' : 'Error',
        text2:
          error?.response?.data?.error ||
          'Failed to update authorization status. Please try again.',
        visibilityTime: 7000,
      });
    }
  };

  return (
    <>
      <Modal
        // A native Modal is a separate Android window and otherwise stays
        // above the app-root CDSL WebView host. Hide only this informational
        // sheet as soon as authUrl exists so TPIN/OTP remains interactive.
        visible={isOpen && !authUrl}
        transparent={true}
        style={{
          justifyContent: 'flex-end',
          margin: 0,
        }}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsOpen(false)}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.contentWrapper}>
              <View style={styles.imageWrapper}>
                <Image
                  source={DDPI} // Replace with your image
                  style={styles.image}
                />
              </View>
              <View style={styles.textSection}>
                <SellAuthGuideCard
                  broker="Zerodha"
                  configData={configData}
                  variant="inApp"
                  sellOrders={sellOrders}
                  testID="sell-auth-guide-zerodha"
                />
                <TouchableOpacity
                  style={styles.proceedButton}
                  onPress={proceedWithTpin}>
                  <Text style={styles.buttonText}>
                    Proceed with Authorization to Sell
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Keep CDSL/Kite in the same app-root browser host as Publisher. A
          nested native Modal creates a second Android window, drops IME focus
          during redirects and does not reliably share the authenticated Kite
          cookie with the subsequent buy basket. */}
      {authUrl ? (
        <PublisherWebViewOverlay
          source={{uri: authUrl}}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadStart={() => console.log('WebView loading started')}
          onLoadEnd={() => console.log('WebView loading finished')}
          onNavigationStateChange={event => {
            console.log('url zerodha:', event.url);
            if (event.url.includes('callback_url')) {
              setAuthUrl(null);
              // Auto-proceed — CDSL TPIN + OTP completed successfully.
              // No need for manual "I've authorized" checkbox.
              handleProceed();
            }
          }}
          onShouldStartLoadWithRequest={request => {
            if (request.url.includes('callback_url')) {
              setAuthUrl(null);
              handleProceed();
              return false;
            }
            return true;
          }}
          renderLoading={() => <ActivityIndicator size="large" color={designColor('000')} />}
          onClose={() => {
            setAuthUrl(null);
            setShowTpinConfirmation(true);
          }}
        />
      ) : null}
      {/* TPIN Confirmation Modal */}
      <Modal
        visible={showTpinConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTpinConfirmation(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTpinConfirmation(false);
                setTpinCompleted(false);
                setIsOpen(false);
              }}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.textSection}>
              <Text style={styles.title}>Authorization Complete?</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setTpinCompleted(!tpinCompleted)}>
                <View style={[styles.checkbox, tpinCompleted ? styles.checked : styles.unchecked]}>
                  {tpinCompleted && <Check size={14} color={designColor('fff')} />}
                </View>
                <Text style={styles.label}>I've authorized the sell of the stocks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedButton, !tpinCompleted && { opacity: 0.5 }]}
                onPress={handleProceed}
                disabled={!tpinCompleted}>
                <Text style={styles.buttonText}>Retry Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,

    alignItems: 'center',
  },

  ////

  actionsContainer: {
    // Column (2026-10-01): two buttons side by side clipped on ~360dp phones.
    flexDirection: 'column',
    alignItems: 'stretch',
    marginTop: 16,
    paddingBottom: 8,
    width: '100%',
  },
  button: {
    height: 41,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    marginRight: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  enabledButton: {
    backgroundColor: designColor('e43d3d'),
  },
  disabledButton: {
    backgroundColor: designColor('e43d3d'),
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: designFont('Poppins'), // Use the font family you need
    color: designColor('fff'),
  },
  howToButton: {
    height: 41,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: designColor('e43d3d'),
  },
  howToButtonText: {
    fontSize: 14,
    fontFamily: designFont('Poppins'), // Use the font family you need
    color: designColor('e43d3d'),
  },

  ////

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checked: {
    backgroundColor: designColor('10b981'), // Tailwind color for success
    borderColor: designColor('10b981'), // Green border when checked
  },
  unchecked: {
    backgroundColor: designColor('fff'),
    borderColor: designColor('d1d5db'), // Light gray border when unchecked
  },
  checkmark: {
    width: 12,
    height: 12,
    backgroundColor: designColor('fff'),
    borderRadius: 2,
  },
  label: {
    // Wrap instead of running off the right edge (shared by every
    // "I've authorized the sell…" checkbox in this file).
    flexShrink: 1,
    fontSize: 14,
    fontFamily: designFont('Poppins'), // Replace with your font if needed
    color: designColor('4b5563'), // Tailwind equivalent of text-gray-600
  },

  closeIcon: {
    fontSize: 24,
    color: designColor('999'),
  },
  contentContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  textSection: {
    flex: 1,
    width: '100%',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: designColor('333'),
  },
  listContainer: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: designColor('666'),
    marginBottom: 8,
  },
  proceedButton: {
    backgroundColor: designColor('ef4444'),
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: designColor('fff'),
    fontWeight: '600',
    fontSize: 14,
  },
  imageSection: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  dialogContainer: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    color: designColor('333'),
  },
  // Prominent "Activate DDPI" nudge that opens the shared
  // `BrokerDdpiHelpModal` via the global modal store. See
  // `src/config/brokerDdpiHelp.js` for the content source.
  ddpiNudgeRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: designColor('e5f7f0'),
    borderColor: designColor('b9e4d2'),
    borderWidth: 1,
    borderRadius: 8,
  },
  ddpiNudgeText: {
    fontSize: 13,
    color: designColor('0a7a5a'),
    fontWeight: '600',
  },
  boldText: {
    fontWeight: '600',
  },
  buttonGradient: {
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  activateButton: {
    height: 46,
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  imageContainer: {
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: 10,
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },

  //
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    width: '90%',
    maxHeight: '90%',
    padding: 10,
  },
  closeButton: {},
  closeIcon: {
    fontSize: 20,
    color: 'gray',
  },
  contentWrapper: {},
  textSection: {
    padding: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alertIcon: {
    fontSize: 24,
    color: 'red',
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    marginLeft: 10,
    marginRight: 20,
    fontWeight: '600',
    color: designColor('000000b3'),
  },
  list: {
    marginVertical: 10,
  },
  listItem: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 6,
  },
  proceedButton: {
    backgroundColor: 'red',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  imageWrapper: {
    width: screenWidth,
    height: 244,
    marginTop: 10,

    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  noHoldingsModal: {
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    width: '80%',
    padding: 16,
  },
  header: {
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  warningText: {
    color: 'red',
    fontWeight: 'bold',
    marginTop: 10,
  },
  tpinModal: {
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    width: '80%',
    padding: 20,
    alignItems: 'center',
  },
  tpinTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginRight: 8,
    color: 'black',
  },
  input: {
    borderWidth: 1,
    borderColor: designColor('ccc'),
    borderRadius: 20,
    paddingHorizontal: 12,
    width: '60%',
    height: 40,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  verifyButton: {
    backgroundColor: designColor('5acac9'),
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    width: '40%',
  },
  cancelButton: {
    backgroundColor: 'gray',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    width: '40%',
  },

  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    padding: 16,
  },

  /* Modal Container */

  /* Close Button */
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 10,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: designColor('6b7280'),
    fontSize: 24,
  },
  BackButton: {
    position: 'absolute',
    top: 12,
    left: 10,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: designColor('6b7280'),
    fontSize: 24,
  },

  /* Content Container */
  modalContent: {
    flexDirection: 'column',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
  },

  playerWrapper: {
    overflow: 'hidden',
    marginTop: 20,
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 20,
  },

  /* Header Section */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },

  /* Icon Style */
  alertIcon: {
    width: 28,
    height: 28,
    marginTop: 4,
    color: designColor('e43d3d'),
  },

  /* Title */
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
    fontFamily: designFont('Poppins-Bold'),
    lineHeight: 26,
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },

  /* List Items */
  modalListItem: {
    fontSize: 13,
    fontWeight: '300',
    fontFamily: designFont('Poppins'),
    color: designColor('4b5563'),
    marginBottom: 8,
  },

  /* Checkbox Section */
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },

  checkboxLabel: {
    fontSize: 14,
    fontFamily: designFont('Poppins'),
    marginLeft: 10,
  },

  /* Button Styles */
  primaryButton: {
    width: '100%',
    height: 41,
    borderRadius: 8,
    fontFamily: designFont('Poppins'),
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    paddingHorizontal: 16,
    backgroundColor: designColor('e43d3d'),
  },

  primaryButtonDisabled: {
    backgroundColor: 'rgba(228, 61, 61, 0.5)',
    cursor: 'not-allowed',
  },

  secondaryButton: {
    width: '100%',
    height: 41,
    paddingHorizontal: 16,
    fontFamily: designFont('Poppins'),
    fontSize: 14,
    color: designColor('e43d3d'),
    borderColor: designColor('e43d3d'),
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
  },
});

const otherBrokerStyles = StyleSheet.create({
  fullWidthAction: {
    alignSelf: 'stretch',
    marginRight: 0,
  },
  retryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  retryStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: designFont('Poppins'),
    color: designColor('374151'),
  },
  retryError: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: designColor('fef2f2'),
    borderWidth: 1,
    borderColor: designColor('fecaca'),
  },
  retryErrorText: {
    fontSize: 13,
    fontFamily: designFont('Poppins'),
    color: designColor('991b1b'),
  },
  ddpiHeroCard: {
    backgroundColor: designColor('f0fdf4'),
    borderColor: designColor('86efac'),
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  ddpiHeroBadge: {
    backgroundColor: designColor('16a34a'),
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  ddpiHeroBadgeText: {
    color: designColor('fff'),
    fontSize: 10,
    fontWeight: '700',
    fontFamily: designFont('Poppins'),
    letterSpacing: 0.5,
  },
  ddpiHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: designColor('15803d'),
    fontFamily: designFont('Poppins'),
    marginBottom: 6,
  },
  ddpiHeroBody: {
    fontSize: 13,
    lineHeight: 19,
    color: designColor('4b5563'),
    fontFamily: designFont('Poppins'),
    marginBottom: 12,
  },
  ddpiHeroButton: {
    backgroundColor: designColor('16a34a'),
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ddpiHeroButtonText: {
    color: designColor('fff'),
    fontSize: 14,
    fontWeight: '600',
    fontFamily: designFont('Poppins'),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: designColor('e5e7eb'),
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: designColor('9ca3af'),
    fontFamily: designFont('Poppins'),
  },
});

export function ActivateNowModel({
  isOpen = false,
  setIsOpen = () => {},
  onActivate = () => {},
}) {
  return (
    <Modal
      isVisible={isOpen}
      onBackdropPress={() => setIsOpen(false)}
      backdropOpacity={0.5}
      style={styles.modalContainer}>
      <View style={styles.dialogContainer}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setIsOpen(false)}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>

        {/* Content */}
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Left Section: Image */}
          <View style={styles.imageContainer}>
            <Image
              source={require('../assets/DDPI.png')} // Replace with your DDPI image path
              style={styles.image}
              resizeMode="cover"
            />
          </View>

          {/* Right Section: Text & Button */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              Save Time and Effort by {'\n'}Enabling DDPI!
            </Text>

            {/* Bullet Points */}
            <View style={styles.listContainer}>
              <View style={styles.listItem}>
                <Image
                  source={require('../assets/checked.png')} // Replace with checkmark image
                  style={styles.checkIcon}
                />
                <Text style={styles.listText}>
                  <Text style={styles.boldText}>Instant Selling:</Text> Sell
                  your holdings instantly after DDPI activation without needing
                  a T-PIN or OTP.
                </Text>
              </View>

              <View style={styles.listItem}>
                <Image
                  source={require('../assets/checked.png')} // Replace with checkmark image
                  style={styles.checkIcon}
                />
                <Text style={styles.listText}>
                  <Text style={styles.boldText}>Seamless Liquidation:</Text>{' '}
                  Liquidate your holdings without the hassle of daily
                  pre-authorization for each sell order.
                </Text>
              </View>

              <View style={styles.listItem}>
                <Image
                  source={require('../assets/checked.png')} // Replace with checkmark image
                  style={styles.checkIcon}
                />
                <Text style={styles.listText}>
                  <Text style={styles.boldText}>Faster Transactions:</Text>{' '}
                  Enjoy smoother and quicker trading experiences with fewer
                  barriers.
                </Text>
              </View>
            </View>

            {/* Action Button */}
            <LinearGradient
              colors={[designColor('d97706'), designColor('f59e0b'), designColor('d97706')]}
              style={styles.buttonGradient}>
              <TouchableOpacity
                style={styles.activateButton}
                onPress={onActivate}>
                <Text style={styles.buttonText}>
                  Activate DDPI Now &gt;&gt;
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ActivateTopModel(userDetails) {
  const [showModal, setShowModal] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleCopy = textToCopy => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(textToCopy);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Copied to clipboard!',
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to copy text.',
      });
    }
  };

  const brokerInstructions = {
    Dhan: {
      title: 'Dhan Broker: How to Authorize Stocks for Selling',
      directLink:
        'https://knowledge.dhan.co/support/solutions/articles/82000900258-from-where-ddpi-service-can-be-activated-',
      steps: [
        'If you have not enabled DDPI, please enable it by following these steps:',
        'Log in to your Dhan account.',
        'Navigate to the DDPI activation section.',
        'Follow the on-screen instructions to complete the DDPI activation process.',
      ],
    },

    // "AliceBlue": {
    //   title: 'Aliceblue Broker: How to Authorize Stocks for Selling',
    //   videoId: 'https://youtu.be/ncFGDQAARhM',
    //   steps: [
    //     '1. Log in to your Aliceblue account. ',
    //     '2. Navigate to Portfolio > Holdings, and click the Authorize button located below the Portfolio Value.',
    //     '3. In the CDSL interface, select the stocks to authorize, click Authorize, and proceed to CDSL.',
    //     '4. Enter your TPIN and OTP for verification. If required, generate a TPIN before proceeding. ',
    //     '5. Upon successful authorization, you will be redirected to the Portfolio screen.',
    //     '6. Go back to the our platform and attempt to sell your stocks again',

    //   ],
    // },

    Zerodha: {
      title: 'Zerodha: How to Authorize Stocks for Selling',
      directLink:
        'https://support.zerodha.com/category/account-opening/online-account-opening/other-online-account-opening-related-queries/articles/activate-ddpi',
      steps: [
        'If you have not enabled DDPI, please enable it by following these steps:',
        'Log in to your Zerodha account.',
        'Navigate to the Profile or Settings section.',
        'Find the DDPI activation option and follow the prompts.',
      ],
    },

    'Angel One': {
      title: 'Angel One: How to Authorize Stocks for Selling',
      directLink:
        'https://www.angelone.in/knowledge-center/demat-account/how-to-set-up-ddpi-on-angel-on',
    },
  };
  const handleActivateClick = () => {
    if (instructions.directLink) {
      Linking.openURL(instructions.directLink);
    } else {
      setShowModal(true);
    }
  };

  const broker = userDetails?.userDetails?.user_broker;
  const instructions = brokerInstructions[broker] || {};
  return (
    <>
      {/* Banner Section */}
      <View style={styles.bannerContainer}>
        <View style={styles.infoIcon} />
        <Text style={styles.bannerText}>
          Enable DDPI for faster trades and seamless transactions.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleActivateClick}>
          <Text style={styles.buttonText}>Activate DDPI &gt;&gt;</Text>
        </TouchableOpacity>
      </View>
      {/* Modal Section */}
      <Modal transparent={true} animationType="slide" visible={showModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {instructions.videoId && (
                <YoutubePlayer
                  height={200}
                  play={false}
                  videoId={instructions.videoId}
                />
              )}

              <Text style={styles.modalTitle}>{instructions.title}</Text>

              {/* Steps Section */}
              {instructions.steps.map((step, index) => (
                <View key={index} style={styles.stepContainer}>
                  <Text style={styles.stepNumber}>{index + 1}.</Text>
                  <View style={styles.stepTextContainer}>
                    <Text style={styles.stepText}>{step}</Text>
                    {step.includes('http') && (
                      <Tooltip
                        popover={
                          <Text style={styles.tooltipText}>Copied!</Text>
                        }
                        isVisible={copied}>
                        <TouchableOpacity
                          onPress={() =>
                            handleCopy(step.match(/https?:\/\/[^\s]+/)[0])
                          }>
                          <Text style={styles.copyButton}>📋</Text>
                        </TouchableOpacity>
                      </Tooltip>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function AngleOneTpinModal({
  sellOrders = [],
  isOpen,
  setIsOpen,
  userDetails,
  edisStatus: edisStatusProp,
  tradingSymbol,
  reopenRebalanceModal,
  getUserDetails,
}) {
  const [loading, setLoading] = useState(false);
  const [localEdisStatus, setLocalEdisStatus] = useState(null);
  const [isWebViewOpen, setIsWebViewOpen] = useState(false);
  const [showTpinConfirmation, setShowTpinConfirmation] = useState(false);
  const [tpinCompleted, setTpinCompleted] = useState(false);
  const { configData } = useTrade();
  // Guard against duplicate verify-edis fires per modal open. SmartAPI
  // verifyDis is rate-limited (1 req/sec) and the userDetails object
  // reference can flip on every parent re-render — without this guard
  // the useEffect re-fires repeatedly and Angel One returns 403
  // "Access denied because of exceeding access rate", which the
  // backend either translates to a 500 (no useful response) or a 200
  // with empty data: {}. Either case stops EDIS from working and is
  // why the CDSL form posts with empty DPId/ReqId/TransDtls.
  const verifyFiredRef = useRef(false);

  // Use prop if available, otherwise use locally fetched status
  const edisStatus = edisStatusProp || localEdisStatus;
  const hasUsableEdisData = !!(
    edisStatus?.data &&
    edisStatus.data.DPId &&
    edisStatus.data.ReqId &&
    edisStatus.data.TransDtls
  );

  // Reset the fire-once guard whenever the modal closes so the next
  // open re-runs verify-edis cleanly.
  useEffect(() => {
    if (!isOpen) {
      verifyFiredRef.current = false;
      setLocalEdisStatus(null);
    }
  }, [isOpen]);

  // Auto-fetch EDIS status if not provided as prop (matches production behavior)
  //
  // 2026-05-02 enhancement (parity with tidi_new RebalanceReviewPage live
  // verify-dis check): if SmartAPI verify-edis returns `edis: true` —
  // meaning the user is ALREADY authorized server-side (DDPI active OR
  // today's TPIN session valid) — auto-call handleProceed to flip
  // `is_authorized_for_sell=true` in DB and close the modal. The user
  // never sees the redundant prompt. Mirrors the Flutter
  // _checkAngelOneEdisStatus pattern (live-probe before forcing the
  // EDIS auth page).
  //
  // 2026-05-07: deps narrowed to primitive jwtToken (not the
  // userDetails object) and gated behind verifyFiredRef to fire once
  // per modal open. Earlier the useEffect refired on every parent
  // re-render and triggered Angel One rate-limiting; rate-limit
  // responses returned `data: {}` to the form-builder and CDSL
  // rejected with "Some data is missing in posted Form".
  const jwtToken = userDetails?.jwtToken;
  const userEmail = getAccountEmail();
  useEffect(() => {
    if (!isOpen) return;
    if (verifyFiredRef.current) return;
    // Prop path: parent already fetched EDIS status (e.g. RebalanceAdviceContent
    // pre-fetches on userDetails change). If it already shows edis=true, auto-skip
    // without re-fetching — same logic as the fetch path below.
    if (edisStatusProp?.edis === true) {
      verifyFiredRef.current = true;
      const isDdpiActive =
        edisStatusProp.errorcode === 'AG1000' ||
        (typeof edisStatusProp.message === 'string' &&
          /already.+registered.+with.+CDSL/i.test(edisStatusProp.message));
      console.log('[DdpiModal] prop edis=true → auto-skip, ddpiActive=', isDdpiActive);
      setTimeout(() => handleProceed(isDdpiActive), 0);
      return;
    }
    if (!jwtToken) return;
    verifyFiredRef.current = true;
    const fetchEdisStatus = async () => {
      try {
        setLoading(true);
        const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}angelone/verify-edis`,
          {
            apiKey: angelOneApiKey,
            jwtToken,
            userEmail,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        );
        console.log('AngleOne local EDIS fetch:', response.data);
        setLocalEdisStatus(response.data);
        // Live short-circuit — already authorized server-side, skip
        // the prompt entirely. handleProceed updates the DB flag +
        // closes the modal + reopens rebalance.
        if (response?.data?.edis === true) {
          // 2026-05-07: SmartAPI's verifyDis returning AG1000 means
          // DDPI is currently active at the broker (per Angel One
          // SmartAPI docs). Pass `ddpiActive: true` to handleProceed
          // so it ALSO sets `ddpi_enabled: true` in the DB —
          // previously only `is_authorized_for_sell` was set, leaving
          // `ddpi_enabled` stuck at false even though the broker
          // considered DDPI active. The RebalanceModal sell-auth
          // gate (line 1357-1364) reads `userDetails.ddpi_enabled`
          // and `userDetails.is_authorized_for_sell` — until the
          // latter was set, the gate would re-fire on every Place
          // Order tap (TPIN session expires daily, but DDPI doesn't).
          // Setting `ddpi_enabled: true` makes the gate skip
          // permanently as long as DDPI stays active at the broker.
          const isDdpiActive =
            response?.data?.errorcode === 'AG1000' ||
            (typeof response?.data?.message === 'string' &&
              /already.+registered.+with.+CDSL/i.test(response.data.message));
          console.log('[DdpiModal] verify-edis edis=true → auto-skip prompt, ddpiActive=', isDdpiActive);
          // Defer to next tick so React has settled state from the
          // setLocalEdisStatus call above before handleProceed mutates
          // the modal visibility.
          setTimeout(() => handleProceed(isDdpiActive), 0);
          return;
        }
        // edis=false but no usable form data — most commonly because
        // SmartAPI rate-limited verifyDis OR getHolding (returns
        // create_error_response with `data: {}`). Tell the user
        // explicitly so they know it's transient, not a "wrong API
        // key" type failure.
        const data = response?.data?.data;
        const hasFormData = !!(data?.DPId && data?.ReqId && data?.TransDtls);
        if (!hasFormData) {
          const reason = response?.data?.error || '';
          Toast.show({
            type: 'error',
            text1: 'Angel One temporarily busy',
            text2: reason
              ? `Couldn't fetch EDIS form: ${reason}. Wait 20s and retry.`
              : "Couldn't fetch EDIS form data. Please wait 20 seconds and retry.",
            visibilityTime: 5000,
          });
          // Allow a manual retry by re-opening the modal — clear the
          // guard so a re-open triggers a fresh call.
          verifyFiredRef.current = false;
        }
      } catch (error) {
        console.error('Error fetching Angel One EDIS status:', error);
        const upstream = error?.response?.data?.error || error?.message || '';
        const isRateLimited = /rate.?limit|exceeding access|RATE_LIMITED/i.test(upstream);
        Toast.show({
          type: 'error',
          text1: isRateLimited ? 'Angel One rate-limited' : 'Error',
          text2: isRateLimited
            ? 'Angel One temporarily blocked the request. Wait 20s and retry.'
            : 'Failed to fetch EDIS status. Please try again.',
          visibilityTime: 5000,
        });
        verifyFiredRef.current = false;
      } finally {
        setLoading(false);
      }
    };
    fetchEdisStatus();
  }, [isOpen, edisStatusProp, jwtToken, userEmail]);
  const buildFormHtml = (edisData) => `
  <!DOCTYPE html>
  <html>
  <script>window.onload = function() { document.getElementById("submitBtn").click(); }</script>
  <body>
    <form
      name="frmDIS"
      method="post"
      action="https://edis.cdslindia.com/eDIS/VerifyDIS/"
      style="display:none;"
    >
      <input type="hidden" name="DPId" value="${edisData?.DPId || ''}" />
      <input type="hidden" name="ReqId" value="${edisData?.ReqId || ''}" />
      <input type="hidden" name="Version" value="1.1" />
      <input type="hidden" name="TransDtls" value="${edisData?.TransDtls || ''}" />
      <input type="hidden" name="returnURL" value="${Config.REACT_APP_WEBSITE_URL || 'https://prod.alphaquark.in'}/stock-recommendation" />
      <input id="submitBtn" type="submit" />
    </form>
  </body>
  </html>
`;
  const [formHtml, setformhtml] = useState('');
  const proceedWithTpin = async () => {
    // Build form HTML fresh with current edisStatus data
    const html = buildFormHtml(edisStatus?.data);
    setformhtml(html);
    setIsWebViewOpen(true); // Open the WebView modal with the form content
    // setIsOpen(false); // Close the DDPI modal
  };
  const closeModal = async () => {
    setIsWebViewOpen(false);
    setformhtml('');
    setIsOpen(false); // Close the DDPI modal
  };

  // 2026-05-07: handleProceed now accepts an optional `ddpiActive`
  // flag. When true, also flips `ddpi_enabled` in the DB. Used by
  // the auto-skip path (verifyDis AG1000 = DDPI active at broker).
  // The TPIN-completion path (WebView returnURL hit) keeps the
  // default `false` since TPIN doesn't imply DDPI is active —
  // DDPI is a one-time setup, TPIN is a daily session.
  const handleProceed = async (ddpiActive = false) => {
    try {
      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
          ...(ddpiActive ? { ddpi_enabled: true } : {}),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
      setIsOpen(false);
      setShowTpinConfirmation(false);
      setTpinCompleted(false);
      if (reopenRebalanceModal) reopenRebalanceModal();
    } catch (error) {
      console.error('Error updating EDIS status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update authorization status.',
      });
    }
  };

  return (
    <>
      <Modal visible={isOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.contentWrapper}>
              <View style={styles.imageWrapper}>
                <Image
                  source={DDPI} // Replace with your image
                  style={styles.image}
                />
              </View>
              <View style={styles.textSection}>
                <SellAuthGuideCard
                  broker="Angel One"
                  configData={configData}
                  variant="inApp"
                  sellOrders={sellOrders}
                  testID="sell-auth-guide-angel-one"
                />
                {/* 2026-05-07: button enable previously checked
                 * `!edisStatus?.data` — but `data: {}` (empty object,
                 * what the backend returns when getHolding is rate-
                 * limited or holdings are empty) is TRUTHY in JS, so
                 * the button enabled and clicking it submitted an
                 * empty form to CDSL → "Some data is missing in
                 * posted Form". hasUsableEdisData verifies the actual
                 * fields the form needs. */}
                <TouchableOpacity
                  style={[styles.proceedButton, (loading || !hasUsableEdisData) && { opacity: 0.5 }]}
                  onPress={proceedWithTpin}
                  disabled={loading || !hasUsableEdisData}>
                  {loading ? (
                    <ActivityIndicator color={designColor('fff')} />
                  ) : (
                    <Text style={styles.buttonText}>
                      Proceed with Angel One Authorization to Sell
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        <Toast />
      </Modal>
      {/* WebView Modal */}
      {isWebViewOpen && (
        <Modal visible={isWebViewOpen} transparent animationType="slide"
          onRequestClose={() => {
            setIsWebViewOpen(false);
            setShowTpinConfirmation(true);
          }}>
          <WebView
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            source={{html: formHtml}}
            startInLoadingState
            renderLoading={() => <ActivityIndicator size="large" color={designColor('0000ff')} />}
            onNavigationStateChange={navState => {
              if (navState.url.includes('stock-recommendation')) {
                setIsWebViewOpen(false);
                setShowTpinConfirmation(true);
              }
            }}
            onShouldStartLoadWithRequest={request => {
              if (request.url.includes('stock-recommendation')) {
                setIsWebViewOpen(false);
                setShowTpinConfirmation(true);
                return false;
              }
              return true;
            }}
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setIsWebViewOpen(false);
              setShowTpinConfirmation(true);
            }}>
            <Text style={styles.closeIcon}>X</Text>
          </TouchableOpacity>
          <Toast />
        </Modal>
      )}
      {/* TPIN Confirmation Modal */}
      <Modal
        visible={showTpinConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTpinConfirmation(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTpinConfirmation(false);
                setTpinCompleted(false);
                setIsOpen(false);
              }}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.textSection}>
              <Text style={styles.title}>Authorization Complete?</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setTpinCompleted(!tpinCompleted)}>
                <View style={[styles.checkbox, tpinCompleted ? styles.checked : styles.unchecked]}>
                  {tpinCompleted && <Check size={14} color={designColor('fff')} />}
                </View>
                <Text style={styles.label}>I've authorized the sell of the stocks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedButton, !tpinCompleted && { opacity: 0.5 }]}
                onPress={handleProceed}
                disabled={!tpinCompleted}>
                <Text style={styles.buttonText}>Retry Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Toast />
      </Modal>
    </>
  );
}

export function DhanTpinModal({
  sellOrders = [],
  isOpen,
  setIsOpen,
  userDetails,
  dhanEdisStatus: dhanEdisStatusProp,
  stockTypeAndSymbol,
  singleStockTypeAndSymbol,
  reopenRebalanceModal,
  getUserDetails,
  onEdisStatusRefresh,
}) {
  const [loading, setLoading] = useState(false);
  const [localDhanEdisStatus, setLocalDhanEdisStatus] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [tpin, setTpin] = useState('');
  const [matchedData, setMatchedData] = useState(null);
  const [matchedIsin, setMatchedIsin] = useState(null);
  const [showNoHoldingModal, setShowNoHoldingModal] = useState(false);
  const [showTpinConfirmation, setShowTpinConfirmation] = useState(false);
  const [tpinCompleted, setTpinCompleted] = useState(false);
  const { configData } = useTrade();

  // A freshly fetched value must win over the parent prop. The parent value is
  // commonly the pre-authorization snapshot and caused the TPIN sheet to loop.
  const dhanEdisStatus = localDhanEdisStatus || dhanEdisStatusProp;

  const selectedSellTrades = getDhanSellTrades(
    stockTypeAndSymbol,
    singleStockTypeAndSymbol,
  );

  const fetchDhanEdisStatus = async () => {
    const response = await axios.post(
      `${server.ccxtServer.baseUrl}dhan/edis-status`,
      {
        clientId: userDetails?.clientCode,
        accessToken: userDetails?.jwtToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        },
      },
    );
    setLocalDhanEdisStatus(response.data);
    if (onEdisStatusRefresh) onEdisStatusRefresh(response.data);
    return response.data;
  };

  // Always refresh on open. A provided prop can be stale after returning from
  // Dhan/CDSL, so its presence must not suppress the live broker check.
  useEffect(() => {
    if (isOpen && userDetails?.jwtToken && userDetails?.clientCode) {
      setLoading(true);
      fetchDhanEdisStatus()
        .catch(error => console.error('Error fetching Dhan EDIS status:', error))
        .finally(() => setLoading(false));
    }
  }, [isOpen, userDetails?.jwtToken, userDetails?.clientCode]);

  const handleProceed = async () => {
    try {
      setLoading(true);
      let refreshedStatus = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        refreshedStatus = await fetchDhanEdisStatus();
        const ready = selectedSellTrades.length > 0
          ? isDhanSellAuthorizationReady(refreshedStatus, selectedSellTrades)
          : refreshedStatus?.data?.some(holding => holding?.edis === true);
        if (ready) break;
        if (attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      const authorizationReady = selectedSellTrades.length > 0
        ? isDhanSellAuthorizationReady(refreshedStatus, selectedSellTrades)
        : refreshedStatus?.data?.some(holding => holding?.edis === true);

      if (!authorizationReady) {
        Toast.show({
          type: 'error',
          text1: 'Dhan authorization is still processing',
          text2: 'The selected sell holdings are not authorized yet. Complete the Dhan/CDSL page, then verify again.',
          visibilityTime: 7000,
        });
        return;
      }

      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
      setIsOpen(false);
      setShowTpinConfirmation(false);
      setTpinCompleted(false);
      if (reopenRebalanceModal) reopenRebalanceModal();
    } catch (error) {
      console.error('Error updating EDIS status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update authorization status.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const shouldOpenPopup = AsyncStorage.getItem('openDhanPopup');
    if (shouldOpenPopup === 'true') {
      setIsPopupOpen(true);
      AsyncStorage.removeItem('openDhanPopup');
    }
  }, []);
  const stockTypeAndSymbolfinal = [...stockTypeAndSymbol].reverse();
  console.log('stockTypeAndSymbol', stockTypeAndSymbolfinal);
  console.log('stockTypeAndSymbolsingle', singleStockTypeAndSymbol);

  console.log('dhanEdisStatus', dhanEdisStatus);

  useEffect(() => {
    if (dhanEdisStatus && dhanEdisStatus.data) {
      let stockToMatch = null;

      if (
        Array.isArray(stockTypeAndSymbolfinal) &&
        stockTypeAndSymbolfinal.length > 0
      ) {
        console.log(
          'Handling array of stocks-------------))))))))))>>>>>>>',
          stockTypeAndSymbolfinal,
        );
        stockToMatch = stockTypeAndSymbolfinal.find(
          stock => stock.Type === 'SELL',
        );
      } else if (
        singleStockTypeAndSymbol &&
        singleStockTypeAndSymbol.type === 'SELL'
      ) {
        console.log('Handling single stock');
        stockToMatch = {
          Symbol: singleStockTypeAndSymbol.symbol,
          Exchange: singleStockTypeAndSymbol.exchange || 'NSE', // Assuming NSE if not provided
        };
      }

      console.log(
        'Stock to match:---------------------------<>>><><>',
        stockToMatch,
      );

      if (stockToMatch) {
        const matchedOrder = dhanEdisStatus.data.find(
          order =>
            order.symbol === stockToMatch.Symbol &&
            (order.exchange === stockToMatch.Exchange ||
              !stockToMatch.Exchange),
        );

        console.log('Matched order:', matchedOrder);

        if (matchedOrder) {
          setMatchedData({
            isin: matchedOrder.isin,
            symbol: matchedOrder.symbol,
            exchange: matchedOrder.exchange,
          });
          setMatchedIsin(matchedOrder.isin);
        } else {
          console.log('No matching order found, trying fallback');
          const fallbackOrder = dhanEdisStatus.data.find(
            (order) => order.edis === false && order.isin,
          );
          if (fallbackOrder) {
            setMatchedData({
              isin: fallbackOrder.isin,
              symbol: fallbackOrder.symbol,
              exchange: fallbackOrder.exchange,
            });
            setMatchedIsin(fallbackOrder.isin);
          } else {
            // Fallback: Use any holding with ISIN (all may be EDIS-authorized already)
            const anyHoldingWithIsin = dhanEdisStatus.data.find(
              (order) => order.isin,
            );
            if (anyHoldingWithIsin) {
              setMatchedData({
                isin: anyHoldingWithIsin.isin,
                symbol: anyHoldingWithIsin.symbol,
                exchange: anyHoldingWithIsin.exchange,
              });
              setMatchedIsin(anyHoldingWithIsin.isin);
            } else {
              setShowNoHoldingModal(true);
            }
          }
        }
      } else {
        console.log('No SELL order found, trying fallback');
        const fallbackOrder = dhanEdisStatus.data.find(
          (order) => order.edis === false && order.isin,
        );
        if (fallbackOrder) {
          setMatchedData({
            isin: fallbackOrder.isin,
            symbol: fallbackOrder.symbol,
            exchange: fallbackOrder.exchange,
          });
          setMatchedIsin(fallbackOrder.isin);
        } else {
          // Fallback: Use any holding with ISIN
          const anyHoldingWithIsin = dhanEdisStatus.data.find(
            (order) => order.isin,
          );
          if (anyHoldingWithIsin) {
            setMatchedData({
              isin: anyHoldingWithIsin.isin,
              symbol: anyHoldingWithIsin.symbol,
              exchange: anyHoldingWithIsin.exchange,
            });
            setMatchedIsin(anyHoldingWithIsin.isin);
          } else {
            setShowNoHoldingModal(true);
          }
        }
      }
    } else {
      console.log('dhanEdisStatus or its data is not available');
    }
  }, [stockTypeAndSymbol, singleStockTypeAndSymbol, dhanEdisStatus]);

  const [isWebViewOpen, setIsWebViewOpen] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  const proceedWithDhanTpin = async () => {
    setLoading(true);

    if (!matchedData || !matchedData.isin) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No holdings found to authorize.',
      });
      setLoading(false);
      return;
    }

    try {
      const broker = userDetails?.user_broker;
      if (broker === 'Dhan') {
        // Generate TPIN API call
        const generateTpinResponse = await fetch(
          `${server.ccxtServer.baseUrl}dhan/generate-tpin`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
            body: JSON.stringify({
              clientId: userDetails?.clientCode,
              accessToken: userDetails?.jwtToken,
            }),
          },
        );
        const generateTpinData = await generateTpinResponse.json();

        if (generateTpinData.status === 0) {
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'TPIN generated successfully for Dhan.',
          });

          // Enter TPIN API call
          const enterTpinResponse = await fetch(
            `${server.ccxtServer.baseUrl}dhan/enter-tpin`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getTenantSubdomain(configData),
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
              body: JSON.stringify({
                clientId: userDetails?.clientCode,
                accessToken: userDetails?.jwtToken,
                isin: matchedData.isin,
                symbol: matchedData.symbol,
                exchange: matchedData.exchange,
              }),
            },
          );
          const enterTpinData = await enterTpinResponse.json();

          if (enterTpinData.status === 0) {
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: enterTpinData.message || 'Operation successful.',
            });

            if (enterTpinData?.data?.edisFormHtml) {
              // Pass the HTML form to WebView
              const edisFormHtml = enterTpinData.data.edisFormHtml;
              setWebViewUrl(edisFormHtml);
              setIsWebViewOpen(true);
            } else {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'EDIS form data not received.',
              });
            }
          } else {
            throw new Error(enterTpinData.message || 'Failed to enter TPIN');
          }
        } else {
          throw new Error(
            generateTpinData.message || 'Failed to generate TPIN for Dhan',
          );
        }
      }
    } catch (error) {
      console.error('Error in API call:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'An error occurred during the process',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNavigation = navState => {
    const {url} = navState;
    console.log('Url we get:', url);
    if (url.includes('ReturnUrl')) {
      // Check if the success condition is met
      Toast.show({
        type: 'success',
        text1: 'success',
        text2: 'EDIS Activated Successfully.',
      });
      setIsWebViewOpen(false);
      setShowTpinConfirmation(true);
    } else if (url.includes('failure')) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'EDIS form data not received.',
      });
      setIsWebViewOpen(false);
    }
  };

  const handleCancel = () => {
    setTpin('');
    setIsPopupOpen(false);
    setIsOpen(false);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Modal visible={isOpen} transparent animationType="fade">
        {showNoHoldingModal ? (
          // No Holdings Modal
          (<View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>No Holdings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}>
                <XIcon size={20} color={'grey'} />
              </TouchableOpacity>
              <Text style={styles.warningText}>
                Unable to place orders. Each order must have sufficient holdings
                to proceed.
              </Text>
            </View>
          </View>)
        ) : !isPopupOpen ? (
          // DDPI Inactive Modal
          (<View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <XIcon size={20} color={'grey'} />
              </TouchableOpacity>
              <View style={styles.imageWrapper}>
                <Image
                  source={DDPI} // Replace with your image
                  style={styles.image}
                />
              </View>
              <View style={styles.contentWrapper}>
                <View style={styles.textSection}>
                  <SellAuthGuideCard
                    broker="Dhan"
                    configData={configData}
                    variant="inApp"
                    sellOrders={sellOrders}
                    testID="sell-auth-guide-dhan"
                  />
                  <TouchableOpacity
                    style={[styles.proceedButton, loading && { opacity: 0.5 }]}
                    onPress={proceedWithDhanTpin}
                    disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color={designColor('fff')} />
                    ) : (
                      <Text style={styles.buttonText}>
                        Proceed with Dhan Authorization to Sell
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>)
        ) : null}
        <Toast />
      </Modal>
      {/* WebView Modal */}
      {isWebViewOpen && (
        <Modal visible={isWebViewOpen} animationType="slide"
          onRequestClose={() => {
            setIsWebViewOpen(false);
            setShowTpinConfirmation(true);
          }}>
          <WebView
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            source={{html: webViewUrl}}
            onNavigationStateChange={handleWebViewNavigation}
            onShouldStartLoadWithRequest={request => {
              if (request.url.includes('ReturnUrl')) {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'EDIS Activated Successfully.',
                });
                setIsWebViewOpen(false);
                setShowTpinConfirmation(true);
                return false;
              }
              return true;
            }}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator size="large" color={designColor('0000ff')} />
            )}
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setIsWebViewOpen(false);
              setShowTpinConfirmation(true);
            }}>
            <XIcon size={20} color={'grey'} />
          </TouchableOpacity>
          <Toast />
        </Modal>
      )}
      {/* TPIN Confirmation Modal */}
      <Modal
        visible={showTpinConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTpinConfirmation(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTpinConfirmation(false);
                setTpinCompleted(false);
                setIsOpen(false);
              }}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.textSection}>
              <Text style={styles.title}>Authorization Complete?</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setTpinCompleted(!tpinCompleted)}>
                <View style={[styles.checkbox, tpinCompleted ? styles.checked : styles.unchecked]}>
                  {tpinCompleted && <Check size={14} color={designColor('fff')} />}
                </View>
                <Text style={styles.label}>I've authorized the sell of the stocks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedButton, !tpinCompleted && { opacity: 0.5 }]}
                onPress={handleProceed}
                disabled={!tpinCompleted || loading}>
                {loading ? (
                  <ActivityIndicator color={designColor('fff')} />
                ) : (
                  <Text style={styles.buttonText}>Verify authorization and review orders</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Toast />
      </Modal>
    </>
  );
}

export function OtherBrokerModel({
  sellOrders = [],
  userDetails,
  onContinue,
  setShowOtherBrokerModel,
  openReviewModal,
  setOpenReviewTrade,
  userEmail,
  apiKey,
  jwtToken,
  secretKey,
  clientCode,
  visible,
  sid,
  viewToken,
  showActivateNowModel,
  serverId,
  setCaluculatedPortfolioData,
  setModelPortfolioModelId,
  modelPortfolioModelId,
  modelName,
  setActivateNowModel,
  setOpenRebalanceModal,
  funds,
  setStoreModalName,
  storeModalName,
  getUserDetails,
  reopenRebalanceModal,
}) {
  const {configData} = useTrade();
  const [isOpen, setIsOpen] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSellAllowed, setIsSellAllowed] = useState(false);

  const [showMainModal, setShowMainModal] = useState(true);
  const [showHowToAuthorize, setShowHowToAuthorize] = useState(false);

  const brokerInstructions = {
    // Keys must match userDetails.user_broker exactly (all 14 supported brokers).
    // Previously: missing Zerodha/Angel One/Groww/Motilal/Axis/Fyers caused TypeError
    // crash on "How to Authorize" tap. Wrong keys 'Kotak Securities'→'Kotak' and
    // 'HDFC Securities'→'Hdfc Securities' also crashed. Dhan's videoId was a full
    // URL (invalid for YoutubePlayer) — removed. YoutubePlayer only rendered when
    // videoId is a non-empty string (guarded below at render site).
    Zerodha: {
      title: 'Zerodha: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Zerodha Kite app → go to the Portfolio tab.',
        '2. Tap the Authorize button shown above your holdings.',
        '3. You will be taken to CDSL — enter your 6-digit TPIN. (Tap "Forgot TPIN" to generate one via OTP if needed.)',
        '4. Enter the OTP sent to your registered mobile number.',
        '5. Return here and retry the sell order.',
      ],
    },
    'Angel One': {
      title: 'Angel One: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Angel One app → go to Portfolio → Holdings.',
        '2. Tap Authorize next to the stock you want to sell.',
        '3. You will be taken to CDSL — enter your TPIN and OTP.',
        '4. Return here and retry the sell order.',
      ],
    },
    Upstox: {
      title: 'Upstox: How to Authorize Stocks for Selling',
      videoId: 'eD6aQ07Ommw',
      steps: [
        '1. Log in to your Upstox account.',
        '2. Go to the Holdings tab and click Authorize next to the Day P&L value.',
        '3. Select Authorize with T-PIN.',
        '4. Click Continue to CDSL.',
        '5. Enter your T-PIN (or generate a new one if needed) and verify it, then enter the OTP.',
        `6. Once verified, return to the ${Config?.REACT_APP_WHITE_LABEL_TEXT || getPlatformDisplayName()} platform and retry the sell order.`,
      ],
    },
    'ICICI Direct': {
      title: 'ICICI Direct: How to Authorize Stocks for Selling',
      steps: [
        '1. Log in to icicidirect.com → go to Portfolio.',
        '2. Click Add Mandate (next to the Refresh icon, just above Overall Gain).',
        '3. Select the stock, click Proceed, enter your MPIN, then Submit.',
        '4. Tick the T&C checkbox, enter the OTP, and click Submit.',
        '5. Return here and retry the sell order.',
      ],
    },
    Kotak: {
      title: 'Kotak Securities: How to Authorize Stocks for Selling',
      steps: [
        '1. Log in to your Kotak Neo account (neo.kotaksecurities.com or the app).',
        '2. Go to Portfolio → Holdings.',
        '3. Tap Authorize next to your stocks.',
        '4. Complete TPIN/OTP verification on CDSL.',
        '5. Return here and retry the sell order.',
      ],
    },
    Dhan: {
      title: 'Dhan: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Dhan app or web.dhan.co → go to Portfolio → Holdings.',
        '2. Tap Authorize next to the stock you want to sell.',
        '3. You will be redirected to CDSL — enter your TPIN and OTP.',
        '4. Return here and retry the sell order.',
      ],
    },
    Fyers: {
      title: 'Fyers: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Fyers app or app.fyers.in → go to Portfolio → Holdings.',
        '2. Select the stock and tap Authorize.',
        '3. Complete TPIN/OTP verification on the CDSL page.',
        '4. Return here and retry the sell order.',
      ],
    },
    'IIFL Securities': {
      title: 'IIFL Securities: How to Authorize Stocks for Selling',
      videoId: 'hpP5M5H52HY',
      steps: [
        '1. Log in to your IIFL Securities account.',
        '2. Tap on the Holdings tab at the bottom of the screen.',
        '3. Select the stocks to sell, tap Transfer, then tap Authorize Now.',
        '4. Complete TPIN verification and OTP authentication.',
        '5. Return here and retry the sell order.',
      ],
    },
    AliceBlue: {
      title: 'AliceBlue: How to Authorize Stocks for Selling',
      videoId: 'gP06qK8LfYo',
      steps: [
        '1. Log in to your AliceBlue account (ant.aliceblueonline.com).',
        '2. Go to Portfolio → Holdings and tap the Authorize button below Portfolio Value.',
        '3. In the CDSL page, select the stocks and tap Authorize.',
        '4. Enter your TPIN and OTP for verification. Tap "Forgot TPIN" if needed.',
        '5. Return here and retry the sell order.',
      ],
    },
    'Motilal Oswal': {
      title: 'Motilal Oswal: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Motilal Oswal app or invest.motilaloswal.com → go to Portfolio → Holdings.',
        '2. Select the stock and tap Authorize for Sell / EDIS Authorization.',
        '3. Enter your TPIN and OTP on the CDSL verification page.',
        '4. Return here and retry the sell order.',
      ],
    },
    'Hdfc Securities': {
      title: 'HDFC Securities: How to Authorize Stocks for Selling',
      videoId: 'CkZI_2psXLY',
      steps: [
        '1. Log in to your HDFC Securities account.',
        '2. Go to Portfolio → Demat Balance → Equity.',
        '3. Click Raise eDIS Request, select the stock(s), and submit.',
        '4. Accept the Terms and Conditions, click Authorize Now (use Forgotten TPIN if needed).',
        '5. Complete CDSL authorization by entering your TPIN and OTP.',
        `6. Return here and retry the sell order.`,
      ],
    },
    Groww: {
      title: 'Groww: How to Authorize Stocks for Selling',
      steps: [
        '1. Open https://groww.in/holdings/cdslauth and sign in to Groww.',
        '2. Select the holdings you want to authorize for today.',
        '3. Enter your CDSL TPIN and OTP. This authorizes holdings; it does not sell them.',
        '4. Return here and recalculate before placing the order again.',
        '5. For a permanent fix, activate DDPI from Stocks Holdings → three-dot menu → DDPI.',
      ],
    },
    'Axis Securities': {
      title: 'Axis Securities: How to Authorize Stocks for Selling',
      steps: [
        '1. Open the Axis Direct app or simplehai.axisdirect.in → go to Portfolio → Holdings.',
        '2. Tap Authorize next to the stock you need to sell.',
        '3. Complete TPIN/OTP verification on the CDSL page.',
        '4. Return here and retry the sell order.',
      ],
    },
  };

  const broker = userDetails?.user_broker;
  const instructions = brokerInstructions[broker] || {};

  const [showOtherBroker, setShowOtherBroker] = useState(false);
  const [loadingRebalance, setLoadingRebalance] = useState(false);
  // Progress of the authorized-recalculate step: 'saving' | 'recalculating' | null.
  const [retryStage, setRetryStage] = useState(null);
  const [retryError, setRetryError] = useState(null);
  const handleContinue = async () => {
    try {
      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
    } catch (error) {
      console.error('Error updating EDIS status:', error);
      Toast.show({
        type: 'error',
        text1: 'Authorization was not saved',
        text2: 'Please try again. No order was placed.',
      });
      return;
    }
    setIsOpen(false);
    setShowOtherBrokerModel(false);
    if (onContinue) await onContinue();
    if (openReviewModal) openReviewModal();
  };

  const handleClose = () => {
    console.log('here we');
    setIsOpen(false); // Close the modal
    setShowOtherBrokerModel(false); // Close the other broker model
    setShowMainModal(false); // Close the main modal
    setShowHowToAuthorize(false); // Hide authorization instructions
    setIsAuthorized(false); // Reset authorization flag
    setIsSellAllowed(false);
  };

  if (!isOpen) return null;

  const openHowToAuthorize = () => {
    setShowMainModal(false);
    setShowHowToAuthorize(true);
  };

  const closeHowToAuthorize = () => {
    setShowHowToAuthorize(false);
    setShowMainModal(true);
  };

  const handleRetrySellOrder = () => {
    console.log('Retrying sell order...');
    // Add your retry sell order logic here
    closeHowToAuthorize();
  };

  const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;
  const advisorName = configData?.config?.REACT_APP_ADVISOR_TAG;
  // "I've authorized — recalculate": save the sell authorization, recalculate
  // the plan, then hand back to the review screen. The sheet stays OPEN with
  // visible progress until the recalculation returns (2026-10-01): it used to
  // close first, so the customer sat on the home screen during the request,
  // then the review reappeared with no explanation, and both failure paths
  // were silent. Orders are never placed here — the customer reviews the
  // recalculated plan and taps Place Order.
  const handleAcceptRebalance = async () => {
    if (retryStage) return; // double-tap guard
    setRetryError(null);
    setLoadingRebalance(true);
    setRetryStage('saving');
    let authorizationSaved = true;
    try {
      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
    } catch (error) {
      // Not a reason to stop: the customer says they authorized at the broker,
      // and the broker itself enforces authorization at placement (a guard on
      // a money path blocks only on positive evidence). Continue, but say so.
      authorizationSaved = false;
      console.error('Error updating EDIS status:', error);
    }

    setRetryStage('recalculating');
    // Simplified payload - backend fetches credentials server-side
    // Only send accessToken for authentication
    const payload = {
      userEmail: userEmail,
      userBroker: broker,
      modelName: storeModalName,
      advisor: advisorName,
      model_id: modelPortfolioModelId,
      userFund: funds?.data?.availablecash,
      accessToken: jwtToken,
    };
    try {
      const response = await axios.request({
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify(payload),
      });
      setCaluculatedPortfolioData(
        tagSellAuthorizationRetryCalculation(response.data, {
          broker,
          modelName: storeModalName,
          modelId: modelPortfolioModelId,
        }),
      );
      setModelPortfolioModelId(modelPortfolioModelId);
      setRetryStage(null);
      setLoadingRebalance(false);
      // Close this sheet only now, then reopen the review.
      onContinue();
      setShowOtherBrokerModel(false);
      setOpenRebalanceModal(true);
      // Shown after the review modal (and its own toast host) has mounted.
      setTimeout(() => {
        Toast.show({
          type: authorizationSaved ? 'success' : 'info',
          text1: authorizationSaved
            ? 'Sell authorization saved'
            : 'Orders recalculated',
          text2:
            'No orders placed yet. Review the updated orders and tap Place Order.',
          visibilityTime: 7000,
        });
      }, 600);
    } catch (error) {
      console.log(error);
      setRetryStage(null);
      setLoadingRebalance(false);
      const detail =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED'
          ? 'Network problem.'
          : '');
      setRetryError(
        `Could not recalculate your orders. ${detail ? `${detail} ` : ''}No orders were placed. Tap retry.`,
      );
    }
  };

  const toggleCheckbox = () => {
    console.log('toog');
    setIsSellAllowed(!isSellAllowed);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <XIcon name="close" size={24} color="gray" />
          </TouchableOpacity>
          {showActivateNowModel && (
            <TouchableOpacity
              style={styles.BackButton}
              onPress={() => setActivateNowModel(false)}>
              <ChevronLeft name="chevron-left" size={24} color="gray" />
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={styles.modalContent}>
            {showHowToAuthorize ? (
              <>
                {brokerInstructions[broker]?.videoId ? (
                  <View style={styles.playerWrapper}>
                    <YoutubePlayer
                      height={screenHeight * 0.23}
                      width={screenWidth * 0.85}
                      play={false}
                      videoId={brokerInstructions[broker].videoId}
                    />
                  </View>
                ) : null}

                {/* Copy comes from the server guide (DDPI_EDIS §10); the local
                    brokerInstructions object only supplies walkthrough videos. */}
                <SellAuthGuideCard
                  broker={broker}
                  configData={configData}
                  variant="portal"
                  sellOrders={sellOrders}
                  testID="sell-auth-guide-howto"
                />
              </>
            ) : (
              <View style={{width: '100%'}}>
                <View style={{flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: 12}}>
                  <AlertTriangle size={22} color={designColor('e43d3d')} />
                  <Text style={[styles.title, {marginLeft: 8, fontSize: 18}]}>
                    Sell Authorization Required
                  </Text>
                </View>

                <View style={otherBrokerStyles.ddpiHeroCard}>
                  <View style={otherBrokerStyles.ddpiHeroBadge}>
                    <Text style={otherBrokerStyles.ddpiHeroBadgeText}>RECOMMENDED</Text>
                  </View>
                  <Text style={otherBrokerStyles.ddpiHeroTitle}>
                    Activate DDPI — Sell Freely, Forever
                  </Text>
                  <Text style={otherBrokerStyles.ddpiHeroBody}>
                    DDPI is a one-time, SEBI-approved authorization that lets you sell stocks without daily TPIN/OTP hassle. Set it up once and never see this screen again.
                  </Text>
                  <TouchableOpacity
                    onPress={() => useModalStore.getState().openModal('DdpiHelp', {broker})}
                    style={otherBrokerStyles.ddpiHeroButton}
                    activeOpacity={0.7}>
                    <Text style={otherBrokerStyles.ddpiHeroButtonText}>
                      Activate DDPI on {broker}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={otherBrokerStyles.dividerRow}>
                  <View style={otherBrokerStyles.dividerLine} />
                  <Text style={otherBrokerStyles.dividerText}>or authorize for today</Text>
                  <View style={otherBrokerStyles.dividerLine} />
                </View>

                <SellAuthGuideCard
                  broker={broker}
                  configData={configData}
                  variant="portal"
                  sellOrders={sellOrders}
                  testID="sell-auth-guide-other-broker"
                />
              </View>
            )}

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                onPress={toggleCheckbox}
                style={[
                  styles.checkbox,
                  isSellAllowed ? styles.checked : styles.unchecked,
                ]}>
                {isSellAllowed && <Check size={20} color={designColor('fff')} />}
              </TouchableOpacity>
              <Text style={styles.label}>
                I've authorized the sell of the above stocks
              </Text>
            </View>

            {/* Progress + outcome of "Authorized — recalculate". */}
            {retryStage ? (
              <View style={otherBrokerStyles.retryStatus}>
                <ActivityIndicator size="small" color={designColor('0056b7')} />
                <Text style={otherBrokerStyles.retryStatusText}>
                  {retryStage === 'saving'
                    ? 'Saving your authorization…'
                    : 'Recalculating your orders…'}
                </Text>
              </View>
            ) : null}
            {retryError ? (
              <View style={otherBrokerStyles.retryError}>
                <Text style={otherBrokerStyles.retryErrorText}>{retryError}</Text>
              </View>
            ) : null}

            {/* Stacked, full-width actions so both fit any phone width (the
                side-by-side row clipped on ~360dp screens once the labels
                grew on 2026-09-30). */}
            <View style={styles.actionsContainer}>
              {modelPortfolioModelId ? (
                <TouchableOpacity
                  style={[
                    styles.button,
                    otherBrokerStyles.fullWidthAction,
                    isSellAllowed && !retryStage
                      ? styles.enabledButton
                      : styles.disabledButton,
                  ]}
                  disabled={!isSellAllowed || Boolean(retryStage)}
                  onPress={handleAcceptRebalance}>
                  {loadingRebalance ? (
                    <ActivityIndicator size="small" color={designColor('fff')} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {retryError ? 'Try again' : 'Authorized — recalculate'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    otherBrokerStyles.fullWidthAction,
                    isSellAllowed
                      ? styles.enabledButton
                      : styles.disabledButton,
                  ]}
                  disabled={!isSellAllowed}
                  onPress={handleContinue}>
                  <Text style={styles.buttonText}>Authorized — review again</Text>
                </TouchableOpacity>
              )}

              {!showHowToAuthorize && (
                <TouchableOpacity
                  style={[styles.howToButton, otherBrokerStyles.fullWidthAction]}
                  onPress={openHowToAuthorize}>
                  <Text style={styles.howToButtonText}>
                    How to Authorize {'>'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
      {/* Toast host inside this native Modal (the app-level host renders
          underneath an open Modal; see RebalanceModal). */}
      <Toast />
    </Modal>
  );
}

export function AfterPlaceOrderDdpiModal({onClose, userDetails, visible = true}) {
  const [showActivateNowModel, setShowActivateNowModel] = useState(false);

  const handleCopy = textToCopy => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(textToCopy);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Copied to clipboard!',
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to copy text.',
      });
    }
  };

  const brokerInstructions = {
    'IIFL Securities': {
      title: 'IIFL Broker: Enable DDPI Instructions',
      videoId: 'N0KXx4vuThw',
      steps: [
        '1. Log in to your IIFL Securities account.',
        '2. Tap on the Holdings tab at the bottom of the screen.',
        '3. Select the stocks to sell, click Transfer, and then click **Authorize Now.',
        '4. Complete TPIN verification and OTP authentication.',
        '5. After successful authorization, return to the platform to retry selling orders.',
      ],
    },
    'ICICI Direct': {
      title: 'To enable DDPI on your ICICI Direct account:',

      steps: [
        "1. There is no online process for activation. You need to fill out the DDPI form provided and send it to your broker's office via courier.",
        '2. Once received, the broker or DP will review and process the request within two to three business days.',
        '3. Download DDPI Form - www.icicidirect.com/mailimages/BM_DDPI_Version_9.pdf?_gl=1*1nq02ef*_gcl_au*MTUyMjU1Nzk2OS4xNzI2MjMxNzQw)',
        '4. Customer Care Details:',
        'Email: helpdesk@icicidirect.com',
        'Phone: 022-3355-1122',
        '5. Complete this process to enable DDPI on your account.',
      ],
    },

    Upstox: {
      title: 'Upstox: Enable DDPI Instructions',
      directLink:
        'https://help.upstox.com/support/solutions/articles/260205-how-do-i-activate-ddpi-poa-on-upstox-',
      steps: [
        '1. If you have not enabled DDPI, please enable it by following these steps:',
        '2. Log in to your Upstox account.',
        '3. Go to the Settings or Profile section.',
        '4. Look for the DDPI activation option and follow the prompts to complete the process.',
      ],
    },

    'Kotak Securities': {
      title: 'Steps to Enable DDPI on Kotak Securities Account:',
      steps: [
        'For Website:',
        '1. Log in to your Kotak Securities account.',
        '2. Click on the User Profile icon.',
        '3. Go to Services > Service Request > Proceed under Demat Debit and Pledge Instruction Execution',
        '',
        'For Mobile App (Neo App):',
        '1. Log in to the Neo App.',
        '2. Click on the Profile Option (displayed as the initials of your name).',
        '3. Navigate to Services > Service Request > Demat Debit and Pledge Instruction Execution',
        '',
        'Customer Care Details:',
        '- Email: service.securities@kotak.com',
        '- Phone: 1800-209-9191',
        '- WhatsApp: +91 77389 88888',
        '',
        'Follow these steps to enable DDPI on your Kotak account for smooth and faster transactions.',
      ],
    },

    'HDFC Securities': {
      title: 'To enable DDPI on your HDFC Securities account:',
      steps: [
        '1. New Accounts: You will receive an email after account creation. Follow the instructions to activate DDPI.',
        "2. Existing Accounts: Contact HDFC Securities customer care as there's no online process. They will email you the steps for activation.",
        '4. Customer Care Details:',
        'Email: support@hdfcsec.com',
        'Phone: 022-6246-5555',
        '5. Follow this process to enable DDPI for faster transactions.',
      ],
    },

    AliceBlue: {
      title: 'AliceBlue: Enable DDPI Instructions',
      directLink:
        'https://aliceblueonline.com/support/account-opening/ddpi-activation-guide/',
      steps: [
        '1. If you have not enabled DDPI, please enable it by following these steps:',
        '2. Sign in to your AliceBlue trading account.',
        '3. Find the DDPI activation option in the Account or Settings menu.',
        '4. Follow the provided instructions to activate DDPI for your account.',
      ],
    },
    Dhan: {
      title: 'Dhan Broker: Enable DDPI Instructions',
      directLink:
        'https://knowledge.dhan.co/support/solutions/articles/82000900258-from-where-ddpi-service-can-be-activated-',
      steps: [
        '1. If you have not enabled DDPI, please enable it by following these steps:',
        '2. Log in to your IIFL account.',
        '3. Navigate to the DDPI activation section.',
        '4. Follow the on-screen instructions to complete the DDPI activation process.',
      ],
    },

    Zerodha: {
      title: 'Zerodha: Enable DDPI Instructions',
      directLink:
        'https://support.zerodha.com/category/account-opening/online-account-opening/other-online-account-opening-related-queries/articles/activate-ddpi',

      steps: [
        '1. If you have not enabled DDPI, please enable it by following these steps:',
        '2. Log in to your Zerodha account.',
        '3. Navigate to the Profile or Settings section.',
        '4. Find the DDPI activation option and follow the prompts.',
      ],
    },

    'Angel One': {
      title: 'AngelOne: Enable DDPI Instructions',
      directLink:
        'https://www.angelone.in/knowledge-center/demat-account/how-to-set-up-ddpi-on-angel-one',
      steps: [
        '1. If you have not enabled DDPI, please enable it by following these steps:',
        '2. Log in to your AngelOne account.',
        '3. Access the Profile section.',
        '4. Find the DDPI option and complete the activation steps.',
      ],
    },
  };

  const broker = userDetails?.user_broker;
  const instructions = brokerInstructions[broker] || {};

  const handleActivateDDPiNow = () => {
    // Close the current modal if it's open, and show the new modal
    if (instructions.directLink) {
      Linking.openURL(instructions.directLink);
      onClose();
    } else {
      setShowActivateNowModel(true);
    }
  };

  const closeModal = () => {
    setShowActivateNowModel(false);
    onClose();
  };

  const handleBackButton = () => {
    setShowActivateNowModel(false);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        {!showActivateNowModel ? (
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={18} color="black" />
            </TouchableOpacity>
            <View style={styles.modalContent}>
              <View style={styles.imageContainer}>
                <Image
                  source={require('../assets/DDPI.png')}
                  style={styles.image}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>
                  Save Time and Effort by Enabling DDPI!
                </Text>
                <ScrollView style={styles.listContainer}>
                  <View style={styles.listItem}>
                    <Text style={styles.listText}>
                      <Text style={styles.bold}>Instant Selling:</Text> Sell
                      your holdings instantly after DDPI activation.
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listText}>
                      <Text style={styles.bold}>Seamless Liquidation:</Text>{' '}
                      Liquidate your holdings without the hassle.
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listText}>
                      <Text style={styles.bold}>Faster Transactions:</Text>{' '}
                      Enjoy smoother and quicker trading experiences.
                    </Text>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={styles.activateButton}
                  onPress={handleActivateDDPiNow}>
                  <Text style={styles.activateButtonText}>
                    Activate DDPI Now &gt;&gt;
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={handleBackButton}
                style={styles.backButton}>
                <ArrowLeft size={18} color="gray" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <X size={20} color="gray" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {instructions.videoId && (
                <View style={styles.videoContainer}>
                  <WebView
                    source={{uri: instructions.videoId}}
                    style={styles.video}
                    javaScriptEnabled
                    domStorageEnabled
                  />
                </View>
              )}
              <Text style={styles.stepTitle}>{instructions.title}</Text>
              <ScrollView style={styles.stepsContainer}>
                {instructions.steps.map((step, index) => (
                  <View key={index} style={styles.step}>
                    <Text style={styles.stepText}>{step}</Text>
                    {step.includes('http') && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(step)}
                        style={styles.linkButton}>
                        <ClipboardList size={16} color="gray" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

export function FyersTpinModal({isOpen, setIsOpen, userDetails, reopenRebalanceModal, getUserDetails, sellOrders = []}) {
  const [loading, setLoading] = useState(false);
  const [webViewHtml, setWebViewHtml] = useState('');
  const [isWebViewOpen, setIsWebViewOpen] = useState(false);
  const [showTpinConfirmation, setShowTpinConfirmation] = useState(false);
  const [tpinCompleted, setTpinCompleted] = useState(false);
  const { configData } = useTrade();

  const proceedWithFyersTpin = async () => {
    setLoading(true);
    try {
      const broker = userDetails.user_broker;

      if (broker === 'Fyers') {
        // `fyers/tpin` only asks CDSL to SEND the customer their TPIN. The
        // authorization itself is `submit-holdings` -> the CDSL page, where the
        // customer types the TPIN they already hold. Chaining the two meant a
        // slow/failed resend killed the whole sell for a customer who never
        // needed it (2026-09-21: Fyers /api/v2/tpin read-timeout at 12s -> ccxt
        // 500 -> 'Failed to generate TPIN for Fyers', with a valid TPIN in
        // hand). The resend is best-effort and never blocks. See
        // prod-alphaquark-github docs/DDPI_EDIS_SELL_AUTH_ARCHITECTURE.md 6.11.
        let tpinResendFailed = false;
        try {
          const generateTpinResponse = await fetch(
            `${server.ccxtServer.baseUrl}fyers/tpin`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getTenantSubdomain(configData),
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
              body: JSON.stringify({
                clientId: userDetails?.clientCode,
                accessToken: userDetails?.jwtToken,
              }),
            },
          );
          const generateTpinData = await generateTpinResponse.json();
          if (generateTpinData?.status !== 0) tpinResendFailed = true;
        } catch (resendError) {
          tpinResendFailed = true;
        }
        Toast.show(
          tpinResendFailed
            ? {
                type: 'info',
                text1: 'Use your existing TPIN',
                text2: "We couldn't send a fresh TPIN. CDSL will ask for the one you already have.",
              }
            : {
                type: 'success',
                text1: 'Success',
                text2: 'TPIN sent for Fyers.',
              },
        );

        const submitHoldingsResponse = await fetch(
          `${server.ccxtServer.baseUrl}fyers/submit-holdings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
            body: JSON.stringify({
              clientId: userDetails?.clientCode,
              accessToken: userDetails?.jwtToken,
            }),
          },
        );

        const submitHoldingsData = await submitHoldingsResponse.json();

        if (submitHoldingsData.status === 0) {
          // Open the CDSL form in a WebView modal
          setWebViewHtml(submitHoldingsData.data);
          setIsWebViewOpen(true);
        } else {
          throw new Error(
            submitHoldingsData.message ||
              'Fyers could not open the CDSL authorization page. Please try again in a moment.',
          );
        }
      } else {
        throw new Error('Invalid broker');
      }
    } catch (error) {
      console.error('Error in API call:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred during the process.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNavigation = navState => {
    if (navState.url.includes('success')) {
      setIsWebViewOpen(false);
      setShowTpinConfirmation(true);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'CDSL authorization completed successfully.',
      });
    }
  };

  const handleProceed = async () => {
    try {
      await axios.put(
        `${server.server.baseUrl}api/update-edis-status`,
        {
          uid: userDetails?._id,
          is_authorized_for_sell: true,
          user_broker: userDetails?.user_broker,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Await the user-details refresh before closing/reopening so the
      // next modal reads the post-PUT is_authorized_for_sell=true
      // instead of stale false. Without await, a fast reopened
      // rebalance modal re-triggers this DDPI prompt (web e73bd81).
      if (getUserDetails) await getUserDetails();
      setIsOpen(false);
      setShowTpinConfirmation(false);
      setTpinCompleted(false);
      if (reopenRebalanceModal) reopenRebalanceModal();
    } catch (error) {
      console.error('Error updating EDIS status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update authorization status.',
      });
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hide the native sheet while the app-root CDSL browser is mounted.
          Keeping two Android Modal windows open puts the TPIN form behind the
          informational sheet and prevents keyboard/touch input. */}
      <Modal
        visible={isOpen && !isWebViewOpen && !showTpinConfirmation}
        transparent
        animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <XIcon size={20} color={'grey'} />
            </TouchableOpacity>
            <View style={styles.imageWrapper}>
              <Image
                source={DDPI} // Replace with your image
                style={styles.image}
              />
            </View>
            <View style={styles.contentWrapper}>
              <View style={styles.textSection}>
                <SellAuthGuideCard
                  broker="Fyers"
                  configData={configData}
                  variant="inApp"
                  sellOrders={sellOrders}
                  testID="sell-auth-guide-fyers"
                />
                <TouchableOpacity
                  style={styles.proceedButton}
                  onPress={proceedWithFyersTpin}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={designColor('fff')} />
                  ) : (
                    <Text style={styles.buttonText}>
                      Proceed with Authorization
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        <Toast />
      </Modal>
      {/* Use the single app-root WebView host. This keeps the Fyers CDSL form
          visible, focusable and keyboard-safe on Android. */}
      {isWebViewOpen && (
        <PublisherWebViewOverlay
          source={{html: webViewHtml}}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onClose={() => {
            setIsWebViewOpen(false);
            setShowTpinConfirmation(true);
          }}
          onNavigationStateChange={handleWebViewNavigation}
          onShouldStartLoadWithRequest={request => {
            if (request.url.includes('success')) {
              setIsWebViewOpen(false);
              setShowTpinConfirmation(true);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'CDSL authorization completed successfully.',
              });
              return false;
            }
            return true;
          }}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator size="large" color={designColor('0000ff')} />
          )}
        />
      )}
      {/* TPIN Confirmation Modal */}
      <Modal
        visible={showTpinConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTpinConfirmation(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTpinConfirmation(false);
                setTpinCompleted(false);
                setIsOpen(false);
              }}>
              <Text style={styles.closeIcon}>X</Text>
            </TouchableOpacity>
            <View style={styles.textSection}>
              <Text style={styles.title}>Authorization Complete?</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setTpinCompleted(!tpinCompleted)}>
                <View style={[styles.checkbox, tpinCompleted ? styles.checked : styles.unchecked]}>
                  {tpinCompleted && <Check size={14} color={designColor('fff')} />}
                </View>
                <Text style={styles.label}>I've authorized the sell of the stocks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedButton, !tpinCompleted && { opacity: 0.5 }]}
                onPress={handleProceed}
                disabled={!tpinCompleted}>
                <Text style={styles.buttonText}>Retry Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Toast />
      </Modal>
    </>
  );
}
