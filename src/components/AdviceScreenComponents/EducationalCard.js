
import React, {useState,useEffect} from 'react';
import { View, Text, Image, StyleSheet,TouchableOpacity,useWindowDimensions } from 'react-native';
import { FadeLoading } from 'react-native-fade-loading';


const EducationalCard = ({ title,image, content }) => {
  const { width: screenWidth } = useWindowDimensions(); 
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    // Simulating a delay to show loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Adjust the time as needed

    return () => clearTimeout(timeout);
  }, []);
  return (
    <View style={styles.card}>
      {/* Image section */}
      {isLoading ? (
            <FadeLoading
              style={{ width: 130, height: 110,padding:10}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <Image source={ image} style={styles.cardImage} />
          )}
      

      {/* Content section */}
      <View style={styles.contentContainer}>
        <View style={{}}>
        {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.2, height: 5,}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}

{isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.5, height: 10,marginTop:20}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <View style={{ flexDirection: 'column' }}>
                                <Text  style={{marginRight: 80, fontFamily: 'Satoshi-Light', fontSize: 12, color: '#858585',justifyContent:'flex-start' }}>
                                {content.substring(0, 50)}...
                                        <Text style={{fontFamily:'Satoshi-Regular', color: '#4B8CEE',padding:1}}>Read More</Text>
                                </Text>
              </View>

          )}
       
       
        </View>
      </View>
     
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 3,
    marginVertical: 5,
    marginHorizontal:10,
    flexDirection:'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    height: 110,
    width: 110,
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 12,
    flexDirection:'column',
    marginRight:45,
    justifyContent:'space-between',
  },
  title: {
    fontSize: 14,
    fontFamily:'Poppins-Medium',
    color: '#333',
    marginRight:65,
    justifyContent:'flex-start',
    textAlign:'left',
  },
  seeAllText: {
    fontSize: 13,
    color: '#079CA6',
    fontFamily:'Poppins-Regular',
    textDecorationLine: 'underline',
    marginRight: 10,
    textAlignVertical:'bottom',
  },
  content: {
    fontSize: 12,
    fontFamily:'Poppins-Regular',
    textAlign:'left',
    color: '#777',
  },
});

export default EducationalCard;
