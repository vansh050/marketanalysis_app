import React, { useState, useMemo ,useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Linking,
  Modal,
} from 'react-native';
import WebSocketManager from '../../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import WebView from 'react-native-webview';
import LinkOpeningWeb from './LinkOpeningWeb';
import { ArrowLeft, ArrowRight, ChevronLeft ,XIcon} from 'lucide-react-native';
import PriceText from '../../../components/AdviceScreenComponents/DynamicText/PriceText';
import MissedGainText from '../../../components/AdviceScreenComponents/DynamicText/BestPerformerGainText';

const NewsInfoScreen = ({ imageUrl, symbol, news, onClose,socketsymbol,socketseg}) => {
  const [selectedNews, setSelectedNews] = useState(null);
  const [webViewVisible,setWebview]=useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
 console.log('newsoooool----------------',socketsymbol);
  const groupNewsByDate = (news) => {
    const grouped = {};
    news.forEach((item) => {
    
      const date = new Date(item?.datetime).toLocaleDateString('en-GB', {  
        day: '2-digit',  
        month: '2-digit',  
        year: 'numeric'  
      });      
      console.log('dateeeeeeeeee:',date);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    return Object.entries(grouped).map(([date, items]) => ({
      date,
      items,
    }));
  };




  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();
    
    // Call subscribeToAllSymbols using wsManager
    console.log('here socket symb00000------',socketseg,socketsymbol);
    await wsManager.subscribeToAllSymbols([{socketsymbol,socketseg}]);
  };
  
  useEffect(() => {
    subscribeToSymbols();
  }, []);

  const OpenWebview = (url) => {
    setCurrentUrl(url);
    setWebview(true);
  };


  const groupedNews = useMemo(() => groupNewsByDate(news), [news]);




  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentContainer}>
      {groupedNews.length > 0 ? (
        groupedNews.map((group, index) => (
          <View key={index} style={styles.cardGroup}>
            {group.items.map((item, idx) => (
             // console.log('itemmmmmm',item),
<View style={{flex:1,}}>
<View  style={{flexDirection:'row',justifyContent:'space-between',marginVertical:20,marginHorizontal:20,}}>
    <View>
    <Text style={styles.cardTitle}>{symbol ? symbol: item?.stock_symbol}</Text>
    </View>
    <View style={{marginHorizontal:10,borderTopWidth:2,borderColor:'grey',flex:1,alignContent:'flex-end',alignItems:'center',alignSelf:'center'}}></View>
  </View>

  <View style={styles.containerNews}>
      <View style={[styles.section]}>
        <Text style={styles.headerCardlabel}>Price</Text>
        <MissedGainText
         advisedRangeCondition={0}
         symbol={socketsymbol || ""}
         exchange={socketseg}
         stockDetails={groupedNews}
         advisedPrice={0}
         type={'newsscreen'}
       />
      </View>
      
      <View style={styles.middleSection}>
        <Text style={styles.headerCardlabel}>Date</Text>
        <Text style={styles.headerCardPriceDate} numberOfLines={1} ellipsizeMode="tail">
          {group?.date}
        </Text>
      </View>
      
      <View style={[styles.section]}>
        <Text style={styles.headerCardlabel}>Sentiment</Text>
        <Text style={styles.headerCardsentiment}>07</Text>
      </View>
    </View>

  <View style={styles.Mainsummary}>
    <View style={styles.summaryHeader}>
      <Text style={{color:'#fff',fontFamily:'Satoshi-Medium'}}>Summary</Text>
    </View>
    <View>
      <Text style={styles.summaryTitle}>
      {item?.summary ? item?.summary : item?.sentiment_data?.summary}
      </Text>
    </View>
  </View>



  <View style={styles.MainnewsLink}>
    <View style={styles.NewsHeader}>
      <Text style={{color:'#fff',fontFamily:'Satoshi-Medium'}}>News</Text>
    </View>
    <View style={{paddingVertical:5}}>
    <FlatList
      data={item?.sentiment_data?.article_links}
      numColumns={3} // Set 3 columns
      keyExtractor={(item, index) => index.toString()}
      columnWrapperStyle={styles.row}
    
      contentContainerStyle={{marginHorizontal:0}}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          key={index}
          onPress={() => OpenWebview(item)}
          style={styles.modalLinkContainer}
        >
          <Text style={styles.modalLinkText}>{index + 1}. Read Article</Text>
          <ArrowRight size={10} color={"#000"}/>
        </TouchableOpacity>
      )}
    />
    </View>
  </View>
</View>
             
            ))}
          </View>
        ))
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No news available</Text>
        </View>
      )}
    </ScrollView>


      

{webViewVisible && (
     <LinkOpeningWeb
     currentUrl={currentUrl}
     webViewVisible={webViewVisible}
     symbol={symbol}
     setWebview={setWebview}
   />)}
      
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({

  containerNews: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#242424',
    borderRadius: 8,
    marginHorizontal: 20,
    padding: 10,
   // Full width minus margins
    flexWrap: 'wrap', // Allows wrapping on small screens
  },
  section: {
    minWidth: 70, // Minimum width for the side sections
    marginBottom: 5,
  },
  middleSection: {
    minWidth: 70,
    marginHorizontal: 10,
    marginBottom: 5,
    borderRightWidth:1,
    borderLeftWidth:1,
    paddingHorizontal:10,
    borderColor:'#303030',

  },
  headerCardlabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  headerCardPriceDate: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  headerCardsentiment: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerCardlabel: {
    color:'white',
    
    fontFamily:'Satoshi-Medium',
    fontSize:14,

  },
  headerCardPriceDate:{
    color:'#626262',
    fontFamily:'Satoshi-Medium',
    fontSize:18,
  },
  headerCardsentiment:{
    color:'#4FD33E',
    fontFamily:'Satoshi-Medium',
    fontSize:18,
  },
  Mainsummary:{
    borderWidth:1,
  
    borderColor:'#000',
    borderRadius:10,
    marginHorizontal:20,
    marginVertical:10,
  },
  MainnewsLink:{
    borderWidth:1,
   
    borderColor:'#000',
    borderRadius:10,
    marginHorizontal:20,
    marginVertical:10,
  },

    summaryHeader:{
    borderBottomWidth:1,
    borderColor:'#000',
    padding:10,
    borderTopRightRadius:10,
    borderTopLeftRadius:10,
    backgroundColor:'#6B0DD7'
  },
  NewsHeader:{

    borderColor:'#000',
    padding:10,
    borderTopRightRadius:10,
    borderTopLeftRadius:10,
    backgroundColor:'#E75912'
  },
  summaryTitle : {
    fontSize:14,
    color:'black',
    fontFamily:'Satoshi-Regular',
    padding:10,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 210,
  },
  iconContainer: {
    position: 'absolute',
    top: 20,
    left: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 5,
  },
  contentContainer: {
    paddingHorizontal: 8,
    paddingVertical:4,
    backgroundColor:'#fff',
 
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
  cardGroup: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 18,
    fontFamily:'Satoshi-Bold',
    color: '#000',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily:'Satoshi-Medium',
    color: '#333',
  },
  cardDate: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
    fontFamily:'Satoshi-Regular',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius:30,
    borderTopRightRadius:30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderLeftWidth:1,
    borderRightWidth:1,
    borderTopColor: '#eee',
    borderLeftColor:'#eee',
    borderRightColor:'#eee'
  },
  footerText: {
    fontSize: 16,
    fontFamily:'Satoshi-Bold',
    color: '#333',
  },
  footerPrice: {
    fontSize: 16,
    fontFamily:'Satoshi-Bold',
    color: '#16A085',
  },
  percentageContainer: {
    backgroundColor: '#16A085',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  change: {
    fontSize: 14,
    color: '#fff',
    fontFamily:'Satoshi-Medium',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalContent: {
    width: width,
    maxHeight: height * 0.7,
    borderTopLeftRadius:20,
    borderTopRightRadius:20,
    backgroundColor: '#fff',
 
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily:'Satoshi-Bold',
    marginBottom: 10,
    color: '#000',
  },
  modalSummary: {
    fontSize: 16,
    color: '#444',
    fontFamily:'Satoshi-Medium',
    marginBottom: 15,
  },
  modalLinkContainer: {
    borderWidth:1,
    borderRadius:8,
    flexDirection:'row',
   maxWidth: '50%',
    flex:1,
    justifyContent:'space-between',
    alignSelf:'center',
    alignContent:'center',
    alignItems:'center',
    
    marginVertical: 5,
    padding:5,
    marginHorizontal:5,
   
  },
  row: {
    justifyContent: "space-between",
    minWidth:10,

    },
  modalLinkText: {
    fontSize: 10,
    color: '#000',
    fontFamily:'Satoshi-Medium',
    minWidth: '10%',
    flexWrap:'wrap',
    flex:1,
    marginRight:5,
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#16A085',
    padding: 10,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontFamily:'Satoshi-Medium'
  },
});

export default NewsInfoScreen;
