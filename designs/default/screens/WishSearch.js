import React from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator} from 'react-native';
import Icon from 'react-native-vector-icons/AntDesign';
import {ArrowLeftIcon, XIcon} from 'lucide-react-native';
import {Dropdown} from 'react-native-element-dropdown';

import {designColor, designFont} from '../../../src/design/literalTokens';

const WishSearch = ({viewModel, actions}) => {
  const {
    selectedVariant, selectedTab, searchQuery, results, loading,
    adviceDerivativesEntries, focusedIndex, optionType, fnoResults,
    currentTab, watchlists, cePeOptions,
  } = viewModel;
  const {
    onBackPress, onQueryChange, handleTabSwitch, setResults,
    setFocusedIndex, setAdviceDerivativesEntries,
    handleDerivativesSymbolSelect, setsymbolfno,
    handleDerivativesInputChange, addFnoResult, setOptionType,
    handleBookmarkPress,
  } = actions;

  const DropdownRenderItem = ({text}) => (
    <View style={styles.dropdownItem}>
      <Text style={styles.dropdownItemText}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.searchResultsContainer}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
  {/* Back Button */}
  <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
    <ArrowLeftIcon size={18} color={designColor('333')} />
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
        (<View style={styles.fnoContainer}>
          {adviceDerivativesEntries.map((entry, index) => (
           // console.log('isfocus',entry),
            (<View key={index} style={styles.dropdownRow}>
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
            </View>)
          ))}
        </View>)
      )}
      {/* Results List */}
      <FlatList
        data={selectedTab === 'Equity' ? results : fnoResults}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              {selectedVariant === "magnus" ? (
                <ActivityIndicator size="small" color={designColor('000')} />
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
                  color={designColor('16a085')}
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
    backgroundColor: designColor('fff'),
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
    backgroundColor: designColor('eee'),
  },
  activeTab: {
    backgroundColor: designColor('4b75f2'),
  },
  tabText: {
    color: designColor('555'),
  },
  activeTabText: {
    color: designColor('fff'),
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: designColor('e6e6e6'),
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
    backgroundColor: designColor('f9fafb'),
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: designColor('e5e7eb'),
    borderWidth: 1,
  },
  dropdownBox: {
    flex:1,
    backgroundColor: designColor('f9fafb'),
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: designColor('e5e7eb'),
    borderWidth: 1,
  },
  dropdownFocussymbol: {
    borderColor: designColor('0056b7'),
    borderWidth: 1.5,
    shadowColor: designColor('4b75f2'),
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  dropdownFocusstrike: {
    borderColor: designColor('0056b7'),
    borderWidth: 1.5,
    shadowColor: designColor('4b75f2'),
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },  dropdownFocuscepe: {
    borderColor: designColor('0056b7'),
    borderWidth: 1.5,
    shadowColor: designColor('4b75f2'),
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: designColor('6b7280'),
  },
  selectedText: {
    fontSize: 12,
    color: designColor('333'),
  },
  inputSearchStyle: {
    fontSize: 12,

    borderColor: designColor('ddd'),
    borderRadius: 8,
    paddingHorizontal: 10,
    color: designColor('333'),
    backgroundColor: designColor('fafafa'),
  },

  searchButton: {
    backgroundColor: designColor('4b75f2'),
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: designColor('eee'),
  },
  stockMarket: {
    backgroundColor: designColor('e7eefd'),
    color: designColor('76a9ea'),
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
    fontFamily:designFont('Satoshi-Bold'),
    color:'black',
  },
  stockMarketContainer: {
    backgroundColor: designColor('e7eefd'),
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start', // prevent stretching in row
  },

  stockMarketText: {
    color: designColor('76a9ea'),
    fontSize: 12,
  }
,
  stockCompany: {
    fontSize: 12,
    fontFamily:designFont('Satoshi-Regular'),
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
    color: designColor('333'),
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
    backgroundColor: designColor('f0f0f0'),
    borderRadius: 8,
    elevation: 2,
  },

  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: designColor('eaeaea'),
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
    backgroundColor: designColor('3d0e55'),
  },

  tabButtonText: {
    fontSize: 14,
    color: designColor('333'),
    fontWeight: '500',
  },

  activeTabButtonText: {
    color: designColor('fff'),
    fontWeight: '600',
  }

});
export default WishSearch;
