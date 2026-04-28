import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

const VideoPlayer = ({ videoId }) => {
  const [playing, setPlaying] = useState(false);

  const onStateChange = (state) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  };

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={200}
        play={playing}
        videoId={videoId}
        onChangeState={onStateChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    height: 200,  // You can adjust this
    width: '100%', // Adjust width based on your layout
  },
});

export default VideoPlayer;
