// components/MotilalConnectUI.js
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
import {WebView} from 'react-native-webview';
import motilalIcon from '../../assets/Motilalicon.png';
import MotilalHelpContent from './HelpUI/MotilalHelpContent';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

/**
 * Internal WebView wrapper with explicit error handling + single retry.
 *
 * Why this exists: `invest.motilaloswal.com` has only an A record (no
 * AAAA). Chromium's DNS path on Android sometimes gets a SERVFAIL on
 * the AAAA query and surfaces it as `net::ERR_NAME_NOT_RESOLVED`
 * instead of falling back to the IPv4 address. Same root cause
 * already fixed server-side in ccxt-india 48d49938 (forced urllib3
 * to AF_INET). On the WebView we can't control the resolver, but a
 * quick reload after failure usually succeeds because the DNS cache
 * has populated by then.
 *
 * Also brings the WebView prop set into parity with every other
 * broker (originWhitelist, cookie flags, mixedContentMode, UA,
 * flex:1 style) so one-off rendering issues aren't confused with
 * DNS failures.
 */
const MotilalWebViewWithRetry = ({authUrl, handleWebViewNavigationStateChange, onRequestRestart}) => {
  const [key, setKey] = useState(0);
  // Two distinct error states. `error` = pre-load network failure
  // (DNS/IPv6 race) — recoverable by reloading the same authUrl.
  // `postLoadError` = WebView crashed AFTER Motilal's page loaded —
  // NOT recoverable by reloading, because reload silently rotates
  // Motilal's session and the user's typed OTP / login state get
  // wiped. In that case the only safe path is to close the WebView
  // and re-fetch a fresh login URL from /motilal-oswal/login (see
  // 2026-04-25 Motilal session-affinity notes in BROKER_CONNECTION.md).
  const [error, setError] = useState(null);
  const [postLoadError, setPostLoadError] = useState(null);
  const retriedRef = useRef(false);
  const pageLoadedOnceRef = useRef(false);

  const onRetryPress = () => {
    setError(null);
    retriedRef.current = false;
    pageLoadedOnceRef.current = false;
    setKey((k) => k + 1);
  };

  const onRestartPress = () => {
    // Tells the parent (MotilalModal) to close the WebView entirely
    // and start a fresh /motilal-oswal/login round-trip. The parent's
    // handleConnect debounce (30s) will gate against rapid restart.
    setPostLoadError(null);
    pageLoadedOnceRef.current = false;
    if (typeof onRequestRestart === 'function') {
      onRequestRestart();
    }
  };

  return (
    <View style={{flex: 1}}>
      {postLoadError ? (
        <View style={styles.wvErrorContainer}>
          <Text style={styles.wvErrorTitle}>Motilal session interrupted</Text>
          <Text style={styles.wvErrorBody}>
            {postLoadError.description || 'The login page failed mid-flow.'}
          </Text>
          <Text style={styles.wvErrorHint}>
            Motilal binds the OTP, the Authorization header, and the page
            session to a single load — reloading would rotate the session
            and invalidate any OTP you've already received. Please tap
            "Restart" to start a fresh connection (you'll get a new OTP).
          </Text>
          <TouchableOpacity style={styles.wvRetryBtn} onPress={onRestartPress}>
            <Text style={styles.wvRetryText}>Restart connection</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={styles.wvErrorContainer}>
          <Text style={styles.wvErrorTitle}>Couldn't reach Motilal Oswal</Text>
          <Text style={styles.wvErrorBody}>
            {error.description || 'Unable to load Motilal login page.'}
          </Text>
          <Text style={styles.wvErrorHint}>
            If this persists, switch to mobile data and try again — Motilal
            doesn't support IPv6 and some networks (including some emulators)
            can't fall back to IPv4 cleanly.
          </Text>
          <TouchableOpacity style={styles.wvRetryBtn} onPress={onRetryPress}>
            <Text style={styles.wvRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={key}
          source={{uri: authUrl}}
          style={{flex: 1}}
          onNavigationStateChange={handleWebViewNavigationStateChange}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
              : 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile Safari/604.1'
          }
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color="#0056B7"
              style={{marginTop: 20}}
            />
          )}
          // First successful page load arms the post-load guard. After
          // this fires, any subsequent onError must NOT silently
          // remount the WebView — see comment on `postLoadError` above.
          onLoadEnd={(syntheticEvent) => {
            const {nativeEvent} = syntheticEvent;
            // `nativeEvent.loading` is false on a successful load; if
            // it's true we're still loading (some platforms call
            // onLoadEnd repeatedly during navigation).
            if (!nativeEvent?.loading) {
              pageLoadedOnceRef.current = true;
            }
          }}
          onError={(syntheticEvent) => {
            const {nativeEvent} = syntheticEvent;
            console.log(
              '[Motilal][WebView onError]',
              nativeEvent.url,
              nativeEvent.code,
              nativeEvent.description,
              'pageLoadedOnce=', pageLoadedOnceRef.current,
            );
            // Post-load failure: surface "Restart connection" UI
            // instead of silently reloading. Reload here would
            // destroy the user's OTP / login state without warning
            // (the trap that produced the 2026-04-25 incident:
            // ERR_NAME_NOT_RESOLVED → silent reload → "Authorization
            // is Invalid In Header Parameter" / MO1007 cascade).
            if (pageLoadedOnceRef.current) {
              setPostLoadError({
                description: nativeEvent.description,
                code: nativeEvent.code,
              });
              return;
            }
            // Pre-load failure: existing auto-retry-once behaviour
            // for the IPv6 / DNS race on `invest.motilaloswal.com`.
            if (!retriedRef.current) {
              retriedRef.current = true;
              setTimeout(() => setKey((k) => k + 1), 500);
              return;
            }
            setError({
              description: nativeEvent.description,
              code: nativeEvent.code,
            });
          }}
          onHttpError={(syntheticEvent) => {
            const {nativeEvent} = syntheticEvent;
            console.log(
              '[Motilal][WebView onHttpError]',
              nativeEvent.url,
              nativeEvent.statusCode,
            );
          }}
        />
      )}
    </View>
  );
};

const MotilalConnectUI = ({
  isVisible,
  onClose,
  apiKey,
  clientCode,
  setApiKey,
  setClientCode,
  isPasswordVisible,
  isPasswordVisibleup,
  setIsPasswordVisible,
  setIsPasswordVisibleup,
  handleConnect,
  loading,
  helpVisible,
  setHelpVisible,
  showWebView,
  authUrl,
  handleWebViewNavigationStateChange,
  handleWebViewClose,
  onRequestRestart,
  egressUserId,
  egressUserEmail,
  egressReady,
  setEgressReady,
  unmetAck,
  setUnmetAck,
  configData,
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
            colors={['#0B3D91', '#0056B7']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <ChevronLeft size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Connect to Motilal Oswal</Text>
            </View>
            <Image source={motilalIcon} style={styles.headerIcon} />
          </LinearGradient>

          {/* WebView Section */}
          {showWebView && authUrl ? (
            <View style={{flex: 1}}>
              <MotilalWebViewWithRetry
                authUrl={authUrl}
                handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
                onRequestRestart={onRequestRestart}
              />
            </View>
          ) : expanded ? (
            /* Full Screen Help when expanded */
            <View style={styles.fullScreenHelp}>
              <ScrollView
                ref={scrollViewRef}
                style={{flex: 1}}
                contentContainerStyle={{padding: 10, paddingBottom: 20}}
                showsVerticalScrollIndicator={true}>
                <MotilalHelpContent expanded={expanded} />
                <View style={[styles.toggleWrapper, {marginTop: 15, paddingBottom: insets.bottom + 10}]}>
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setExpanded(false)}>
                    <Text style={styles.toggleText}>See Less</Text>
                    <View style={styles.toggleIconContainer}>
                      <ChevronUp size={14} color="#000" />
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
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
                  <MotilalHelpContent expanded={expanded} />
                </View>

                {/* Read More */}
                <TouchableOpacity
                  style={styles.toggleContainer}
                  onPress={() => setExpanded(true)}>
                  <Text style={styles.toggleText}>Read More</Text>
                  <View style={styles.toggleIconContainer}>
                    <ChevronDown size={14} color="#000" />
                  </View>
                </TouchableOpacity>

                {/* Motilal is IPv4-only — all calls go through the
                    server's shared static IPv4 (72.61.251.253) via the
                    IPv4-pinned session on ccxt-india. Ports web 156589e:
                    replace EgressIpCallout with a simple static callout
                    showing the server IPv4, a Copy button, and an
                    acknowledgment checkbox. `egressReady` gate is
                    preserved so Connect stays locked until ticked;
                    `unmetAck` still fires the red-flash signal. */}
                <View style={styles.motilalIpCallout}>
                  <Text style={styles.motilalIpTitle}>
                    Server IPv4 to whitelist on Motilal
                  </Text>
                  <View style={styles.motilalIpRow}>
                    <Text style={styles.motilalIpValue}>72.61.251.253</Text>
                    {/* Matches the existing app-wide pattern (HelpModal.js,
                        KotakConsumerKeySteps.js, DdpiModal.js) — Clipboard
                        used as a runtime global without an explicit import.
                        If the platform doesn't expose a Clipboard shim, the
                        catch shows a toast asking the user to long-press. */}
                    <TouchableOpacity
                      onPress={() => {
                        try {
                          // eslint-disable-next-line no-undef
                          Clipboard.setString('72.61.251.253');
                          Toast.show({
                            type: 'success',
                            text1: 'Server IP copied',
                            position: 'bottom',
                            visibilityTime: 1500,
                          });
                        } catch {
                          Toast.show({
                            type: 'info',
                            text1: 'Long-press the IP to copy manually',
                            position: 'bottom',
                            visibilityTime: 2500,
                          });
                        }
                      }}
                      style={styles.motilalIpCopy}>
                      <Text style={styles.motilalIpCopyText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.motilalIpHint}>
                    Paste the IP above into Motilal's "Allowed IPs" field on
                    the API Key settings page. Motilal rejects every order
                    from a non-whitelisted IP.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setEgressReady && setEgressReady(!egressReady);
                      if (unmetAck) setUnmetAck && setUnmetAck(false);
                    }}
                    style={[
                      styles.motilalIpAckRow,
                      unmetAck && !egressReady && styles.motilalIpAckRowFlash,
                    ]}>
                    <View
                      style={[
                        styles.motilalIpAckBox,
                        egressReady && styles.motilalIpAckBoxChecked,
                      ]}>
                      {egressReady ? (
                        <Text style={styles.motilalIpAckCheck}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.motilalIpAckLabel}>
                      I've whitelisted{' '}
                      <Text style={{fontWeight: '700'}}>72.61.251.253</Text> on
                      Motilal's API Key page.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Input Card */}
                <View style={styles.inputCard}>
                  <View style={styles.connectRow}>
                    <Text style={styles.connectLabel}>
                      Connect to Motilal Oswal
                    </Text>
                    <Image
                      source={motilalIcon}
                      style={styles.connectIcon}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Fixed Bottom Inputs & Button */}
                  <View style={styles.bottomContainer}>
                    {/* API Key */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>API Key:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={apiKey}
                          placeholder="Enter your API Key"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setApiKey(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Client Code */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>Client Code:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={clientCode}
                          placeholder="Enter your Client Code"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setClientCode(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Connect Button */}
                    <TouchableOpacity
                      style={[
                        styles.proceedButton,
                        {
                          backgroundColor:
                            apiKey && clientCode && egressReady
                              ? 'rgba(0, 86, 183, 1)'
                              : '#d3d3d3',
                        },
                      ]}
                      onPress={handleConnect}
                      disabled={!(apiKey && clientCode && egressReady)}>
                      {loading ? (
                        <ActivityIndicator size={27} color="#fff" />
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
            broker="Motilal Oswal"
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
    backgroundColor: '#fff',
  },
  wvErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  wvErrorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  wvErrorBody: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  wvErrorHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  wvRetryBtn: {
    backgroundColor: '#0056B7',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  wvRetryText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  headerIcon: {width: 35, height: 35, borderRadius: 3, backgroundColor: '#fff'},
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
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
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    marginLeft: 10,
  },
  guideBox: {
    borderWidth: 1,
    borderColor: '#E8E9EC',
    borderRadius: 8,
    padding: 10,
  },
  fullScreenHelp: {flex: 1, backgroundColor: '#fff'},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
    paddingVertical: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 20,
  },
  toggleText: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#0056B7'},
  toggleIconContainer: {
    marginLeft: 5,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 3,
    elevation: 3,
  },
  inputCard: {
    marginHorizontal: 20,
    borderWidth: 0.3,
    borderRadius: 8,
    borderColor: '#c8c8c8',
    marginBottom: 20,
  },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  connectLabel: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Poppins-SemiBold',
  },
  connectIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  bottomContainer: {
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inputWrapper: {marginBottom: 10},
  headerLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#000',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: commonHeight,
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#000',
    paddingVertical: 5,
  },
  proceedButton: {
    height: commonHeight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  proceedButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},

  // Motilal static server-IPv4 callout (replaces EgressIpCallout for
  // this broker only — see web 156589e).
  motilalIpCallout: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 10,
    marginTop: 10,
  },
  motilalIpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
  },
  motilalIpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  motilalIpValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  motilalIpCopy: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fde68a',
  },
  motilalIpCopyText: {fontSize: 12, fontWeight: '600', color: '#78350f'},
  motilalIpHint: {fontSize: 12, color: '#92400e', lineHeight: 17, marginBottom: 10},
  motilalIpAckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 6,
    borderRadius: 6,
  },
  motilalIpAckRowFlash: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  motilalIpAckBox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#92400e',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  motilalIpAckBoxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  motilalIpAckCheck: {color: '#fff', fontSize: 12, fontWeight: '700'},
  motilalIpAckLabel: {flex: 1, fontSize: 12, color: '#0f172a', lineHeight: 17},
});

export default MotilalConnectUI;
