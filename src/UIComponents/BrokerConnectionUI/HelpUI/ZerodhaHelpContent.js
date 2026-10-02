import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Dimensions } from 'react-native';
import YoutubePlayer from "react-native-youtube-iframe";
import { designColor, designFont } from '../../../design/literalTokens';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const ZerodhaHelpContent = ({ expanded, onExpandChange }) => {
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
            videoId="tqJTYfgkS04"
          />
        </View>
        <Text style={styles.title}>How to Connect Zerodha</Text>
        <View style={styles.content}>
          <Text style={styles.instruction}>
            1. Click the <Text style={{ fontWeight: 'bold' }}>"Login to Zerodha"</Text> button below.
          </Text>

          <Text style={styles.instruction}>
            2. You will be redirected to Zerodha's secure login page.
          </Text>

          <Text style={styles.instruction}>
            3. Enter your <Text style={{ fontWeight: 'bold' }}>Zerodha User ID</Text> and <Text style={{ fontWeight: 'bold' }}>Password</Text>.
          </Text>

          <Text style={styles.instruction}>
            4. Complete the <Text style={{ fontWeight: 'bold' }}>2-Factor Authentication</Text> (TOTP/PIN) as prompted.
          </Text>

          <Text style={styles.instruction}>
            5. Review and authorize the app to access your Zerodha account.
          </Text>
        </View>
        {expanded && (
          <>
            <Text style={styles.instruction}>
              6. After successful authorization, you'll be redirected back to the app.
            </Text>

            <Text style={styles.instruction}>
              7. Your Zerodha account is now connected! You can now place orders directly from the app.
            </Text>

            <View style={styles.noteContainer}>
              <Text style={styles.noteTitle}>Important Notes:</Text>
              <Text style={styles.noteText}>
                • Your login credentials are never stored in our app - authentication is handled securely by Zerodha.
              </Text>
              <Text style={styles.noteText}>
                • You'll need to reconnect your account daily as Zerodha tokens expire every 24 hours.
              </Text>
              <Text style={styles.noteText}>
                • Make sure you have an active Zerodha trading account before connecting.
              </Text>
              <Text style={styles.noteText}>
                • If you face any issues, try logging out from Zerodha's website first, then reconnect.
              </Text>
            </View>

            <View style={styles.supportContainer}>
              <Text style={styles.supportTitle}>Need Help?</Text>
              <Text style={styles.supportText}>
                If you encounter any issues during the connection process, please contact our support team.
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoBox: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: designColor('000'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: designColor('1f2937'),
    marginBottom: 12,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  content: {
    marginTop: 8,
  },
  instruction: {
    fontSize: 14,
    color: designColor('374151'),
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: designFont('Poppins-Regular'),
  },
  linkContainer: {
    backgroundColor: designColor('ebf5ff'),
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: designColor('0056b7'),
  },
  link: {
    color: designColor('0056b7'),
    fontWeight: '600',
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
  },
  noteContainer: {
    backgroundColor: designColor('fef3c7'),
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: designColor('f59e0b'),
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: designColor('92400e'),
    marginBottom: 8,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  noteText: {
    fontSize: 13,
    color: designColor('78350f'),
    marginBottom: 6,
    lineHeight: 18,
    fontFamily: designFont('Poppins-Regular'),
  },
  supportContainer: {
    backgroundColor: designColor('f3f4f6'),
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: designColor('1f2937'),
    marginBottom: 6,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  supportText: {
    fontSize: 13,
    color: designColor('6b7280'),
    lineHeight: 18,
    fontFamily: designFont('Poppins-Regular'),
  },
});

export default ZerodhaHelpContent;
