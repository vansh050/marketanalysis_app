import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity,Dimensions } from 'react-native';
import { Clock } from 'lucide-react-native';
const edu1= require('../../assets/edu1.png')
const edu2= require('../../assets/edu2.png')
const edu3= require('../../assets/edu3.png')
const { width, height } = Dimensions.get('window');
// Sample data
const blogs = [
  {
    id: '1',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  {
    id: '2',
    imageUrl: edu3,
    title: 'Agriculture News',
    timestamp: '10 mins ago',
  },
  {
    id: '3',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',

  },
  {
    id: '4',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  {
    id: '5',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  {
    id: '5',
    imageUrl: edu3,
    title: 'Agriculture News',
    timestamp: '10 mins ago',
  },
  {
    id: '6',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',

  },
  {
    id: '7',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  {
    id: '8',
    imageUrl: edu3,
    title: 'Agriculture News',
    timestamp: '10 mins ago',
  },
  {
    id: '9',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',
  },
  {
    id: '10',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',

  },
  {
    id: '11',
    imageUrl: edu3,
    title: 'Agriculture News',
    timestamp: '10 mins ago',
  },
  {
    id: '12',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  {
    id: '13',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',
  },
  {
    id: '14',
    imageUrl: edu2,
    title: "UBS fears slowdown in Indian pharma markets; gives 'Sell'",
    timestamp: '10 mins ago',

  },
  {
    id: '15',
    imageUrl: edu1,
    title: 'Natural gas prices dropped by 3.2% to settle at ₹193.9',
    timestamp: '10 mins ago',
  },
  // Add more blog entries as needed
];

const AllEducationalBlogs = () => {
  const renderItem = ({ item }) => (
    <View style={styles.blogCard}>
      <Image source={item.imageUrl} style={styles.blogImage} />
      <View style={styles.textOverlay}>
        <Text numberOfLines={2} style={styles.blogTitle}>{item.title}</Text>
        <View style={styles.timestampContainer}>
          <Clock size={16} color={'white'}/>
          <Text style={styles.timestampText}> {item.timestamp}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
  

      {/* Horizontal List of Blogs */}
      <FlatList
        data={blogs}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blogList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    
    marginHorizontal: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    marginBottom: 10,
    color: 'black',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4B8CEE',
    marginRight: 10,
  },
  blogList: {
    paddingHorizontal: 5,
  },
  blogCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    width: width/2-25,
    marginRight: 15,
    height:110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginBottom:10,
    elevation: 3, // For Android shadow
  },
  blogImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  blogContent: {
    padding: 10,
  },
  blogTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal:15,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',  // Dark overlay for text visibility
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  timestampText: {
    fontSize: 12,
    color: 'white',
    alignSelf:'flex-start',
    fontFamily: 'Poppins-Regular',
  },
});

export default AllEducationalBlogs;
