import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { X } from "lucide-react-native";
import { useConfig } from "../../context/ConfigContext";
import useTokens from "../../theme/useTokens";

/**
 * @param {Function} [verifyDocumentStatus] - async () => 'completed' |
 *   'pending' | 'failed'. When supplied, tapping X asks Digio whether the
 *   document is actually signed BEFORE the modal is torn down — mirroring the
 *   web app (components/DigioModel.js `handleManualComplete`). Without this,
 *   a customer whose completion the WebView failed to detect taps X and is
 *   dropped back to the plan sheet with no way forward.
 */
const DigioModal = ({
  authenticationUrl,
  digioModalOpen,
  onClose,
  onSuccess,
  onError,
  onVerificationComplete,
  verifyDocumentStatus,
}) => {
  const config = useConfig();
  const tokens = useTokens();
  const mainColor = tokens.colors.brand.primary;
  const gradient2 = tokens.colors.brand.gradientEnd;

  const webviewRef = useRef(null);
  const hasTriggeredRef = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Reset the trigger flag when modal opens
  useEffect(() => {
    if (digioModalOpen) {
      hasTriggeredRef.current = false;
      setIsVerifying(false);
    }
  }, [digioModalOpen]);

  const handleSuccess = (data) => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    console.log("✅ Digio Success triggered", data);
    onClose();
    if (onSuccess) onSuccess(data);
    if (onVerificationComplete) onVerificationComplete();
  };

  const handleError = (data) => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    console.log("❌ Digio Error triggered", data);
    if (onError) onError(data);
    onClose();
  };

  // Tapping X is ambiguous: it means "I'm done" as often as "I give up", and
  // the WebView's own detection is unreliable enough that we must not assume
  // the latter. So: verify with Digio while KEEPING the modal mounted (the
  // WebView keeps its state, so "keep signing" resumes exactly where they
  // were), then either complete or ask.
  //
  // Web stays open indefinitely when unsigned, which traps a customer who
  // genuinely wants out. The confirm dialog below is the mobile improvement —
  // it protects the mid-signing mis-tap without removing the exit.
  const handleClosePress = async () => {
    if (hasTriggeredRef.current) return;

    if (typeof verifyDocumentStatus !== "function") {
      onClose();
      return;
    }

    setIsVerifying(true);
    let status = null;
    try {
      status = await verifyDocumentStatus();
    } catch (err) {
      console.error("Close-time Digio verification failed:", err?.message);
    }
    setIsVerifying(false);

    if (status === "completed") {
      handleSuccess({ source: "close_check" });
      return;
    }

    Alert.alert(
      "Signature not complete",
      "We couldn't confirm your signature yet. If you've already signed, give it a moment and it will complete on its own.",
      [
        { text: "Keep signing", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => onClose() },
      ],
    );
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("📨 Received from WebView:", data);

      if (data.status === "success" || data.status === "completed") {
        handleSuccess(data);
      } else if (data.status === "error") {
        handleError(data);
      }
    } catch (err) {
      console.error("WebView message parse error:", err);
    }
  };

  const handleNavigationStateChange = (navState) => {
    const { url } = navState;
    console.log("🔗 Navigation URL:", url);

    if (!url) return;

    // Check for success URL patterns
    if (
      url.includes("digio_success") ||
      url.includes("status=success") ||
      url.includes("type=success") ||
      url.includes("signed=true") ||
      url.includes("exitMessage=Signed") ||
      url.includes("Signed%20Successfully")
    ) {
      console.log("✅ Success pattern matched in URL!");
      handleSuccess({ url });
    }

    // Check for error URL patterns
    if (
      url.includes("digio_error") ||
      url.includes("status=error") ||
      url.includes("type=error") ||
      url.includes("status=failed")
    ) {
      console.log("❌ Error pattern matched in URL!");
      handleError({ url });
    }
  };

  if (!digioModalOpen) return null;

  return (
    <Modal animationType="slide" transparent={false} visible={digioModalOpen}>
      <SafeAreaView style={styles.fullScreen}>
        <StatusBar backgroundColor={gradient2} barStyle="light-content" />

        {/* Header with Close Button */}
        <View style={[styles.header, { backgroundColor: gradient2 }]}>
          <Text style={styles.headerTitle}>Digio Authentication</Text>
          <TouchableOpacity
            onPress={handleClosePress}
            disabled={isVerifying}
            style={styles.closeBtn}>
            <X size={24} color={isVerifying ? "rgba(255,255,255,0.4)" : "#fff"} />
          </TouchableOpacity>
        </View>

        {/* WebView or Loader */}
        {authenticationUrl ? (
          <WebView
            ref={webviewRef}
            source={{ uri: authenticationUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleWebViewMessage}
            injectedJavaScript={`
              (function() {
                console.log('🚀 Digio WebView initialized');
                
                // Listen for Digio SDK callbacks if available
                if (window.Digio) {
                  if (window.Digio.on) {
                    window.Digio.on('success', function(data) {
                      console.log('Digio SDK success:', data);
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'success', 
                        data: data,
                        source: 'digio_sdk'
                      }));
                    });
                    
                    window.Digio.on('error', function(data) {
                      console.log('Digio SDK error:', data);
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'error', 
                        data: data,
                        source: 'digio_sdk'
                      }));
                    });
                  }
                }

                // Monitor URL changes
                let lastUrl = window.location.href;
                setInterval(function() {
                  const currentUrl = window.location.href;
                  
                  if (currentUrl !== lastUrl) {
                    console.log('URL changed:', currentUrl);
                    lastUrl = currentUrl;
                    
                    if (currentUrl.includes('digio_success') || 
                        currentUrl.includes('status=success') ||
                        currentUrl.includes('type=success') ||
                        currentUrl.includes('signed=true') ||
                        currentUrl.includes('exitMessage=Signed') ||
                        currentUrl.includes('Signed%20Successfully')) {
                      console.log('✅ Success detected in URL monitor');
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'success', 
                        url: currentUrl,
                        source: 'url_monitor'
                      }));
                    }
                    
                    if (currentUrl.includes('digio_error') || 
                        currentUrl.includes('status=error') ||
                        currentUrl.includes('type=error') ||
                        currentUrl.includes('status=failed')) {
                      console.log('❌ Error detected in URL monitor');
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'error', 
                        url: currentUrl,
                        source: 'url_monitor'
                      }));
                    }
                  }
                }, 500);

                // Listen for postMessage from Digio iframe
                window.addEventListener('message', function(event) {
                  console.log('Received postMessage:', event.data);
                  
                  try {
                    let data = event.data;
                    
                    // Try to parse if it's a string
                    if (typeof data === 'string') {
                      try {
                        data = JSON.parse(data);
                      } catch(e) {
                        // Keep as string
                      }
                    }
                    
                    // Check for success indicators
                    if (data && (
                      data.status === 'completed' ||
                      data.status === 'success' ||
                      data.type === 'digio:signed' ||
                      data.message === 'Signed Successfully'
                    )) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'success', 
                        data: data,
                        source: 'postmessage'
                      }));
                    }
                    
                    // Check for error indicators
                    if (data && data.status === 'error') {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        status: 'error', 
                        data: data,
                        source: 'postmessage'
                      }));
                    }
                  } catch(e) {
                    console.error('Error processing message:', e);
                  }
                });

                true;
              })();
            `}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("WebView error:", nativeEvent);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("WebView HTTP error:", nativeEvent);
            }}
          />
        ) : (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={mainColor} />
            <Text style={styles.loaderText}>Loading authentication...</Text>
          </View>
        )}

        {/* Overlaid, not swapped in — unmounting the WebView here would throw
            away the customer's place in the Digio flow if they chose to keep
            signing. */}
        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator size="large" color={mainColor} />
            <Text style={styles.verifyingText}>Verifying your signature...</Text>
            <Text style={styles.verifyingSubtext}>
              This usually takes 2-5 seconds
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: 56,
    backgroundColor: "#002651",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 0.4,
    borderBottomColor: "#003A99",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  webview: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loaderText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  verifyingText: {
    marginTop: 16,
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  verifyingSubtext: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 13,
  },
});

export default DigioModal;