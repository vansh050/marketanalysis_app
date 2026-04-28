import React, { useState,useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { Coins, X } from 'lucide-react-native';
import RazorpayCheckout from "react-native-razorpay";
import AwesomeAlert from 'react-native-awesome-alerts';
import Coin from '../../assets/coin.svg';
import Config from "react-native-config";
import { useTrade } from '../TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
const { width } = Dimensions.get('window');
const COIN_SIZE = (width - 80) / 2;



const CoinAnimation = ({ isSelected, children }) => {
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const [stars, setStars] = useState([]);

  React.useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.timing(flipAnimation, {
          toValue: 1,
          duration: 600,
          easing: Easing.bounce,
          isInteraction:true,
          useNativeDriver: true,
          
        }),
      ]).start(() => generateStars()); // Generate stars after flip
    } else {
      flipAnimation.setValue(0);
    }
  }, [isSelected]);

  const spin = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "180deg", "360deg"],
  });

  const scale = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 1],
  });

  const generateStars = () => {
    const newStars = Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      animation: new Animated.Value(0),
    }));

    setStars(newStars);

    newStars.forEach((star) => {
      Animated.timing(star.animation, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        isInteraction:true,
        useNativeDriver: true,
      }).start(() => {
        setStars((prevStars) => prevStars.filter((s) => s.id !== star.id));
      });
    });
  };

  return (
    <View style={{ position: "relative" }}>
      <Animated.View
        style={{
          transform: [{ rotateY: spin }, { scale }],
        }}
      >
        {children}
      </Animated.View>

      {/* Star Effects */}
      {stars.map((star, index) => {
        const translateY = star.animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -40], // Move upwards
        });

        const opacity = star.animation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0], // Fade out
        });

        const translateX = (index % 2 === 0 ? -1 : 1) * Math.random() * 20;

        return (
          <Animated.Text
            key={star.id}
            style={{
              position: "absolute",
              top: 10,
              left: 10 + Math.random() * 20,
              fontSize: 12,
              color: "#FFD700",
              opacity,
              transform: [{ translateY }, { translateX }],
            }}
          >
            ★
          </Animated.Text>
        );
      })}
    </View>
  );
};
const TokenPurchaseModal = ({setShowFailAlert,setselectedCoin,setModalVisible,setShowAlert, userEmail,visible, PurchaseToken}) => {
  const { configData } = useTrade();
  const [selectedCoin, setSelectedCoin] = useState(null);

  const coins = [
    { id: "1", TokenAmount: 10, price: 50 },
    { id: "2", TokenAmount: 20, price: 100 },
    { id: "3", TokenAmount: 50, price: 400 },
    { id: "4", TokenAmount: 100, price: 800 },
    { id: "5", TokenAmount: 500, price: 3000 },
    
  ];

  const handleCoinSelect = (coin) => {
    setSelectedCoin(coin);
  };
  const generateOrderId = () => `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;


  const handlePayNow = () => {
    if (!selectedCoin) {
      Alert.alert("Error", "Please select a token package first.");
      return;
    }
    const { TokenAmount, price } = selectedCoin;
    // Razorpay payment options
    var options = {
      description: `Purchase ${TokenAmount} tokens`,
      image: "https://your-logo-url.com/logo.png",
      currency: "INR",
      key: Config.REACT_APP_RAZORPAY_LIVE_API_KEY, // Replace with your Razorpay Key
      amount: price * 100, // Razorpay uses paise (1 INR = 100 paise)
      name: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || configData?.appName || getAdvisorSubdomain(),
    
      prefill: {
        email: userEmail,
        contact: "9999999999",
        name: "Ritik Yadav",
      },
      theme: { color: "#F2BC1A" },
    };

    RazorpayCheckout.open(options)
      .then((data) => {
        // Payment Success
        setShowAlert(true); // Show success alert
        console.log('Payment Data:',data);
       // Alert.alert("Success", `Payment ID: ${data.razorpay_payment_id}`);
       setselectedCoin(TokenAmount);
        PurchaseToken(userEmail,TokenAmount, 100); // Add tokens to user account
        setModalVisible(false);
      })
      .catch((error) => {
        // Payment Failed
        console.log('rorrr',error);
        setselectedCoin(TokenAmount);
        setShowFailAlert(true);
       // Alert.alert("Payment Failed", error.description);
      });
  };





  const renderCoin = ({ item }) => {
    const isSelected = selectedCoin?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.coinButton,
          isSelected && styles.selectedCoin,
        ]}
        onPress={() => handleCoinSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.coinCircle, isSelected && styles.selectedCoinCircle]}>
        <CoinAnimation isSelected={isSelected}>   
        <View style={styles.coinContainer}>
<Coin width={40} height={40} />
<Text style={[styles.tokenAmount, isSelected && styles.selectedText]}>
{item.TokenAmount}
</Text>
</View>


        </CoinAnimation>

       
        </View>
      
        <Text style={[styles.price, isSelected && styles.selectedTextprice]}>
          ₹{item.price}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Tokens</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <X size={20} color="#666666" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={coins}
            keyExtractor={(item) => item.id}
            renderItem={renderCoin}
            numColumns={4}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />

          <TouchableOpacity
            style={[
              styles.payButton,
              !selectedCoin && styles.payButtonDisabled
            ]}
            onPress={handlePayNow}
            disabled={!selectedCoin}
          >
            <Text style={styles.payButtonText}>
              {selectedCoin 
                ? `Pay ₹${selectedCoin.price}`
                : 'Select Token'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  row: {
    justifyContent: "space-between",
    },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  listContainer: {
    paddingVertical: 8,
  },
  coinButton: {
    alignItems: 'center',
    padding: 8,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  selectedCoin: {
    backgroundColor: '#e9e9e9',
  },
  coinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9e9e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedCoinCircle: {
    backgroundColor: '#e9e9e9',
    borderColor: '#F4B400',
  },
  coinContainer: {
    width: 40,  // Same as Coin width
    height: 40, // Same as Coin height
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  tokenAmount: {
    position: "absolute",
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",  // Adjust color based on the Coin background
    textAlign: "center",
  },
  price: {
    fontSize: 12,
    color: '#666666',
    fontFamily:'Satoshi-Bold',
  },
  selectedText: {
    color: '#fff',
    fontFamily:'Satoshi-Bold',
  },
  selectedTextprice: {
    color: '#000',
    fontFamily:'Satoshi-Bold',
    fontSize:14,
    
  },
  payButton: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  payButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});


export default TokenPurchaseModal;
