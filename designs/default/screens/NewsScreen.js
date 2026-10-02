import React from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import CalendarPicker from 'react-native-calendar-picker';
import AwesomeAlert from 'react-native-awesome-alerts';
import dayjs from 'dayjs';
import {ArrowLeft, Calendar} from 'lucide-react-native';
import Icon from 'react-native-vector-icons/Fontisto';

import {
  designColor,
  designFont,
} from '../../../src/design/literalTokens';

const {width: screenWidth} = Dimensions.get('window');

/**
 * Presentation-only AI news surface. Network, token purchase, Firebase and
 * navigation behavior stay in src/screens/Home/NewsScreen/NewsScreen.js and
 * arrive here as viewModel/actions/slots.
 */
const NewsScreen = ({viewModel, actions, slots}) => {
  const {
    mainColor,
    secondaryColor,
    searchQuery,
    tokens,
    options,
    daysAgo,
    selectedStartDate,
    selectedEndDate,
    loading,
    finalNewsData,
    results,
    historyNewsData,
    symbol,
    socketsymbol,
    socketseg,
    startDateOpen,
    minDate,
    maxDate,
    showFailedAlert,
    showAlert,
    selectedCoin,
    modalVisible,
    userEmail,
  } = viewModel;
  const {
    setSearchQuery,
    handleOpenTokenPurchase,
    handleDaysAgoSelect,
    setStartDateOpen,
    closeNewsModal,
    openNewsModal,
    openNewsHistoryModal,
    convertToIST,
    onDateChange,
    setShowFailAlert,
    setShowAlert,
    setModalVisible,
    setselectedCoin,
    PurchaseToken,
    getToken,
  } = actions;
  const {
    Coin,
    Loader,
    NewsInfoScreen,
    TokenPurchaseModal,
  } = slots;

  const renderSearchResult = ({item}) => (
    <TouchableOpacity onPress={() => openNewsModal(item)} activeOpacity={0.8}>
      <View style={styles.newsItemRecent}>
        <Text style={styles.newsTitleRecent}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({item}) => (
    <TouchableOpacity onPress={() => openNewsHistoryModal(item)}>
      <View style={styles.newsItemRecent}>
        <Text style={styles.newsTitleRecent}>{item.stock_symbol}</Text>
        <Text style={styles.newsDateRecent}>
          {item.datetime ? convertToIST(item.datetime) : 'No Date'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <LinearGradient
          colors={[
            mainColor || designColor('262626'),
            secondaryColor || designColor('262626'),
          ]}
          start={{x: 1, y: 1}}
          end={{x: 1, y: 0}}
          style={styles.headerGradient}>
          <View style={styles.searchRow}>
            <LinearGradient
              colors={[designColor('262626'), designColor('262626')]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.borderGradient}>
              <LinearGradient
                colors={[designColor('262626'), designColor('262626')]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.linearGradient}>
                <View style={styles.searchBarContainer}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    textAlignVertical="bottom"
                    placeholderTextColor={designColor('fff')}
                    style={styles.searchBar}
                    placeholder="India’s First AI News Search. Just Ask"
                    accessibilityLabel="Search stock news"
                  />
                  <TouchableOpacity
                    onPress={handleOpenTokenPurchase}
                    style={styles.coinContainer}
                    accessibilityRole="button"
                    accessibilityLabel={`${tokens || 0} news tokens`}>
                    <Coin width={20} height={20} />
                    <Text style={styles.tokenAmount}>{tokens}</Text>
                  </TouchableOpacity>
                  <Icon name="search" size={12} color={designColor('fff')} />
                </View>
              </LinearGradient>
            </LinearGradient>
          </View>

          <View style={styles.filtersRow}>
            <View style={styles.chipContainer}>
              {options.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.chip,
                    daysAgo === option.value && styles.selectedChip,
                  ]}
                  onPress={() => handleDaysAgoSelect(option.value)}>
                  <Text
                    style={[
                      styles.chipText,
                      daysAgo === option.value && styles.selectedChipText,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setStartDateOpen(true)}
              style={styles.datePicker}
              accessibilityRole="button"
              accessibilityLabel="Choose news date range">
              <Text style={styles.datePickerText}>
                {selectedStartDate
                  ? dayjs(selectedStartDate).format('D MMMM')
                  : 'dd/mm/yy'}{' '}
                -{' '}
                {selectedEndDate
                  ? dayjs(selectedEndDate).format('D MMMM')
                  : 'dd/mm/yy'}
              </Text>
              <Calendar
                size={12}
                color={designColor('fff')}
                style={styles.calendarIcon}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loaderOverlay}>
              <Loader color={designColor('000')} width={40} height={40} />
            </View>
          ) : null}

          {finalNewsData.length > 0 ? (
            <View style={styles.newsDetails}>
              <TouchableOpacity
                onPress={closeNewsModal}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to news history">
                <ArrowLeft size={20} color={designColor('000')} />
              </TouchableOpacity>
              <NewsInfoScreen
                symbol={symbol}
                socketsymbol={socketsymbol}
                socketseg={socketseg}
                news={finalNewsData}
                onClose={closeNewsModal}
              />
            </View>
          ) : (
            <Animatable.View animation="fadeInDown" duration={700}>
              <FlatList
                data={results.length > 0 ? results : historyNewsData}
                ListHeaderComponent={
                  results.length === 0 ? (
                    <View>
                      <View style={styles.historyHeader}>
                        <Text style={styles.newsTitleHeader}>History</Text>
                        <View style={styles.line} />
                      </View>
                      {historyNewsData.length === 0 ? (
                        <View style={styles.emptyHistory}>
                          <Text style={styles.emptyHistoryText}>
                            No Recent News History to Show
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null
                }
                contentContainerStyle={styles.listContent}
                keyExtractor={(item, index) =>
                  item?.id || item?._id || `${item?.stock_symbol || 'news'}-${index}`
                }
                renderItem={
                  results.length > 0 ? renderSearchResult : renderHistoryItem
                }
                showsVerticalScrollIndicator={false}
              />
            </Animatable.View>
          )}
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={startDateOpen}
        onRequestClose={() => setStartDateOpen(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <CalendarPicker
              startFromMonday
              allowRangeSelection
              minDate={minDate}
              width={screenWidth * 0.8}
              maxDate={maxDate}
              monthTitleStyle={styles.calendarTitle}
              previousTitleStyle={styles.calendarTitle}
              nextTitleStyle={styles.calendarTitle}
              todayBackgroundColor={designColor('9eaec1')}
              selectedDayColor={designColor('002a5c')}
              selectedDayTextColor={designColor('ffffff')}
              onDateChange={onDateChange}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setStartDateOpen(false)}>
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
        closeOnTouchOutside
        closeOnHardwareBackPress={false}
        showConfirmButton
        confirmText="Close"
        confirmButtonColor={designColor('dc2626')}
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
        closeOnTouchOutside
        closeOnHardwareBackPress={false}
        showConfirmButton
        confirmText="Close"
        confirmButtonColor={designColor('008000')}
        onConfirmPressed={() => {
          setShowAlert(false);
          setModalVisible(false);
        }}
      />

      {modalVisible ? (
        <TokenPurchaseModal
          setShowFailAlert={setShowFailAlert}
          setselectedCoin={setselectedCoin}
          setModalVisible={setModalVisible}
          setShowAlert={setShowAlert}
          userEmail={userEmail}
          PurchaseToken={PurchaseToken}
          getToken={getToken}
          visible={modalVisible}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: designColor('6d0dd6'),
  },
  modalContent: {
    width: '100%',
    height: '100%',
    backgroundColor: designColor('fff'),
  },
  headerGradient: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  searchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  borderGradient: {borderRadius: 10, padding: 2, marginHorizontal: 5},
  linearGradient: {
    borderRadius: 8,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  searchBarContainer: {flexDirection: 'row', alignItems: 'center'},
  searchBar: {
    flex: 1,
    padding: 0,
    paddingVertical: 5,
    color: designColor('fff'),
    fontSize: 13,
    fontFamily: designFont('Satoshi-Regular'),
  },
  coinContainer: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  tokenAmount: {
    position: 'absolute',
    fontSize: 9,
    color: designColor('fff'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingVertical: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: designColor('262626'),
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  selectedChip: {backgroundColor: designColor('262626')},
  chipText: {
    color: designColor('fff'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 9,
  },
  selectedChipText: {color: designColor('fff')},
  datePicker: {
    flexDirection: 'row',
    borderColor: designColor('262626'),
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  datePickerText: {
    fontSize: 9,
    color: designColor('fff'),
    alignSelf: 'center',
    fontFamily: designFont('Satoshi-Medium'),
  },
  calendarIcon: {marginLeft: 8, alignSelf: 'center'},
  content: {flex: 1},
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('ffffffcc'),
    zIndex: 10,
  },
  newsDetails: {flex: 1},
  backButton: {marginHorizontal: 20},
  listContent: {marginHorizontal: 20},
  historyHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 15},
  newsTitleHeader: {
    fontSize: 16,
    color: designColor('000'),
    paddingVertical: 10,
    fontFamily: designFont('Satoshi-Medium'),
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: designColor('aaa'),
    marginHorizontal: 10,
  },
  emptyHistory: {alignItems: 'center', paddingVertical: 20},
  emptyHistoryText: {
    color: designColor('808080'),
    fontFamily: designFont('Satoshi-Bold'),
  },
  newsItemRecent: {
    padding: 10,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: designColor('ddd'),
  },
  newsTitleRecent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColor('000'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  newsDateRecent: {
    fontSize: 12,
    color: designColor('888'),
    marginTop: 5,
    fontFamily: designFont('Satoshi-Medium'),
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('00000080'),
  },
  modalView: {
    width: screenWidth * 0.85,
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: designColor('000'),
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calendarTitle: {color: designColor('000')},
  closeButton: {
    marginTop: 20,
    backgroundColor: designColor('002a5c'),
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  closeButtonText: {color: designColor('ffffff'), fontSize: 16},
});

export default NewsScreen;
