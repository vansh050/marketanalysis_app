import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const KotakHelpContent = ({ expanded, onExpandChange }) => {
  const brokerConnectRedirectURL = Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.videoBox}>
          <YoutubePlayer
            height={screenHeight * 0.24}
            width={screenWidth * 0.86}
            play={false}
            videoId="JXwnwaxM88k"
          />
        </View>
        <Text style={styles.title}>Steps to Obtain API Credentials for Kotak Neo:</Text>
        <View style={styles.content}>

          <Text style={styles.instruction}>Step 1: Getting NEO trade API access</Text>

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
            Login with your mobile number and register for Kotak Neo Trade API. Enter your Client ID, email, and contact number, then click "Submit." You'll receive your User ID, password, and Neo Finkey via email within 30 minutes.
          </Text>

          {/* Substep iii */}
          <Text style={styles.instruction1}>
            (iii) If you are using Kotak Stock Trader, kindly switch to Neo:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://www.kotaksecurities.com/switch-to-neo/" />
          </View>

          {/* STEP 2 */}
          <Text style={styles.instruction}>Step 2: Setting API access - Getting consumer key and consumer secret keys</Text>

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
            (ii) Create an Application: Navigate to the "Applications" section, click on "Add New Application," and fill required details (use any app name, e.g., {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}). Select Unlimited in Shared Quota, leave description & group empty, then save.
          </Text>

          <Text style={styles.instruction1}>
            (iii) Under "Subscriptions" section, click on Subscribe APIs and subscribe to all available APIs.
          </Text>

          <Text style={styles.instruction1}>
            (iv) Go to "Production Keys", click "Generate Keys" to obtain your API Key & Secret Key. Copy Consumer Key & Secret for Step 4.
          </Text>

          {/* STEP 3 */}
          <Text style={styles.instruction}>Step 3: TOTP Registration</Text>

          <Text style={styles.instruction1}>
            (i) Go to:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://www.kotaksecurities.com/platform/kotak-neo-trade-api/totp-registration/" />
          </View>

          <Text style={styles.instruction1}>
            Register for TOTP, verify mobile via OTP, select account, scan QR via authenticator app (e.g. Google Authenticator), and submit TOTP.
          </Text>

          {/* STEP 4 */}
          <Text style={styles.instruction}>Step 4: Linking account to Kotak NEO Apis</Text>

          <Text style={styles.instruction1}>
            (i) Go to broker settings in your app, select Kotak, and input Unique Client Code, Consumer Key & Secret obtained earlier, and your MPIN.
          </Text>

          <Text style={styles.instruction1}>
            (ii) You'll need to provide TOTP from Authenticator app while linking.
          </Text>
          </>
        )}

      </ScrollView>

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
