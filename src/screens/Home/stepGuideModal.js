import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Pressable } from 'react-native';
import Modal from 'react-native-modal';
import { XIcon } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

const step1 = require('../../assets/step-1.png');
const step2 = require('../../assets/step-2.png');
const step3 = require('../../assets/step-3.png');
const step4 = require('../../assets/step-4.png');
const step5 = require('../../assets/step-5.png');

const StepGuideModal = ({ showStepGuideModal, setShowStepGuideModal }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 830;

  const steps = [
    { number: '01', image: step1, title: 'Review Buy Advice', description: 'Assess each recommendation from your advisor.' },
    { number: '02', image: step2, title: 'Decide and Place Orders', description: 'Choose which advices to accept and execute the buy orders.' },
    { number: '03', image: step3, title: 'Hold Stocks', description: 'Keep the purchased stocks in your portfolio.' },
    { number: '04', image: step4, title: 'Monitor for Sell Advice', description: 'Wait for the sell advices from your advisor.' },
    { number: '05', image: step5, title: 'Book Profit/Loss', description: 'Sell stocks based on the advisor\'s recommendations and current market conditions.' },
  ];

  return (
    <Modal
    isVisible={showStepGuideModal}
    onBackdropPress={() => setShowStepGuideModal(false)}
    style={styles.modal}
    backdropOpacity={0.5}
    useNativeDriver
    hideModalContentWhileAnimating
    animationIn="slideInUp"
    animationOut="slideOutDown"
    swipeDirection={['down']} // Enables swiping down to close
    onSwipeComplete={() => setShowStepGuideModal(false)} 
    >
      <View style={styles.modalContent}>
        <TouchableOpacity onPress={() => setShowStepGuideModal(false)} style={styles.closeButton}>
          <XIcon size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.horizontal} ></View>
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <Pressable>
        <Text style={styles.modalTitle}>
          Maximize Your Investment Success. Steps to Follow:
        </Text>
          <View style={[styles.stepsContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            {steps.map((step, index) => (
              <View key={index} style={[styles.stepWrapper, { flexDirection: isDesktop ? 'column' : 'row' }]}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>{step.number}</Text>
                  <Image source={step.image} style={styles.stepImage} />
                  {index < steps.length - 1 && <View style={styles.verticalLine}></View>}
                </View>
                <View style={styles.stepTextContainer}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },

  horizontal:{
    width:110,
    height:6,
    borderRadius:250,
    alignSelf:'center',
    backgroundColor:'#f1f4f8',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight / 1.7, // Half of the screen height
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalTitle: {
    textAlign: 'center',
    color: '#00000080',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Poppins',
    lineHeight: 22,
    marginBottom: 5,
  },
  scrollViewContent: {
    paddingVertical: 10,
  },
  stepsContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stepWrapper: {
    alignItems: 'flex-start',
    padding: 1,
    width: '100%', // Make sure the wrapper takes full width
  },
  stepNumberContainer: {
    alignItems: 'center', // Center items horizontally
    marginBottom: 0,
  },
  stepNumber: {
    backgroundColor: 'transparent',
    color: '#23a48d',
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: 'Poppins',
    lineHeight: 45,
    marginBottom: 5, // Space between number and image
  },
  stepImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain', // Ensure the image fits within the container
  },
  verticalLine: {
    width: 2,
    height: 50,
    backgroundColor: '#c4c4c7',
    marginTop: 5,
  },
  stepTextContainer: {
    marginTop:5,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  stepTitle: {
    color: '#23a48d',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 25,
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
  stepDescription: {
    color: '#000',
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 25,
    marginTop:10,
    marginRight: 19,
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
});

export default StepGuideModal;
