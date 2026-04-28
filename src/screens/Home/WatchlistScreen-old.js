
import React, { useState, useEffect,useRef, act} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Keyboard, StatusBar, ToastAndroid, Dimensions,FlatList } from 'react-native';
import { SlidersVerticalIcon, SearchIcon, Trash2, ShoppingCart } from 'lucide-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import WishSearch from './WishSearch';
const star = require('../../assets/star1.png');
import AwesomeAlert from 'react-native-awesome-alerts';
import Toast from 'react-native-toast-message'
import CustomToast from '../../components/customToast'; 
import DeleteAdviceModal from '../../components/DeleteAdviceModal'
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import MissedGainText from '../../components/AdviceScreenComponents/DynamicText/BestPerformerGainText';
import APP_VARIANTS from '../../utils/Config';
const WatchlistScreen = () => {
  const webSocket = useRef(WebSocketManager.getInstance());
  const [activeTab, setActiveTab] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [watchlists, setWatchlists] = useState({
    1: [], // Watchlist 1
    2: [], // Watchlist 2
    3: [], // Watchlist 3
    4: [], // Watchlist 4
    5: [], // Watchlist 5
  });



  const [toastvisible, settoastvisible] = useState(false); 
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showBuyButtonOpacity, setShowBuyButtonOpacity] = useState(1); // State for Buy button opacity
  const [showDeleteButtonOpacity, setShowDeleteButtonOpacity] = useState(1); // State for Delete button opacity

  const [showAlert, setShowAlert] = useState(false);

  const showAlertHandler = () => {
    setShowAlert(true);
  };
  const resetAlertState = () => {
    setShowAlert(false);
  };
  const hideAlertHandler = () => {
    setShowAlert(false);
  };
  // Load watchlist data from AsyncStorage when the component mounts
  useEffect(() => {
    const loadWatchlistData = async () => {
      try {
        const storedWatchlists = await AsyncStorage.getItem('watchlists');
        if (storedWatchlists) {
          setWatchlists(JSON.parse(storedWatchlists));
        }
      } catch (error) {
     //   console.error('Failed to load watchlists from storage', error);
      }
    };

    loadWatchlistData();
  }, []);

  // Save watchlist data to AsyncStorage whenever it changes
  useEffect(() => {
    const saveWatchlistData = async () => {
      try {
        await AsyncStorage.setItem('watchlists', JSON.stringify(watchlists));
      } catch (error) {
      //  console.error('Failed to save watchlists to storage', error);
      }
    };

    saveWatchlistData();
  }, [watchlists]);

  const openSearch = () => {
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const showToast = (message1, type, message2) => {
  //  console.log('hero o wat',message1,type,message2);
    Toast.show({
        type: type,
        text2: message2 + " " + message1,
        position: 'bottom', // Ensure the position is set to bottom or your desired position
        visibilityTime: 4000, // Duration the toast is visible
        autoHide: true,
        topOffset: 60, // Adjust this value to position the toast if needed
        bottomOffset: 100, // You can tweak this to align the toast properly
        text1Style: {
            color: 'black',
            fontSize: 14,
            fontFamily: 'Poppins-Medium'
        },
        text2Style: {
            color: 'black',
            fontSize: 13,
            fontFamily: 'Poppins-Regular'
        },
    });
};

  

  const addStockToWatchlist = (stock) => {
    setWatchlists((prevWatchlists) => {
      const currentWatchlist = prevWatchlists[activeTab];
  
      // Check if the stock is already in the current watchlist
      if (currentWatchlist.some(item => item.symbol === stock.symbol)) {
        // Remove the stock if already present
        console.log('item full------',stock);
        const updatedWatchlist = currentWatchlist.filter(item => item.id!==stock.id);
        showToast(`Removed from Watchlist ${activeTab}`, 'error',stock.name);
        setToastMessage(`Removed from Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('fail');
        return { ...prevWatchlists, [activeTab]: updatedWatchlist };
      } else {
        // Add the stock if not already present
        const updatedWatchlist = [...currentWatchlist, stock];
        showToast(`Added to Watchlist ${activeTab}`, 'success',stock.name);
        setToastMessage(`Added to Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('success');
        return { ...prevWatchlists, [activeTab]: updatedWatchlist };
      }
    });
  };

  console.log('watchlist tab:::----------------:',watchlists[activeTab]);
  const deleteStock = (rowKey,stockname) => {
    setWatchlists((prevWatchlists) => {
      console.log('Row Key :',rowKey,'StockName:',stockname);
      const currentWatchlist = prevWatchlists[activeTab];
      const updatedWatchlist = currentWatchlist.filter(item => item.id !== rowKey);
      showToast(`Removed from Watchlist ${activeTab}`, 'error',stockname);
      return { ...prevWatchlists, [activeTab]: updatedWatchlist };
    });
  };
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleLongPress = (item) => {
    console.log('this go');
    setSelectedStock(item); // Set the selected stock for deletion
    setShowDeleteModal(true); // Show the delete modal
  };


  const [selectedStock, setSelectedStock] = useState(null); // Track the stock to delete

  const buyStock = (rowKey) => {
    // Handle the "Buy" action here
    ToastAndroid.show(`Buying stock ${rowKey}`, ToastAndroid.SHORT);
  };
  const groupStocksIntoPairs = (stocks) => {
    const groupedStocks = [];
    for (let i = 0; i < stocks.length; i += 2) {
      groupedStocks.push(stocks.slice(i, i + 2));
    }
    return groupedStocks;
  };
  
  const renderStockRow = ({ item }) => {
    console.log('itemm------:',item);
    return (
      <View style={styles.row}>
            {item.map((stock, index) => {
  const finalsymbol = (stock.exchange === "NFO" || stock.exchange === "BFO") ? stock.name : stock.symbol;
  return (
          <TouchableOpacity
            key={stock.id}
            style={styles.stockContainer}
            onLongPress={() => handleLongPress(stock)}
          >
            <View style={styles.stockItem}>
            <Text style={styles.stockName}>{finalsymbol} </Text>
            <View style={{ paddingHorizontal: 10 }}>
              <MissedGainText
                advisedRangeCondition={0}
                symbol={stock.symbol || ""}
                exchange={stock.exchange}
                stockDetails={watchlists[activeTab]}
                advisedPrice={0}
                type={'watchlist'}
              />
                </View>
      </View>
    </TouchableOpacity>
  );
})}


{selectedStock && (
        console.log('selectedStock:',selectedStock),
        <DeleteAdviceModal
          isVisible={showDeleteModal}
          stockname={selectedStock.symbol}
          stockIgnoreId={selectedStock.id}
          onClose={() => setShowDeleteModal(false)} // Close the modal
          onConfirm={() => {
            deleteStock(selectedStock.id, selectedStock.symbol); // Perform deletion
            setShowDeleteModal(false); // Close the modal after confirming
            setSelectedStock(null); // Reset the selected stock
          }}
        />
      )}
      </View>
    );
  };
  

  


  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();
    
    // Call subscribeToAllSymbols using wsManager
    await wsManager.subscribeToAllSymbols(watchlists[activeTab]);
  };
  
  useEffect(() => {
    subscribeToSymbols();
  }, [watchlists[activeTab]]);
  


    onRowOpen = rowKey => {
       console.log('Opened row with key:', rowKey);
        deleteStock(rowKey);
    };
  
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="light-content" />

      {!isSearchOpen ? (
        <>
          <View style={styles.tabs}>
            {['Watchlist 1', 'Watchlist 2', 'Watchlist 3','Watchlist 4','Watchlist 5'].map((tab, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.tab, activeTab === index + 1 && styles.activeTab]}
                onPress={() => setActiveTab(index + 1)}
              >
                <Text style={[styles.tabText, activeTab === index + 1 && styles.activeTabText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchBarContainer}>
            <SearchIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} size={16} color={'#918F8F'} />
            <TextInput 
              textAlignVertical='bottom'
              placeholderTextColor={'#918F8F'}
              style={styles.searchBar}
              placeholder="Search & add stocks"
              value={searchQuery}
              onFocus={openSearch} 
              onChangeText={text => setSearchQuery(text)}
            />
            <Text style={styles.stockLimit}>{watchlists[activeTab].length}/100</Text>
 
          </View>

          {watchlists[activeTab].length > 0 ? (
               <FlatList
               data={groupStocksIntoPairs(watchlists[activeTab])}
               renderItem={renderStockRow}
               style={{marginTop:5,}}
               keyExtractor={(item, index) => `row-${index}`}
             />
          ) : (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 30,
              marginVertical: 20,
              marginHorizontal: 20,
              backgroundColor: APP_VARIANTS.EmptyStateUi.lightWarmColor,
              borderRadius: 16,
              overflow: 'hidden',
              width: '90%',
              alignSelf: 'center',
            }}>
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.7,
                backgroundColor: '#fff',
                borderRadius: 16,
              }}>
                <View style={{
                  position: 'absolute',
                  top: -80,
                  right: -80,
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: 'rgba(107, 20, 0, 0.08)',
                }} />
                <View style={{
                  position: 'absolute',
                  bottom: -60,
                  left: -60,
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: 'rgba(173, 66, 38, 0.06)',
                }} />
              </View>
              
              <View style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                shadowColor: APP_VARIANTS.EmptyStateUi.backgroundColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 4,
              }}>
                <Image 
                  source={require('../../assets/emptyWatchlisticon.png')} 
                  style={{
                    width: 70,
                    height: 70,
                    resizeMode: 'contain',
                  }} 
                />
              </View>
              
              <Text style={{ 
                fontFamily: 'Satoshi-Bold', 
                fontSize: 20,
                color: APP_VARIANTS.EmptyStateUi.darkerColor,
                textAlign: 'center',
                marginBottom: 12,
              }}>
                Nothing here yet
              </Text>
              
              <Text style={{
                fontFamily: 'Satoshi-Medium',
                fontSize: 15,
                color: APP_VARIANTS.EmptyStateUi.mediumColor,
                textAlign: 'center',
                maxWidth: '85%',
                lineHeight: 22,
                marginBottom: 20,
              }}>
                Use the search bar to add stocks to your watchlist.
              </Text>
              
     
            </View>
          )}
        </>
      ) : (
        <View style={styles.swapUpContainer}>
          <WishSearch 
            searchQuery={searchQuery}
            onBackPress={closeSearch}
            onQueryChange={setSearchQuery}
            onBookmark={addStockToWatchlist} // Pass the add stock function
            watchlists={watchlists} // Pass the watchlists to WishSearch
            currentTab={activeTab} // Pass the current active tab to WishSearch
          />
        </View>
      )}
    
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toast: {
    position: 'absolute',
    top: 60, // Adjust this value as needed to position below the CustomToolbar
    left: 0,
    right: 0,
    zIndex: 10, // Ensures it's above other components
  },
  headerContainer: {
    flexDirection: 'column',
    marginHorizontal: 10,
    marginVertical: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: 'black',
    paddingHorizontal: 15,
  },
  rowFront: {
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    padding: 15,
    justifyContent: 'center',
  },
  rowBack: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButtonBuy: {
    alignItems: 'center',
    backgroundColor: 'green',
    justifyContent: 'center',
    borderRadius: 5,
    width: Dimensions.get('window').width,
    height: '100%',
  },
  backButtonRemove: {
    alignItems: 'center',
    backgroundColor: 'red',
    justifyContent: 'center',
    borderRadius: 5,
    width: Dimensions.get('window').width,
    height: '100%',
  },
  infoText: {
    fontSize: 15,
    paddingHorizontal: 15,
    fontFamily: 'Poppins-Regular',
    color: 'grey',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 10,
    marginTop:10,
    paddingHorizontal: 25,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  activeTab: {
    borderColor: '#000',
  },
  tabText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 11,
    color: '#C8C8C8',
  },
  activeTabText: {
    fontFamily: 'Satoshi-Medium',
    color: '#000',
    fontSize:12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    justifyContent:'center',
    textAlignVertical:'center',
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    borderColor: '#E6E6E6',
    marginHorizontal: 20,
  },
  searchBar: {
    paddingVertical:5,
    textAlignVertical:'center',
    flex:1,
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    marginLeft: 10,
  },
  stockLimit: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    textAlignVertical:'center',
    color: '#918F8F',
    marginRight: 10,
  },
  filterButton: {
    padding: 10,
  },
  watchlistContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    marginHorizontal:5,
  },
  stockContainer: {
    flex: 1,
    
    marginHorizontal:8,
    paddingVertical:5,
    borderWidth:1,
    borderColor:'#e9e9e9',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    alignItems: 'center',
  },
  stockItem: {
 
    alignContent:'center',
    alignItems:'center',
    justifyContent:'space-between',
    flexDirection:'column',
    flex:1,
  },
  stockName: {
    fontSize: 12,
    color:'black',
    paddingHorizontal:10,
    fontFamily:'Satoshi-Medium',
    fontWeight: 'bold',
  },
  stockNamebelow: {
    fontFamily: 'Poppins-Light',
    fontSize: 14,
    color: '#C8C8C8',
  },
  stockPrice: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#000',
  },
  stockPricegainloss: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#73BE4A',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: '#000',
    marginTop:5
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
    fontFamily: 'Poppins-Light',
    textAlign: 'center',
    paddingHorizontal: 85,
  },
  swapUpContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default WatchlistScreen;
