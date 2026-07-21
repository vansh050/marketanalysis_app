import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const KotakHelpContent = ({ expanded, onExpandChange }) => {
  const brokerConnectRedirectURL = Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  const appName = Config.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark';
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
      <View style={[styles.container, { paddingBottom: 20 }]}>
        <View style={styles.videoBox}>
          <YoutubePlayer
            height={screenHeight * 0.24}
            width={screenWidth * 0.86}
            play={false}
            videoId="JXwnwaxM88k"
          />
        </View>
        <Text style={styles.title}>Steps to Obtain API Credentials for Kotak Neo:</Text>

        <Text style={styles.overview}>
          One-time setup. Steps 1–3 happen on Kotak's website; Step 4 is back
          here in this app. Heads up: in Step 1 Kotak emails your API-portal
          login — it can take up to 30 minutes, so you may need to pause and
          come back once it arrives.
        </Text>

        <View style={styles.content}>

          <Text style={styles.stepHeader}>Step 1: Get Neo Trade API access</Text>

          {/* Substep i */}
          <Text style={styles.instruction1}>
            (i) Check if you are using Kotak NEO or Kotak Stock trader. If you are using Kotak NEO, please obtain your Client ID by logging into Kotak Neo account and finding your Client ID under account details.
          </Text>

          {/* Substep ii */}
          <Text style={styles.instruction1}>
            (ii) After that, please login to:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://www.kotaksecurities.com/platform/kotak-neo-trade-api/" />
          </View>


        </View>
        {expanded && (
          <>
          
          <Text style={styles.instruction1}>
            Login with your mobile number and register for Kotak Neo Trade API. Enter your Client ID, email, and contact number, then click "Submit."
          </Text>

          <Text style={styles.checkpoint}>
            ⏳ Now wait for Kotak's email — it contains your User ID, password,
            and Neo Finkey (arrives within ~30 min). You need it for Step 2, so
            pause here until it's in your inbox.
          </Text>

          {/* Substep iii */}
          <Text style={styles.instruction1}>
            (iii) If you are using Kotak Stock Trader, kindly switch to Neo:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://www.kotaksecurities.com/switch-to-neo/" />
          </View>

          {/* STEP 2 */}
          <Text style={styles.stepHeader}>Step 2: Get your Consumer Key & Secret</Text>

          <Text style={styles.instruction1}>
            (i) Log In to the Kotak API Portal:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://napi.kotaksecurities.com/devportal/apis" />
          </View>

          <Text style={styles.instruction1}>
            Login using the username and password you received via email.
          </Text>

          <Text style={styles.instruction1}>
            (ii) Create an Application: Navigate to the "Applications" section, click on "Add New Application," and fill required details (use any app name, e.g., {appName}). Select Unlimited in Shared Quota, leave description & group empty, then save.
          </Text>

          <Text style={styles.instruction1}>
            (iii) Under "Subscriptions" section, click on Subscribe APIs and subscribe to all available APIs.
          </Text>

          <Text style={styles.instruction1}>
            (iv) Go to "Production Keys", click "Generate Keys" to obtain your API Key & Secret Key. Copy Consumer Key & Secret for Step 4.
          </Text>

          {/* STEP 3 */}
          <Text style={styles.stepHeader}>Step 3: Register TOTP (Authenticator)</Text>

          <Text style={styles.instruction1}>
            (i) Go to:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://www.kotaksecurities.com/platform/kotak-neo-trade-api/totp-registration/" />
          </View>

          <Text style={styles.instruction1}>
            On the Kotak Neo API Dashboard (the Trade API page), click "TOTP Registration". Verify your mobile via OTP, select your account, scan the QR with an authenticator app (e.g. Google Authenticator), and submit the TOTP to register.
          </Text>

          {/* STEP 4 */}
          <Text style={styles.stepHeader}>Step 4: Link your account (back in this app)</Text>

          <Text style={styles.instruction1}>
            Return to this screen and fill the fields below: your Unique Client Code (UCC), the Consumer Key & Secret from Step 2, your MPIN, and the current TOTP from your Authenticator app (Step 3). Then tap Connect.
          </Text>

          <Text style={styles.instruction1}>
            Tip: your Client Code (UCC) is shown in your Kotak Neo Profile (or in the "Select Client Code" prompt that appears during TradeAPI setup).
          </Text>
          </>
        )}

      </View>

    </View>

  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  videoBox: {
    alignItems: 'center',
    marginVertical: 12,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: "#222",
    marginBottom: 9,
  },
  overview: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontFamily: 'Poppins-Regular',
  },
  instruction1: {
    fontSize: 12,
    color: "black",
    marginVertical: 3,
    fontFamily: 'Poppins-Regular'
  },
  instruction: {
    fontSize: 14,
    color: "#222",
    marginBottom: 8,
  },
  // Distinct, scannable step header — bug-80: the old `instruction` style
  // (14px, same dark grey as body) made the 4 step headers blend into the
  // sub-steps, so the long Kotak guide read as an undifferentiated wall.
  stepHeader: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '700',
    color: "#0F3D8C",
    marginTop: 16,
    marginBottom: 6,
  },
  checkpoint: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    fontFamily: 'Poppins-Regular',
  },
  link: {
    color: "#1890FF",
    textDecorationLine: 'underline',
  },
  toggleContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1890FF',
  },
});

export default KotakHelpContent;
