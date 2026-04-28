import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Pencil } from 'lucide-react-native';
import CustomToolbar from '../components/CustomToolbar';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();

  const daySuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${daySuffix(day)} ${month} ${year}`;
};

const BrokerConnectCard = ({ isBrokerConnected, openModal, brokername, createdDate }) => {
  return (
    <View>

    <View style={styles.cardContainer}>
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.detailLabel1}>Created Date :</Text>
          <Text style={styles.detailLabel2}>Broker :</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.detailValue}>{formatDate(createdDate)}</Text>
          <View style={styles.brokerInput}>
            <Text style={styles.detailValueBtn}>{brokername}</Text>
            <TouchableOpacity style={styles.editIcon} onPress={openModal}>
              <Pencil size={screenWidth * 0.048} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    height: screenHeight * 0.2,
    backgroundColor: '#f2f2f2',
    padding: screenWidth * 0.04,
    borderRadius: 10,
    shadowColor: '#000',
    alignContent:'center',
    justifyContent:'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: screenWidth * 0.9,
    alignSelf: 'center',
    marginVertical: screenHeight * 0.02,
  },
  row: {
    
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    justifyContent: 'center',
  },
  detailLabel1: {
    fontSize: screenWidth * 0.038,
    fontFamily:'Poppins-Regular',
    color: 'black',
  },
  detailLabel2: {
    fontSize: screenWidth * 0.038,
    fontFamily:'Poppins-Regular',
    color: 'black',
    paddingVertical:10,
    marginTop: screenHeight * 0.02,
  },
  detailValue: {
    fontSize: screenWidth * 0.038,
    fontFamily:'Poppins-Medium',
    color: '#333',
  },
  detailValueBtn: {
    fontSize: screenWidth * 0.038,
    fontFamily:'Poppins-Medium',
    color: 'black',
  },
  brokerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth:1,
    borderColor:'#ccc',
    borderBottomWidth:1,
    paddingVertical:10,
    justifyContent:'space-between',
    marginTop: screenHeight * 0.02,
  },
  editIcon: {
    marginLeft: screenWidth * 0.02,
  },
  line2: {
    height: 1,
    backgroundColor: '#ccc',
    marginTop: screenHeight * 0.01,
    width: '55%',
    alignSelf: 'flex-end',
  },
});

export default BrokerConnectCard;
