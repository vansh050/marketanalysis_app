import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/AntDesign';
import { ArrowLeftIcon, Plus, XIcon } from 'lucide-react-native';
import axios from 'axios';
import debounce from 'lodash.debounce';
import MissedGainText from '../../components/AdviceScreenComponents/DynamicText/BestPerformerGainText';
import Loader from '../../utils/Loader';
import Config from '../../utils/safeConfig';
import { Dropdown } from 'react-native-element-dropdown';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';

const WishSearch = ({ searchQuery, onBackPress, onQueryChange, onBookmark, currentTab, watchlists }) => {
  const {configData}=useTrade();

  // Get dynamic config from API
  const config = useConfig();
  const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#0056B7';
  const gradient1 = config?.gradient1 || '#0056B7';
  const gradient2 = config?.gradient2 || '#002651';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedTab, setSelectedTab] = useState('Equity'); // <-- New state
  const [symbolQuery, setSymbolQuery] = useState('');
  const [strikePriceQuery, setStrikePriceQuery] = useState('');
  const [optionType, setOptionType] = useState(''); // CE or PE
  const [value, setValue] = useState('All Trades');
  const [isFocus, setIsFocus] = useState(false);
  const [fnoResults, setFnoResults] = useState([]);

  // Existing fetchSymbols


  
  const fetchSymbols = async (query) => {
    if (query.length < 3) return setResults([]);
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/get-symbol-name-exchange`,
        { symbol: query },
        { headers: { 'Content-Type': 'application/json' } }
      );
  
      const resultsWithIds = (response.data.match || []).map((item, index) => ({
        ...item,
        exchange: item.segment,        // ✅ Rename 'segment' to 'exchange'
        id: `${item.name}-${item.segment}-${index}`
      }));
  
      // Optionally remove the 'segment' key if you don't want it
      resultsWithIds.forEach(item => delete item.segment);
  
      //console.log('result with id:', resultsWithIds);
      setResults(resultsWithIds);
    } catch (error) {
      console.error('Error fetching symbols:vvvv', error);
    } finally {
      setLoading(false);
    }
  };
  

  const debouncedFetchSymbols = useCallback(debounce(fetchSymbols, 300), []);

  useEffect(() => {
    if (selectedTab === 'Equity') {
      debouncedFetchSymbols(searchQuery);
    }
    return () => debouncedFetchSymbols.cancel();
  }, [searchQuery, selectedTab]);

  const handleBookmarkPress = (item) => {
    console.log('item to add::',item);
    const currentWatchlist = watchlists[currentTab] || [];
    const isBookmarked = currentWatchlist.some(watchlistItem => watchlistItem.id === item.id);
    if (!isBookmarked) onBookmark(item);
  };

 

  const handleTabSwitch = (tab) => {
    setSelectedTab(tab);
    setResults([]);
    setSymbolQuery('');
    setStrikePriceQuery('');
    setOptionType('');
  };

  const cePeOptions = [
    { label: 'CE', value: 'CE' },
    { label: 'PE', value: 'PE' },
  ];
  

    // Derivative add entry
    const [adviceDerivativesEntries, setAdviceDerivativesEntries] = useState([
      {
        id: Date.now(),
        symbol: "",
        foType: "OPTIONS",
        expiry: "",
        strike: "",
        optionType: "",
        lots: "",
        order: "MARKET",
        price: 0,
        rationale: "",
        comments: "",
        extendedComment: "",
        strikes: [],
        optionTypes: [],
        symbols: [],
      },
    ]);

  const fetchDerivativesSymbols = async (index, inputValue, type) => {
    if (inputValue.length < 3) return;

    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}comms/fno/search`,
        {
          symbol: inputValue,
          type: type || "",
        },
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
      const symbols = response.data.match || [];

      const strikes = [...new Set(symbols.map((sym) => sym.strike))]
        .filter(Boolean)
        .sort((a, b) => a - b);
      const optionTypes = [
        ...new Set(symbols.map((sym) => sym.optionType)),
      ].filter(Boolean);

      setAdviceDerivativesEntries((prevEntries) =>
        prevEntries.map((entry, i) =>
          i === index
            ? {
                ...entry,
                symbols: symbols,
                strikes: strikes,
                optionTypes: optionTypes,
              }
            : entry
        )
      );
    } catch (error) {
      console.error("Error fetching derivatives symbols:", error);
    }
  };
 // console.log('advicee-----',adviceDerivativesEntries);
  const debouncedFetchDerivativesSymbols = useCallback(
    debounce((index, value, type) => {
      fetchDerivativesSymbols(index, value, type);
    }, 300),
    []
  );

  const handleDerivativesInputChange = (index, value) => {
    setAdviceDerivativesEntries((prevEntries) =>
      prevEntries.map((entry, i) =>
        i === index
          ? { ...entry, searchSymbol: value, symbol: value, showDropdown: true }
          : entry
      )
    );

    if (value.length >= 3) {
      const currentType = adviceDerivativesEntries[index].foType;
      debouncedFetchDerivativesSymbols(index, value, currentType);
    }
  };

  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const handleDerivativesSymbolSelect = (
    index,
    symbol,
    lotsize,
    strike,
    exchange,
    optionType
  ) => {
   // console.log('symbol i get:',symbol);
    setAdviceDerivativesEntries((prevEntries) =>
      prevEntries.map((entry, i) =>
        i === index
          ? {
              ...entry,
              symbol: symbol.symbol,
              searchSymbol: symbol.searchSymbol,
              strike: strike,
              optionType: optionType, // Set the optionType
              lots: symbol.lotsize,
              exchange: exchange,
              strikes: prevEntries[i].strikes || [], // Preserve the strikes array
              symbols: [],
              showDropdown: false,
            }
          : entry
      )
    );
    setSelectedSymbols((prev) => {
      const filtered = prev.filter((item) => item.index !== index);
      return [
        ...filtered,
        {
          index,
          symbol: symbol.symbol,
          exchange: symbol.exchange,
        },
      ];
    });

    fetchDerivativesSymbols(index, symbol.searchSymbol, "OPTIONS");
  };

  const [symbolfno,setsymbolfno]=useState("");
  const DropdownRenderItem = ({ text }) => {
    return (
      <View style={styles.dropdownItem}>
        <Text style={styles.dropdownItemText}>{text}</Text>
      </View>
    );
  };

  const [focusedIndex, setFocusedIndex] = useState(null);
  const addFnoResult = (entry,value) => {
    console.log('entry =---',value);
    const id = `${entry.selectedSymbol}-${entry.strike}-${entry.optionType}`;
    if (!entry.selectedSymbol || !entry.strike || !entry.optionType) return;
  
    const newItem = {
      id,
      name:`${entry.selectedSymbol}-${entry.strike}-${entry.optionType}`,
      symbol: `${symbolfno}`,
      exchange: 'NFO',
    };
  
    setFnoResults(prev => {
      const exists = prev.some(item => item.id === newItem.id);
      return exists ? prev : [...prev, newItem];
    });
  };
  
  return (
    <View style={styles.searchResultsContainer}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
  {/* Back Button */}
  <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
    <ArrowLeftIcon size={18} color={'#333'} />
  </TouchableOpacity>

  {/* Tabs */}
  <View style={styles.tabWrapper}>
    {['Equity', 'FNO'].map(tab => (
      <TouchableOpacity
        key={tab}
        style={[
          styles.tabButton,
          selectedTab === tab && styles.activeTabButton
        ]}
        onPress={() => handleTabSwitch(tab)}
      >
        <Text style={[
          styles.tabButtonText,
          selectedTab === tab && styles.activeTabButtonText
        ]}>
          {tab}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>


      {/* Search bar */}
      {selectedTab === 'Equity' ? (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchBar}
            placeholderTextColor={'grey'}
            placeholder="Search & add stocks"
            value={searchQuery}
            onChangeText={onQueryChange}
            autoFocus={true}
          />
          <TouchableOpacity onPress={() => {
            onQueryChange('');
            setResults([]);
          }}>
            <XIcon size={16} color={'grey'} />
          </TouchableOpacity>
        </View>
      ) : (
        // FNO Inputs
        <View style={styles.fnoContainer}>
          {adviceDerivativesEntries.map((entry, index) => (
           // console.log('isfocus',entry),
            <View key={index} style={styles.dropdownRow}>

              
              {/* Symbol Dropdown */}
              <Dropdown
                style={[
                  styles.dropdownBoxsymbol,
                  focusedIndex === `symbol-${index}` && styles.dropdownFocussymbol
                ]}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={{ width: 20, height: 20 }}
                data={
                  Array.from(new Set((entry.symbols || []).map(s => s.searchSymbol || s.symbol)))
                    .filter(sym => sym)
                    .map(uniqueSymbol => {
                      const matched = entry.symbols.find(s => (s.searchSymbol || s.symbol) === uniqueSymbol);
                      if (!matched) return null;
                      return {
                        label: matched.searchSymbol || matched.symbol,
                        value: matched.symbol,
                        lotsize: matched.lotsize,
                        strike: matched.strike,
                        exchange: matched.exchange,
                        optionType: matched.optionType,
                      };
                    }).filter(item => item)
                }
                search
         
                labelField="label"
                valueField="label"
             
                placeholder={!entry.isFocus ? 'Select symbol' : ''}
                searchPlaceholder="Search..."
                value={entry.selectedSymbol}
                onFocus={() => {
                  const updated = [...adviceDerivativesEntries];
                  updated[index].isFocus = true;
                  setFocusedIndex(`symbol-${index}`)
                  setAdviceDerivativesEntries(updated);
                }}
                onBlur={() => {
                  const updated = [...adviceDerivativesEntries];
                  updated[index].isFocus = false;
                  setFocusedIndex(null)
                  setAdviceDerivativesEntries(updated);
                }}
                onChange={(item) => {
                  console.log('itme------mmmmmmmmmmmmmmmm--',item);
                  const updated = [...adviceDerivativesEntries];
                  updated[index].selectedSymbol = item.label;
                  updated[index].isFocus = false;
                
                  setAdviceDerivativesEntries(updated);
                
                  handleDerivativesSymbolSelect(
                    index,
                    item,
                    item.lotsize,
                    item.strike,
                    item.exchange,
                    item.optionType
                  );
                  const sym=item?.value;
                  console.log('symmmmkm',sym);
                  setsymbolfno(sym);
                                  
                  const entry = updated[index];
                  if (entry.selectedSymbol && entry.strike && optionType) {
                    entry.optionType = optionType;
                    addFnoResult(entry);
                  }
                }}
                
                onChangeText={(text) => {
                  const updatedEntries = [...adviceDerivativesEntries];
                  updatedEntries[index].symbol = text;
                  handleDerivativesInputChange(index, text);
                }}
                renderItem={(item) => <DropdownRenderItem text={item.label} />}
    
              />

              {/* Strike Price Dropdown (same styling, mock data example) */}
              <Dropdown
                style={[
                  styles.dropdownBox,
                  focusedIndex === `strike-${index}` && styles.dropdownFocusstrike
                ]}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={{ width: 20, height: 20 }}
                data={
                  (entry.symbols || []).map((s, i) => ({
                    label: s.strike?.toString(),
                    value: s.strike?.toString()
                  })).filter(i => i.value)
                }
                search
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Strike"
                searchPlaceholder='Strike'
                value={entry.strike}
                onChange={(item) => {
                  const updated = [...adviceDerivativesEntries];
                  updated[index].strike = item.value;
                  setAdviceDerivativesEntries(updated);
                  console.log('stijjkkv',item);
                  // Check if all 3 values exist, then add to fnoResults
                  const entry = updated[index];
                  if (entry.selectedSymbol && entry.strike && optionType) {
                    entry.optionType = optionType;
                    addFnoResult(entry);
                  }
                }}
                
                onFocus={() => setFocusedIndex(`strike-${index}`)}
                onBlur={() => setFocusedIndex(null)}
                renderItem={(item) => <DropdownRenderItem text={item.label} />}
              />

              {/* CE/PE Dropdown */}
              <Dropdown
                style={[
                  styles.dropdownBox,
                  focusedIndex === `option-${index}` && styles.dropdownFocuscepe
                ]}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={{ width: 20, height: 20 }}
                data={cePeOptions}
                labelField="label"
                valueField="value"
                placeholder="CE / PE"
                value={optionType}
                onChange={(item) => {
                  setOptionType(item.value);
                
                  const updated = [...adviceDerivativesEntries];
                  updated[index].optionType = item.value;
                  setAdviceDerivativesEntries(updated);
                
                  // Check if all 3 values exist, then add to fnoResults
                  const entry = updated[index];
                 
                  if (entry.selectedSymbol && entry.strike && item.value) {
                    addFnoResult(entry);
                  }
                }}
                
                renderItem={(item) => <DropdownRenderItem text={item.label} />}
                onFocus={() => setFocusedIndex(`option-${index}`)}
                onBlur={() => setFocusedIndex(null)}
              />
            </View>
          ))}

       
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={selectedTab === 'Equity' ? results : fnoResults}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              {selectedVariant === "magnus" ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text>Loading...</Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isBookmarked = (watchlists[currentTab] || []).some(w => w.id === item.id);
          return (
            <View style={styles.searchResultCard}>
              <View style={styles.stockMarketContainer}>
              <Text style={styles.stockMarket}>{item.exchange}</Text>
               </View>
              <View style={styles.stockDetails}>
                <Text style={styles.stockName}>{item.name}</Text>
                <Text style={styles.stockCompany}>{item.symbol}</Text>
              </View>
              <TouchableOpacity onPress={() => handleBookmarkPress(item)} style={styles.bookmarkButton}>
                <Icon
                  name={isBookmarked ? "checksquare" : "plussquareo"}
                  size={20}
                  color={'#16A085'}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 130 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchResultsContainer: {
    marginTop: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#eee',
  },
  activeTab: {
    backgroundColor: '#4B75F2',
  },
  tabText: {
    color: '#555',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 13,
    color: 'grey',
  },
  fnoContainer: {
    gap: 10,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  dropdownBoxsymbol: {
    width:'40%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  dropdownBox: {
    flex:1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  dropdownFocussymbol: {
    borderColor: '#0056B7',
    borderWidth: 1.5,
    shadowColor: '#4B75F2',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  dropdownFocusstrike: {
    borderColor: '#0056B7',
    borderWidth: 1.5,
    shadowColor: '#4B75F2',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },  dropdownFocuscepe: {
    borderColor: '#0056B7',
    borderWidth: 1.5,
    shadowColor: '#4B75F2',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: '#6B7280',
  },
  selectedText: {
    fontSize: 12,
    color: '#333',
  },
  inputSearchStyle: {
    fontSize: 12,

    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  
  searchButton: {
    backgroundColor: '#4B75F2',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  stockMarket: {
    backgroundColor: '#e7eefd',
    color: '#76a9ea',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  stockDetails: {
    flex: 1,
    marginLeft: 10,
  },
  stockName: {
    fontSize: 14,
    fontFamily:'Satoshi-Bold',
    color:'black',
  },
  stockMarketContainer: {
    backgroundColor: '#e7eefd',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start', // prevent stretching in row
  },
  
  stockMarketText: {
    color: '#76a9ea',
    fontSize: 12,
  }
,  
  stockCompany: {
    fontSize: 12,
    fontFamily:'Satoshi-Regular',
    color:'grey',
  },
  bookmarkButton: {
    paddingHorizontal: 10,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dropdownItemText: {
    fontSize: 12, // <<< Set this smaller value to reduce font size
    color: '#333',
  }

,
  symbolDropdown: {
    flex: 0.4,
    marginRight: 5,
  },
  
  strikeDropdown: {
    flex: 0.3,
    marginRight: 5,
  },
  
  optionTypeDropdown: {
    flex: 0.3,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  
  backButton: {
    padding: 6,
    marginRight: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    elevation: 2,
  },
  
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#EAEAEA',
    borderRadius: 25,
    padding: 4,
    flex: 1,
    justifyContent: 'space-between',
  },
  
  tabButton: {
    paddingVertical: 8,
    flex:1,
    borderRadius: 20,
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',

  },
  
  activeTabButton: {
    backgroundColor: '#3D0E55',
  },
  
  tabButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  
  activeTabButtonText: {
    color: '#fff',
    fontWeight: '600',
  }
  
});
export default WishSearch;
