import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal,Dimensions, ActivityIndicator } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import axios from 'axios';
import { XIcon } from 'lucide-react-native';

// YouTube API Key and Channel ID
const API_KEY = 'AIzaSyCnsA2NAIZ2XeXDFcGC9BHNO1KUeV7U5Ck';  // Replace with your YouTube API key
const CHANNEL_ID = 'UCmzr8eYNcUvJjiaRgvruV8A';    // Replace with the desired YouTube channel ID
const { width, height } = Dimensions.get('window');
const AllEducationalVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);  // Add loading state
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const channelResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`
        );
        const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        const videosResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${API_KEY}`
        );
        
        const videoItems = videosResponse.data.items;
        const videoIds = videoItems.map(item => item.snippet.resourceId.videoId).join(',');
        const videoDetailsResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${API_KEY}`
        );
        
        const videosWithDetails = videoDetailsResponse.data.items.map(item => ({
          id: item.id,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium.url,
          publishedAt: item.snippet.publishedAt,
          views: item.statistics.viewCount
        }));
        setVideos(videosWithDetails);
      } catch (error) {
     //   console.error('Error fetching video data:', error);
      } finally {
        setLoading(false);  // Stop loading once the data is fetched
      }
    };

    fetchVideos();
  }, []);

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
    <TouchableOpacity style={{marginBottom:10,}} activeOpacity={0.9} onPress={() => setSelectedVideo({ id: item.id, title: item.title })}>
      <View style={styles.videoCard}>
        <Image style={styles.videoThumbnail} source={{ uri: item.thumbnail }} />
        <View style={styles.videoInfo}>
          <View>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.videoTitle}>{item.title}</Text>
            <Text style={styles.videoDetails}>
              {item.views ? `${item.views} Views` : 'Loading...'} • {getTimeAgo(item.publishedAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
 

      {loading ? (  // Show loading spinner if data is still being fetched
        <ActivityIndicator size="large" color="#4B8CEE" />
      ) : (
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.videoList}
        />
      )}

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
  videoList: {
    paddingHorizontal: 0,
    
  },
  videoCard: {
    color:'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 0,
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
    fontFamily:'Poppins-Medium',
    fontWeight: 'normal', 
    color: 'black',
  },
  videoDetails: {
    fontSize: 12,
    color: '#888',
    fontFamily:'Poppins-Light'
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    width: '100%',
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

export default AllEducationalVideos;
