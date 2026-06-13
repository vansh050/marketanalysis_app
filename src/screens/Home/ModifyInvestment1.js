import React, { useState, useEffect,useRef } from 'react';
import Toast from 'react-native-toast-message';

import axios from 'axios';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { XIcon , AlertCircle } from 'lucide-react-native';
import { flattenDiagnosticMessageText } from 'typescript';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import { black } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';

const ModifyInvestment = ({
    modifyInvestmentModal,
    setModifyInvestmentModal,
    strategyDetails,
    userEmail,
    getStrategyDetails,
    amount,
    latestRebalance,
    userBroker
}) => {
  const {configData}=useTrade();

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#002651';
    const [portfolioAmount, setPortfolioAmount] = useState("");
    const [subscriptionAmountLoading, setSubscriptionAmountLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState("topup");
    const [totalAmount, setTotalAmount] = useState(0);
    const hasFetchedSubscriptionData = useRef(false);
    const [subscriptionAmount, setSubscriptionAmount] = useState(null);
    const [pnlData, setPnlData] = useState(null);
    const [pnlLoading, setPnlLoading] = useState(false);
    const [includePnl, setIncludePnl] = useState(false);

    useEffect(() => {
      setPortfolioAmount(amount);
      console.log("User Broker:", strategyDetails);
    }, [amount]);

    useEffect(() => {
      if (modifyInvestmentModal && strategyDetails?.model_name) {
        setPnlLoading(true);
        axios.get(
          `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(strategyDetails.model_name)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          }
        ).then(resp => {
          const data = resp.data?.data;
          if (data) {
            const netPf = data.user_net_pf_model;
            const latest = Array.isArray(netPf) && netPf.length > 0 ? netPf[netPf.length - 1] : null;
            const invested = parseFloat(latest?.subscriptionAmount || amount || 0);
            const holdings = latest?.stocks || [];
            const currentVal = holdings.reduce((sum, h) => {
              return sum + (parseFloat(h.qty || 0) * parseFloat(h.ltp || h.lastLtp || h.price || 0));
            }, 0);
            const grossPnl = currentVal - invested;
            const tradeCount = holdings.length * 2;
            const estCosts = tradeCount > 0
              ? (tradeCount * 20) + (currentVal * 0.001) + (currentVal * 0.0000297) + (tradeCount * 20 * 0.18)
              : 0;
            setPnlData({
              invested: Math.round(invested * 100) / 100,
              currentValue: Math.round(currentVal * 100) / 100,
              grossPnl: Math.round(grossPnl * 100) / 100,
              estimatedCosts: Math.round(estCosts * 100) / 100,
              netPnl: Math.round((grossPnl - estCosts) * 100) / 100,
            });
          }
        }).catch(() => setPnlData(null))
        .finally(() => setPnlLoading(false));
      }
    }, [modifyInvestmentModal, strategyDetails?.model_name]);
  


    const modifyInvestmentModalPortfolio = () => {
      setSubscriptionAmountLoading(true);
      const pnlAdjustment = includePnl && pnlData ? pnlData.netPnl : 0;
      const submitAmount = (selectedOption === "topup" ? totalAmount : Number(portfolioAmount)) + pnlAdjustment;

      let data2 = JSON.stringify({
        userEmail: userEmail,
        model: strategyDetails?.model_name,
        advisor: configData?.config?.REACT_APP_HEADER_NAME,
        model_id: latestRebalance.model_Id,
        userBroker: userBroker ? userBroker : "DummyBroker",
        subscriptionAmountRaw: [
          {
            amount: submitAmount,
            dateTime: new Date(),
          },
        ],
      });
  
      console.log("Data 2---",data2);
      let config2 = {
        method: "post",
        url: `${server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
          data:data2,
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
                  };
  
                  axios
                    .request(config2)
                    .then((response) => {
                      getStrategyDetails();
                      setSubscriptionAmountLoading(false);
                      setModifyInvestmentModal(false);
                      console.log("Response here1----",response);
                      Toast.show({
                        type: 'success',
                        text1: 'Investment updated successfully!',
                      });
                    })
                    .catch((error) => {
                      console.log(error);
                      setSubscriptionAmountLoading(false);
                      setModifyInvestmentModal(false);
                      Toast.show({
                        type: 'error',
                        text1: 'Failed to update investment.',
                        text2: error?.response?.data?.message || error.message || 'Please try again.',
                      });
                    });
                };
              
  



     const getLatestAmount = (subscriptionAmount) => {
    if (!subscriptionAmount?.subscription_amount_raw?.length) return null;

    const latestEntry = subscriptionAmount.subscription_amount_raw.reduce(
      (latest, entry) =>
        new Date(entry.dateTime) > new Date(latest.dateTime) ? entry : latest
    );

    return latestEntry.amount;
  };

  const investmentAmount = getLatestAmount(subscriptionAmount);
    const isConfirmDisabled = () => {
    const inputAmount = Number(portfolioAmount);
    const currentInvestment = Number(investmentAmount || 0);
    const calculatedTotal =
      selectedOption === "topup"
        ? currentInvestment + inputAmount
        : inputAmount;

    return (
      !portfolioAmount ||
      calculatedTotal < strategyDetails?.minInvestment ||
      calculatedTotal > strategyDetails?.maxNetWorth
    );
  };
  
    useEffect(() => {
      if (modifyInvestmentModal) {
        setPortfolioAmount("");
      }
    }, [modifyInvestmentModal]);
  
    useEffect(() => {
      const enteredAmount = Number.parseInt(portfolioAmount || "0")
      const currentInvestment = Number.parseInt(amount || "0")
  
      if (selectedOption === "topup") {
        setTotalAmount(currentInvestment + enteredAmount)
      } else {
        setTotalAmount(enteredAmount)
      }
    }, [portfolioAmount, selectedOption, amount])


      const getSubscriptionData = async () => {
    if (!userEmail || !strategyDetails || hasFetchedSubscriptionData.current)
      return;
    const modelName = strategyDetails?.model_name || strategyDetails?.name;
    try {
      const response = await axios.get(
        `${
          server.server.baseUrl
        }api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(
          userEmail
        )}&modelName=${encodeURIComponent(
          modelName
        )}&user_broker=${encodeURIComponent(userBroker || "")}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
            "aq-encrypted-key": generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );
      setSubscriptionAmount(response.data.data);
      hasFetchedSubscriptionData.current = true;
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    }
  };
  useEffect(() => {
    // Call getSubscriptionData when component mounts
    getSubscriptionData();
  }, []);
 return (
  <Modal
    visible={modifyInvestmentModal}
    transparent
    animationType="slide"
    onRequestClose={() => setModifyInvestmentModal(false)}
  >
    <SafeAreaView style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        {/* Close Button */}
        <TouchableOpacity
          onPress={() => setModifyInvestmentModal(false)}
          style={styles.closeButton}
        >
          <XIcon size={22} color="#444" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text style={[styles.headerText, {color: mainColor}]}>
            Modify Your Investment Allocation
          </Text>

          {/* Description */}
          <Text style={styles.descriptionText}>
            You currently have{" "}
            <Text style={styles.boldText}>₹{amount || "-"}</Text> invested in{" "}
            <Text style={styles.boldText}>
              {strategyDetails?.model_name}
            </Text>{" "}
            Model Portfolio.{"\n\n"}
            If you'd like to invest more on top of your existing amount, select{" "}
            <Text style={styles.boldText}>Top Up</Text> and enter only the
            additional amount (e.g. ₹50,000).{"\n"}
            If you wish to allocate the total amount from scratch, select{" "}
            <Text style={styles.boldText}>Full Amount</Text> and enter the
            entire investment value.
          </Text>

          {/* Alert */}
          {!portfolioAmount && (
            <View style={styles.alertContainer}>
              <AlertCircle size={18} color="#FF4D4F" />
              <Text style={styles.alertText}>
                Min. investment: ₹{strategyDetails?.minInvestment} | Max: ₹
                {strategyDetails?.maxNetWorth}
              </Text>
            </View>
          )}

          {/* Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              onPress={() => setSelectedOption("topup")}
              style={[
                styles.toggleButton,
                {borderColor: themeColor},
                selectedOption === "topup" && {backgroundColor: themeColor},
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  {color: themeColor},
                  selectedOption === "topup" && styles.toggleTextActive,
                ]}
              >
                Top Up
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedOption("full")}
              style={[
                styles.toggleButton,
                {borderColor: themeColor},
                selectedOption === "full" && {backgroundColor: themeColor},
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  {color: themeColor},
                  selectedOption === "full" && styles.toggleTextActive,
                ]}
              >
                Full Amount
              </Text>
            </TouchableOpacity>
          </View>

          {/* Investment Details */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Investment</Text>
            <Text style={styles.detailValue}>₹{amount}</Text>
          </View>

          {/* PnL Display */}
          {pnlLoading ? (
            <ActivityIndicator size="small" style={{marginVertical: 8}} />
          ) : pnlData ? (
            <View style={{marginVertical: 8}}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Portfolio Value</Text>
                <Text style={[styles.detailValue, {color: '#16a34a'}]}>₹{pnlData.currentValue?.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>P&L (net of costs)</Text>
                <Text style={[styles.detailValue, {color: pnlData.netPnl >= 0 ? '#16a34a' : '#ef4444'}]}>
                  {pnlData.netPnl >= 0 ? '+' : ''}₹{Math.abs(pnlData.netPnl)?.toLocaleString('en-IN')}
                </Text>
              </View>
              <Text style={{fontSize: 11, color: '#9CA3AF', marginTop: 2, paddingHorizontal: 4}}>
                Gross: ₹{pnlData.grossPnl?.toLocaleString('en-IN')} | Costs: ₹{pnlData.estimatedCosts?.toLocaleString('en-IN')}
              </Text>
              <TouchableOpacity
                onPress={() => setIncludePnl(!includePnl)}
                style={{flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 10, backgroundColor: includePnl ? '#f0fdf4' : '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: includePnl ? '#86efac' : '#e5e7eb'}}
              >
                <Text style={{flex: 1, fontSize: 13, color: '#4b5563'}}>Include P&L in {selectedOption === 'topup' ? 'top-up' : 'new amount'}</Text>
                <View style={{width: 20, height: 20, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center', ...(includePnl ? {backgroundColor: '#16a34a', borderColor: '#16a34a'} : {borderColor: '#d1d5db'})}}>
                  {includePnl && <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>✓</Text>}
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          {selectedOption === "topup" && portfolioAmount ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total after Top-up{includePnl && pnlData ? ' (incl. P&L)' : ''}</Text>
              <Text style={styles.detailValue}>₹{(totalAmount + (includePnl && pnlData ? pnlData.netPnl : 0)).toLocaleString('en-IN')}</Text>
            </View>
          ) : null}

          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputPrefix, {color: mainColor}]}>₹</Text>
            <TextInput
              placeholder="Enter amount"
              value={portfolioAmount}
              style={styles.inputBox}
              placeholderTextColor="#999"
              keyboardType="numeric"
              onChangeText={(value) => {
                if (value === "" || /^[0-9]+$/.test(value)) {
                  setPortfolioAmount(value);
                }
              }}
            />
          </View>

          {/* Footer Buttons */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              onPress={() => setModifyInvestmentModal(false)}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelText, {color: mainColor}]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={modifyInvestmentModalPortfolio}
              style={[
                styles.confirmButton,
                {backgroundColor: themeColor},
                isConfirmDisabled() && styles.disabledButton,
              ]}
              disabled={isConfirmDisabled()}
            >
              {subscriptionAmountLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>Confirm Allocation</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>
)};
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: "100%",
    maxHeight: "90%",
  },
  closeButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  headerText: {
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    color: "#002651",
    textAlign: "center",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    color: "#333",
    lineHeight: 20,
    marginBottom: 16,
  },
  boldText: {
    fontFamily: "Poppins-SemiBold",
    color: "#000",
  },
  alertContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  alertText: {
    color: "#FF4D4F",
    fontSize: 12,
    marginLeft: 8,
    fontFamily: "Poppins-Medium",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#0056B7",
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: "center",
    alignContent:'center',
    alignSelf:'center',
  },
  toggleActive: {
    backgroundColor: "#0056B7",
  },
  toggleText: {
    fontSize: 12,
    color: "#0056B7",
    fontFamily: "Poppins-Medium",
  },
  toggleTextActive: {
    color: "#fff",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#555",
    fontFamily: "Poppins-Regular",
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "#000",
  },
  inputContainer: {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 10,
  paddingHorizontal: 12,
  height: 40, // slightly taller for good visual balance
  marginTop: 12,
},
inputPrefix: {
  fontSize: 14,
  color: "#002651",
  marginRight: 6,
},
inputBox: {
  flex: 1,
  fontSize: 14,
  color: "#000",
  fontFamily: "Poppins-Medium",
  paddingVertical: 0, // 👈 removes default top/bottom padding
  includeFontPadding: false, // 👈 removes Android extra spacing
  textAlignVertical: "center", // 👈 ensures perfect vertical alignment
},
  footerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 10,
    alignContent:'center',
    alignSelf:'center',
    alignItems: "center",
  },
  cancelText: {
    color: "#002651",
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#0056B7",
    paddingVertical: 14,
    borderRadius: 10,
    alignContent:'center',
    alignSelf:'center',
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ModifyInvestment;
