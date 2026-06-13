import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const FyersHelpContent = ({expanded, onExpandChange }) => {
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
          videoId="blhTiePBIg0"
        />
      </View>
      <Text style={styles.title}>Steps to Obtain API and Secret key for Fyers:</Text>
<View style={styles.content}>
              <Text
                          style={styles.instruction}
                        >
                          1. Visit{" "}
                          <LinkifiedUrl url="https://fyers.in/web/api-dashboard/user-apps" />{' '}
                        </Text>
                        <Text style={styles.instruction}>
                          2. Log in using your phone number, enter the TOTP, and your 4-digit PIN.
                        </Text>
                      
                       
                       
                        
                   
            
            </View>
      {expanded && (
        <>
        <Text style={styles.instruction}>
                          3. Click on the "Create App" button. Provide an app name, paste the redirect URL as specified in the instructions, add a description, and delete the webhook. {"\n\n"}
                          ⚠️ <Text style={{fontWeight: '700'}}>You MUST tick the "Order Placement" permission</Text> — without it Fyers rejects every basket order with "algo orders are not allowed for this app". The checkbox is OFF by default. {"\n\n"}
                          Tick all other permissions you want (Holdings, Funds, Orders read, etc.), accept the API Usage Terms and Conditions, and click "Create App."
                        </Text>
                        <Text style={styles.instruction}>
                          4. Scroll down to find the newly created app. Copy the App ID and Secret ID and paste them into your platform.
                        </Text>
                        <Text style={styles.instruction}>
                          5. <Text style={{fontWeight: '700'}}>Already created the app and seeing "algo orders are not allowed"?</Text> Go back to https://fyers.in/web/api-dashboard/user-apps → click your app → "Edit" → tick the Order Placement permission → Save. No need to delete and recreate the app or re-paste your keys.
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

export default FyersHelpContent;
