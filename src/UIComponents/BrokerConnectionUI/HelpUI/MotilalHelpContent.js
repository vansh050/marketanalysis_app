import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import Config from 'react-native-config';
import YoutubePlayer from "react-native-youtube-iframe";
import LinkifiedUrl from './LinkifiedUrl';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const MotilalHelpContent = ({expanded, onExpandChange }) => {
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
          videoId="gGKedxU-sQ0"
        />
      </View>
      <Text style={styles.title}>Steps to Obtain API and Secret key for Motilal Oswal:</Text>
<View style={styles.content}>
                 <Text style={styles.instruction}>
                           1. Visit{' '}
                           <LinkifiedUrl url="https://www.motilaloswal.com" />{' '}
                           in your browser.
                         </Text>
               
                         {/* STEP 2 */}
                         <Text style={styles.instruction}>
                           2. Click on <Text style={{ fontWeight: 'bold' }}>Customer Login</Text> at the top right, then select the Older Version to log into your account.
                         </Text>
               
                         {/* STEP 3 */}
                        
            </View>
      {expanded && (
        <>
          
                 <Text style={styles.instruction}>
                           3. Click on <Text style={{ fontWeight: 'bold' }}>Profile Icon</Text> at the top to get Client Code.
                         </Text>
               
                         {/* STEP 4 */}
                         <Text style={styles.instruction}>
                           4. Click on the <Text style={{ fontWeight: 'bold' }}>hamburger menu (☰)</Text> at the top right corner.
                         </Text>
               
                         {/* STEP 5 */}
                         <Text style={styles.instruction}>
                           5. From the dropdown list, select <Text style={{ fontWeight: 'bold' }}>"Trading API"</Text>.
                         </Text>
               
                         {/* STEP 6 */}
                         <Text style={styles.instruction}>
                           6. On the Trading API page, click on <Text style={{ fontWeight: 'bold' }}>"Create an API Key"</Text>. 
                           Enter a name for your app (e.g., {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}) and enter the Redirect URL below:
                         </Text>
               
                         <View style={styles.linkContainer}>
                           <LinkifiedUrl url="https://ccxtprod.alphaquark.in/motilal-oswal/callback" />
                         </View>
               
                         <Text style={styles.instruction}>
                           Copy this URL and paste it in the Redirect URL field, then hit <Text style={{ fontWeight: 'bold' }}>"Create"</Text>.
                         </Text>
               
                         {/* STEP 7 */}
                         <Text style={styles.instruction}>
                           7. Your API Key is now created. Copy the <Text style={{ fontWeight: 'bold' }}>API Key</Text> and your Client Code.
                         </Text>
               
                         {/* STEP 8 */}
                         <Text style={styles.instruction}>
                           8. Paste these details in our app to complete your broker connection.
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

export default MotilalHelpContent;
