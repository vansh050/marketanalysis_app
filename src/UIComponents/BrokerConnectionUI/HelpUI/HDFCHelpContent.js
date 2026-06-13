import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const HDFCHelpContent = ({expanded, onExpandChange }) => {
  const brokerConnectRedirectURL=Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
    <View style={styles.container}>
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
              <Text
                            style={styles.instruction}
                          >
                            1. Go to{" "}
                            <LinkifiedUrl url="https://developer.hdfcsec.com/" />
                          </Text>
                          <Text style={styles.instruction}>
                            2. Log in with your ID, password, and OTP.
                          </Text>
                        
                   
            
            </View>
      {expanded && (
        <>
           <Text style={styles.instruction}>
                            3. Accept the *Risk Disclosure *.
                          </Text>
                          <Text style={styles.instruction}>
                            4. Click *Create* to make a new app. Enter app
            name, paste your dedicated static IP (claimed in the
            IP-whitelist panel above) into the "Allowed IPs" field on the
            InvestRight app form — HDFC rejects orders from non-whitelisted
            IPs. Set the redirect URL to: {' '}
            <LinkifiedUrl url={brokerConnectRedirectURL} />
            {' '}and description, then click *Create *.
                          </Text>
                          <Text style={styles.instruction}>
                            5. Copy the *API* and *Secret Key* and paste
            them into the {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'} platform to connect
            your broker.
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

export default HDFCHelpContent;
