import React from 'react';
import { View, Text, StyleSheet, Image, FlatList ,TouchableOpacity, SafeAreaView} from 'react-native';
import { Calendar, ReplyIcon,ChevronLeft, Navigation } from "lucide-react-native";
import { useNavigation } from '@react-navigation/native';
const Alpha100 = require('../assets/alpha-100.png');
const NotificationListScreen = () => {
  // Sample data, replace with real data from your backend or state
  const notifications = []; // Set this to [] to see the empty state
  const navigation = useNavigation();
  const renderNotificationItem = ({ item }) => (
    <SafeAreaView style={styles.notificationItem}>
      <View style={styles.iconRow}>
        <Image source={Alpha100} style={styles.flameIcon} />
        <Text style={styles.slash}>/</Text>
      </View>
      <Text style={styles.notificationText}>{item.message}</Text>
    </SafeAreaView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateText}>No notifications available</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Title */}
      <View style={{flexDirection:'row',alignContent:'center',alignItems:'center',borderBottomColor:'#00000033',borderBottomWidth:1,paddingVertical:15}}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
      <ChevronLeft
        style={{
          alignContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
          marginRight: 10,
        }}
        size={20}
        color={'black'}
      />
    </TouchableOpacity>
      <Text style={styles.title}>Notification Screen</Text>
      </View>
     

      {/* Notification List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item, index) => index.toString()}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Background color
    paddingTop: 20, // Adjust padding as needed for title spacing
  },
  title: {
    fontSize: 20, // Title font size
    fontFamily:'Satoshi-Medium',
    color: '#000', // Title color
    textAlign: 'center', // Space between title and list
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, // Padding around each notification
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0', // Divider between items
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8, // Space between icon row and text
  },
  flameIcon: {
    width: 20, // Adjust width as per icon size
    height: 20, // Adjust height as per icon size
    resizeMode: 'contain',
  },
  slash: {
    fontSize: 20, // Slash font size
    color: '#333333',
    marginLeft: 4, // Adjust spacing between flame icon and slash
  },
  notificationText: {
    fontSize: 18,
    color: '#333333',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50, // Adjust for spacing
  },
  emptyStateText: {
    fontSize: 18,
    color: '#999999',
  },
  listContent: {
    paddingBottom: 20, // Extra space at the bottom for the list
  },
  emptyListContent: {
    flexGrow: 1, // Center empty state in the list
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationListScreen;
