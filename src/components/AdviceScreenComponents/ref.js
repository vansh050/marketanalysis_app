import React, { useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
const ZerodhaOrderScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);
  
  const generateHtmlForm = (basket, apiKey) => {
    return `<html>
        <body>
          <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
            <input type="hidden" name="api_key" value="${apiKey}" />
            <input type="hidden" name="data" value='${JSON.stringify(basket)}' />
            <input type="hidden" name="redirect_params" value="${appURL}=true" />
          </form>
          <script>
            document.getElementById('zerodhaForm').submit();
          </script>
        </body>
      </html>
    `;
  };

  const handleZerodhaRedirect = async (stockDetails) => {
    const apiKey = zerodhaApiKey;

    const basket = stockDetails.map((stock) => {
      let baseOrder = {
        variety: "regular",
        tradingsymbol: stock.tradingSymbol,
        exchange: stock.exchange,
        transaction_type: stock.transactionType,
        order_type: stock.orderType,
        quantity: stock.quantity,
        readonly: false,
        price: stock.price,
      };

      // Get the LTP for the current stock
      const ltp = getLTPForSymbol(stock.tradingSymbol);

      // If LTP is available and not '-', use it as the price
      if (ltp !== "-") {
        baseOrder.price = parseFloat(ltp);
      }

      // If it's a LIMIT order, use the LTP as the price
      if (stock.orderType === "LIMIT") {
        baseOrder.price = parseFloat(stock.price || 0);
      } else if (stock.orderType === "MARKET") {
        const ltp = getLTPForSymbol(stock.tradingSymbol);
        if (ltp !== "-") {
          baseOrder.price = parseFloat(ltp);
        } else {
          baseOrder.price = 0;
        }
      }

      if (stock.quantity > 100) {
        baseOrder.readonly = true;
      }

      return baseOrder;
    });

    const currentISTDateTime = new Date();
    
    try {
      // Update the database with the current IST date-time
      await axios.put(`${server.server.baseUrl}api/zerodha/update-trade-reco`,
        {
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain": Config.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      }, {
        stockDetails: stockDetails,
        leaving_datetime: currentISTDateTime,
      });

      // Generate HTML form content
      const htmlContent = generateHtmlForm(basket, apiKey);
      
      // Inject the HTML form into WebView
      webViewRef.current.injectJavaScript(`
        document.open();
        document.write(\${htmlContent}\);
        document.close();
      `);
    } catch (error) {
      console.error("Failed to update trade recommendation:", error);
    }
  };

  const handleWebViewNavigationStateChange = (newNavState) => {
    // Handle navigation state changes, e.g., success/failure redirects
    const { url } = newNavState;
    if (url.includes('success') || url.includes('completed')) {
      // Handle successful order placement
      navigation.goBack();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ html: '<html><body></body></html>' }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
};

export default ZerodhaOrderScreen;