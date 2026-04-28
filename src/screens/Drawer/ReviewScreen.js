import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions
} from 'react-native';
import { ChevronLeft, Filter,AlignLeft } from 'lucide-react-native';
import  AntDesign from 'react-native-vector-icons/AntDesign'; 
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Dropdown } from 'react-native-element-dropdown';

const { width: screenWidth } = Dimensions.get('window');
const dummyReviews = [
  {
    id: '1',
    name: 'Akshata Kenjale',
    avatar:  require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '3 hours ago',
  },
  {
    id: '2',
    name: 'Aman Singh',
    avatar:  require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '6 hours ago',
  },
  {
    id: '3',
    name: 'Om Rai',
    avatar:  require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '10 hours ago',
  },
  {
    id: '4',
    name: 'Krunalee Rane',
    avatar:  require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '1 day ago',
  },
  {
    id: '5',
    name: 'Bhushan Jagdale',
    avatar: require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '1 day ago',
  },
  {
    id: '6',
    name: 'Krunalee Rane',
    avatar:  require('../../assets/default.png'), // Replace with actual image paths
    rating: 4,
    review:
      'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
    timeAgo: '1 day ago',
  },
];

const ReviewScreen = () => {
  const [selectedValue, setSelectedValue] = useState('newest');
const navigation = useNavigation();

const [value, setValue] = useState(null);
const [data, setData] = useState([
  { label: 'Newest to Oldest', value: 'newest' },
  { label: 'Oldest to Newest', value: 'oldest' },
]);

  const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <AntDesign
          key={i}
          name="star"
          size={16}
          color={i < rating ? '#FFCE31' : '#E0E0E0'}
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={styles.starRating}>{stars}</View>;
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <Image source={item.avatar} style={styles.avatar} />
        <View style={styles.reviewInfo}>
          <Text style={styles.name}>{item.name}</Text>
          {renderStarRating(item.rating)}
        </View>
        <Text style={styles.timeAgo}>{item.timeAgo}</Text>
      </View>
      <Text style={styles.reviewText}>
        "{item.review}"
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ARFS FNO LITE Reviews</Text>
      </View>

      <View style={styles.sortDropdownContainer}>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={{fontSize:11,fontFamily:'Poppins-Regular',color:'black'}}
          selectedTextStyle={{fontSize:11,fontFamily:'Poppins-Regular',color:'black'}}
          inputSearchStyle={{color:'black',fontSize:11}}
          iconStyle={styles.iconStyle}
          data={data}
          
          search={false}
          itemTextStyle={{color:'black',fontSize:11}}
          labelField="label"
          valueField="value"
          placeholder="Sort by : Newest to Oldest"
          searchPlaceholder="Search..."
          value={value}
          onChange={item => {
            setValue(item.value);
            // Implement your sorting logic here based on item.value
          }}
          renderLeftIcon={() => <AlignLeft style={{marginRight:10}} size={20} color={'black'}/>}
        />
      </View>

      <FlatList
        data={dummyReviews}
        renderItem={renderReviewItem}
        keyExtractor={(item) => item.id}
        style={styles.reviewList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop:20,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    alignContent:'center',


    paddingHorizontal:10,
  },
  backButton: {
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily:'Satoshi-Bold',
    color: 'black',
  },
  sortDropdownContainer: {

  },
  sortIconContainer: {
    marginRight: 8,
  },
  dropdown: {
    width:screenWidth-80,
    marginLeft:10,
    marginBottom:10,
    color:'black',
    paddingHorizontal:5,
    borderColor: '#0000001A',
    borderWidth:1,
    backgroundColor:'#FFF',
    borderRadius: 4,
    paddingVertical:7,


  },
  placeholderStyle: {
    fontSize: 14,
    color: '#757575',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#333',
  },
  reviewList: {
    flex: 1,
    paddingHorizontal:10,
  },
  reviewItem: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 15,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  reviewInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
  },
  starRating: {
    flexDirection: 'row',
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 12,
    color: '#757575',
  },
  reviewText: {
    fontSize: 14,
    color: 'black',
    lineHeight: 20,
    marginLeft: 50,
  },
});

export default ReviewScreen;