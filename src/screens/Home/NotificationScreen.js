import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
// You can use other icon sets
import { CandlestickChartIcon,X,Check,Bike } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute} from '@react-navigation/native';

import { designColor } from '../../design/literalTokens';

const NotificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sdkEventType = route.params?.sdkEventType;
  const isSdkTrade = !!sdkEventType;
  const circumference = 2 * Math.PI * 35;
  return (
    <LinearGradient colors={[designColor('062a56'), designColor('002a5c'), designColor('ffffff')]} style={styles.linearGradient}>
      <View style={styles.MainContainer}>
      <View style={styles.topIconContainer}>
          <View >
          <Icon name="user" size={42} color={designColor('000')}  style={{
    borderWidth: 3,
    borderColor: 'green',
    borderRadius: 42 / 2 + 15, // Half the size of the icon plus padding
    padding: 15,
    justifyContent: 'center',
    backgroundColor:'white',
    alignItems: 'center',
    width: 42 + 30, // Icon size + padding * 2
    height: 42 + 30, // Icon size + padding * 2
  }} />
          </View>  
      </View>


      <View style={styles.notificationBox}>
        <View style={{flexDirection:'column',alignContent:'center',alignItems:'center'}}>
        <Text style={styles.notificationText}>
          {isSdkTrade
            ? (sdkEventType === 'order.checking_broker'
              ? 'Checking your broker — do not resubmit'
              : 'A time-sensitive trade update is ready')
            : 'You have a new recommendation'}
        </Text>
        <View style={styles.userInfo}>
          <View style={styles.details}>
            <Text style={styles.userName}>{isSdkTrade ? (route.params?.recommendationTitle || 'Unlock to review the frozen recommendation') : 'Open your notification centre'}</Text>
            {!!route.params?.broker && <Text style={styles.brokerName}>Broker: {route.params.broker}</Text>}
          </View>
        </View>
        </View>
        

        <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.denyButton} onPress={() => navigation.goBack()}>
          <X size={30} color={'white'}/>
          <Text style={styles.secondaryButtonText}>Ignore for now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.approveButton} onPress={() => navigation.navigate('PushNotificationScreen', {sdkEventId: route.params?.sdkEventId})}>
        <Check size={30} color={'white'}/>
          <Text style={styles.buttonText}>Review &amp; Approve</Text>
        </TouchableOpacity>
      </View>
      </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  MainContainer:{
    marginBottom:120,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation:5,
    justifyContent: 'center', // Vertically center the content
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('002a5c'),  // Adjust background color if needed
  },
  linearGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 15,
    borderRadius: 5
  },
  topIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    transform: [{ translateY: 45 },{translateX:0}],
    zIndex: 10, // Ensures it is above the card
  },
  topIconContainer1: {
    alignItems: 'center',
  },
  topIcon: {
    backgroundColor: designColor('fbc02d'),  // Yellow circle background
    padding: 15,
    borderRadius: 50,
  },
  notificationText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop:15,
    color:'grey',
    textAlign: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf:'center'
  },
  userImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  details: {
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color:'grey'
  },
  brokerName: {fontSize: 13, color: designColor('64748b'), marginTop: 6, textAlign: 'center'},
  companyLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  companyLogo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  notificationBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '85%',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '92%',
    transform: [{ translateY: 70 },{translateX:0}],
    zIndex: 10, // Ensures it is above the card
  },
  denyButton: {
    backgroundColor: designColor('eef2f6'),
    flexDirection: 'colum',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    width: 108,
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: designColor('43a047'),
    flexDirection: 'colum',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    minWidth: 156,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: designColor('64748b'),
    fontSize: 13,
  },
});

export default NotificationScreen;
