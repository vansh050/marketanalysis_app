import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check, Shield } from "lucide-react-native";
import { useConfig } from "../../context/ConfigContext";

const otpBasedMethod = process.env.REACT_APP_OTP_BASED_AUTHENTICATION;
const aadharBasedMethod = process.env.REACT_APP_AADHAR_BASED_AUTHENTICATION;

const VerificationMethodCheck = ({ authMethod, setAuthMethod }) => {
  // Get dynamic colors from config
  const config = useConfig();
  const mainColor = config?.mainColor || '#2563EB';
  return (
    <View style={[styles.container, { borderColor: `${mainColor}40` }]}>
      <View>
        <View style={styles.header}>
          <Shield size={16} color={mainColor} style={{ marginRight: 6 }} />
          <Text style={styles.headerText}>Choose Authentication Method</Text>
        </View>

        <View style={styles.optionsContainer}>
          {otpBasedMethod === "true" && (
            <TouchableOpacity
              style={[
                styles.optionCard,
                authMethod === "otp" && [styles.optionSelected, { borderColor: mainColor }],
              ]}
              onPress={() => setAuthMethod("otp")}
            >
              <View style={[styles.radioCircle, { borderColor: mainColor }]}>
                {authMethod === "otp" && <View style={[styles.selectedRb, { backgroundColor: mainColor }]} />}
              </View>
              <View style={styles.optionContent}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>OTP Based Authentication</Text>
                  <Text style={styles.optionBadge}>Fast & Secure</Text>
                </View>
                <Text style={styles.optionDescription}>
                  Verify your identity using OTP sent to your registered mobile number
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {aadharBasedMethod === "true" && (
            <TouchableOpacity
              style={[
                styles.optionCard,
                authMethod === "aadhaar" && [styles.optionSelected, { borderColor: mainColor }],
              ]}
              onPress={() => setAuthMethod("aadhaar")}
            >
              <View style={[styles.radioCircle, { borderColor: mainColor }]}>
                {authMethod === "aadhaar" && <View style={[styles.selectedRb, { backgroundColor: mainColor }]} />}
              </View>
              <View style={styles.optionContent}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>Aadhaar Based Authentication</Text>
                  <Text style={[styles.optionBadge, { backgroundColor: "#DBEAFE", color: "#1E40AF" }]}>
                    Digital Signature
                  </Text>
                </View>
                <Text style={styles.optionDescription}>
                  Secure digital verification using your Aadhaar credentials
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {authMethod && (
          <View style={styles.selectedContainer}>
            <Check size={16} color="#16A34A" style={{ marginRight: 6 }} />
            <Text style={styles.selectedText}>
              Selected:{" "}
              <Text style={{ fontWeight: "700" }}>
                {authMethod === "otp" ? "OTP Based" : "Aadhaar Based"} Authentication
              </Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  optionsContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    borderColor: "#2563EB",
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  selectedRb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  optionContent: {
    marginLeft: 12,
    flex: 1,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  optionBadge: {
    fontSize: 10,
    fontWeight: "500",
    color: "#047857",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  optionDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  selectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  selectedText: {
    fontSize: 13,
    color: "#374151",
  },
});

export default VerificationMethodCheck;
