import React, { useCallback, useEffect, useRef, useState } from "react";
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
import axios from "axios";
import { WebView } from "react-native-webview";
import { X } from "lucide-react-native";
import useTokens from "../../theme/useTokens";
import server from "../../utils/serverConfig";
import { getAuthedHeaders } from "../../utils/courseAuthHeaders";
import { designColor } from "../../design/literalTokens";

// How often the open modal asks the backend whether the MITC is signed. The
// page's own "signed" message is the fast path; this poll is the fallback
// for a WebView that never delivers it.
const STATUS_POLL_MS = 4000;

// The hostingsol signing page announces completion with
// window.parent.postMessage({type:"aq-consent", status:"signed"}). Inside a
// WebView window.parent is the page itself, so the message lands on its own
// window; forward it to React Native.
const FORWARD_SIGNED_MESSAGE = `
  (function() {
    window.addEventListener('message', function(event) {
      var data = event && event.data;
      if (data && data.type === 'aq-consent' && data.status === 'signed' && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'aq-consent', status: 'signed' }));
      }
    });
  })();
  true;
`;

const withEmbed = (url) => (/[?&]embed=1\b/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}embed=1`);

/**
 * MITC acceptance confirmed with a WhatsApp OTP — the mobile counterpart of
 * prod-alphaquark-github src/components/WhatsAppMitcModal.jsx. Used instead of
 * Digio when the advisor's `mitcSignatureMode` is `whatsapp_otp`.
 *
 * Node `/api/mitc/consent/start` freezes the advisor's published MITC into a
 * hostingsol consent request and returns its signing URL; the customer reads
 * it, enters their WhatsApp number and confirms with the OTP. Completion is
 * accepted only after Node `/api/mitc/consent/status` confirms a signed
 * record — the same check the payment routes enforce.
 *
 * @param {string} planId - '' for one global signature, or the plan id when
 *   the advisor signs per plan (must match the server gate's scope).
 */
const WhatsAppMitcModal = ({ open, name, phone, planId, onClose, onComplete }) => {
  const tokens = useTokens();
  const mainColor = tokens.colors.brand.primary;
  const gradient2 = tokens.colors.brand.gradientEnd;

  const [signUrl, setSignUrl] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const completedRef = useRef(false);

  const isSigned = useCallback(async () => {
    const headers = await getAuthedHeaders();
    const response = await axios.get(`${server.server.baseUrl}api/mitc/consent/status`, {
      params: { plan_id: planId || "" },
      headers,
      timeout: 10000,
    });
    return response?.data?.completed === true;
  }, [planId]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!open) return undefined;
    completedRef.current = false;
    let cancelled = false;
    setSignUrl("");
    setError("");
    (async () => {
      const digits = String(phone || "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        setError("Add a valid 10-digit Indian mobile number, then try again.");
        return;
      }
      try {
        const headers = await getAuthedHeaders();
        const response = await axios.post(
          `${server.server.baseUrl}api/mitc/consent/start`,
          { name: String(name || "").trim() || "Customer", phone: digits, plan_id: planId || "" },
          { headers, timeout: 20000 },
        );
        const url = response?.data?.sign_url;
        if (!url) throw new Error("The signing link was not returned.");
        if (!cancelled) setSignUrl(withEmbed(url));
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.error || e?.message || "Could not start the MITC confirmation.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, name, phone, planId]);

  useEffect(() => {
    if (!open || !signUrl) return undefined;
    const timer = setInterval(async () => {
      try {
        if (await isSigned()) complete();
      } catch (_) {
        // Keep waiting; the customer can still finish and tap X to verify.
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [open, signUrl, isSigned, complete]);

  const verifyAndComplete = async () => {
    setIsVerifying(true);
    let signed = false;
    try {
      signed = await isSigned();
    } catch (e) {
      console.error("[WhatsAppMitc] status check failed:", e?.message);
    }
    setIsVerifying(false);
    if (signed) complete();
    return signed;
  };

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "aq-consent" && data?.status === "signed") {
        const signed = await verifyAndComplete();
        if (!signed) setError("Your confirmation is recorded; we are still verifying it. This completes on its own in a moment.");
      }
    } catch (_) {
      // Not our message.
    }
  };

  const handleClosePress = async () => {
    if (completedRef.current) return;
    if (!signUrl) {
      onClose?.();
      return;
    }
    if (await verifyAndComplete()) return;
    Alert.alert(
      "MITC not confirmed",
      "We couldn't confirm your acceptance yet. You need to accept the MITC before paying.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => onClose?.() },
      ],
    );
  };

  if (!open) return null;

  return (
    <Modal animationType="slide" transparent={false} visible={open} onRequestClose={handleClosePress}>
      <SafeAreaView style={styles.fullScreen}>
        <StatusBar backgroundColor={gradient2} barStyle="light-content" />
        <View style={[styles.header, { backgroundColor: gradient2 }]}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Review and accept MITC</Text>
            <Text style={styles.headerSubtitle}>A WhatsApp OTP confirms your mobile number</Text>
          </View>
          <TouchableOpacity onPress={handleClosePress} disabled={isVerifying} style={styles.closeBtn}>
            <X size={24} color={isVerifying ? "rgba(255,255,255,0.4)" : designColor("fff")} />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {signUrl ? (
          <WebView
            source={{ uri: signUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            injectedJavaScriptBeforeContentLoaded={FORWARD_SIGNED_MESSAGE}
            onMessage={handleMessage}
          />
        ) : !error ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={mainColor} />
            <Text style={styles.loaderText}>Preparing the MITC…</Text>
          </View>
        ) : null}

        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator size="large" color={mainColor} />
            <Text style={styles.loaderText}>Checking your confirmation…</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: designColor("fff") },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: { flex: 1, paddingRight: 12 },
  headerTitle: { color: designColor("fff"), fontSize: 18, fontWeight: "600" },
  headerSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },
  webview: { flex: 1 },
  error: { color: designColor("c0392b"), fontSize: 14, padding: 16 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { marginTop: 12, fontSize: 14, color: designColor("555") },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default WhatsAppMitcModal;
