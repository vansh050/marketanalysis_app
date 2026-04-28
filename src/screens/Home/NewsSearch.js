import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions
} from "react-native";
import axios from "axios";
import debounce from "lodash.debounce";
import dayjs from 'dayjs';
import moment from "moment";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";

import CalendarPicker from "react-native-calendar-picker";
import { ChevronLeft, XIcon,BanIcon, CalendarDays, MinusIcon,SearchIcon, PlusIcon,ChevronUpIcon ,ChevronDownIcon,Undo2Icon,History,Filter,Calendar } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import NewsInfoScreen from "./NewsScreen/NewsInfoScreen";
import server from "../../utils/serverConfig";
import LinkOpeningWeb from "./NewsScreen/LinkOpeningWeb";
import { useTrade } from "../TradeContext";

const { width: screenWidth } = Dimensions.get('window');
const NewsSearch = ({ setIsSearchActive, isSearchActive }) => {
  const {configData}=useTrade();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  const [symbol, setSymbol] = useState("");



    const [selectedStartDate, setSelectedStartDate] = useState(null);
    const [selectedEndDate, setSelectedEndDate] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [clear,setClear]=useState(false);
    const minDate = new Date(2020, 1, 1); // e.g., February 1, 2020
    const maxDate = new Date(); // Today
  
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
  const fetchStockNews = async (selectedSymbol) => {
    setLoading(true);
    console.log({
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
    
      console.log('news response:',response);
      if (response) {
        setNews(response.data.stockNews);
      } else {
        console.log("Error fetching stock news:", response.data);
      }
    } catch (error) {
      console.error("Error fetching stock news:", error);
    } finally {
      setLoading(false);
    }
  };
  const openNewsModal = async (newsItem) => {
    setSymbol(newsItem.name);
   // await fetchStockNews(newsItem.name); // Fetch news for the selected symbol
    setSelectedNews(newsItem);
    setNewsModalOpen(true);
  };

    const [endDate, setEndDate] = useState(new Date());
    const [startDateOpen, setStartDateOpen] = useState(false);

  const closeNewsModal = () => {
    setNewsModalOpen(false);
    setSelectedNews(null);
  };

  const handleClose = () => {
    setIsSearchActive(false);
  };

  const renderNewsItem = ({ item }) => (
    <TouchableOpacity onPress={() => openNewsModal(item)}>
      <View style={styles.newsItem}>
        <Text style={styles.newsTitle}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isSearchActive}
      animationType="slide"
      onRequestClose={handleClose}
    >
      
      <View style={styles.modalOverlay}>

        <View style={styles.modalContent}>
        <View style={{ flexDirection: 'row',justifyContent:'center', alignItems: 'center',alignContent:'center',alignSelf:'center', }}>
          <ChevronLeft onPress={handleClose} size={18} style={{alignContent:'center',alignItems:'center',alignSelf:'center',}}/>
    <TouchableOpacity style={styles.searchBarContainer}>
          <SearchIcon size={18} color={'#918F8F'} />
          <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
            textAlignVertical="bottom"
            placeholderTextColor={'#918F8F'}
            style={styles.searchBar}
            placeholder='Enter "Reliance" to get latest updates'
          />
      </TouchableOpacity>

      <TouchableOpacity  style={styles.coin}>
        <Text style={styles.coinText}>10</Text>
      </TouchableOpacity>
    </View>
          {/* Search Bar */}
     
      <View>
        {/* Date Range and Filter Section */}
        <View style={styles.filterSection}>
        <TouchableOpacity onPress={() => setStartDateOpen(true)} style={styles.datePicker}>
  <Text style={styles.datepickerText}>
    {selectedStartDate ? dayjs(selectedStartDate).format('DD-MM-YYYY') : 'dd/mm/yy'} - 
    {selectedEndDate ? dayjs(selectedEndDate).format('DD-MM-YYYY') : 'dd/mm/yy'}
  </Text>
  <Calendar size={15} color={'black'} style={{marginLeft:8,alignSelf:'center'}}/>
</TouchableOpacity>
        
          <TouchableOpacity style={styles.filterButton}><Text style={{color:'white',fontFamily:'Poppins-Regular',fontSize:11}}>Clear</Text>
          </TouchableOpacity>
        </View>
        
       
      </View>
          {/* News List */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderNewsItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>

      <Modal
        visible={newsModalOpen}
        animationType="slide"
        onRequestClose={closeNewsModal}
      >
        <NewsInfoScreen
          symbol={symbol}
          news={news}
          onClose={closeNewsModal}
        />
      </Modal>
     
   
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding:10,
    elevation: 5,
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
    fontSize: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 5,
    paddingLeft: 10,
    alignContent:'center',
    alignSelf:'center',
    borderColor: '#E6E6E6',
    marginLeft: 10,
  },
  searchBar: {
    flex: 1,
    fontFamily: 'Satoshi-Regular',
    textAlignVertical:'center',
    fontSize: 13,
    marginLeft: 10,
  },
  datePicker: {
    borderColor: '#E4E4E4',
    backgroundColor:'white',
    paddingVertical:8,
    paddingHorizontal:10,
    elevation:3,
    fontSize: 11,
    flexDirection:'row',
    justifyContent:'center',
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    fontFamily: 'Poppins-Regular',
    borderRadius: 4,
    marginRight: 8,
    color: 'black',
    marginTop:10,
  },
  datepickerText: {
    fontSize: 11,
    color:'black',
    fontFamily: 'Poppins-Regular',
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
    padding: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
  },
  newsTitle: {
    fontSize: 16,
    color: "#333",
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

export default NewsSearch;
