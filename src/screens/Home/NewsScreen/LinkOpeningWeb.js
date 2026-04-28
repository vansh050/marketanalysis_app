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

const LinkOpeningWeb = ({ setWebview,currentUrl,webViewVisible,symbol }) => {
   // console.log('here i enter',currentUrl);
    const [loading,setLoading]=useState(false);
  return (
 
       <Modal visible={webViewVisible} animationType="slide" onRequestClose={() => setWebview(false)}>
                    <SafeAreaView style={{flexDirection:'row',justifyContent:'space-between',alignContent:'center',alignItems:'center',marginVertical:10,marginHorizontal:10,borderBottomColor:'#e9e9e9',borderBottomWidth:2,}}>
                    <Text style={styles.headerTitle}>{symbol}</Text>
                    <XIcon
                          size={24}
                          color="black"
                          style={{marginTop:0,}}
                          onPress={() => setWebview(false)}
                        />
                    </SafeAreaView>
                    
                   <SafeAreaView style={{flex:1}}>
                   <WebView
                          source={{ uri: currentUrl }}
                          style={styles.webView}
                          startInLoadingState={true}  // Ensures the loader is shown initially
                          renderLoading={() => (
                            <View style={styles.loaderContainer}>
                              <Loader color={'#000'} width={40} height={40} />
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
    color: '#888',
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
    fontFamily: 'Satoshi-Bold',
    marginBottom: 10,
    color: 'black',
  },
  webView: {
     flex:1,
  },
  cardGroup: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 18,
    fontFamily:'Satoshi-Bold',
    color: '#000',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily:'Satoshi-Medium',
    color: '#333',
  },
  cardDate: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
    fontFamily:'Satoshi-Regular',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius:30,
    borderTopRightRadius:30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderLeftWidth:1,
    borderRightWidth:1,
    borderTopColor: '#eee',
    borderLeftColor:'#eee',
    borderRightColor:'#eee'
  },
  footerText: {
    fontSize: 16,
    fontFamily:'Satoshi-Bold',
    color: '#333',
  },
  footerPrice: {
    fontSize: 16,
    fontFamily:'Satoshi-Bold',
    color: '#16A085',
  },
  percentageContainer: {
    backgroundColor: '#16A085',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  change: {
    fontSize: 14,
    color: '#fff',
    fontFamily:'Satoshi-Medium',
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
    backgroundColor: '#fff',
 
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily:'Satoshi-Bold',
    marginBottom: 10,
    color: '#000',
  },
  modalSummary: {
    fontSize: 16,
    color: '#444',
    fontFamily:'Satoshi-Medium',
    marginBottom: 15,
  },
  modalLinkContainer: {
    marginBottom: 10,
  },
  modalLinkText: {
    fontSize: 16,
    color: '#007BFF',
    textDecorationLine: 'underline',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#16A085',
    padding: 10,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontFamily:'Satoshi-Medium'
  },
});

export default LinkOpeningWeb;
