import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import WebView from "react-native-webview";
import LinearGradient from "react-native-linear-gradient";
import { useTrade } from "../TradeContext";
import { useConfig } from "../../context/ConfigContext";

const TermsandConditionsScreen = () => {
  const { configData } = useTrade();
  const tncURL =
    configData?.config?.REACT_APP_ADVISOR_TERMS_AND_CONDITION;

  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || "rgba(0, 86, 183, 1)";
  const gradient2 = config?.gradient2 || "rgba(0, 38, 81, 1)";
  const mainColor = config?.mainColor || "#0056B7";
  const [isValidUrl, setIsValidUrl] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    if (!tncURL) {
      setIsValidUrl(false);
      return;
    }

    // ✅ Regex-based URL validation (safer for React Native)
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w-./?%&=]*)?$/i;
    setIsValidUrl(urlPattern.test(tncURL));
  }, [tncURL]);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerContainer}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
        </View>
      </LinearGradient>

      {/* WebView or Error */}
      {isValidUrl ? (
        <WebView
          source={{ uri: tncURL }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color={mainColor} />
              <Text style={[styles.loaderText, { color: mainColor }]}>Loading...</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={request => {
            if (request.url === tncURL) return true;
            if (request.url.startsWith(tncURL + '#') || request.url === 'about:blank') return true;
            navigation.goBack();
            return false;
          }}
          style={{ flex: 1, backgroundColor: "#fff" }}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: mainColor }]}>Invalid or Missing URL</Text>
          <Text style={styles.errorText}>
            The Terms & Conditions page couldn’t be loaded. Please check your
            configuration or try again later.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Poppins-Medium",
    color: "#fff",
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    color: "#0056B7",
    fontFamily: "Poppins-Medium",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#0056B7",
    marginBottom: 8,
  },
  errorText: {
    textAlign: "center",
    color: "grey",
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});

export default TermsandConditionsScreen;
