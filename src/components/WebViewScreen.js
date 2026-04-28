import React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import WebView from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';

const parseQueryString = (queryString) => {
  const params = {};
  const query = queryString.startsWith('?') ? queryString.substring(1) : queryString;
  const pairs = query.split('&');
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return params;
};

const WebViewScreen = ({ route }) => {
  const  authUrl ='https://smartapi.angelbroking.com/publisher-login?api_key=8PGOS2CW';
  const navigation = useNavigation();

  const handleWebViewNavigationStateChange = (newNavState) => {
    const { url } = newNavState;
    console.log('here1', url);
    if (url.includes("apisession=")) {
      console.log('here2', url);
      const queryParams = parseQueryString(url.split('?')[1]);
      const sessionToken = queryParams.apisession;
      if (sessionToken) {
        console.log('here3', sessionToken);
        // Pass sessionToken back to the previous screen
         // Pass sessionToken to previous screen
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {/* WebView */}
      <WebView
        source={{ uri: authUrl }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color="#0000ff" />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    elevation: 5, // For Android shadow
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});

export default WebViewScreen;
