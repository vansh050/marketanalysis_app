import React from "react";
import { View, Text, Modal, TouchableOpacity, Image, StyleSheet,Dimensions } from "react-native";
import { X as XIcon } from "lucide-react-native"; // Adjust import if using another library
import Checked from "../../assets/checked.png"; // Adjust path as needed
const { height: screenHeight } = Dimensions.get('window');
const PaymentSuccessModal = ({
  visible,
  setPaymentSuccess,
  specificPlan,
  setSelectedCard,
  setPaymentModal,
  specificPlanDetails,
  setOpenSubscribeModel,
}) => {
  console.log('spoooss:',specificPlanDetails);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => setPaymentSuccess(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                setPaymentSuccess(false);
                setSelectedCard(null);
                setPaymentModal(false);
                console.log('Spedifgic:',specificPlanDetails);
                if (specificPlanDetails?.type === "model portfolio") {
                  setOpenSubscribeModel(true);
                }
              }}
              style={styles.closeButton}
            >
              <XIcon size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={{marginBottom:10,}}>
            <Image source={Checked} style={styles.successIcon} resizeMode="contain" />

            </View>
           
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successMessage}>
            Your payment for the <Text style={{color:'black',fontFamily:'Satoshi-Bold'}}>{specificPlan?.name}
              </Text> {specificPlan?.type === "model portfolio" ? "Model Portfolio " : "Bespoke Plan "} 
             has been processed successfully.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight / 2.1,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent:'flex-end',
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 16,
 
    borderBottomColor: "#E0E0E0",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Montserrat",
    color: "#000",
  },
  closeButton: {
    padding: 8,
    alignContent:'flex-end',
    alignItems:'flex-end',
    alignSelf:'flex-end'
  },
  body: {
    flex: 1,
    alignItems: "center",
  
    paddingHorizontal: 16,
  },
  successIcon: {
    width: 70,
    height: 70,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    color:'#000000CC',
    fontFamily: "Satoshi-Bold",
    marginBottom: 8,
    marginTop:15,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    fontFamily: "Satoshi-Regular",
    color: "#666666",
    textAlign: "center",
    maxWidth: 400,
    lineHeight: 24,
  },
});

export default PaymentSuccessModal;
