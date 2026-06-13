import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import server from '../../../utils/serverConfig';
import { getAdvisorSubdomain } from '../../../utils/variantHelper';
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const ICICIHelpContent = ({expanded, onExpandChange }) => {
  // Web-parity callback URL — server finishes the apisession handshake.
  const advisorSubdomain =
    Config.REACT_APP_HEADER_NAME || getAdvisorSubdomain() || '';
  const iciciCallbackUrl = `${server.ccxtServer.baseUrl}icici/auth-callback/${advisorSubdomain}`;
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
          videoId="XFLjL8hOctI"
        />
      </View>
      <Text style={styles.title}>Steps to Obtain API and Secret key for ICICI:</Text>
<View style={styles.content}>
             <Text style={styles.instruction}>
                           1. Visit{" "}
                           <LinkifiedUrl url="https://api.icicidirect.com/apiuser/home" />{" "}
                           and log in using your username and password. Verify your identity with the OTP and submit.
                         </Text>
                         <Text style={styles.instruction}>
                           2. Click on the "Register an App" tab, then fill in the "App Name" field with "{Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}" or a name of
                           your choice. Paste your dedicated static IP (claimed in the IP-whitelist panel above) into the Breeze "IP Whitelist" field — ICICI rejects every order from a non-whitelisted IP. Enter the "Redirect URL" as{" "}
                           <LinkifiedUrl url={iciciCallbackUrl} />{" "}
                           and click "Submit". Please ensure that "Redirect URL" is entered exactly as shown above — if you previously registered a different URL, update it.
                         </Text>
                   
            
            </View>
      {expanded && (
        <>
           <Text style={styles.instruction}>
                           3. Navigate to the "View Apps" tab and copy your API and Secret Key- enter these details on the screen.
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
    fontFamily:'Poppins-Medium',
    color: "#222",
    marginBottom: 9,
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

export default ICICIHelpContent;
