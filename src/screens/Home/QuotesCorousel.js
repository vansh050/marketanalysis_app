import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';

const { width } = Dimensions.get('window'); // Get the width of the screen

// Sample quotes
const quotes = [
  "Money moves from the impatient to the patient.",
  "Save first, spend later.",
  "Knowledge is the best investment."
];


const HomeCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(-1); // Start from index 0
  const translateX = useState(new Animated.Value(0))[0]; // Animated value for horizontal movement
  const itemWidth = 250; // Define the width of each carousel item

  useEffect(() => {
    const interval = setInterval(() => {
      //  console.log('indexsdd:',activeIndex);
      setActiveIndex((prevIndex) => {
        if (prevIndex === 1) return -1; // Move to the first item after the last one
        return prevIndex + 1; // Move to the next item
      });
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval); // Clear interval on unmount
  }, []);

  useEffect(() => {
    // Ensure the translateX value moves the carousel by the width of each item
    Animated.spring(translateX, {
      toValue: -activeIndex * itemWidth, // Moves the carousel by item width (e.g., 250px) each time
      useNativeDriver: true,
    }).start();
  }, [activeIndex]);

  return (
    <View style={styles.carouselContainer}>
      <Animated.View
        style={[
          styles.carouselWrapper,
          { transform: [{ translateX }] },
        ]}
      >
        
        {quotes.map((quote, index) => {
          const opacity = activeIndex === index-1 ? 1 : 0.2;
          return (
            <Animated.View
              key={index}
              style={[
                styles.itemContainer,
                { opacity }, // Apply opacity to each item
              ]}
            >
                <View style={{backgroundColor:'#000',padding:8, opacity:0.1 ,position:'absolute',left:0,borderTopRightRadius:20,borderBottomRightRadius:20}}>

</View>
<View style={{backgroundColor:'#000',padding:8, opacity:0.1 ,position:'absolute',right:0,borderTopLeftRadius:20,borderBottomLeftRadius:20}}>

</View>
              <Text style={styles.quoteText}>{quote}</Text>
            </Animated.View>
          );
        })}
      
      </Animated.View>
      <View style={styles.dotsContainer}>
        {quotes.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: activeIndex === index-1 ? 7:5,
                height: activeIndex === index-1 ? 7:5,
                opacity: activeIndex === index-1 ? 1 : 0.3, // Change opacity based on active index
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  
    overflow: 'hidden', // Prevent overflow of items when translating
  },
  dotsContainer: {
    flexDirection: 'row',
    alignContent:'center',
    alignItems:'center',
    justifyContent: 'center',
    marginTop: 10, // Space between carousel and dots
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5, 
    backgroundColor: '#fff',
    marginHorizontal: 5, 
  },
  carouselWrapper: {
    
    flexDirection: 'row', 
  },
  itemContainer: {
    width: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#9D2115',
    borderRadius: 30,
    elevation:4,
    height: 150,
    paddingHorizontal:20,
    marginHorizontal: 5, 
  },
  quoteText: {
    fontSize: 12,
    fontStyle:'italic',
    textAlign: 'center',
    color: '#fff',
    fontFamily:'Satoshi-Regular'
  },
});

export default HomeCarousel;
