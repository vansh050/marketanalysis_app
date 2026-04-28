import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal,useWindowDimensions, ActivityIndicator,Dimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import axios from 'axios';
import { XIcon,RefreshCw} from 'lucide-react-native';
import { FadeLoading } from 'react-native-fade-loading';
import { useTrade } from '../../screens/TradeContext';
import server from '../../utils/serverConfig';
const { width, height } = Dimensions.get('window');
const screenWidth = Dimensions.get('window').width;
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
const screenHeight = Dimensions.get('window').height;
// YouTube API Key and Channel ID
const API_KEY = 'AIzaSyCnsA2NAIZ2XeXDFcGC9BHNO1KUeV7U5Ck';  // Replace with your YouTube API key
const CHANNEL_ID = 'UCmzr8eYNcUvJjiaRgvruV8A';    // Replace with the desired YouTube channel ID

const  HoldingScoreModal = ({modalVisible,scoreSymbol,setModalVisible}) => {
    const {configData}=useTrade();
    const [loadingscore, setLoadingscore] = useState(false);
    const [stockData, setStockData] = useState(null);
    const [error, setError] = useState(null);
  
    const fetchStockScore = async (stockSymbol) => {
      setLoadingscore(true);
      setError(null);
        console.log('stocksss:',stockSymbol);
      // Remove "-EQ" or any other suffix after "-" and append ".NS"
      const cleanedSymbol = stockSymbol.replace(/-.*$/, "") + ".NS";
      console.log(`${server.ccxtServer.baseUrl}/misc/calculate-stocks-scores-runtime`);
      console.log('Payload:', "stocks:", [cleanedSymbol], // ✅ Send cleaned symbol with ".NS"
        "date:", new Date().toISOString().split("T")[0],)
        const payload = {
          stocks: [cleanedSymbol], // ✅ Send cleaned symbol with ".NS"
          date: new Date().toISOString().split("T")[0],
        };
        console.log('paylll----:',payload);
      try {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}/misc/calculate-stocks-scores-runtime`, 
          payload,
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
        
        console.log('cleanded symbol',cleanedSymbol);
        const { success, cached } = response.data;
        const scoreData = success.length > 0 ? success[0] : cached.length > 0 ? cached[0] : null;
        console.log('reddsss:',response.data);
        setStockData(scoreData);
        setLoadingscore(false);
      } catch (err) {
        setError("Failed to fetch stock scores. Try again.");
        setLoadingscore(false);
      } finally {
        setLoadingscore(false);
      }
    };
  
  
    useEffect(()=> {
        if(modalVisible) {
            fetchStockScore(scoreSymbol);
        }
    },[modalVisible])
  
  

  return (

   <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignContent:'center',alignItems:'center',marginBottom:20}}>
            <Text style={styles.modalTitle}>Stock Score for {scoreSymbol}</Text>
            <XIcon  onPress={() => {
      setStockData(null);  // ✅ Clear stock data
      setModalVisible(false);  // ✅ Close modal
    }} size={18} color={'black'}/>
            </View>
          
            {loadingscore ? (
              <ActivityIndicator size="large" color="#000" />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : stockData ? (
                <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableRow}>
                  <Text style={[styles.tableHeader, styles.cell]}>Metric</Text>
                  <Text style={[styles.tableHeader, styles.cell]}>Score</Text>
                  <TouchableOpacity onPress={()=> fetchStockScore(scoreSymbol)} style={styles.refreshButton}>
                <RefreshCw size={14} color={'#000'} />
              </TouchableOpacity>
                </View>
          
                {/* Table Rows */}
                <View style={styles.tableRow}>
                  <Text style={styles.cell}>Durability</Text>
                  <Text style={styles.cell}>{stockData.scores.durability_score.toFixed(2)}</Text>
                </View>
          
                <View style={styles.tableRow}>
                  <Text style={styles.cell}>Momentum</Text>
                  <Text style={styles.cell}>{stockData.scores.momentum_score.toFixed(2)}</Text>
                </View>
          
                <View style={styles.tableRow}>
                  <Text style={styles.cell}>Valuation</Text>
                  <Text style={styles.cell}>{stockData.scores.valuation_score.toFixed(2)}</Text>
                </View>
          
                {/* Total Score Row */}
                <View   style={[
    styles.tableRow,
    styles.totalRow,
    {
      backgroundColor:
        stockData.scores.total_score < 20
          ? '#FFCCCC' // Faded Red
          : stockData.scores.total_score < 50
          ? '#FFF4B2' // Yellow
          : '#C8E6C9', // Green
    },
  ]}>
                  <Text style={[styles.cell, styles.totalText]}>Total Score</Text>
                  <Text style={[styles.cell, styles.totalText]}>{stockData.scores.total_score.toFixed(2)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.infoText}>No stock score found!</Text>
            )}
  

          </View>
        </View>
      </Modal>
   
  );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      },
      modalContent: {
        backgroundColor: "#fff",
        padding: 20,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
      
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
      },
      modalTitle: {
        fontSize: 16,
        fontFamily:'Satoshi-Bold',
        color:'black'

      },
      refreshButton: {
        padding: 3,
    
        position:'absolute',
        right:0,
      },
      scoreContainer: {
        marginVertical: 10,
      },
      scoreText: {
        fontSize: 16,
        color: "#333",
        marginVertical: 3,
      },
      totalScore: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#007AFF",
        marginTop: 10,
      },
      infoText: {
        fontSize: 14,
        color: "#666",
        marginBottom: 10,
        fontFamily:'Satoshi-Medium'
      },
      button: {
        backgroundColor: "#fff",
        paddingVertical: 10,
        borderWidth:1,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginTop: 10,
      },
      buttonText: {
        color: "#000",
        fontSize: 12,
        fontFamily:'Satoshi-Medium'
      },
      closeButton: {
        marginTop: 10,
      },
      closeButtonText: {
        color: "#007AFF",
        fontSize: 16,
        fontWeight: "bold",
      },
      errorText: {
        color: "red",
        fontSize: 14,
        marginBottom: 10,
      },
      tableContainer: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#fff',
      },
      tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#000',
      },
      cell: {
        flex: 1,
        padding: 10,
        textAlign: 'center',
        fontSize: 14,
        color:'#000',
        fontFamily:'Satoshi-Regular'
      },
      tableHeader: {
        backgroundColor: '#fff',
        color: '#000',
        fontWeight: 'bold',
      },
      totalRow: {
        backgroundColor: '#e3f2fd',
      },
      totalText: {
        fontWeight: 'bold',
        fontSize: 14,
        color:'#000',
      },
});

export default HoldingScoreModal;
