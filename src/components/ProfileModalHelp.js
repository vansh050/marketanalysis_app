import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Alert, ScrollView,FlatList, Pressable} from 'react-native';

import Modal from 'react-native-modal';
import YoutubePlayer from "react-native-youtube-iframe";
import { Collapse, CollapseHeader, CollapseBody } from "accordion-collapse-react-native";

import { CountryCode } from "../utils/CountryCode";
import { ChevronLeft, XIcon } from 'lucide-react-native';
import axios from 'axios';
import server from '../utils/serverConfig';
import Svg, { Circle } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import Toast from "react-native-toast-message";


const { height: screenHeight } = Dimensions.get('window');

const ProfileModalHelp = ({
  showModal,
  setShowModal,
  userEmail,
  getUserDeatils,
  userDetails,
}) => {
  const [playing, setPlaying] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [showCountryCode, setShowCountryCode] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState("");
  const [userPhoneNumber, setUserPhoneNumber] = useState("");
  const [userTelegram, setUserTelegram] = useState("");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
  const circumference = 2 * Math.PI * 35;


  const onStateChange = useCallback((state) => {
    if (state === "ended") {
      setPlaying(false);
      Alert.alert("Video has finished playing!");
    }
  }, []);

  const togglePlaying = useCallback(() => {
    setPlaying((prev) => !prev);
  }, []);

  const handleAccordionToggle = () => {
    setIsAccordionOpen(!isAccordionOpen);
  };
  const OpenHelpModal = () => {
    // console.log('modal:',helpVisible)
     setHelpVisible(true);
 
   };



  return (
    <Modal
      isVisible={showModal}
      onBackdropPress={() => setShowModal(false)}
      style={styles.modal}
      backdropOpacity={0.5}
      useNativeDriver
      hideModalContentWhileAnimating
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={['down']}
      onSwipeComplete={() => setShowModal(false)}
    >
   <View style={[styles.modalContent, { height: !userTelegram ? screenHeight / 1.5 : screenHeight / 1.8 }]}>
   <View style={{flexDirection:'row'}}>
   <ChevronLeft style={{top:2}} onPress={() => setShowModal(false)} size={24} color="grey"/>
   <Text style={{fontSize: 16,
    marginHorizontal:10,
    fontWeight: "Poppins-Bold",
    color: 'black',
    marginBottom: 15,}}>Steps to get Telegram Username</Text>
        <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
        <XIcon size={24} color="grey" />
        </TouchableOpacity>
   </View>
       
        <View style={{flex:1}}>
        <ScrollView>
          <Pressable>
          {1 && (
    <View style={styles.telegrambox}>
      <View style={styles.playerWrapper}>
        <YoutubePlayer
          height={200}
          width={350}
          play={playing}
          videoId={"S-F8R3ord3k"}
          onChangeState={onStateChange}
        />
      </View>
      <View style={styles.accordionContainer}>
        <Collapse isExpanded={1}>
          <CollapseHeader style={styles.header}>
 
          </CollapseHeader>
          <CollapseBody style={styles.accordionContent}>
            <Text style={{ fontSize: 16, lineHeight:20, justifyContent:'center', color:'#2b2b2b',fontFamily:'Poppins-Regular' }}>
              1. Log in to your Telegram account via Desktop or Mobile App.{"\n"}
              {"\n"}
              2. Click on the menu icon located at the top left corner and select "Settings."{"\n"}
              {"\n"}
              3. In the "My Account" menu, click on "t.me/username."{"\n"}
              {"\n"}
              4. Fill in username of your choosing, that is available.{"\n"}
              {"\n"}
              5. Click on "Save" to set your username.{"\n"}
              {"\n"}
              6. Provide this username in your telegram ID section on this page and save.
            </Text>
          </CollapseBody>
        </Collapse>
      </View>
    </View>
  )}
         
          </Pressable>
        </ScrollView>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight / 1.5,
    padding: 15,
  },
  circularWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  circularText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  circularProgressWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  playerWrapper: {
    overflow: 'hidden',
    marginTop: 20,
    alignSelf:'center',
    borderRadius: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf:'center',
    width: '90%',
    backgroundColor: '#000101',
    padding: 10,
    borderRadius: 8,
    marginBottom: 1,
  },
  addButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    alignSelf:'center',
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    right: 10,
  },
  scrollViewContent: {
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  accordionContainer: {
    width: '100%',
    marginTop: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft:30,
  },
  headerText: {
    fontFamily:'Poppins-Bold',
    color: 'black',
    fontSize: 17,

  },
  accordionContent: {
    fontFamily:'Poppins-Regular',
    fontSize: 16,
    marginTop:10,
    paddingHorizontal:10
  },
  profileCompletionContainer: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  profileCompletionText: {
    fontSize: 16,
    fontFamily:'Poppins-Bold',
    color:'black',
    alignSelf: 'flex-start',
    marginLeft: 30,
  },
  instructions: {
    fontSize: 14,
    color: '#777',
    fontFamily:'Poppins-Regular',
    paddingRight:150,
    marginBottom: 10,
    marginLeft: 30,

  },
  horizontal: {
    width: 110,
    height: 6,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
    marginBottom: 10,
  },
  input: {
    fontFamily:'Poppins-Regular',
    width: '90%',
    height: 50,
    borderColor: '#ccc',
    color:'#000101',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    alignSelf:'center',
    marginBottom: 15,
  },
  inputphn: {
    fontFamily:'Poppins-Regular',
    width: '67%',
    color:'#000101',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding:8,
    alignSelf:'center',
    marginBottom: 10,
  },
  countryCodeButton: {
    flexDirection:'row',
    width: '20%',
    height: 40,
    
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    alignItems: 'flex-start',
    marginRight: 10,
  },
  countryCodeText: {
    fontFamily:'Poppins-Regular',
    fontSize: 16,
    color:'#000101',
  },
  countryCodeList: {
    fontFamily:'Poppins-Regular',
    width: '70%',
    position: 'absolute',
    top: 55,
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    zIndex: 999,
  },
  searchInput: {
    fontFamily:'Poppins-Bold',
    height: 40,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
    padding: 10,
  },
  countryCodeScrollView: {
    maxHeight: 150, // Adjust based on the number of items you expect
  },
  countryCodeItem: {
    padding: 10,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
});

export default ProfileModalHelp;
