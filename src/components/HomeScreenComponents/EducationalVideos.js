import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal,useWindowDimensions, ActivityIndicator,Dimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import axios from 'axios';
import { XIcon } from 'lucide-react-native';
import { FadeLoading } from 'react-native-fade-loading';
import { useTrade } from '../../screens/TradeContext';
import APP_VARIANTS from '../../utils/Config';

const { width, height } = Dimensions.get('window');
const screenWidth = Dimensions.get('window').width;

const screenHeight = Dimensions.get('window').height;
// YouTube API Key and Channel ID
const API_KEY = 'AIzaSyCnsA2NAIZ2XeXDFcGC9BHNO1KUeV7U5Ck';  // Replace with your YouTube API key
const CHANNEL_ID = 'UCmzr8eYNcUvJjiaRgvruV8A';    // Replace with the desired YouTube channel ID

const EducationalVideos = ({type,visible,setOpenvideos}) => {
    const { setVideos,videos,fetchContent,isDatafetchingvideos } = useTrade();
  const { width: screenWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);  // Add loading state
  const [selectedVideo, setSelectedVideo] = useState(null);

  
  //console.log('Videos:',videos);
  const onStateChange = (state) => {
    if (state === 'ended') {
      setSelectedVideo(null);
    }
  };
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const videoDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - videoDate) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
      const count = Math.floor(diffInSeconds / interval.seconds);
      if (count > 1) {
        return `${count} ${interval.label}s ago`;
      } else if (count === 1) {
        return `${count} ${interval.label} ago`;
      }
    }

    return 'just now';
  };

  const renderItem = ({ item }) => (
   // console.log('videos Item:',item),
    <TouchableOpacity style={{marginBottom:10}} activeOpacity={0.9} onPress={() => setSelectedVideo({ id: item.video_id, title: item.title })}>
      <View style={[styles.videoCard,{ width: type === 'allhomevideos' ? width : 300 }]}>
        <Image style={styles.videoThumbnail} source={{ uri: item.thumbnail_url }} />
        <View style={styles.videoInfo}>
          <View>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.videoTitle}>{item.title}</Text>
            <Text style={styles.videoDetails}>
                  {getTimeAgo(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (

   <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    >
    <View style={styles.modalOverlay} >
      <View style={[styles.modalContainer]}>

    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',alignContent:'center',paddingHorizontal:20,paddingVertical:15,borderBottomWidth:1,marginBottom:10,borderColor:'#ccc'}}>

<View style={styles.header}>
<Text style={styles.headerTitle}>Educational Videos</Text>
</View>
  <XIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} onPress={()=>setOpenvideos(false)} size={15} color={'#000'}/>
    </View>

    <View style={styles.container}>
   
        <FlatList
          data={[]}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal={type==='homevideos'}
          style={{  alignContent:'center',
            }}
          ListEmptyComponent={() => (
            // isDatafetchingvideos ? (
            //   <View style={{ flexDirection: 'row' }}>
            //     <FadeLoading
            //       style={{ width: screenWidth * 0.5, height: 100, marginTop: 5, marginLeft: 10 }}
            //       primaryColor="#f0f0f0"
            //       secondaryColor="#e0e0e0"
            //       duration={500}
            //     />
            //     <FadeLoading
            //       style={{ width: screenWidth * 0.5, height: 100, marginTop: 5, marginLeft: 10 }}
            //       primaryColor="#f0f0f0"
            //       secondaryColor="#e0e0e0"
            //       duration={500}
            //     />
            //   </View>
            // ) :
            
            (
           
                <View style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  marginVertical: 30,
                  marginHorizontal: 20,
                  backgroundColor: APP_VARIANTS.EmptyStateUi.lightWarmColor, 
                  borderRadius: 16,
                  overflow: 'hidden',
                }}>
                  {/* Decorative background elements */}
                  <View style={{
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    backgroundColor: 'rgba(107, 20, 0, 0.08)', // #6B1400 with opacity
                  }} />
                  <View style={{
                    position: 'absolute',
                    bottom: -40,
                    left: -40,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: 'rgba(173, 66, 38, 0.06)', // Lighter shade of #6B1400
                  }} />
                  
                  {/* Icon container */}
                  <View style={{
                    width: 70,
                    height: 70,
                    borderRadius: 35,
                    backgroundColor: '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 20,
                    shadowColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }}>
                    <Text style={{ fontSize: 30 }}>🎬</Text>
                  </View>
                  
                  <Text style={{ 
                    fontFamily: 'Satoshi-Bold', 
                    fontSize: 18,
                    color: APP_VARIANTS.EmptyStateUi.darkerColor, // Darker shade of reference color
                    textAlign: 'center',
                    marginBottom: 10,
                  }}>
                    No Videos Available
                  </Text>
                  
                  <Text style={{
                    fontFamily: 'Satoshi-Medium',
                    fontSize: 14,
                    color: APP_VARIANTS.EmptyStateUi.mediumColor, // Medium shade of reference color
                    textAlign: 'center',
                    maxWidth: '90%',
                    lineHeight: 20,
                  }}>
                    We're curating video tutorials and masterclasses for you. Check back soon for fresh content!
                  </Text>
                  
                  {/* Visual indicators - video timeline style */}
                  <View style={{
                    flexDirection: 'row',
                    marginTop: 20,
                    alignItems: 'center',
                  }}>
                    <View style={{
                      width: 30,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                      marginHorizontal: 3,
                      opacity: 0.3,
                    }} />
                    <View style={{
                      width: 20,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                      marginHorizontal: 3,
                      opacity: 0.5,
                    }} />
                    <View style={{
                      width: 10,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                      marginHorizontal: 3,
                      opacity: 0.7,
                    }} />
                  </View>
                </View>
            )
          )}
          
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.videoList}
          
        />
      
      {selectedVideo && (
        <Modal  visible={true} transparent={true} onRequestClose={() => setSelectedVideo(null)}>
          <View style={styles.modalBackground}>
            <View style={styles.videoPlayerContainer}>
              <YoutubePlayer
                height={200}
                width={'100%'}
                play={true}
                videoId={selectedVideo.id}
                onChangeState={onStateChange}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>

    </View>
    </View>






    </Modal>
   
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical:10,
  },
  modalContainer: {
    backgroundColor:'#FFFEF7',
    borderTopRightRadius:20,borderTopLeftRadius:20,
    maxHeight:screenHeight,
 
  },
  modalOverlay: {
    flex: 1,
    alignContent:'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: 14,
    fontFamily:'Satoshi-Medium',
    color: '#666',
    marginBottom: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily:'Satoshi-Medium',
    textAlign: 'center',
 
  },
  containerEmpty: {
    paddingVertical:50,
    flex: 1, // Ensures it takes up the entire available space
    justifyContent: 'center', // Centers content vertically
    alignItems: 'center', // Centers content horizontally
    alignContent: 'center',
    backgroundColor: '#fDfDfD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    color: 'black',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: '#4B8CEE',
    marginRight: 10,
  },
  videoList: {
    paddingVertical:5,
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
  
  },
  videoCard: {
    color:'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    width: 300,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  videoThumbnail: {
    width: '100%',
    height: 150,
    borderRadius:10,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    color:'transparent'
  },
  videoTitle: {
    fontSize: 14,
    lineHeight: 15,
    fontFamily:'Satoshi-Medium',
    fontWeight: 'normal', 
    color: 'black',
  },
  videoDetails: {
    fontSize: 12,
    color: '#888',
    fontFamily:'Satoshi-Light'
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    width: '90%',
    backgroundColor: '#fff',
    height:'25%',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  closeButton: {
    padding: 10,
    backgroundColor: '#ff5c5c',
    width: '100%',
    alignItems: 'flex-end',
  },
  modalVideoTitle: {
    color: '#fff',
    fontSize: 14,
    marginRight:10,
    paddingVertical:5,
    paddingHorizontal:0,
    fontWeight: 'bold',
    marginBottom: 0,
  },
});

export default EducationalVideos;
