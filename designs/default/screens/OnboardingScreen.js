import React from 'react';
import {
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Video from 'react-native-video';

import {designColor} from '../../../src/design/literalTokens';

const {width, height} = Dimensions.get('window');

const OnboardingScreen = ({viewModel, actions}) => {
  const {
    slides,
    currentIndex,
    flatListRef,
    onViewableItemsChanged,
    viewabilityConfig,
  } = viewModel;

  const renderSlide = ({item, index}) => {
    const shouldRenderVideo = Math.abs(currentIndex - index) <= 1;
    return (
      <View style={styles.slide}>
        {shouldRenderVideo ? (
          <Video
            source={item.video}
            style={styles.video}
            resizeMode="cover"
            repeat
            muted
            paused={currentIndex !== index}
            onError={actions.onVideoError}
            bufferConfig={{
              minBufferMs: 2500,
              maxBufferMs: 5000,
              bufferForPlaybackMs: 2500,
              bufferForPlaybackAfterRebufferMs: 2500,
            }}
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue to login"
        style={styles.loginTouchArea}
        onPress={actions.onLoginPress}
        activeOpacity={1}>
        <View />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: designColor('000')},
  slide: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
  },
  videoPlaceholder: {backgroundColor: designColor('1a1a2e')},
  loginTouchArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.18,
    backgroundColor: 'transparent',
  },
});

export default OnboardingScreen;
