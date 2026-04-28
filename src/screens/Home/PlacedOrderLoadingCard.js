import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import FadeLoading from 'react-native-fade-loading';

const PlacedOrderLoadingCard = ({ style, primaryColor = "#f0f0f0", secondaryColor = "#e0e0e0", duration = 500 }) => {
  return (
    <View style={[styles.container, style]}>
      {/* Inner section */}
      <View style={styles.innerSection}>
        <FadeLoading
          style={[styles.loadingBar, { width: Dimensions.get('window').width - 40, height: 5 }]}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          duration={duration}
        />
        <FadeLoading
          style={[styles.loadingBar, { width: Dimensions.get('window').width - 80, height: 4, marginTop: 8 }]}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          duration={duration}
        />
        <FadeLoading
          style={[styles.loadingBar, { width: Dimensions.get('window').width - 150, height: 4, marginTop: 8 }]}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          duration={duration}
        />
      </View>

      {/* Outer section */}
      <FadeLoading
        style={[styles.outerLoadingCard, { width: Dimensions.get('window').width }]}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        duration={duration}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  innerSection: {
    borderWidth: 0.5,
    borderColor: '#e4e4e4',
    marginHorizontal: 10,
    paddingVertical: 8,
  },
  loadingBar: {
    marginHorizontal: 10,
  },
  outerLoadingCard: {
    height: 85,
    marginTop: 5,
    marginLeft: 10,
  },
});

export default PlacedOrderLoadingCard;
