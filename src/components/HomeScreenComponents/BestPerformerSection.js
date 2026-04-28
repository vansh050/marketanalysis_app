import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal,ActivityIndicator, Button,Dimensions } from 'react-native';
import WebView from 'react-native-webview';
import { Trophy } from 'lucide-react-native';
import server from '../../utils/serverConfig';
import axios from 'axios';
import { FadeLoading } from 'react-native-fade-loading';
 
import moment from 'moment';
import Config from 'react-native-config';
import { useTrade } from '../../screens/TradeContext';
import LinkOpeningWeb from '../../screens/Home/NewsScreen/LinkOpeningWeb';
import { Title } from 'react-native-paper';
import PriceText from '../AdviceScreenComponents/DynamicText/PriceText';
import BestPerformerText from '../AdviceScreenComponents/DynamicText/HomeBestPerformer';
const { width, height } = Dimensions.get('window');

const screenWidth = Dimensions.get('window').width;


const BestPerformerSection = ({type}) => {

  const { bestPerformer,isPerformerLoading } = useTrade();
  const [filteredPerformers, setFilteredPerformers] = useState([]);


  const getUniqueHighestPnlItems = (data) => {
    const map = new Map();
  
    data.forEach(item => {
      const isFno = item.exchange === 'FNO' || item.exchange === 'BFO';
  
      const key = isFno
        ? `${item.symbol}-${item.strike}-${item.option_type}`
        : `${item.symbol}-${item.exchange}`;
  
      if (!map.has(key) || item.pnl > map.get(key).pnl) {
        map.set(key, item);
      }
    });
  
    // Sort by pnl descending before returning
    return Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
  };
  
  useEffect(() => {
    if (bestPerformer?.length > 0) {
      const filtered = getUniqueHighestPnlItems(bestPerformer);
      setFilteredPerformers(filtered); // 👈 Set to state
    }
  }, [bestPerformer]);
  
 // console.log('blogsrtt_;',type);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
 // const [loading, setLoading] = useState(false); 
  const [title,settitle]=useState('');

  const openWebView = (item) => {
    setCurrentUrl(item.link);
    settitle(item.title);
    setModalVisible(true);

  };

 

  const convertToTimeAgo = (dateString) => {
    return moment(dateString).fromNow();  // Returns relative time format like "1 day ago"
  };
  const formatSymbol = (symbol) => {
    const regex = /(.*?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/;
    const match = symbol.match(regex);
    if (match) {
      return `${match[1]}${match[2]} | ${match[3]} | ${match[4]}`;
    }
    return symbol;
  };

     

 
 // console.log('broker  kkk',bestPerformer);

  const renderItem = ({ item }) => {
    if (item.symbol === "IDEA-EQ") {
    //  console.log("iteml heree", item);
    }
  
    return (
      <TouchableOpacity activeOpacity={1}>
        <View style={styles.card}>
          <View style={[styles.header]}>
            <Text style={styles.stockName}>{formatSymbol(item.symbol)}</Text>
            <BestPerformerText
              Exchange={item.exchange}
              type={'bestP2'}
              advisedRangeCondition={0}
              advisedRangeHigher={0}
              advisedRangeLower={0}
              symbol={item.symbol}
              stockDetails={bestPerformer}
              buysell={item.type}
              entryprice={item.price_when_send_advice}
              quantity={1}
            />
          </View>
  
          <View style={{ flexDirection: "column", marginTop: 15 }}>
            <View>
              <Text style={styles.currentLabel}>CURRENT</Text>
            </View>
          </View>
  
          <BestPerformerText
            Exchange={item.exchange}
            type={'bestP1'}
            advisedRangeCondition={0}
            advisedRangeHigher={0}
            advisedRangeLower={0}
            symbol={item.symbol}
            stockDetails={bestPerformer}
            buysell={item.type}
            entryprice={item.price_when_send_advice}
            quantity={1}
          />
        </View>
      </TouchableOpacity>
    );
  };
  
      
  return (
    <View style={styles.container}>
 
      <FlatList
  // data={filteredPerformers}
  // renderItem={renderItem}
  data={
    filteredPerformers.length > 1
      ? [...filteredPerformers, { isPlaceholder: true, advice_reco_id: "placeholder" }]
      : filteredPerformers
  }
  renderItem={({ item }) => {
    if (item.isPlaceholder) {
      return (
        <TouchableOpacity activeOpacity={1}>
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonTitle}>More coming soon</Text>
              <View style={styles.divider} />
              <Text style={styles.comingSoonSubtitle}>Stay tuned for additional performers</Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }
    return renderItem({ item })
  }}
  keyExtractor={(item) => item.advice_reco_id} // Ensure unique keys
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{paddingRight:10,   marginLeft:10,alignContent:'center', alignSelf:'center',}}
  showsVerticalScrollIndicator={false}
  ListEmptyComponent={() =>
    isPerformerLoading ? (
      <View style={{ flexDirection: "row",justifyContent:'space-between' }}>
        <FadeLoading
          style={{
            width: screenWidth * 0.4,
            height: 100,
            borderRadius: 10,
            marginBottom: 10,
            
          }}
        />
         <FadeLoading
          style={{
            marginHorizontal:10,
            width: screenWidth * 0.4,
            height: 100,
            borderRadius: 10,
            marginBottom: 10,
          }}
        />
      </View>
    ) : (
      <View style={styles.emptyStateWrapper}>
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
        <Trophy size={32} color="#8B45FF" /></View>
        <Text style={styles.emptyStateTitle}>No Best Performers Yet</Text>
        <Text style={styles.emptyStateText}>
          Looks like there's no data to display right now. Once you have performers, they'll appear here.
        </Text>
      </View>
    </View>
    
    )
  }
/>

      <LinkOpeningWeb
        symbol={title}
        setWebview={setModalVisible}
        webViewVisible={modalVisible}
        currentUrl={currentUrl}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignContent:'center',alignItems:'flex-start',
  },
  containerEmpty: {
    paddingVertical:10,
    justifyContent: 'center',
    alignItems: 'center',
    alignContent:'center',
    alignSelf:'center',
    flex:1,
    backgroundColor: '#fDfDfD',
  },
  title: {
    fontSize: 14,
    fontFamily:'Satoshi-Bold',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 10
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    maxWidth:screenWidth,
    paddingHorizontal:20,

    fontFamily:'Satoshi-Medium',
    textAlign: 'center',
    marginBottom: 20,
  },
 
  
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 10,
    color: '#000',
  },
  blogList: {
    paddingHorizontal: 0,
  },
  blogCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    width: 260,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginBottom: 10,
    elevation: 3, // For Android shadow
  },
  blogImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  blogTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: 'white',
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 15,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for text visibility
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  timestampText: {
    fontSize: 12,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webView: {
    borderTopColor:'#e9e9e9',
    borderWidth:1,
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent background
    zIndex: 1, // Ensure the loader is above the WebView
  },


  ///
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 15,
    padding: 16,
    flex:1,
    minWidth:180,
    marginRight:10,
 
  },
  header: {
    flexDirection:'row',
    justifyContent:'space-between',
  
  },
  stockName: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily:'Satoshi-Medium',
    marginRight:10
  },
  percentageBadge: {
    backgroundColor: "#14C46F",
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  percentageText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily:'Satoshi-Bold',
  },
  currentLabel: {
    color: "#A0A0A0",
    fontSize: 10,
    fontFamily:'Satoshi-Medium',
    marginTop: 8,
  },
  currentPrice: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily:'Satoshi-Medium',
    marginTop: 2,
  },
  change: {
    fontSize: 16,
    color: "#14C46F",
    fontFamily:'Satoshi-Medium',
    marginTop: 4,
    marginLeft:20,
  },
  moreComingCard: {
    backgroundColor: "rgba(26, 26, 26, 0.7)",
    borderRadius: 15,
    padding: 16,
    minWidth: 180,
    marginLeft: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  moreComingTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "Satoshi-Medium",
    textAlign: "center",
  },
  moreComingSubtitle: {
    fontSize: 10,
    color: "#A0A0A0",
    fontFamily: "Satoshi-Medium",
    marginTop: 4,
    textAlign: "center",
  },
  comingSoonCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 15,
    padding: 16,
    flex: 1,
    minWidth: 180,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  comingSoonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Satoshi-Medium",
    textAlign: "center",
  },
  comingSoonSubtitle: {
    fontSize: 10,
    color: "#A0A0A0",
    fontFamily: "Satoshi-Medium",
    marginTop: 4,
    textAlign: "center",
  },
  divider: {
    height: 1,
    width: "80%",
    backgroundColor: "#333",
    marginVertical: 12,
  },
  emptyStateWrapper: {
    flex: 1,
    marginVertical:5,
  },
  emptyStateContainer: {
    backgroundColor: '#fDfDfD',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateIconContainer: {
    backgroundColor: '#f3e8ff',
    borderRadius: 32,
    padding: 16,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Satoshi-Medium',
    textAlign: 'center',
  },
});

export default BestPerformerSection;