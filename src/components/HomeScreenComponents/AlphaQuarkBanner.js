import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import {useTrade} from '../../screens/TradeContext';
import ProfileModal from '../ProfileModal';
import LinearGradient from 'react-native-linear-gradient';
import Config from 'react-native-config';

const AlphaQuarkBanner = () => {
  const {
    stockRecoNotExecutedfinal,
    planList,
    recommendationStockfinal,
    isDatafetching,
    getAllTrades,
    rejectedTrades,
    ignoredTrades,
    userDetails,
    broker,
    brokerStatus,
    getUserDeatils,
    funds,
    getAllFunds,
    userEmail,
    configData,
  } = useTrade();
  const [modalVisible, setModalVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={styles.bannerContainer}>
        <LinearGradient
          colors={['#1A358C', '#2D5CF2']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.alphaQuarkBanner}>
          <Image
            source={require('../../assets/Alpha.png')}
            style={[styles.promoCardVectorImg]}
            resizeMode="cover"
          />
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>
                <Image source={require('../../assets/electric.png')} />
                {Config?.REACT_APP_WHITE_LABEL_TEXT
                  ? Config?.REACT_APP_WHITE_LABEL_TEXT
                  : configData?.appName || 'AlphaQuark'}
              </Text>
              <Text style={styles.bannerSubtitle}>Your Trading Companion</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={styles.profileButton}>
              <Text style={styles.profileButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Profile Modal */}
      <ProfileModal
        showModal={showModal}
        setShowModal={setShowModal}
        userEmail={userEmail}
        getUserDeatils={getUserDeatils}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    flex: 1,
  },
  bannerContainer: {
    marginBottom: 0,
  },
  alphaQuarkBanner: {
    borderRadius: 13,
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'white',
    marginBottom: 4,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 80,
    position: 'relative',
    paddingHorizontal: 16,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#ffffff',
    fontFamily: 'Poppins-Regular',
  },
  profileButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileButtonText: {
    fontSize: 12,
    color: '#2C5BEF',
    marginTop: 2,
    fontFamily: 'Poppins-SemiBold',
  },

  promoCardVectorImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  InvestCardVectorImg: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
});

export default AlphaQuarkBanner;
