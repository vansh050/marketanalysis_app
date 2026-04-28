import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { WebView } from "react-native-webview";

const { width } = Dimensions.get("window");

const TradingViewTicker = () => {
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin:0; padding:0; background:transparent; }
          .tradingview-widget-container { width: 100%; height: 60px; }
        </style>
      </head>
      <body>
        <!-- TradingView Mini Symbol Overview BEGIN -->
        <div class="tradingview-widget-container">
          <div id="tradingview_1"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js" async>
          {
            "symbols": [
              ["NSE:NIFTY", "NIFTY"],
              ["NSE:BANKNIFTY", "BANK NIFTY"]
            ],
            "width": "${width}",
            "height": 60,
            "locale": "en",
            "colorTheme": "light",
            "trendLineColor": "#37a6ef",
            "underLineColor": "rgba(55, 166, 239, 0.15)",
            "isTransparent": true,
            "autosize": true,
            "largeChartUrl": ""
          }
          </script>
        </div>
        <!-- TradingView Mini Symbol Overview END -->
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: widgetHtml }}
        style={{ width: width, height: 60, backgroundColor: "transparent" }}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%", height: 60, backgroundColor: "transparent" },
});

export default TradingViewTicker;
