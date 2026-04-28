import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const DhanHelpContent = ({expanded, onExpandChange }) => {
  const brokerConnectRedirectURL=Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded]);

  return (
    <View>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 0 }}>
      <View style={styles.videoBox}>
        <YoutubePlayer
          height={screenHeight * 0.24}
          width={screenWidth * 0.86}
          play={false}
          videoId="MhAfqNQKSrQ"
        />
      </View>
      <Text style={styles.title}>Steps to Obtain Client ID and Access Token for Dhan:</Text>
<View style={styles.content}>
              <Text
                          style={styles.instruction}
                        >
                          1. Go to{" "}
                          <LinkifiedUrl url="https://login.dhan.co" />{' '}
                        </Text>
                        <Text style={styles.instruction}>
                          2. Click on your profile picture and choose "My Profile on Dhan". Under the Profile details, you'll find the "Client ID".
                        </Text>
                       
                        
                   
            
            </View>
      {expanded && (
        <>
           <Text style={styles.instruction}>
                          3. Then, select "Dhan HQ Trading APIs" from the menu.
                        </Text>
                        <Text style={styles.instruction}>
                          4. To generate an access token, click on "+ New Token," enter a name for your app, set the validity to 30 days, and click "Generate Token."
                        </Text>
                        <Text style={styles.instruction}>
                          5. Copy the access token and paste it into the designated field.
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

export default DhanHelpContent;
