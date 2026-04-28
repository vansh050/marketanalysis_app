import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from '@react-native-community/blur';

const BlurredComponent = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Blur effect in the background with padding */}
      <View style={styles.contentContainer}>{children}</View>
      <View style={styles.blurWrapper}>
        <BlurView
          blurType="light"
          blurAmount={5} // ✅ Adjust for stronger blur
          blurRadius={5}
          reducedTransparencyFallbackColor="white"
          style={styles.blurContainer} 
        />
      </View>
    
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
  
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurWrapper: {
    ...StyleSheet.absoluteFillObject, // ✅ Keeps blur in the background
  // ✅ Padding inside blur (not affecting outer component)
  },
  blurContainer: {
    flex: 1, // ✅ Ensures blur fills the wrapper
    borderRadius: 20, // ✅ Keeps blur inside rounded corners
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BlurredComponent;
