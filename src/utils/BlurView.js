import React from "react";
import { View, StyleSheet } from "react-native";

const BlurView = ({ children, blurAmount = 10, overlayColor = "rgba(255, 255, 255, 0.2)" }) => {
  return (
    <View style={[styles.container, { backgroundColor: overlayColor }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Makes the view cover the entire parent
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(10px)", // Works on Web
  },
});

export default BlurView;
