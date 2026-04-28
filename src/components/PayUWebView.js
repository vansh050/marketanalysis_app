/**
 * PayUWebView.js
 *
 * React Native WebView component for PayU payment processing.
 *
 * PayU requires form POST submission (unlike Cashfree/Razorpay which use JS SDKs).
 * This component:
 * 1. Displays a WebView with PayU payment form
 * 2. Auto-submits the form to PayU
 * 3. Intercepts return/cancel URLs
 * 4. Callbacks to parent with payment result
 *
 * Usage:
 * <PayUWebView
 *   visible={showPayU}
 *   paymentData={payuFormData}
 *   isSI={false}
 *   onSuccess={(txnid, details) => handleSuccess(txnid, details)}
 *   onFailure={(error) => handleFailure(error)}
 *   onClose={() => setShowPayU(false)}
 * />
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  BackHandler,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { XIcon, AlertCircle, RefreshCw } from 'lucide-react-native';
import { buildPayUFormHTML, parsePayUCallback, getPayUFormUrl } from '../FunctionCall/services/PayUService';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

/**
 * PayUWebView Component
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether modal is visible
 * @param {Object} props.paymentData - Payment data from backend (form data or HTML string)
 * @param {boolean} props.isSI - Whether this is a Standing Instructions payment
 * @param {Function} props.onSuccess - Callback on successful payment (txnid, details)
 * @param {Function} props.onFailure - Callback on failed payment (error)
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {string} props.successUrlPattern - URL pattern to detect success (default: /payu/return)
 * @param {string} props.failureUrlPattern - URL pattern to detect failure (default: /payu/cancel)
 */
const PayUWebView = ({
  visible,
  paymentData,
  isSI = false,
  onSuccess,
  onFailure,
  onClose,
  successUrlPattern = '/payu/return',
  failureUrlPattern = '/payu/cancel',
}) => {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRetry, setShowRetry] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  // Handle Android back button
  useEffect(() => {
    if (visible && Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          handleClose();
          return true;
        },
      );
      return () => backHandler.remove();
    }
  }, [visible]);

  /**
   * Generate HTML content for WebView
   */
  const getWebViewSource = () => {
    if (!paymentData || !paymentData.data) {
      return null;
    }

    const formData = paymentData.data;

    // Check if data is already HTML string (from PayU SDK)
    if (typeof formData === 'string' && formData.includes('<form')) {
      // Wrap the HTML form with auto-submit script
      return {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              .loader {
                text-align: center;
              }
              .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="loader">
              <div class="spinner"></div>
              <p>Redirecting to PayU...</p>
            </div>
            <div style="display: none;">
              ${formData}
            </div>
            <script>
              setTimeout(function() {
                var form = document.querySelector('form');
                if (form) {
                  form.submit();
                }
              }, 500);
            </script>
          </body>
          </html>
        `,
      };
    }

    // Handle structured form data
    const html = buildPayUFormHTML(formData, isSI);
    return { html };
  };

  /**
   * Handle navigation state change to detect PayU callback URLs
   */
  const handleNavigationStateChange = (navState) => {
    const { url } = navState;

    console.log('[PayU WebView] Navigation:', url);

    // Check for success URL pattern
    if (url && (url.includes(successUrlPattern) || url.includes('surl') || url.includes('/return'))) {
      const callbackData = parsePayUCallback(url);

      if (callbackData.isSuccess) {
        console.log('[PayU WebView] Payment Success:', callbackData);
        onSuccess?.(callbackData.txnid, callbackData);
        return false; // Prevent navigation
      } else if (callbackData.isFailure) {
        console.log('[PayU WebView] Payment Failed:', callbackData);
        onFailure?.(callbackData.error || 'Payment failed');
        return false;
      }
    }

    // Check for failure URL pattern
    if (url && (url.includes(failureUrlPattern) || url.includes('furl') || url.includes('/cancel'))) {
      const callbackData = parsePayUCallback(url);
      console.log('[PayU WebView] Payment Cancelled:', callbackData);
      onFailure?.(callbackData.error || 'Payment cancelled');
      return false;
    }

    // Check for deep link schemes (React Native return)
    if (url && url.startsWith('alphab2b://')) {
      const callbackData = parsePayUCallback(url);

      if (url.includes('/return') || url.includes('/success')) {
        if (callbackData.isSuccess || callbackData.txnid) {
          console.log('[PayU WebView] Deep Link Success:', callbackData);
          onSuccess?.(callbackData.txnid, callbackData);
        } else {
          console.log('[PayU WebView] Deep Link Failure:', callbackData);
          onFailure?.(callbackData.error || 'Payment failed');
        }
      } else if (url.includes('/cancel') || url.includes('/failure')) {
        console.log('[PayU WebView] Deep Link Cancel:', callbackData);
        onFailure?.(callbackData.error || 'Payment cancelled');
      }
      return false;
    }

    return true;
  };

  /**
   * Handle URL requests for navigation interception
   */
  const handleShouldStartLoadWithRequest = (request) => {
    const { url } = request;

    // Allow PayU URLs
    if (url.includes('payu.in') || url.includes('payubiz.in')) {
      return true;
    }

    // Handle callback URLs
    if (
      url.includes(successUrlPattern) ||
      url.includes(failureUrlPattern) ||
      url.startsWith('alphab2b://')
    ) {
      handleNavigationStateChange({ url });
      return false;
    }

    // Allow all other URLs (bank pages, OTP pages, etc.)
    return true;
  };

  /**
   * Handle WebView errors
   */
  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[PayU WebView] Error:', nativeEvent);
    setError(nativeEvent.description || 'Failed to load payment page');
    setShowRetry(true);
    setLoading(false);
  };

  /**
   * Handle WebView HTTP errors
   */
  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[PayU WebView] HTTP Error:', nativeEvent);

    // Ignore non-critical HTTP errors (like tracking pixels)
    if (nativeEvent.statusCode >= 400 && nativeEvent.statusCode < 500) {
      if (!nativeEvent.url.includes('payu.in')) {
        return; // Ignore non-PayU 4xx errors
      }
    }

    setError(`HTTP Error ${nativeEvent.statusCode}`);
    setShowRetry(true);
  };

  /**
   * Handle retry
   */
  const handleRetry = () => {
    setError(null);
    setShowRetry(false);
    setLoading(true);
    setWebViewKey(prev => prev + 1);
  };

  /**
   * Handle close with confirmation
   */
  const handleClose = () => {
    // Could add confirmation dialog here
    onClose?.();
  };

  const source = getWebViewSource();

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isSI ? 'Setup Recurring Payment' : 'Complete Payment'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XIcon size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0056B7" />
            <Text style={styles.loadingText}>Loading payment page...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Payment Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            {showRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <RefreshCw size={16} color="#fff" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView */}
        {source && !error && (
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={source}
            style={styles.webView}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onError={handleError}
            onHttpError={handleHttpError}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            userAgent={Platform.select({
              ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
              android: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Mobile Safari/537.36',
            })}
            cacheEnabled={false}
            incognito={false}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
          />
        )}

        {/* No Payment Data */}
        {!source && !error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Invalid Payment Data</Text>
            <Text style={styles.errorMessage}>
              Unable to initialize payment. Please try again.
            </Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0056B7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
});

export default PayUWebView;
