import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  withDelay,
} from 'react-native-reanimated';
import Loader from '../utils/Loader';
import {ChevronRight} from 'lucide-react-native';
import Config from '../utils/safeConfig';
const selectedVariant = Config?.APP_VARIANT || 'rgxresearch'; // Default to "rgxresearch" if not set

const SliderButton = ({
  loading,
  onSlideComplete = () => {},
  text = 'Swipe To Raise The Alert',
  backgroundColor = '#000',
  textColor = '#fff',
  buttonColor = '#fff',
  iconColor = '#E64040',
  disabled = false, // New prop to handle disabling
}) => {
  const screenWidth = Dimensions.get('window').width;
  const END_POSITION = screenWidth - 90;
  const position = useSharedValue(0);
  const isSliding = useSharedValue(false);
  const handleComplete = () => {
    if (!disabled) {
      onSlideComplete();
    }
  };

  const gesture = Gesture.Pan()
    .onBegin(() => {
      if (!disabled) {
        isSliding.value = true;
      }
    })
    .onUpdate(e => {
      if (!disabled) {
        const newPosition = e.translationX + 0;
        position.value = Math.max(0, Math.min(newPosition, END_POSITION));
      }
    })
    .onEnd(() => {
      if (!disabled) {
        isSliding.value = false;

        if (position.value > END_POSITION * 0.7) {
          // Slide to the endpoint and call onSlideComplete
          position.value = withSpring(END_POSITION, {damping: 15}, () => {
            runOnJS(handleComplete)();

            // Use withDelay to reset the position after a delay
            position.value = withDelay(
              1000, // Delay in milliseconds
              withTiming(0, {duration: 200}),
            );
          });
        } else {
          // Reset to starting position if not past threshold
          position.value = withTiming(0, {duration: 200});
        }
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: position.value}],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      position.value,
      [0, END_POSITION * 0.5],
      [1, 0],
    );
    return {
      opacity,
    };
  });

  return (
    <View
      style={[
        styles.sliderContainer,
        {backgroundColor: disabled ? '#cccccc' : backgroundColor}, // Dim background if disabled
      ]}>
      {loading ? (
        selectedVariant === 'magnus' ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Loader color={'#fff'} width={25} height={25} />
        )
      ) : (
        <>
          <Animated.Text
            style={[
              styles.sliderText,
              {color: disabled ? '#aaaaaa' : textColor}, // Dim text if disabled
              textAnimatedStyle,
            ]}>
            {text}
          </Animated.Text>
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                styles.swipeBtn,
                animatedStyle,
                {backgroundColor: disabled ? '#dddddd' : 'transparent'}, // Dim button if disabled
              ]}>
              <ChevronRight
                size={20}
                color={disabled ? '#aaaaaa' : 'grey'}
                style={{marginRight: -12}}
              />
              <ChevronRight
                size={20}
                color={disabled ? '#aaaaaa' : '#fff'}
                style={{margin: 0}}
              />
            </Animated.View>
          </GestureDetector>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sliderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    height: 35,
    overflow: 'hidden',
    borderRadius: 15,
  },
  sliderText: {
    color: '#fff',
    fontSize: 16,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',

    fontFamily: 'Satoshi-Medium',
  },
  swipeBtn: {
    width: 30,
    height: 30,
    flexDirection: 'row',
    position: 'absolute',
    left: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    zIndex: 1,
  },
});

export default SliderButton;
