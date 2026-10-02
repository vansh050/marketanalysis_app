import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Modal,
  SafeAreaView,
} from 'react-native';
import Loader from '../../../utils/Loader';
import WebView from 'react-native-webview';
import { ChevronLeft ,XIcon} from 'lucide-react-native';

import { designColor, designFont } from '../../../design/literalTokens';

const LinkOpeningWeb = ({ setWebview,currentUrl,webViewVisible,symbol }) => {
   // console.log('here i enter',currentUrl);
    const [loading,setLoading]=useState(false);
  return (
    <Modal visible={webViewVisible} animationType="slide" onRequestClose={() => setWebview(false)}>
      <SafeAreaView style={styles.header}>
      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.headerTitle}>{symbol}</Text>
      <TouchableOpacity
            onPress={() => setWebview(false)}
            accessibilityRole="button"
            accessibilityLabel="Close blog"
            style={styles.blogHeaderCloseButton}>
        <XIcon size={22} color="black" />
      </TouchableOpacity>
      </SafeAreaView>
      <SafeAreaView style={{flex:1}}>
      <WebView
             source={{ uri: currentUrl }}
             style={styles.webView}
             startInLoadingState={true}  // Ensures the loader is shown initially
             renderLoading={() => (
               <View style={styles.loaderContainer}>
                 <Loader color={designColor('000')} width={40} height={40} />
               </View>
             )}
             onShouldStartLoadWithRequest={request => {
               // Allow the original URL and data: URLs (blog HTML content)
               if (request.url === currentUrl) return true;
               if (request.url.startsWith('data:')) return true;
               if (request.url.startsWith(currentUrl + '#') || request.url === 'about:blank') return true;
               // Block external navigation — close the webview instead
               setWebview(false);
               return false;
             }}
             originWhitelist={['*']}
           />
      </SafeAreaView>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
   
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.23)', // Semi-transparent background
    zIndex: 1, // Ensure the loader is above the WebView
  },
  emptyStateText: {
    fontSize: 18,
    color: designColor('888'),
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 200,
  },
  iconContainer: {
    position: 'absolute',
    top: 20,
    left: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 5,
  },
  contentContainer: {
    padding: 16,
    borderTopLeftRadius:50,
    borderTopRightRadius:50
  },
  modalContainer: {
   flex:1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 12,
    paddingBottom: 8,
    borderBottomColor: designColor('e9e9e9'),
    borderBottomWidth: 2,
  },
  blogHeaderCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designColor('f1f5f9'),
  },
  webView: {
     flex:1,
  },
  cardGroup: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 18,
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('000'),
    marginBottom: 10,
  },
  card: {
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily:designFont('Satoshi-Medium'),
    color: designColor('333'),
  },
  cardDate: {
    fontSize: 14,
    color: designColor('888'),
    marginTop: 5,
    fontFamily:designFont('Satoshi-Regular'),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius:30,
    borderTopRightRadius:30,
    backgroundColor: designColor('fff'),
    borderTopWidth: 1,
    borderLeftWidth:1,
    borderRightWidth:1,
    borderTopColor: designColor('eee'),
    borderLeftColor:designColor('eee'),
    borderRightColor:designColor('eee')
  },
  footerText: {
    fontSize: 16,
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('333'),
  },
  footerPrice: {
    fontSize: 16,
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('16a085'),
  },
  percentageContainer: {
    backgroundColor: designColor('16a085'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  change: {
    fontSize: 14,
    color: designColor('fff'),
    fontFamily:designFont('Satoshi-Medium'),
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalContent: {
    width: width,
    maxHeight: height * 0.7,
    borderTopLeftRadius:20,
    borderTopRightRadius:20,
    backgroundColor: designColor('fff'),
 
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily:designFont('Satoshi-Bold'),
    marginBottom: 10,
    color: designColor('000'),
  },
  modalSummary: {
    fontSize: 16,
    color: designColor('444'),
    fontFamily:designFont('Satoshi-Medium'),
    marginBottom: 15,
  },
  modalLinkContainer: {
    marginBottom: 10,
  },
  modalLinkText: {
    fontSize: 16,
    color: designColor('007bff'),
    textDecorationLine: 'underline',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: designColor('16a085'),
    padding: 10,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: designColor('fff'),
    fontFamily:designFont('Satoshi-Medium')
  },
});

export default LinkOpeningWeb;
