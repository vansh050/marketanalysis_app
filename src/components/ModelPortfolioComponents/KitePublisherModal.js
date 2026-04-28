// Kite Publisher SDK wrapper for React Native
// This loads the Publisher SDK in a WebView and communicates via postMessage

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { XIcon } from 'lucide-react-native';

const KITE_PUBLISHER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://kite.trade/publisher.js?v=3"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; text-align: center; }
    .loading { margin-top: 50px; }
    .error { color: red; margin-top: 20px; }
    .success { color: green; margin-top: 20px; }
  </style>
</head>
<body>
  <div id="status" class="loading">Loading Kite Publisher...</div>
  <script>
    let kite = null;
    let itemsAdded = false;

    // Log KiteConnect availability
    console.log('KiteConnect available:', typeof window.KiteConnect);
    console.log('KiteConnect version:', window.KiteConnect ? 'yes' : 'no');

    // Listen for messages from React Native
    window.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        console.log('Received data:', data);

        if (data.type === 'init') {
          const apiKey = data.apiKey;
          document.getElementById('status').innerHTML = 'Initializing Kite with API key: ' + apiKey.substring(0, 4) + '...';

          if (!window.KiteConnect) {
            const errorMsg = 'KiteConnect not loaded! Check internet connection.';
            document.getElementById('status').innerHTML = '<span class="error">' + errorMsg + '</span>';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: errorMsg }));
            return;
          }

          try {
            console.log('Creating KiteConnect with apiKey:', apiKey.substring(0, 4) + '...');
            kite = new window.KiteConnect(apiKey);
            console.log('KiteConnect instance created, type:', typeof kite);
            console.log('KiteConnect methods: add=' + typeof kite.add + ', link=' + typeof kite.link + ', connect=' + typeof kite.connect + ', finished=' + typeof kite.finished);

            document.getElementById('status').innerHTML = 'Kite initialized! Ready to open basket.';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          } catch (e) {
            console.error('KiteConnect creation error:', e);
            console.error('Error name:', e.name);
            console.error('Error message:', e.message);
            const errorMsg = e.name + ': ' + e.message;
            document.getElementById('status').innerHTML = '<span class="error">Error: ' + errorMsg + '</span>';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: errorMsg }));
          }
        }

        if (data.type === 'addItems' && kite) {
          try {
            console.log('Adding ' + data.items.length + ' items to basket');
            data.items.forEach(function(item, idx) {
              console.log('Item ' + idx + ':', JSON.stringify(item));
              kite.add(item);
            });
            itemsAdded = true;
            document.getElementById('status').innerHTML = 'Items added! Opening Kite...';

            // Set up finished callback
            kite.finished(function(status, request_token) {
              console.log('Finished callback:', status, request_token);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'finished',
                status: status,
                requestToken: request_token
              }));
            });

            // Open the publisher - this is where the popup opens
            console.log('Calling kite.connect() to open Kite basket...');
            kite.connect();

            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'opened' }));
          } catch (e) {
            console.error('Add items error:', e);
            console.error('Error name:', e.name);
            console.error('Error message:', e.message);
            const errorMsg = e.name + ': ' + e.message;
            document.getElementById('status').innerHTML = '<span class="error">Error adding items: ' + errorMsg + '</span>';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: errorMsg }));
          }
        }
      } catch (e) {
        console.error('Message parse error:', e);
        document.getElementById('status').innerHTML = '<span class="error">Error: ' + e.message + '</span>';
      }
    });

    // Signal that we're ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
  </script>
</body>
</html>
`;

const KitePublisherModal = ({
  visible,
  onClose,
  apiKey,
  basketItems,
  onSuccess,
  onError,
}) => {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    if (visible && apiKey && basketItems?.length > 0) {
      setIsReady(false);
      setError(null);
      setIsOpening(false);
    }
  }, [visible, apiKey, basketItems]);

  const handleWebViewMessage = (event) => {
    try {
      const rawData = event.nativeEvent.data;
      console.log('[KitePublisher] Raw WebView message:', rawData);

      const data = JSON.parse(rawData);
      console.log('[KitePublisher] Parsed WebView message type:', data.type);

      switch (data.type) {
        case 'loaded':
          // Publisher script loaded, now initialize
          console.log('[KitePublisher] Script loaded, initializing with API key:', apiKey?.substring(0, 4) + '...');
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'init',
            apiKey: apiKey
          }));
          break;

        case 'ready':
          setIsReady(true);
          console.log('[KitePublisher] Kite ready, adding', basketItems?.length, 'items to basket');
          console.log('[KitePublisher] Basket items:', JSON.stringify(basketItems, null, 2));
          // Add items to basket
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'addItems',
            items: basketItems
          }));
          break;

        case 'opened':
          setIsOpening(true);
          console.log('[KitePublisher] Publisher opened - user should see Kite basket popup');
          break;

        case 'finished':
          console.log('[KitePublisher] Finished - status:', data.status, ', requestToken:', data.requestToken);
          if (data.status === 'success') {
            onSuccess?.(data.requestToken);
          } else {
            const errorMsg = data.status === 'error' ? 'Order cancelled by user' : data.status;
            setError(errorMsg);
            onError?.(data.status);
          }
          break;

        case 'error':
          console.error('[KitePublisher] Error from WebView:', data.message);
          setError(data.message);
          onError?.(data.message);
          break;
      }
    } catch (e) {
      console.error('[KitePublisher] Message parse error:', e);
      console.error('[KitePublisher] Raw event data:', event.nativeEvent.data);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kite Publisher</Text>
          <TouchableOpacity onPress={onClose}>
            <XIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          source={{ html: KITE_PUBLISHER_HTML }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          style={styles.webview}
          originWhitelist={['*']}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!isReady && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Loading Kite Publisher...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#fee',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
  },
});

export default KitePublisherModal;
