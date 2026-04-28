import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const AliceblueHelpContent = ({expanded, onExpandChange }) => {
  const brokerConnectRedirectURL=Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 0 }}>
      {/* TODO: Replace with public AliceBlue tutorial video - current video is private */}
      {/* <View style={styles.videoBox}>
        <YoutubePlayer
          height={screenHeight * 0.24}
          width={screenWidth * 0.86}
          play={false}
          videoId="m906oWzMe0o"
        />
      </View> */}
      <Text style={styles.title}>Steps to Obtain Client ID and API Key for AliceBlue:</Text>
<View style={styles.content}>
             <Text
                          style={styles.instruction}
                        >
                          1. Login to{" "}
                          <LinkifiedUrl url="https://ant.aliceblueonline.com/apps" />{' '}
                          using your phone number, password, and TOTP or mobile OTP.
                        </Text>

                        <Text style={styles.instruction}>
                          2. If prompted with a Risk Disclosure pop-up, click "Proceed".
                        </Text>
                       
                       
                        
                   
            
            </View>
      {expanded && (
        <>
          <Text style={styles.instruction}>
                          3. In the "Apps" tab, click on "API Key", then click "Copy" and paste it into the API Key field below. {'\n'}
                          <Text style={styles.note}>Note: API Key is valid for 24 hours only. Generate a new one daily.</Text>
                        </Text>
                        <Text style={styles.instruction}>
                          4. To get your Client ID: Click the profile icon → "Your Profile/Settings" → Copy the Client ID shown under your name → Paste it into the Client ID field below.
                        </Text>
                        <Text style={styles.instruction}>
                          5. After entering both Client ID and API Key, click "Connect AliceBlue" to complete the connection.
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
  note: {
    fontSize: 12,
    color: "#666",
    fontStyle: 'italic',
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

export default AliceblueHelpContent;
