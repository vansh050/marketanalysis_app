import React, {useState, useEffect, useRef, act} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Keyboard,
  StatusBar,
  ToastAndroid,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  SlidersVerticalIcon,
  SearchIcon,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  Search,
  ChevronLeft,
} from 'lucide-react-native';
import {Picker} from '@react-native-picker/picker';
import Icon1 from 'react-native-vector-icons/Fontisto';
import {Pencil} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WishSearch from './WishSearch';
const star = require('../../assets/star1.png');
import Toast from 'react-native-toast-message';
import CustomToast from '../../components/customToast';
import DeleteAdviceModal from '../../components/DeleteAdviceModal';
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import MissedGainText from '../../components/AdviceScreenComponents/DynamicText/BestPerformerGainText';
import APP_VARIANTS from '../../utils/Config';
import {useRoute} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';
import axios from 'axios';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import server from '../../utils/serverConfig';
import LinearGradient from 'react-native-linear-gradient';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';

const WatchlistScreen = props => {
  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';
  const {configData}=useTrade();
  const route = useRoute();
  const navigation = props.navigation;
  const fullScreen = route.params?.fullScreen ?? props.fullScreen ?? false;
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

  // Reload watchlist data whenever the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadWatchlistData = async () => {
        try {
          const storedWatchlists = await AsyncStorage.getItem('watchlists');
          if (storedWatchlists) {
            setWatchlists(JSON.parse(storedWatchlists));
          }
        } catch (error) {}
      };
      loadWatchlistData();
    }, []),
  );

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
      text2: message2 + ' ' + message1,
      position: 'bottom', // Ensure the position is set to bottom or your desired position
      visibilityTime: 4000, // Duration the toast is visible
      autoHide: true,
      topOffset: 60, // Adjust this value to position the toast if needed
      bottomOffset: 100, // You can tweak this to align the toast properly
      text1Style: {
        color: 'black',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
      },
      text2Style: {
        color: 'black',
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
      },
    });
  };

  const addStockToWatchlist = stock => {
    setWatchlists(prevWatchlists => {
      const currentWatchlist = prevWatchlists[activeTab];

      // Check if the stock is already in the current watchlist
      if (currentWatchlist.some(item => item.symbol === stock.symbol)) {
        // Remove the stock if already present
        // console.log('item full------',stock);
        const updatedWatchlist = currentWatchlist.filter(
          item => item.id !== stock.id,
        );
        showToast(`Removed from Watchlist ${activeTab}`, 'error', stock.name);
        setToastMessage(`Removed from Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('fail');
        return {...prevWatchlists, [activeTab]: updatedWatchlist};
      } else {
        // Add the stock if not already present
        const updatedWatchlist = [...currentWatchlist, stock];
        showToast(`Added to Watchlist ${activeTab}`, 'success', stock.name);
        setToastMessage(`Added to Watchlist ${activeTab}`);
        settoastvisible(true);
        setToastType('success');
        return {...prevWatchlists, [activeTab]: updatedWatchlist};
      }
    });
  };

  // console.log('watchlist tab:::----------------:',watchlists[activeTab]);
  const deleteStock = (rowKey, stockname) => {
    setWatchlists(prevWatchlists => {
      // console.log('Row Key :',rowKey,'StockName:',stockname);
      const currentWatchlist = prevWatchlists[activeTab];
      const updatedWatchlist = currentWatchlist.filter(
        item => item.id !== rowKey,
      );
      showToast(`Removed from Watchlist ${activeTab}`, 'error', stockname);
      return {...prevWatchlists, [activeTab]: updatedWatchlist};
    });
  };
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLongPress = item => {
    // console.log('this go');
    setSelectedStock(item); // Set the selected stock for deletion
    setShowDeleteModal(true); // Show the delete modal
  };

  const [selectedStock, setSelectedStock] = useState(null); // Track the stock to delete
 

  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();

    // Call subscribeToAllSymbols using wsManager
    await wsManager.subscribeToAllSymbols(watchlists[activeTab]);
  };

  useEffect(() => {
    subscribeToSymbols();
  }, [watchlists[activeTab]]);

  onRowOpen = rowKey => {
    //  console.log('Opened row with key:', rowKey);
    deleteStock(rowKey);
  };

  const watchlistOptions = [
    {label: 'Watchlist 1', value: 1},
    {label: 'Watchlist 2', value: 2},
    {label: 'Watchlist 3', value: 3},
    {label: 'Watchlist 4', value: 4},
    {label: 'Watchlist 5', value: 5},
  ];

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [editMode, setEditMode] = useState(false); // New state for edit mode
  const [isWatchlistPickerVisible, setIsWatchlistPickerVisible] =
    useState(false); // For edit mode picker
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Symbol search API call
  const fetchSymbolSuggestions = async query => {
    console.log('fetchSymbolSuggestions called with:', query); // DEBUG
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/equity/symbol-search`,
        {symbol: query},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      console.log('API response:', response.data); // DEBUG
      setSearchSuggestions(response.data.match || []);
    } catch (error) {
      console.log('API error:', error); // DEBUG
      setSearchSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Call fetchSymbolSuggestions when searchQuery changes
  useEffect(() => {
    fetchSymbolSuggestions(searchQuery);
  }, [searchQuery]);

  const handleSaveEditWatchlist = async () => {
    try {
      await AsyncStorage.setItem('watchlists', JSON.stringify(watchlists));
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save watchlist:', error);
    }
  };

  const {watchlistLoading} = props;

    return editMode ? (
      // Edit Watchlist UI
      <>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 12,
            backgroundColor: '#EFF0EE',
          }}>

            
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <TouchableOpacity
              onPress={() => setEditMode(false)}
              style={{
                padding: 4,
                marginRight: 8,
                justifyContent: 'center',
                height: 32,
              }}>
              <Icon1 name="angle-left" size={22} color="#222" />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 16,
                color: '#222',
                fontFamily: Platform.select({
                  ios: 'HelveticaNeue-Medium',
                  android: 'HelveticaNeueMedium',
                  default: 'HelveticaNeueMedium', // fallback
                }),
                flex: 1,
                textAlign: 'left',
              }}>
              Edit Watchlist
            </Text>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: '#3F7AFC',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 4,
              marginLeft: 8,
            }}
            onPress={handleSaveEditWatchlist}>
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontFamily: 'HelveticaNeue',
              }}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
        {/* Name Input Row */}
        <TouchableOpacity onPress={() => setIsWatchlistPickerVisible(true)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 10,
              marginHorizontal: 16,
              marginTop: 0,
              marginBottom: 12,
              height: 44,
              borderWidth: 1,
              borderColor: '#ECECEC',
              paddingHorizontal: 12,
            }}>
            <Text
              style={{
                color: '#B0B0B0',
                fontSize: 15,
                fontFamily: Platform.select({
                  ios: 'HelveticaNeue-Medium',
                  android: 'HelveticaNeueMedium',
                  default: 'HelveticaNeueMedium', // fallback
                }),
                marginRight: 8,
              }}>
              Name
            </Text>
            <TextInput
              style={{
                flex: 1,
                fontSize: 16,
                color: '#888',
                fontFamily: Platform.select({
                  ios: 'HelveticaNeue-Medium',
                  android: 'HelveticaNeueMedium',
                  default: 'HelveticaNeueMedium', // fallback
                }),
                paddingVertical: 0,
                backgroundColor: 'transparent',
              }}
              value={
                watchlistOptions.find(opt => opt.value === activeTab)?.label ||
                ''
              }
              editable={false}
              placeholderTextColor="#888"
            />
            <Pencil size={18} color="#B0B0B0" style={{marginLeft: 8}} />
          </View>
        </TouchableOpacity>
        {/* Stock List */}
        <View
          style={{
            flex: 1,
            marginHorizontal: 0,
            marginTop: 0,
            backgroundColor: '#fff',
          }}>
          <FlatList
            data={watchlists[activeTab]}
            keyExtractor={item => item.id?.toString() || item.symbol}
            renderItem={({item, index}) => (
              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    paddingLeft: 16,
                    paddingRight: 16,
                    height: 52,
                  }}>
                  {/* Drag handle icon (dots) */}
                  <Icon1
                    name="nav-icon-list"
                    size={10}
                    color="#B0B0B0"
                    style={{marginRight: 18}}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: '#222',
                      fontFamily: Platform.select({
                        ios: 'HelveticaNeue-Medium',
                        android: 'HelveticaNeueMedium',
                        default: 'HelveticaNeueMedium', // fallback
                      }),
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {item.name || item.symbol}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      deleteStock(item.id, item.name || item.symbol)
                    }
                    style={{marginLeft: 8, padding: 6}}>
                    <Trash2 size={20} color="#B0B0B0" />
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: '#F1F1F1',
                    marginLeft: 52,
                    marginRight: 16,
                  }}
                />
              </View>
            )}
            contentContainerStyle={{paddingBottom: 8}}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  padding: 40,
                }}>
                <Text
                  style={{
                    color: '#888',
                    fontFamily: Platform.select({
                      ios: 'HelveticaNeue-Medium',
                      android: 'HelveticaNeueMedium',
                      default: 'HelveticaNeueMedium', // fallback
                    }),
                    fontSize: 16,
                  }}>
                  No stocks in this watchlist.
                </Text>
              </View>
            }
          />
        </View>
        {/* Watchlist Picker Modal */}
        <Modal
          visible={isWatchlistPickerVisible}
          transparent
          animationType="fade">
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setIsWatchlistPickerVisible(false)}>
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 10,
                minWidth: 250,
                elevation: 6,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 8,
                overflow: 'hidden',
                maxHeight: 220,
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}>
              {/* X Close Button above names */}
              <TouchableOpacity
                onPress={() => setIsWatchlistPickerVisible(false)}
                style={{position: 'absolute', top: 6, right: 8, zIndex: 2}}>
                <Icon1 name="close" size={18} color="#888" />
              </TouchableOpacity>
              <View style={{height: 10}} />
              <FlatList
                data={watchlistOptions}
                keyExtractor={item => item.value.toString()}
                style={{maxHeight: 220}}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      minWidth: 250,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F1F1',
                    }}
                    onPress={() => {
                      setActiveTab(item.value);
                      setIsWatchlistPickerVisible(false);
                    }}>
                    <Text
                      style={{
                        color: '#222',
                        fontSize: 15,
                        fontFamily: 'Helvetica Neue',
                        textAlign: 'center',
                      }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    ) : (
      // Normal mode: show Watchlists header, tabs, and list as before
      <>
        
        {/* Tabs */}
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: '#ECECEC',
            backgroundColor: '#EFF0EE',
            marginBottom: 0,
            zIndex: 1,
            borderTopWidth: 0,
          }}>
               <LinearGradient  colors={[gradient1, gradient2]}
        start={{ x: 0, y: 0 }}
  end={{ x: 0, y: 1 }}
   style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
      <ChevronLeft size={24} color="#000" /> 
    </TouchableOpacity>
          <Text style={styles.headerTitle}>WatchList</Text>
        </View>
      </LinearGradient>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 8}}>
            {watchlistOptions.map((tab, idx) => (
              <TouchableOpacity
                key={tab.value}
                style={{
                  alignItems: 'center',
                  paddingTop: 10,
                  paddingBottom:10,
                  paddingHorizontal: 10,
                  borderBottomWidth: activeTab === tab.value ? 2 : 0,
                  borderBottomColor:
                    activeTab === tab.value ? '#000' : 'transparent',
                  marginBottom: -1,
                  marginRight: 10,
                }}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.7}>
                <Text
                  style={{
                    color: activeTab === tab.value ? '#000' : '#888',
                    fontFamily: Platform.select({
                      ios: 'HelveticaNeue-Medium',
                      android: 'HelveticaNeueMedium',
                      default: 'HelveticaNeueMedium', // fallback
                    }),
                    fontSize: 14,
                    letterSpacing: 0.1,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View
          style={{position: 'relative', zIndex: 10, backgroundColor: '#EFF0EE'}}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 8,
            }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF',
                borderRadius: 8,
              paddingHorizontal: 12,
              height: 38,
              borderWidth: 1,
              borderColor: '#ECECEC',
              shadowColor: '#000',
           
              shadowRadius: 2,
              elevation: 1,
            }}>
            <SearchIcon size={15} color={'#616161'} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 8,
                fontFamily: Platform.select({
                  ios: 'HelveticaNeue',
                  android: 'HelveticaNeue',
                  default: 'HelveticaNeue', // fallback
                }),
                fontSize: 14,
                color: '#222',
                paddingVertical: 0,
                height: 38,
              }}
              placeholder="Search Stocks"
              placeholderTextColor="#86868A"
              value={searchQuery}
              onChangeText={text => setSearchQuery(text)}
            />

            <Text style={{color: '#888', fontSize: 12}}>
              {watchlists[activeTab]?.length || 0}/25
            </Text>
            </View>
            
            <TouchableOpacity
              onPress={() => setEditMode(true)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: themeColor,
                borderRadius: 3,
                marginLeft: 12,
                height: 35,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: Platform.select({
                    ios: 'HelveticaNeue-Medium',
                    android: 'HelveticaNeueMedium',
                    default: 'HelveticaNeueMedium', // fallback
                  }),
                }}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>
          {/* Suggestions Dropdown Overlay */}
          {searchQuery.length > 1 &&
            (searchSuggestions.length > 0 || searchLoading) && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 2,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#ECECEC',
                  borderRadius: 8,
                  maxHeight: 560,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 6,
                }}>
                {searchLoading ? (
                  <View
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: 60,
                    }}>
                    <Text style={{color: '#666'}}>Loading...</Text>
                  </View>
                ) : searchSuggestions.length === 0 ? (
                  <View
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: 60,
                    }}>
                    <Text style={{color: '#666'}}>No results found</Text>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={true}
                    scrollEnabled={true}
                    bounces={true}
                    keyboardShouldPersistTaps="handled">
                    {searchSuggestions.map((item, index) => {
                      const alreadyInWatchlist = watchlists[activeTab].some(
                        w => w.symbol === item.symbol,
                      );
                      return (
                        <TouchableOpacity
                          key={item.token + item.symbol}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderBottomWidth:
                              index < searchSuggestions.length - 1 ? 1 : 0,
                            borderBottomColor: '#F1F1F1',
                            backgroundColor: 'transparent',
                          }}
                          activeOpacity={0.7}
                          onPress={() => {
                            addStockToWatchlist({
                              id: item.token,
                              name: item.name,
                              symbol: item.symbol,
                              exchange: item.segment,
                              companyName: item.companyName,
                              industry: item.industry,
                            });
                            setSearchQuery('');
                          }}>
                          <View style={{flex: 1}}>
                            <Text
                              style={{
                                fontSize: 15,
                                color: '#222',
                                fontFamily: 'HelveticaNeue',
                              }}>
                              {item.name || item.symbol}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: '#888',
                                fontFamily: 'HelveticaNeue',
                                marginTop: 2,
                              }}>
                              {item.segment}{' '}
                              <Text
                                style={{
                                  fontSize: 8,
                                  color: '#888',
                                  fontFamily: 'HelveticaNeue',
                                  marginHorizontal: 4,
                                  marginTop: -2,
                                }}>
                                {'• '}
                              </Text>
                              {item.companyName}
                            </Text>
                          </View>
                          <View style={{padding: 6}}>
                            <Icon1
                              name={alreadyInWatchlist ? 'check' : 'plus-a'}
                              size={18}
                              color={alreadyInWatchlist ? '#2DBD85' : '#407BFF'}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
        </View>
        {/* Stock List Area */}
        <View
          style={{
            flex: 1,
            marginHorizontal: 0,
            marginTop: 0,
            backgroundColor: '#EFF0EE',
          }}>
          <View
            style={{
              backgroundColor: '#EFF0EE',
              marginHorizontal: 8,
              marginTop: 0,
              overflow: 'hidden',
              flex: 1,
            }}>
            {/* Table Header */}
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderBottomWidth: 0,
                borderBottomColor: '#ECECEC',
              }}>
              <View
                style={{
                  height: 1.3,
                  backgroundColor: '#9E9E9E',
                  marginHorizontal: 16,
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              />
              <Text
                style={{
                  flex: 2,
                  color: '#9E9E9E',
                  fontFamily: Platform.select({
                    ios: 'HelveticaNeue-Medium',
                    android: 'HelveticaNeueMedium',
                    default: 'HelveticaNeueMedium', // fallback
                  }),
                  fontSize: 12,
                  letterSpacing: 0.2,
                }}>
                STOCKS
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: '#9E9E9E',
                  fontFamily: Platform.select({
                    ios: 'HelveticaNeue-Medium',
                    android: 'HelveticaNeueMedium',
                    default: 'HelveticaNeueMedium', // fallback
                  }),
                  fontSize: 12,
                  textAlign: 'center',
                  letterSpacing: 0.2,
                }}>
                
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: '#9E9E9E',
                  fontFamily: Platform.select({
                    ios: 'HelveticaNeue-Medium',
                    android: 'HelveticaNeueMedium',
                    default: 'HelveticaNeueMedium', // fallback
                  }),
                  fontSize: 12,
                  textAlign: 'right',
                  letterSpacing: 0.2,
                }}>
                PRICE
              </Text>
            </View>
            {/* Stock List */}
            {watchlists[activeTab]?.length > 0 ? (
              <FlatList
                data={watchlists[activeTab]}
                keyExtractor={item => item.id?.toString() || item.symbol}
                renderItem={({item}) => <WatchlistRow item={item} />}
                contentContainerStyle={{paddingBottom: 8}}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}>
                <View style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 20,
             
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                }}>
                  <View style={{
                    width: 70,
                    height: 70,
                    borderRadius: 35,
                 
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Search size={40} color={"#333"} />
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: 'Satoshi-Medium',
                    fontSize: 17,
                    color: '#424242',
                    textAlign: 'center',
                    lineHeight: 24,
                    marginBottom: 20,
                    maxWidth: 240,
                    alignSelf: 'center',
                  }}>
                  Add stocks you're tracking or curious about
                </Text>
              </View>
            )}
          </View>
        </View>
      </>
    );
  }



const WatchlistRow = ({item}) => {
  const livePriceRaw = useLTPStore(state => state.ltps[item.symbol]);
  const livePrice = Number(livePriceRaw) || 0;

  const referencePrice = Number(item.advisedPrice) || 0;
  const cmp = Number(livePrice) || 0;
  
  let percentChange = 0;
  let changeValue = 0;
  if (referencePrice > 0 && cmp > 0) {
    percentChange = ((cmp - referencePrice) / referencePrice) * 100;
    changeValue = cmp - referencePrice;
  }
  const isPositive = percentChange >= 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        minHeight: 48,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth:1,
        borderColor:'#c8c8c8',
        borderBottomColor: '#ECECEC',
      }}>
      {/* Left Column: Symbol and Company Name */}
      <View>
        <Text
          style={{
            color: '#222',
            fontSize: 14,
            fontFamily: 'Poppins-Medium',
            marginBottom: 2,
          }}
          numberOfLines={1}
          ellipsizeMode="tail">
          {item.name || item.symbol}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: '#888',
            fontFamily: 'HelveticaNeue',
            marginTop: 2,
            maxWidth: 170,
          }}>
          {item?.exchange}{' '}
          <Text
            style={{
              fontSize: 8,
              color: '#888',
              fontFamily: 'HelveticaNeue',
              marginHorizontal: 4,
              marginTop: -2,
            }}>
            {'• '}
          </Text>
          {item.companyName}
        </Text>
      </View>
      <View style={{flex: 1, alignItems: 'flex-end'}}>
        <Text
          style={{
            color: '#222',
            fontSize: 14,
            fontFamily: 'Poppins-Medium',
            letterSpacing: 0.25,
            marginBottom: 10,
 
           
          }}>
          {cmp > 0 ? `₹${cmp.toFixed(2)}` : '--'}
        </Text>
      </View>
      {/* Right Column: Price and Gain */}
      {/* <View style={{flex: 1, alignItems: 'flex-end'}}>
        <View style={{alignItems: 'flex-end', flexDirection: 'column'}}>
          <Text style={{
            color: isPositive ? '#2DBD85' : '#E74C3C',
            fontSize: 12,
            fontFamily: 'HelveticaNeue',
          }}>
            {changeValue > 0 ? '+' : ''}{changeValue.toFixed(2)}
          </Text>
          <Text style={{
            color: isPositive ? '#2DBD85' : '#E74C3C',
            fontSize: 10,
            fontFamily: 'HelveticaNeue',
          }}>
            ({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)
          </Text>
        </View>
      </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF0EE',
    paddingBottom: 12,
  },
   headerGradient: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 10,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
  },
    headerTitle: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.1,
  },
  backButton: { padding: 4,borderRadius:5, backgroundColor: '#fff',marginRight:10 },
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
  searchBarContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    textAlignVertical: 'center',

    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    borderColor: '#E6E6E6',
    marginHorizontal: 20,
  },
  searchBar: {
    paddingVertical: 5,
    textAlignVertical: 'center',
    flex: 1,
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    marginLeft: 10,
  },
  stockLimit: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    textAlignVertical: 'center',
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
    marginHorizontal: 5,
  },
  stockContainer: {
    flex: 1,

    marginHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e9e9e9',
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  stockItem: {
    alignContent: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'column',
    flex: 1,
  },
  stockName: {
    fontSize: 12,
    color: 'black',
    paddingHorizontal: 10,
    fontFamily: 'Satoshi-Medium',
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
    marginTop: 5,
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
