import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,Image,ActivityIndicator
} from "react-native";
import LinearGradient from 'react-native-linear-gradient';
import LinkOpeningWeb from "./LinkOpeningWeb";
import WebView from "react-native-webview";
import AwesomeAlert from 'react-native-awesome-alerts';
import * as Animatable from 'react-native-animatable';
import axios from "axios";
import debounce from "lodash.debounce";
import dayjs from 'dayjs';
import moment from "moment";
import { getAuth } from "@react-native-firebase/auth";
import TokenPurchaseModal from "../TokenPurchaseModal";
import Loader from "../../../utils/Loader";
import CalendarPicker from "react-native-calendar-picker";
import { ChevronLeft, XIcon,BanIcon, CalendarDays, MinusIcon,SearchIcon, PlusIcon,ChevronUpIcon ,ChevronDownIcon,Undo2Icon,History,Filter,Calendar, ArrowLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import NewsInfoScreen from "./NewsInfoScreen";
import server from "../../../utils/serverConfig";
import Coin from '../../../assets/coin.svg';
import Icon1 from 'react-native-vector-icons/Fontisto';
const { width: screenWidth } = Dimensions.get('window');
import Config from "react-native-config";
import { generateToken } from "../../../utils/SecurityTokenManager";
import { useTrade } from "../../TradeContext";
import { useConfig } from "../../../context/ConfigContext";

const NewsScreen = ({isVisible}) => {
  const {configData}=useTrade();
  const config = useConfig();
  const { logo: LogoComponent, themeColor, CardborderWidth, mainColor, secondaryColor, gradient1, gradient2, cardElevation, selectedTabcolor, cardverticalmargin, placeholderText } = config || {};

    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [news, setNews] = useState([]);
    const [newsModalOpen, setNewsModalOpen] = useState(false);
    const [selectedNews, setSelectedNews] = useState(null);
    const [symbol, setSymbol] = useState("");
  
    const [daysAgo, setDaysAgo] = useState(7); // Dropdown default value
  const [dropdownVisible, setDropdownVisible] = useState(false);



    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = user?.email;

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const handleDaysAgoSelect = (days) => {
    setDaysAgo(days);
    setDropdownVisible(false);

  // Calculate the start and end dates
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days); // Subtract the selected days from today

  // Update the state
  setSelectedStartDate(startDate);
  setSelectedEndDate(today);
  };

  const renderDropdownItem = (item) => (
    <TouchableOpacity
      key={item}
      onPress={() => handleDaysAgoSelect(item)}
      style={styles.dropdownItem}
    >
      <Text style={styles.dropdownItemText}>{item} days ago</Text>
    </TouchableOpacity>
  );
  
      const [selectedStartDate, setSelectedStartDate] = useState(null);
      const [selectedEndDate, setSelectedEndDate] = useState(null);
      const [modalVisible, setModalVisible] = useState(false);
      const [selectedCoin, setselectedCoin] = useState(false);
      const [clear,setClear]=useState(false);
      const minDate = new Date(2020, 1, 1); // e.g., February 1, 2020
      const maxDate = new Date(); // Today
    
      const options = [
        { label: "1 d", value: 1 },
        { label: "3 d", value: 3 },
        { label: "7 d", value: 7 },
        { label: "30 d", value: 30 },
      ];
 
      
        const handleOpenTokenPurchase= () => {
        //  console.log('hereee');
          setModalVisible(true);
          // Check if the user is logged in and if you want to minimize the app
        // Allow the default behavior (navigating back)
        };
      


      const onDateChange = (date, type) => {
        if (type === 'END_DATE') {
          setSelectedEndDate(date);
          setModalVisible(false);
    
        } else {
          setSelectedStartDate(date);
          setSelectedEndDate(null); // Reset end date when a new start date is selected
        }
      };

      const formatDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0'); // Ensures 2 digits
        const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = d.getFullYear(); // Full year
        return `${day}-${month}-${year}`;
      };
      const [showAlert, setShowAlert] = useState(false);
      const [showFailedAlert, setShowFailAlert] = useState(false);
    // Fetch symbols based on the search query
    const fetchSymbols = async (query) => {
      if (query.length < 3) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}/angelone/get-symbol-name-exchange`,
          { symbol: query },
          { headers: {
                                  "Content-Type": "application/json",
                                  "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                                  "aq-encrypted-key": generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                }, }
        );
    
        const uniqueResults = [];
        const seenNames = new Set();
    
        (response.data.match || []).forEach((item, index) => {
          if (!seenNames.has(item.name)) {
            uniqueResults.push({
              ...item,
              id: `${item.name}-${item.segment}-${index}`,
            });
            seenNames.add(item.name);
          }
        });
    
        setResults(uniqueResults);
      } catch (error) {
        console.error("Error fetching symbols:", error);
      } finally {
        setLoading(false);
      }
    };
    
  
    const debouncedFetchSymbols = useCallback(debounce(fetchSymbols, 300), []);
  
    useEffect(() => {
      if (searchQuery) {
        debouncedFetchSymbols(searchQuery);
      } else {
        setResults([]);
      }
      return () => debouncedFetchSymbols.cancel();
    }, [searchQuery, debouncedFetchSymbols]);
  
  
    // Fetch stock news for the selected symbol
    const fetchStockNews = async (selectedSymbol,selectedStartDate,selectedEndDate) => {
    //  setLoading(true);
      console.log("payload to fjffjfjff:::",{
        email:userEmail,
        symbol: selectedSymbol,
        fromDate: formatDate(selectedStartDate).toString(),
        toDate: formatDate(selectedEndDate).toString()
    });
     // console.log("Selected Date:666777",(formatDate(selectedStartDate)).toString(),(formatDate(selectedEndDate)).toString());
      try {
        const response = await axios.post(`${server.ccxtServer.baseUrl}misc/stock-news`,
          {
            headers: {
                                    "Content-Type": "application/json",
                                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                                    "aq-encrypted-key": generateToken(
                                      Config.REACT_APP_AQ_KEYS,
                                      Config.REACT_APP_AQ_SECRET
                                    ),
                                  },
          }, {
          symbol: selectedSymbol,
          fromDate: (formatDate(selectedStartDate)).toString(),
          toDate: (formatDate(selectedEndDate)).toString(),
        });
      
      //  console.log('news response:',response);
        if (response) {
          setFinalNewsData(response.data.stockNews);
        } else {
          console.log("Error fetching stock news:", response);
        }
      } catch (error) {
        console.error("Error fetching stock news:", error.response);
      } finally {
       // setLoading(false);
      }
    };
   // console.log('selected Date:',formatDate(selectedStartDate));
    const openNewsHistoryModal = async (newsItem) => {
      console.log('newss------------------------.......',newsItem);
      setSymbol(newsItem.name);
      setFinalNewsData([newsItem]);
      setsocketsymbol(newsItem?.orginal_symbol);
      setsocketseg(newsItem?.exchange);
    //  console.log('news item i pass:',newsItem);
      setNewsModalOpen(true);
      //await fetchNews(newsItem.name,selectedStartDate,selectedEndDate);
     // await fetchStockNews(newsItem.name); // Fetch news for the selected symbol
  
    };
    const [socketsymbol,setsocketsymbol]=useState();
    const [socketseg,setsocketseg]=useState();
    const openNewsModal = async (newsItem) => {
      console.log('news item i get:::::::::::::::::::::::::::::::::::',newsItem);
      setSymbol(newsItem.name);
      setsocketsymbol(newsItem.symbol);
      setsocketseg(newsItem.segment);
     // console.log('news item i pass:',newsItem);
      await fetchNews(newsItem.symbol,newsItem.segment,selectedStartDate,selectedEndDate); // Fetch news for the selected symbol
      setNewsModalOpen(true);
  
    };
  
      const [endDate, setEndDate] = useState(new Date());
      const [startDateOpen, setStartDateOpen] = useState(false);
  
    const closeNewsModal = () => {
      setNewsModalOpen(false);
      setFinalNewsData([]);
      fetchHistory();
      setSelectedNews(null);
    };
  
    const handleClose = () => {
      setIsSearchActive(false);
    };

   
    const [historyNewsData, setHistoryNewsData] = useState([
      
    ]);
    //console.log('history data;',historyNewsData);
    const [finalNewsData, setFinalNewsData] = useState([]);

    const convertToIST = (dateString) => {
      const date = new Date(dateString);
      if (isNaN(date)) {
        throw new Error("Invalid date string provided");
      }
   
      // Check if the device is iOS
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        // Fallback solution for iOS: Use UTC and manually adjust for IST offset (+5:30)
        const istOffset = 5.5 * 60; // 5 hours 30 minutes
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + istOffset);
      }
   
      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
   
      return date.toLocaleString('en-IN', options);
   };
   
  
    useEffect(() => {
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - daysAgo); // Subtract the selected days from today
    
      // Update the state
      setSelectedStartDate(startDate);
      setSelectedEndDate(today);
     

      fetchHistory();
      getToken(userEmail,100);
    }, [userEmail]);
 // console.log('reess',results);



 const fetchHistory = async () => {
 // setLoading(true);
  try {
    const payload = {
      email: userEmail,  // Replace with the dynamic email if needed
      length: 10  // Set the length parameter as required
    };
    const response = await axios.post(
      `${server.ccxtServer.baseUrl}/misc/user_news_history`,
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
    setHistoryNewsData(response.data.data || []);
   // setLoading(false);
   // console.log('History news fetched:', response.data);
  } catch (error) {
  //  setLoading(false);
    console.error('Error fetching history:', error);
  }
};

 const consumeTokens = async (email, tokensToConsume, defaultTokens) => {
  const apiUrl = `${server.ccxtServer.baseUrl}misc/consume-tokens`;
  const payload = {
      email: email,
      tokens_to_consume: tokensToConsume,
      default_tokens: defaultTokens
  };

  try {
      const response = await axios.post(apiUrl, payload, {
          headers: {
                                  "Content-Type": "application/json",
                                  "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                                  "aq-encrypted-key": generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                },
      });
     // console.log("API Response:", response.data);
      getToken(userEmail,100);
      return response.data;
  } catch (error) {
      console.log("Error consuming tokens:", error.response ? error.response.data : error.message);
      return null;
  }
};


const PurchaseToken = async (email, tokensToPurchase, defaultTokens) => {
  const apiUrl = `${server.ccxtServer.baseUrl}/misc/add-tokens`;
  const payload = {
      email: email,
      tokens_to_add: tokensToPurchase,
      default_tokens: defaultTokens
  };
  try {
      const response = await axios.post(apiUrl, payload, {
          headers: {
                                  "Content-Type": "application/json",
                                  "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                                  "aq-encrypted-key": generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                },
      });
      getToken(userEmail,100);
      return response.data;
  } catch (error) {
      console.log("Error consuming tokens:", error.response ? error.response.data : error.message);
      return null;
  }
};


const [tokens,setToken]=useState();

const getToken = async (email, defaultTokens) => {
  try {
    const response = await axios.post(`${server.ccxtServer.baseUrl}misc/check-tokens`, {
      email: email,
      default_tokens: defaultTokens,
    }, {
     headers: {
                             "Content-Type": "application/json",
                             "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                             "aq-encrypted-key": generateToken(
                               Config.REACT_APP_AQ_KEYS,
                               Config.REACT_APP_AQ_SECRET
                             ),
                           },
    });
    const data = response.data;
    if (data.status === 0 && data.message === "Tokens retrieved successfully") {
      setToken(data.tokens);
      return data.tokens; // Return the tokens
    } else {
      throw new Error("Failed to retrieve tokens");
    }
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return null;
  }
};

getToken(userEmail,100);
console.log('tokens i gettt_--',tokens);
 const fetchNews = async (stockSymbol,exchange, startDate, endDate) => {
  setLoading(true);
  await fetchHistory();
  try {
    const trimmedSymbol = stockSymbol;
    const daysAgo = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Check if news for this stock symbol and date range already exists in historyNewsData
    const existingNews = historyNewsData.find(
      (news) =>
        news.stock_symbol === trimmedSymbol &&
        new Date(news.date) >= startDate &&
        new Date(news.date) <= endDate
    );
    console.log('ExistingNews:',existingNews);
    if (existingNews) {
      // If news exists, set it as final news data
      setFinalNewsData(existingNews);
      console.log('News fetched from histovrlly:', existingNews);
      setLoading(false);
      return;
      
    }

    // Fetch stock news if not found in history
   //await fetchStockNews(stockSymbol, startDate, endDate);
   console.log('final data fetch:',finalNewsData);
    // If still no data, summarize the news
    if (finalNewsData.length===0) {
      const summarizePayload = {
        stockSymbols: [trimmedSymbol],
        exchanges:[exchange],
        days: daysAgo,
        sentiment: 0,
        email: userEmail,
      };
      console.log('Summarize Payload:', summarizePayload);
      const summarizeResponse = await axios.post(
        `${server.ccxtServer.baseUrl}/misc/summarize-stock-news`,
        summarizePayload, // Payload should be the second argument
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
      
     console.log('summarize response:', summarizeResponse);
//       const summarizeResponse = {
//   data: {
//     data: [{
//       Company: "IDEA",
//       "Full Summary": "Amid calls from some southern states favouring higher population to address disparities in Central funds, former RBI Governor D Subbarao on Thursday argued that population growth is not the solution.",
//       "Full_sentiment_score_description": "NA",
//       "List of new links/articles": [
//         "http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=679ba6f1b4c643889ed8f95014d85f01&url=https%3a%2f%2fwww.msn.com%2fen-in%2fmoney%2ftopstories%2fsouthern-states-pushing-for-more-population-not-good-idea-says-former-rbi-guv-subbarao%2far-AA1y73ik&c=11861539195369317305&mkt=en-in"
//       ],
//       "Num Articles": 1.0,
//       "Overall Sentiment Score": "NA"
//     }],
//     datetime: "Thu, 30 Jan 2025 16:21:12 GMT",
//     message: "Successfully processed <coroutine object MongoService.save_sentiment_data at 0x75243eb90630> stocks",
//     status: 0
//   },
//   status: 200
// };


// You can then use it like this:


//console.log(updatedData); // To verify the transformed data
      if (summarizeResponse.data.status === 0) {
        const updatedData = summarizeResponse.data.data.map(item => {
          const { 
            Company, 
            "Full Summary": fullSummary, 
            "List of new links/articles": articleLinks,
            ...rest 
          } = item;
          
          return {
            stock_symbol: Company,
            summary: fullSummary,
            datetime: summarizeResponse.data.datetime,
            sentiment_data: {
              article_links: articleLinks || []
            },
            ...rest,
          };
        });
       consumeTokens(userEmail,10,100);
        console.log(';uuuuuuuuuuuuuoo', updatedData);
        setFinalNewsData(updatedData); // Set the updated data with the new structure
        setLoading(false);
      }
      
       else {
        setLoading(false);
        console.error('Error summarizing newsoo:', summarizeResponse.data);
      }
    }
  } catch (error) {
    setLoading(false);
    console.error('Error fetching news:', error.message);
  }
};
const renderNewsItem = ({ item }) => (
  <TouchableOpacity onPress={() => openNewsModal(item)} activeOpacity={0.8}>
    <View style={styles.newsItemRecent}>
      <Text style={styles.newsTitleRecent}>{item.name}</Text>
    </View>
  </TouchableOpacity>
);

//console.log('historrd:',historyNewsData);
    const renderNewsRecentItem = ({ item }) => (
     // console.log('this i get:his:',item),
      <TouchableOpacity onPress={() => openNewsHistoryModal(item)}>
        <View style={styles.newsItemRecent}>
          <Text style={styles.newsTitleRecent}>{item.stock_symbol}</Text>
          <Text style={styles.newsDateRecent}>
            {item.datetime ? convertToIST(item.datetime) : 'No Date'}
          </Text>
        </View>
      </TouchableOpacity>
    );
    
      const [webViewVisible,setWebview]=useState(false);
      const [currentUrl, setCurrentUrl] = useState('');
//  console.log('resilte:',results);
    return (

        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            <LinearGradient 
            colors={[mainColor,secondaryColor]} // Adjust gradient colors
            start={{ x: 1, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingHorizontal: 10,
              paddingBottom:10,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            }}
            >
              <View>
              <View style={{ flexDirection: 'row',justifyContent:'center',marginHorizontal:0 }}>
               <LinearGradient
                 colors={['#262626','#262626']} // Border gradient colors
                 start={{ x: 0, y: 0 }}
                 end={{ x: 1, y: 1 }}
                 style={styles.borderGradient} // Border gradient container
               >
                 {/* Inner Container */}
                 <LinearGradient
                   colors={['#262626','#262626']}
                   start={{ x: 0, y: 0 }}
                   end={{ x: 1, y: 1 }}
                   style={styles.linearGradient} // Apply gradient as background
                 >
                 <TouchableOpacity style={styles.searchBarContainer}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                  textAlignVertical="bottom"
                  placeholderTextColor={'#fff'}
                  style={styles.searchBar}
                  placeholder="India’s First AI News Search. Just Ask"
                />
                   <TouchableOpacity onPress={handleOpenTokenPurchase} style={styles.coinContainer}>
  <Coin width={20} height={20} />
  <Text style={styles.tokenAmount}>
  {tokens}
  </Text>
  </TouchableOpacity>
                <Icon1 name='search' size={12} color={'#fff'}/>
              </TouchableOpacity>
               </LinearGradient>
               </LinearGradient>
             
      



      </View>
<View style={{flexDirection:'row',justifyContent:'space-between',paddingBottom:10,paddingHorizontal:5,paddingVertical:10,}}>
<View style={styles.chipcontainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[[styles.chip,{borderColor:'#262626'}], daysAgo === option.value && [styles.selectedChip,{backgroundColor:'#262626'}]]}
          onPress={() => handleDaysAgoSelect(option.value)}
        >
          <Text
            style={[styles.chipText, daysAgo === option.value && styles.selectedChipText]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
      </View>

      <TouchableOpacity onPress={() => setStartDateOpen(true)} style={[styles.datePicker,{borderColor:'#262626'}]}>
    <Text style={styles.datepickerText}>
    {selectedStartDate ? dayjs(selectedStartDate).format('D MMMM') : 'dd/mm/yy'} - 
{selectedEndDate ? dayjs(selectedEndDate).format('D MMMM') : 'dd/mm/yy'}
    </Text>
    <Calendar size={12} color={'white'} style={{marginLeft:8,alignSelf:'center'}}/>
  </TouchableOpacity>

</View>
              </View>
            </LinearGradient>
        <View style={{borderBottomWidth:1,borderBottomColor:'#eee',paddingBottom:10,}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',  }}>
          </View>
        </View>
        <View style={{ flex: 1 ,zIndex:-10}}>
  {loading ? ( // If loading is true, show the Loader
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Optional: Add a slight background overlay
        zIndex: 10, // Ensures the loader is on top
      }}
    >
      <Loader color={'#000'} width={40} height={40} />
    </View>
  ) : null}

{/* The FlatList */}




{finalNewsData.length>0 ? (
  <View style={{flex:1,}}>
      <TouchableOpacity onPress={closeNewsModal} style={{marginHorizontal:20,}}>
  <ArrowLeft size={20} color={'black'}/>
</TouchableOpacity>
  <NewsInfoScreen
  symbol={symbol}
  socketsymbol={socketsymbol}
  socketseg={socketseg}
  news={finalNewsData}
  onClose={closeNewsModal}
  setWebview={setWebview}
  setCurrentUrl={setCurrentUrl}
/>
    </View>

 ) : (

  <Animatable.View animation="fadeInDown" duration={700} style={{ flex: 0 }}>
  <FlatList
    data={
      results.length > 0 ? results : historyNewsData}
    ListHeaderComponent={
      results.length === 0 ? (
        <View>
          <View style={styles.header}>
          <Text style={styles.newsTitleHeader}>History</Text>
            <View style={styles.line} />
          </View>
         
          {historyNewsData.length===0 && (
            <View style={{justifyContent:'center',alignContent:'center',alignItems:'center',paddingVertical:20,}}>
              <Text style={{color:'grey',fontFamily:'Satoshi-Bold'}}>
                No Recent News History to Show
              </Text>
              </View>
          )}
        </View>
      ) : null
    }
    contentContainerStyle={{marginHorizontal:20,}}
    keyExtractor={(item, index) => index.toString()}
    renderItem={results.length > 0 ? renderNewsItem : renderNewsRecentItem}
    showsVerticalScrollIndicator={false}
  />
</Animatable.View>
)}




</View>

          </View>
       
   

            <Modal
                  animationType="slide"
                  transparent={true}
                  visible={startDateOpen}
                  onRequestClose={() => setStartDateOpen(false)}
                >
                  <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                      <CalendarPicker
                        startFromMonday={true}
                        allowRangeSelection={true}
                        minDate={minDate}
                        width={screenWidth * 0.8} 
                        maxDate={maxDate}
                        monthTitleStyle={{color:'black'}}
                        previousTitleStyle={{color:'black'}}
                        nextTitleStyle={{color:'black'}}
                        todayBackgroundColor="#9EAEC1"
                        selectedDayColor="#002a5c"
                
                        selectedDayTextColor="#FFFFFF"
                        onDateChange={onDateChange}
                      />
                
                      {/* Close Modal Button */}
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => {
                          setStartDateOpen(false);
                          // Add your second function here
                         // handleApplyFilter(value); // Or any other function you want to execute
                        }}
                        
                      >
                        <Text style={styles.closeButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal> 

                <AwesomeAlert
                        show={showFailedAlert}
                        showProgress={false}
                        title="Payment Failed"
                        message={`Payment failed for ${selectedCoin} tokens. Please try again.`}
                        closeOnTouchOutside={true}
                        messageStyle={{fontSize:16}}
                        titleStyle={{ fontSize: 20, fontWeight: "bold",fontFamily:'Satoshi-Bold',color:'black' }} 
                        closeOnHardwareBackPress={false}
                        contentContainerStyle={{ padding: 20 ,margin:0}}
                        showConfirmButton={true}
                        confirmText="Close"
                        confirmButtonColor="red"
                        onConfirmPressed={() => {
                          setShowFailAlert(false);
                          setModalVisible(false);
                        }}
                      />

                 <AwesomeAlert
                        show={showAlert}
                        showProgress={false}
                        title="Payment Successful"
                        message={`You have purchased ${selectedCoin} tokens!`}
                        closeOnTouchOutside={true}
                        messageStyle={{fontSize:16}}
                        titleStyle={{ fontSize: 20, fontWeight: "bold",fontFamily:'Satoshi-Bold',color:'black' }} 
                        closeOnHardwareBackPress={false}
                        showConfirmButton={true}
                        contentContainerStyle={{ padding: 20 ,margin:0}} // Increase padding inside the box
                        confirmText="Close"
                        confirmButtonColor="#008000"
                        onConfirmPressed={() => {
                          setShowAlert(false);
                          setModalVisible(false);
                        }}
                      />
                {modalVisible && (
 <TokenPurchaseModal setShowFailAlert={setShowFailAlert} setselectedCoin={setselectedCoin} setModalVisible={setModalVisible} setShowAlert={setShowAlert} userEmail={userEmail} PurchaseToken={PurchaseToken} getToken={getToken} visible={modalVisible} />
  )}


        </View>
 
    );
  };
  
  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      alignItems: "center",
      backgroundColor:'#6D0DD6'
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
   
    },
    line: {
      flex: 1,
      height: 2,
      backgroundColor: "#aaa",
      marginHorizontal: 10,
    },
    chipcontainer: {
      flexDirection: "row",
    justifyContent: "center",
    alignContent:'center',
    alignItems:'center',
    gap: 10,
    },
    chip: {
      borderWidth: 1,
      borderColor: "'#262626", // Light Purple Border
      borderRadius: 20,
      paddingVertical:5,
      paddingHorizontal: 10,
      backgroundColor: "transparent",
    },
    selectedChip: {
      backgroundColor: "#262626", // Purple background for selected
    },
    chipText: {
      color: "#fff",
     fontFamily:'Satoshi-Medium',
      fontSize: 9,
    },
    selectedChipText: {
      color: "#fff",
    },
    loaderContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent background
      zIndex: 1, // Ensure the loader is above the WebView
    },
    dropdown: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 10,
        borderRadius: 5,
      },
      dropdownText: { fontSize: 14, marginRight: 5,fontFamily:'Satoshi-Regular',color:'grey' },
      dropdownList: {
        backgroundColor: "#fff",
        position: 'absolute',
        top: 50,
        left: 0,
        
        borderRadius: 5,
        elevation: 5,
        zIndex: 100,
      },
      coinContainer: {
       textAlign:'center',
       textAlignVertical:'center',
       alignContent:'center',
       alignItems:'center',

       alignSelf:'center',
        marginRight:10,
        justifyContent:'center',
        position: "relative",
  
        
      },
      tokenAmount: {
        position: "absolute",
        fontSize:9,
        fontFamily:'Satoshi-Medium',
        color:'#fff'
     
      },
      dropdownItem: { padding:10, borderBottomWidth: 1, borderBottomColor: "#eee" },
      dropdownItemText: { fontSize: 14 ,fontFamily:'Satoshi-Regular',color:'grey'},
    modalContent: {
      width: "100%",
      height: "100%",
      backgroundColor: "#fff",
   
    },
    newsItemRecent: {
      padding: 10,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      
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
    newsTitleRecent: {
      fontSize: 16,
      fontWeight: 'bold',
      color:'black',
      fontFamily:'Satoshi-Medium'
    },
    newsDateRecent: {
      fontSize: 12,
      color: '#888',
      marginTop: 5,
      fontFamily:'Satoshi-Medium'
    },
    coin: {
      width: 40, // Adjust the size based on your needs
      height: 40,
      borderRadius: 20, // To make it a circle
      backgroundColor: 'gold', // Golden color for the coin
      justifyContent: 'center',
      alignContent:'center',alignItems:'center',alignSelf:'center',
      
      marginHorizontal: 10,
      borderWidth: 1,
      borderColor: '#fff', // Space between search bar and coin
    },
    coinText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 10,
    },
    borderGradient: {
      borderRadius: 10, 
      padding: 2,  // This creates the border effect
      marginHorizontal: 5,
    },
    linearGradient: {
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 0,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden', // Ensures child components don't overflow
    },
    searchBarContainer: {
      flexDirection: 'row', // Ensures TextInput and Icon are in a row
      alignItems: 'center', // Vertically centers them
      
    },
    searchBar: {
      fontFamily: 'Satoshi-Regular',
      textAlignVertical: 'center',
      alignContent:'space-between',
      alignItems:'center',
      alignSelf:'center',
      flex:1,
      fontSize: 13,
      padding: 0,
      paddingVertical: 5,
      color: 'white',
    },
    datePicker: {
      borderColor: "#A855F7",
      borderWidth:1,
      backgroundColor:'transparent',
      paddingVertical:5,
      paddingHorizontal:10,

    
      flexDirection:'row',
    
      borderRadius: 8,

    },
    datepickerText: {
      fontSize: 9,
      color:'white',
      alignSelf:'center',
      textAlignVertical:'center',
      fontFamily:'Satoshi-Medium',
    },
  
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: "#333",
    },
    clearButton: {
      marginLeft: 10,
    },
    newsItem: {
      backgroundColor: "#ffffff",
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginVertical: 6,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 3, // For Android
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    newsTitle: {
      fontSize: 15,
  
      color: "#1a1a1a",
      textAlign: "center",
      fontFamily:'Satoshi-Medium',
      letterSpacing: 0.5,
    },
    newsTitleHeader: {
      fontSize: 16,
      color: "#000",
      paddingVertical:10,
     
      fontFamily:'Satoshi-Medium',
    },
        
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    },
    modalView: {
      width: screenWidth*0.85, // Adjust this to control modal width
      backgroundColor: 'white',
      borderRadius: 10,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    closeButton: {
      marginTop: 20,
      backgroundColor: '#002a5c',
      paddingHorizontal: 10,
      paddingVertical:5,
      borderRadius: 20,
    },
    closeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
    },
  });

export default NewsScreen;
