import { useEffect,useState } from 'react';

import { View, Text, Image, StyleSheet,Dimensions } from 'react-native';
const screenWidth = Dimensions.get('window').width;
import { FadeLoading } from 'react-native-fade-loading';
const NewsCard = ({ title, image, time }) => {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    // Simulating a delay to show loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Adjust the time as needed

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.newsItem}>
      {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.2, height: 65,}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <Image source={image} style={styles.newsImage} />
          )}
     
      <View style={{ flex: 1, paddingLeft: 10 }}>

      {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.2, height: 5,}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <Text style={styles.newsTime}>{time}</Text>
          )}

{isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.5, height: 10,marginTop:5}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
          
        <Text numberOfLines={2} style={styles.newsTitle}>{title}</Text>
          )}
       
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  newsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#00000010',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    paddingHorizontal:15,
    padding:3,
    paddingVertical:8,
    elevation:2,
    shadowColor:'3px 6px 30x rgba(0,0,0,0.2)',
    shadowRadius: 4,
    marginHorizontal:5,
    width: screenWidth * 0.93,// Use percentage for responsiveness
  
  },
  newsImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  newsTime: {
    fontFamily:'Poppins-Regular',
    fontSize: 12,
    color: '#888',
  },
  newsTitle: {
    fontSize: 14,
    fontFamily:'Poppins-Regular',

    color: '#333',
  },
});

export default NewsCard;
