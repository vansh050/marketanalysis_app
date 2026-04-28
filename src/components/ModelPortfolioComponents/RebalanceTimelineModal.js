import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons'; // For XIcon, use Ionicons
import { Circle, CheckCircle,CircleCheck } from "lucide-react-native"; // Icon library for check/circle icons
import moment from 'moment';

const RebalanceTimeLineModal = ({
  visible,
  closeRebalanceTimelineModal,
  strategyDetails,
}) => {
  const rebalanceTimelineData = strategyDetails?.model?.rebalanceHistory
    // Sort by date in ascending order (earliest to latest)
    .sort((a, b) => new Date(a.rebalanceDate) - new Date(b.rebalanceDate))
    // Map the sorted data to the required format
    .reverse()
    .map((rebalance, index, array) => {
      const date = moment(rebalance.rebalanceDate).format('MMM D, YYYY');
      const reversedIndex = array.length - index;
      return {
        text: `Rebalance ${reversedIndex}`,
        date: date,
        complete: true, // Assume all past rebalances are complete
      };
    });

  // Add the next review item at the beginning
  rebalanceTimelineData.unshift({
    text: 'Next Rebalance',
    date: moment(strategyDetails?.nextRebalanceDate).format('MMM D, YYYY'),
    complete: false, // Next review is pending
  });

  // Sample other historical events (hardcoded)
  rebalanceTimelineData.push({
    text: 'Strategy Went Live',
    date: moment(strategyDetails?.created_at).format('MMM D, YYYY'),
    complete: true,
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={closeRebalanceTimelineModal}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeRebalanceTimelineModal}
          >
            <Ionicons name="close" size={23} color={'black'} />
          </TouchableOpacity>

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.headerText}>Rebalance Timeline</Text>
          </View>

          {/* Rebalance Timeline List */}
          <ScrollView contentContainerStyle={styles.timelineContainer}>
            <View style={styles.stepsContainer}>
              {rebalanceTimelineData.map((item, index) => (
                <View key={index} style={styles.stepWrapper}>
                  <View style={styles.stepNumberContainer}>
                    {item.complete ? (
                  
                         <CircleCheck size={30} color={'white'} fill={'green'} />
                
                     
                    ) : (
                      <Circle size={30} color={'#ccc'} />
                    )}
                    {index < rebalanceTimelineData.length - 1 && (
                      <View style={styles.verticalLine}></View>
                    )}
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text style={styles.timelineText}>{item.text}</Text>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%', // Limit the modal height
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  modalHeader: {

    paddingBottom: 10,
    marginBottom: 20,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  timelineContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5, // Adjust padding for better alignment
  },
  stepsContainer: {
    flexDirection: 'column', // Ensure column layout for vertical steps
    alignItems: 'center',
    position: 'relative',
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginVertical: 15,
  },
  stepNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 15,
  },
  stepTextContainer: {
    flex: 1,
  },
  timelineText: {
    fontSize: 16,
    color: '#333',
  },
  timelineDate: {
    fontSize: 14,
    color: '#666',
  },
  verticalLine: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#ccc',
    top: 27, // Adjust this value to match the height between icons
    bottom: -80, // Adjust based on the vertical space between icons
    left: '50%', // Center it within the container
  },
});

export default RebalanceTimeLineModal;
