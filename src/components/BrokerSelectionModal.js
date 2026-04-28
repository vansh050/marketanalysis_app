// BrokerSelectionModal.js
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Modal from 'react-native-modal';
import {
  ChevronRight,
  ChevronLeft,
  XIcon,
  Info,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react-native';
import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import server from '../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../utils/SecurityTokenManager';
import useModalStore from '../GlobalUIModals/modalStore';
import LinearGradient from 'react-native-linear-gradient';
import {useTrade} from '../screens/TradeContext';
import {useConfig} from '../context/ConfigContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';
import {registerCallback} from '../utils/brokerAuth';
import {brokerDisplayConfig} from '../config/brokerDisplayConfig';
import {
  handleSmartReauth,
  flipPrimaryBroker,
} from '../utils/reauthHelpers';
import {refreshGrowwSession} from '../utils/growwRefresh';
import eventEmitter from './EventEmitter';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const BrokerSelectionModal = ({
  showBrokerModal,
  setShowBrokerModal,
  OpenTokenExpireModel,
  setOpenTokenExpireModel,
  handleAcceptRebalanceWithoutBroker,
  handleBrokerConnectedContinue,
}) => {
  const {
    brokerStatus: globalBrokerStatus,
    configData,
    userDetails: tradeUserDetails,
    fetchBrokerStatusModal,
  } = useTrade();
  const freshConfig = useConfig();
  const openModal = useModalStore(state => state.openModal);
  const showModalAlert = useModalStore(state => state.showAlert);

  // Same resolution order as ManageConnectionsModal — advisor-specific
  // redirect URL registered in each broker's dev portal.
  const brokerConnectRedirectURL =
    freshConfig?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';

  const brokersmain = brokerDisplayConfig;

  const [pressedBroker, setPressedBroker] = useState(null);
  const [userDetails, setUserDetails] = useState();
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const [loginLoading, setLoginLoading] = useState(false);
  const [brokerStatus, setBrokerStatus] = useState(
    userDetails ? userDetails.connect_broker_status : null,
  );
  const [showMessage, setShowMessage] = useState(false);
  const [showLetUsKnow, setShowLetUsKnow] = useState(false);
  const [brokerSearchText, setBrokerSearchText] = useState('');
  const [allBrokers, setAllBrokers] = useState([]);
  const [selectedUnavailableBroker, setSelectedUnavailableBroker] =
    useState(null);
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [connectingBroker, setConnectingBroker] = useState(false);

  // Detect broker connection: when user completes broker auth, globalBrokerStatus changes to 'connected'
  // Re-open the modal with "Broker Connected - Continue" button (matching web ConnectBroker behavior)
  useEffect(() => {
    if (globalBrokerStatus === 'connected' && showBrokerModal) {
      setBrokerConnected(true);
      setConnectingBroker(false);
    }
  }, [globalBrokerStatus, showBrokerModal]);

  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => {
        setUserDetails(res.data.User);
        setBrokerStatus(res.data.User.connect_broker_status);
      })
      .catch(err => console.log(err));
  };

  useEffect(() => {
    if (userEmail) {
      getUserDeatils();
    }
  }, [userEmail]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMessage(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const fetchAllBrokers = async () => {
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}comms/all-brokers`,
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
      if (response.data) {
        setAllBrokers(response.data);
      }
    } catch (error) {
      console.log('Error fetching all brokers:', error);
    }
  };

  const handleLetUsKnowPress = () => {
    setShowLetUsKnow(true);
    fetchAllBrokers();
  };

  const handleUnavailableBrokerSelect = async brokerName => {
    setSelectedUnavailableBroker(brokerName);
    try {
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/unavailable-broker/save`,
        {
          email: userEmail,
          broker: brokerName,
        },
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
    } catch (error) {
      console.log('Error saving unavailable broker:', error);
    }
  };

  const filteredAllBrokers = allBrokers.filter(b =>
    (b.name || b)
      .toString()
      .toLowerCase()
      .includes(brokerSearchText.toLowerCase()),
  );

  const handleBrokerSelect = async broker => {
    const {openModal, closeModal} = useModalStore.getState();
    if (broker?.key) {
      // Angel One nonce-based fallback: register a nonce before opening the modal
      if (broker.key === 'Angel One') {
        await registerCallback('angelone', '/stock-recommendation');
      }
      setShowBrokerModal(false);
      closeModal();
      setTimeout(() => {
        openModal(broker.key);
      }, 100);
    }
  };

  // `userDetails.user_broker` stores the display name (e.g. "ICICI Direct",
  // "Hdfc Securities"), but `ModalManager.js` dispatches on a shorter
  // modal key (e.g. "ICICI", "HDFC"). Without this mapping, re-auth for
  // ICICI Direct / Kotak Neo / Hdfc Securities / Motilal Oswal / AngelOne
  // silently no-ops — the switch hits `default: return null`.
  const USER_BROKER_TO_MODAL_KEY = {
    'ICICI Direct': 'ICICI',
    'Kotak Neo': 'Kotak',
    'Hdfc Securities': 'HDFC',
    'Motilal Oswal': 'Motilal',
    AngelOne: 'Angel One',
  };

  // Mid-trade session-expiry "Login to {broker}" button. Routes in
  // three distinct ways based on broker type:
  //  1. Groww → one-tap silent refresh via refreshGrowwSession. The
  //     backend already has the TOTP seed (AES-256 at rest) and mints
  //     fresh tokens server-side — no WebView, no credential paste.
  //     Only falls back to the connect modal on NO_TOTP_SEED /
  //     INVALID_SEED (legacy customers or revoked keys). Mirrors
  //     TokenExpireBrokerModal.handleGrowwRefresh.
  //  2. Credential brokers (Upstox/ICICI/HDFC/Motilal/Fyers) →
  //     smart-reauth: backend pre-signs the OAuth URL from stored
  //     creds so the per-broker modal skips the credential form and
  //     jumps straight into the WebView.
  //  3. Partner-OAuth (Zerodha/Dhan/AliceBlue/Axis/IIFL/Angel One) and
  //     Kotak TOTP → open the full per-broker modal.
  const handleBrokerSelectOpenExpire = async broker => {
    const {openModal, closeModal} = useModalStore.getState();
    if (!broker) return;

    const modalKey = USER_BROKER_TO_MODAL_KEY[broker] || broker;

    // Prefer the richer TradeContext userDetails (has encrypted creds
    // for decryption inside handleSmartReauth, and _id for Groww's
    // refresh-token call) over the local copy this modal fetched.
    const detailsForReauth = tradeUserDetails || userDetails;

    // --- Groww: one-tap refresh path ---
    if (broker === 'Groww') {
      setLoginLoading(true);
      try {
        await refreshGrowwSession({
          userId: detailsForReauth?._id,
          advisorSubdomain: configData?.config?.REACT_APP_HEADER_NAME,
          showAlert: showModalAlert,
          onClose: () => {
            setShowBrokerModal(false);
            setOpenTokenExpireModel(false);
          },
          onSuccess: () => {
            // Re-hydrate user + funds so handleCheckStatus' next tick
            // doesn't re-pop the TokenExpire modal with stale state.
            if (fetchBrokerStatusModal) fetchBrokerStatusModal();
            eventEmitter.emit('refreshEvent', {
              source: 'Groww mid-trade refresh',
            });
          },
          // NO_TOTP_SEED / INVALID_SEED → open the GrowwConnectModal
          // so the customer can (re)capture a seed.
          onOpenConnectModal: () => {
            closeModal();
            setTimeout(() => openModal('Groww'), 100);
          },
        });
      } finally {
        setLoginLoading(false);
      }
      return;
    }

    // --- Non-Groww: smart-reauth for credential brokers, else full modal ---
    setLoginLoading(true);
    try {
      await flipPrimaryBroker(broker, userEmail, configData);

      const result = await handleSmartReauth({
        brokerName: broker,
        userEmail,
        userDetails: detailsForReauth,
        configData,
        brokerConnectRedirectURL,
      });

      // Unmount this modal first so Android doesn't swallow the next
      // transparent Modal (same race ManageConnectionsModal guards
      // against — see reauthHelpers.js:167 note).
      setShowBrokerModal(false);
      setOpenTokenExpireModel(false);
      closeModal();

      setTimeout(() => {
        if (result.handled) {
          // Credential broker — backend returned a pre-signed OAuth URL
          // and stored creds were decrypted. The per-broker modal will
          // skip its credential form entirely.
          openModal(result.modalKey, result.payload);
        } else {
          // Partner-OAuth / Kotak — open the full modal.
          openModal(modalKey);
        }
      }, 100);
    } finally {
      setLoginLoading(false);
    }
  };

  const broker = userDetails?.user_broker;

  const onClose = () => {
    setShowBrokerModal(false);
    setOpenTokenExpireModel(false);
  };

  // Create rows of brokers (4 per row)
  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const brokerRows = chunkArray(brokersmain, 4);

  return (
    <Modal
      isVisible={showBrokerModal || OpenTokenExpireModel}
      backdropOpacity={0.5}
      useNativeDriver={true}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={styles.modal}
      onBackdropPress={onClose}>
      {showBrokerModal && (
        <LinearGradient
          colors={['#002651', '#003572', '#0053B1']}
          style={styles.gradientContainer}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.contentContainer}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowBrokerModal(false)}
                  activeOpacity={0.9}>
                  <ChevronLeft size={24} color="#ffffff" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                  Select your broker for connection
                </Text>
              </View>

              {/* SEBI Disclaimer */}
              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>SEBI Disclaimer:</Text>
                <Text style={styles.noticeText}>
                  • Actions and decisions are solely yours as per SEBI (Research
                  Analysts) Regulations, 2014.
                </Text>
                <Text style={styles.noticeText}>
                  • RA doesn't control or influence your action.
                </Text>
                <Text style={styles.noticeText}>
                  • RA isn't responsible for your outcome.
                </Text>
                <Text style={styles.noticeText}>
                  • You act independently on the broker platform.
                </Text>
              </View>

              {/* Scrollable Broker Grid */}
              <ScrollView
                style={styles.brokerScrollView}
                contentContainerStyle={styles.brokerScrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.brokerGrid}>
                  {brokerRows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.brokerRow}>
                      {row.map((broker, index) => (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={0.7}
                          style={[
                            styles.brokerCard,
                            pressedBroker === broker.key &&
                              styles.brokerCardPressed,
                          ]}
                          onPressIn={() => setPressedBroker(broker.key)}
                          onPressOut={() => setPressedBroker(null)}
                          onPress={() => handleBrokerSelect(broker)}>
                          <View style={styles.brokerLogoContainer}>
                            <Image
                              source={broker.logo}
                              style={styles.brokerLogo}
                              resizeMode="contain"
                            />
                          </View>
                          <Text style={styles.brokerName}>{broker.name}</Text>
                        </TouchableOpacity>
                      ))}
                      {/* Add empty placeholders for last row if needed */}
                      {row.length < 4 &&
                        Array.from({length: 4 - row.length}).map((_, i) => (
                          <View
                            key={`placeholder-${i}`}
                            style={styles.brokerCardPlaceholder}
                          />
                        ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Bottom Button States */}
              {brokerConnected ? (
                <TouchableOpacity
                  style={[styles.continueButton, styles.connectedButton]}
                  activeOpacity={0.7}
                  hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  onPress={handleBrokerConnectedContinue || handleAcceptRebalanceWithoutBroker}>
                  <Text style={styles.connectedButtonText}>
                    Disconnect my current broker
                  </Text>
                </TouchableOpacity>
              ) : connectingBroker ? (
                <View style={[styles.continueButton, styles.connectingButton]}>
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                    style={{marginRight: 10}}
                  />
                  <Text style={styles.continueButtonText}>
                    Connecting broker...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.continueButton}
                  activeOpacity={0.7}
                  hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  onPress={handleAcceptRebalanceWithoutBroker}>
                  <Text style={styles.continueButtonText}>
                    Continue without connecting broker
                  </Text>
                </TouchableOpacity>
              )}

              {/* Can't find your broker? */}
              {!showLetUsKnow ? (
                <TouchableOpacity
                  style={styles.letUsKnowButton}
                  activeOpacity={0.7}
                  onPress={handleLetUsKnowPress}>
                  <Text style={styles.letUsKnowText}>
                    Can't find your broker?{' '}
                    <Text style={styles.letUsKnowLink}>Let us know</Text>
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.letUsKnowContainer}>
                  <Text style={styles.letUsKnowTitle}>
                    Search for your broker
                  </Text>
                  <TextInput
                    style={styles.brokerSearchInput}
                    placeholder="Search broker..."
                    placeholderTextColor="#999"
                    value={brokerSearchText}
                    onChangeText={setBrokerSearchText}
                  />
                  <ScrollView
                    style={styles.allBrokersList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}>
                    {filteredAllBrokers.map((item, index) => {
                      const brokerName =
                        typeof item === 'string' ? item : item.name || '';
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.allBrokersItem,
                            selectedUnavailableBroker === brokerName &&
                              styles.allBrokersItemSelected,
                          ]}
                          activeOpacity={0.7}
                          onPress={() =>
                            handleUnavailableBrokerSelect(brokerName)
                          }>
                          <Text
                            style={[
                              styles.allBrokersItemText,
                              selectedUnavailableBroker === brokerName &&
                                styles.allBrokersItemTextSelected,
                            ]}>
                            {brokerName}
                          </Text>
                          {selectedUnavailableBroker === brokerName && (
                            <Text style={styles.selectedCheckmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {filteredAllBrokers.length === 0 && (
                      <Text style={styles.noBrokersText}>
                        No brokers found
                      </Text>
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.letUsKnowBackButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowLetUsKnow(false);
                      setBrokerSearchText('');
                      setSelectedUnavailableBroker(null);
                    }}>
                    <Text style={styles.letUsKnowBackText}>Back</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
        )}

        {OpenTokenExpireModel && (
        <View style={styles.expireModalContainer}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XIcon size={24} color="#666" />
          </TouchableOpacity>

          {!showMessage || !broker ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <View style={styles.loginPromptContainer}>
              <View style={styles.loginPromptHeader}>
                <View style={styles.alertIconWrapper}>
                  <AlertOctagon size={40} color="#FF3B30" />
                </View>
                <View style={styles.loginPromptTextContainer}>
                  <Text style={styles.loginPromptTitle}>
                    Authentication Required
                  </Text>
                </View>
              </View>

              <View style={styles.securityNoteContainer}>
                <Info size={16} color="#0066CC" />
                <Text style={styles.securityNoteText}>
                  {broker === 'Groww'
                    ? 'Your Groww session has expired. Tap to refresh — takes about 2 seconds, no credentials needed.'
                    : 'Your session has expired. Please login to your broker to continue with your investments.'}
                </Text>
              </View>

              {broker && (
                <TouchableOpacity
                  style={styles.enhancedLoginButton}
                  onPress={() => handleBrokerSelectOpenExpire(broker)}
                  disabled={loginLoading}
                  activeOpacity={0.7}>
                  <View style={styles.loginButtonContent}>
                    <Text style={styles.loginButtonText}>
                      {loginLoading
                        ? broker === 'Groww'
                          ? 'Refreshing Groww session…'
                          : `Connecting ${broker}…`
                        : broker === 'Groww'
                          ? 'Refresh Groww session'
                          : `Login to ${broker}`}
                    </Text>
                    <View style={styles.arrowIconContainer}>
                      {loginLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ArrowRight size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    color: '#FFB800',
    marginRight: 14,
    elevation: 3,
  },
  gradientContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    flex: 1,
    maxHeight: screenHeight * 0.9,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  noticeBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 2,
    borderColor: '#FFB800',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#FFB800',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 4,
  },
  brokerScrollView: {
    flex: 1,
    marginBottom: 16,
  },
  brokerScrollContent: {
    paddingBottom: 10,
  },
  brokerGrid: {},
  brokerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brokerCardPlaceholder: {
    width: (screenWidth - 60) / 4,
    aspectRatio: 1,
  },
  brokerCard: {
    width: (screenWidth - 70) / 4, // 4 cards with spacing
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  brokerCardPressed: {
    backgroundColor: '#E8F4FF',
    transform: [{scale: 0.95}],
  },
  brokerLogoContainer: {
    width: '50%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  brokerLogo: {
    width: '100%',
    height: '100%',
  },
  brokerName: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    color: '#000000',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 10,
    minHeight: 54,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF',
  },
  connectedButton: {
    backgroundColor: '#1B8D1B',
    borderColor: '#17A817',
  },
  connectedButtonText: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF',
  },
  connectingButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  letUsKnowButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  letUsKnowText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  letUsKnowLink: {
    fontFamily: 'Satoshi-Bold',
    color: '#FFB800',
    textDecorationLine: 'underline',
  },
  letUsKnowContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  letUsKnowTitle: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  brokerSearchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#000000',
    marginBottom: 12,
  },
  allBrokersList: {
    maxHeight: 180,
    marginBottom: 12,
  },
  allBrokersItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  allBrokersItemSelected: {
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  allBrokersItemText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#FFFFFF',
  },
  allBrokersItemTextSelected: {
    color: '#FFB800',
    fontFamily: 'Satoshi-Bold',
  },
  selectedCheckmark: {
    fontSize: 16,
    color: '#FFB800',
    fontFamily: 'Satoshi-Bold',
  },
  noBrokersText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingVertical: 20,
  },
  letUsKnowBackButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  letUsKnowBackText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#FFB800',
  },

  // Token Expire Modal Styles
  expireModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: screenWidth * 0.05,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  loaderContainer: {
    marginVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPromptContainer: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  loginPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  alertIconWrapper: {
    backgroundColor: '#FFF2F2',
    padding: 12,
    borderRadius: 12,
    marginRight: 15,
  },
  loginPromptTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loginPromptTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: '#000000',
  },
  enhancedLoginButton: {
    backgroundColor: '#0066CC',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 15,
    shadowColor: '#0066CC',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#0052A3',
  },
  loginButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  arrowIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 15,
    padding: 5,
    marginLeft: 8,
  },
  securityNoteContainer: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0066CC',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  securityNoteText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#666666',
    lineHeight: 18,
    marginLeft: 10,
    flex: 1,
  },
});

export default BrokerSelectionModal;
