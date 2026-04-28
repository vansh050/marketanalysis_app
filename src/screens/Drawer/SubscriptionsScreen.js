import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SubscriptionsScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Subscriptions</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SubscriptionsScreen;
