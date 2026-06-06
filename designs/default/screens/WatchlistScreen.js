/**
 * WatchlistScreen — design-system screen presentation (Phase G batch 4, 2026-05-02)
 *
 * Pure presentation. Container owns useConfig, useTrade, useRoute,
 * useFocusEffect, useLTPStore (via WatchlistRow), WebSocketManager,
 * axios symbol search, AsyncStorage persistence, watchlist CRUD.
 *
 * Contract:
 *   viewModel = {
 *     // theme
 *     themeColor, gradient1, gradient2,
 *     // state
 *     editMode, activeTab, searchQuery,
 *     watchlistOptions, currentWatchlist, currentWatchlistCount,
 *     searchSuggestions, searchLoading,
 *     isWatchlistPickerVisible,
 *     dropdownVisible,
 *   }
 *   actions = {
 *     onGoBack,
 *     onSetActiveTab, onSetSearchQuery,
 *     onSetEditMode, onSaveEditWatchlist,
 *     onSetIsWatchlistPickerVisible,
 *     onDeleteStock, onAddStockToWatchlist,
 *   }
 *   slots = {
 *     WatchlistRowRenderer,  // (item) => ReactElement — renders a single row with live LTP
 *   }
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {
  SearchIcon,
  Trash2,
  ChevronLeft,
  Search,
} from 'lucide-react-native';
import {Pencil} from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Fontisto';
import LinearGradient from 'react-native-linear-gradient';

const WatchlistScreen = ({ viewModel, actions, slots }) => {
  const {
    themeColor = '#0056B7',
    gradient1 = 'rgba(0, 38, 81, 1)',
    gradient2 = 'rgba(0, 86, 183, 1)',
    editMode = false,
    activeTab = 1,
    searchQuery = '',
    watchlistOptions = [],
    currentWatchlist = [],
    currentWatchlistCount = 0,
    searchSuggestions = [],
    searchLoading = false,
    isWatchlistPickerVisible = false,
  } = viewModel || {};

  const {
    onGoBack = () => {},
    onSetActiveTab = () => {},
    onSetSearchQuery = () => {},
    onSetEditMode = () => {},
    onSaveEditWatchlist = () => {},
    onSetIsWatchlistPickerVisible = () => {},
    onDeleteStock = () => {},
    onAddStockToWatchlist = () => {},
  } = actions || {};

  const {
    WatchlistRowRenderer = null,
  } = slots || {};

  if (editMode) {
    return (
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
              onPress={() => onSetEditMode(false)}
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
                  default: 'HelveticaNeueMedium',
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
            onPress={onSaveEditWatchlist}>
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
        <TouchableOpacity onPress={() => onSetIsWatchlistPickerVisible(true)}>
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
                  default: 'HelveticaNeueMedium',
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
                  default: 'HelveticaNeueMedium',
                }),
                paddingVertical: 0,
                backgroundColor: 'transparent',
              }}
              value={
                watchlistOptions.find(opt => opt.value === activeTab)?.label || ''
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
            data={currentWatchlist}
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
                        default: 'HelveticaNeueMedium',
                      }),
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {item.name || item.symbol}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onDeleteStock(item.id, item.name || item.symbol)}
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
                      default: 'HelveticaNeueMedium',
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
            onPress={() => onSetIsWatchlistPickerVisible(false)}>
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
              <TouchableOpacity
                onPress={() => onSetIsWatchlistPickerVisible(false)}
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
                      onSetActiveTab(item.value);
                      onSetIsWatchlistPickerVisible(false);
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
    );
  }

  // Normal mode
  return (
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
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.headerGradient}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>WatchList</Text>
          </View>
        </LinearGradient>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 8}}>
          {watchlistOptions.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={{
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 10,
                paddingHorizontal: 10,
                borderBottomWidth: activeTab === tab.value ? 2 : 0,
                borderBottomColor:
                  activeTab === tab.value ? '#000' : 'transparent',
                marginBottom: -1,
                marginRight: 10,
              }}
              onPress={() => onSetActiveTab(tab.value)}
              activeOpacity={0.7}>
              <Text
                style={{
                  color: activeTab === tab.value ? '#000' : '#888',
                  fontFamily: Platform.select({
                    ios: 'HelveticaNeue-Medium',
                    android: 'HelveticaNeueMedium',
                    default: 'HelveticaNeueMedium',
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
                  default: 'HelveticaNeue',
                }),
                fontSize: 14,
                color: '#222',
                paddingVertical: 0,
                height: 38,
              }}
              placeholder="Search Stocks"
              placeholderTextColor="#86868A"
              value={searchQuery}
              onChangeText={text => onSetSearchQuery(text)}
            />
            <Text style={{color: '#888', fontSize: 12}}>
              {currentWatchlistCount}/25
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onSetEditMode(true)}
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
                  default: 'HelveticaNeueMedium',
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
                    const alreadyInWatchlist = currentWatchlist.some(
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
                          onAddStockToWatchlist({
                            id: item.token,
                            name: item.name,
                            symbol: item.symbol,
                            exchange: item.segment,
                            companyName: item.companyName,
                            industry: item.industry,
                          });
                          onSetSearchQuery('');
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
                  default: 'HelveticaNeueMedium',
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
                  default: 'HelveticaNeueMedium',
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
                  default: 'HelveticaNeueMedium',
                }),
                fontSize: 12,
                textAlign: 'right',
                letterSpacing: 0.2,
              }}>
              PRICE
            </Text>
          </View>
          {/* Stock List */}
          {currentWatchlist.length > 0 ? (
            <FlatList
              data={currentWatchlist}
              keyExtractor={item => item.id?.toString() || item.symbol}
              renderItem={({item}) => WatchlistRowRenderer ? WatchlistRowRenderer(item) : null}
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
};

const styles = StyleSheet.create({
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
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
});

export default WatchlistScreen;
