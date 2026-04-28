import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const SocialProofPopup = ({ message, visible, onHidden }) => {
  const [animation] = useState(new Animated.Value(100)); // Start off-screen

  useEffect(() => {
    if (visible) {
      // Animate popup
      Animated.timing(animation, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      // Automatically hide after 3 seconds
      const hideTimeout = setTimeout(() => {
        Animated.timing(animation, {
          toValue: 100,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          // Notify parent that the popup has hidden
          if (onHidden) {
            onHidden();
          }
        });
      }, 3000);

      return () => clearTimeout(hideTimeout); // Cleanup timeout
    }
  }, [visible]);

  return visible ? (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: animation }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  ) : null; // Hide component when not visible
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});

export default SocialProofPopup;
