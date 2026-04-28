import React from 'react';
import { View, StyleSheet } from 'react-native';
import CustomToolbar from './CustomToolbar'; // Adjust the path if necessary

const ScreenWrapper = ({ children }) => {
  return (
    <View style={styles.container}>
      <CustomToolbar />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
