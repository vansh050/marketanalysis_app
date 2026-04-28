import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import server from '../../utils/serverConfig';
import {
  ChevronUpIcon,
  ChevronLeft,
  ChevronDownIcon,
  Calendar,
} from 'lucide-react-native';
import dayjs from 'dayjs';

import {Dropdown} from 'react-native-element-dropdown';
import moment from 'moment';
import {useNavigation} from '@react-navigation/native';
import CalendarPicker from 'react-native-calendar-picker';
import Accordion from 'react-native-collapsible/Accordion';
import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import {useTrade} from '../TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
const {width: screenWidth} = Dimensions.get('window');
const HistoryScreen = () => {
  const {configData} = useTrade();
  const auth = getAuth();
  const navigation = useNavigation();
  const user = auth.currentUser;
  const userEmail = user && user.email;
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [filterData, setFilterData] = useState('All Trades');
  const [data, setData] = useState([]);
  const [broker, setbroker] = useState([]);
  const [filterTradeHistory, setFilterTradeHistory] = useState([]);
  const [Loading, setLoading] = useState(false);
  const [value, setValue] = useState('All Trades');
  const [isFocus, setIsFocus] = useState(false);

  const [filteredeData, setFilteredData] = useState([]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const menuOptions = [
    {label: 'All Trades', value: 'All Trades'},
    {label: 'Profit', value: 'profit'},
    {label: 'Loss', value: 'loss'},
  ];

  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => {
        setbroker(res.data.User.user_broker);
      })
      .catch(err => console.log(err));
  };

  const getAllTrades = () => {
    if (!userEmail) return;
    setLoading(true);
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/trade-history/trade-history-by-client?email=${userEmail}`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };
    axios
      .request(config)
      .then(response => {
        const stockData = response?.data?.trades;
        setData(stockData);
        setFilterTradeHistory(response.data.trades);
        setLoading(false);
      })
      .catch(error => {
        //console.log(error);
        setLoading(false);
      });
  };
  useEffect(() => {
    getUserDeatils();
    getAllTrades();
  }, []);

  const handleDropdownSelection = value => {
    setValue(value);
    setIsDropdownOpen(false);
    // Logic for filtering trades can be added here.
  };

  const handleClear = () => {
    setSelectedStartDate(null); // Set to null instead of an empty string
    setSelectedEndDate(null); // Set to null instead of an empty string
    setValue('');
  };

  useEffect(() => {
    if (!data) return;

    // Copy of data to avoid mutating the original array
    let raw = [...data];

    // Sort the trade history by date in descending order

    // Filter by profit, loss, or show all based on filterData
    let filteredTrades = [];
    if (value === 'profit') {
      filteredTrades = raw.filter(trade => trade.pnl > 0); // Profit trades
    } else if (value === 'loss') {
      filteredTrades = raw.filter(trade => trade.pnl < 0); // Loss trades
    } else {
      filteredTrades = raw; // View all
    }

    // Further filter by startDate and endDate if they are provided
    if (selectedStartDate) {
      filteredTrades = filteredTrades.filter(trade =>
        moment(trade.sell[0]?.exitDate).isSameOrAfter(selectedStartDate, 'day'),
      );
    }
    if (selectedEndDate) {
      // Change here to selectedEndDate
      filteredTrades = filteredTrades.filter(trade =>
        moment(trade.sell[0]?.exitDate).isSameOrBefore(selectedEndDate, 'day'),
      );
    }

    // Update the filtered data
    //console.log('jk', filteredTrades);
    setFilterTradeHistory(filteredTrades);
  }, [value, selectedStartDate, selectedEndDate, data]);

  const handleApplyFilter = value => {
    // console.log("Filter Applied !!");
    // console.log("Start Date", startDate);
    // console.log("End Date", endDate);
    if (!data) return;
    // Copy of data to avoid mutating the original array
    let raw = [...data];
    // Sort the trade history by date in descending order
    // Filter by profit, loss, or show all based on filterData
    let filteredTrades = [];
    if (value === 'profit') {
      filteredTrades = raw.filter(trade => trade.pnl > 0); // Profit trades
    } else if (value === 'loss') {
      filteredTrades = raw.filter(trade => trade.pnl < 0); // Loss trades
    } else {
      filteredTrades = raw; // View all
    }
    // Further filter by startDate and endDate if they are provided
    if (selectedStartDate) {
      filteredTrades = filteredTrades.filter(trade =>
        moment(trade.sell[0]?.exitDate).isSameOrAfter(selectedStartDate, 'day'),
      );
    }
    if (endDate) {
      filteredTrades = filteredTrades.filter(trade =>
        moment(trade.sell[0]?.exitDate).isSameOrBefore(selectedEndDate, 'day'),
      );
    }
    // Update the filtered data
    console.log('filter', filteredTrades);
    setFilterTradeHistory(filteredTrades);
  };

  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [clear, setClear] = useState(false);
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

  const [activeSections, setActiveSections] = useState([]); // Handles which sections are expanded

  const filteredTradeHistory = filterTradeHistory
    ?.filter(
      stock =>
        stock.hasOwnProperty('exited_quantity') &&
        stock?.user_broker === broker,
    )
    ?.sort((a, b) => {
      const dateA = new Date(a.sell[0]?.exitDate);
      const dateB = new Date(b.sell[0]?.exitDate);
      return dateB - dateA; // Sort by date in descending order
    });

  // Mapping the filtered data into sections
  const sections = filteredTradeHistory?.map((item, index) => ({
    symbol: item.Symbol,
    exitDate: item.sell[0]?.exitDate
      ? new Date(item.sell[0]?.exitDate)
          .toLocaleDateString(undefined, {
            year: '2-digit', // Use '2-digit' to get the two-digit year
            month: '2-digit', // Use '2-digit' to ensure two-digit month
            day: '2-digit', // Use '2-digit' to ensure two-digit day
          })
          .replace(/\//g, '/') // Replace slashes with slashes if necessary
      : '-',
    buyQuantity: item.buy[0]?.Quantity || '-',
    tradedPrice: item.buy[0]?.tradedPrice || '-',
    entryPrice: item.buy[0]?.tradedPrice ? `${item.buy[0]?.tradedPrice}` : '-',
    sellQuantity: item.sell[0]?.Quantity || '-',
    exitPrice: item.sell[0]?.exitPrice || '-',
    pnl: item?.pnl,
    purchaseDate: item.buy[0]?.purchaseDate
      ? new Date(item.buy[0]?.purchaseDate)
          .toLocaleDateString(undefined, {
            year: '2-digit', // Use '2-digit' to get the two-digit year
            month: '2-digit', // Use '2-digit' to ensure two-digit month
            day: '2-digit', // Use '2-digit' to ensure two-digit day
          })
          .replace(/\//g, '/') // Replace slashes with slashes if necessary
      : '-',
  }));

  // Method to update which section is active/expanded
  const updateSections = activeSections => {
    setActiveSections(activeSections);
  };

  // Render the header of each accordion section (collapsed view)
  const renderHeader = (item, _, isActive) => (
    <ScrollView>
      <View
        style={[styles.itemContainer, {borderBottomWidth: isActive ? 0 : 0.5}]}>
        <View style={styles.row}>
          <View style={styles.leftColumn}>
            <Text style={styles.dateRangeText}>
              {item.exitDate} - {item.purchaseDate}
            </Text>
            <View style={{flex: 1, padding: 0, maxWidth: 120}}>
              <Text style={styles.stockName}>{item.symbol}</Text>
            </View>
            <View
              style={{
                marginRight: 5,
                alignItems: 'center', // Center items horizontally
                justifyContent: 'center', // Center items vertically
                flexDirection: 'row', // Align items in a row
              }}>
              {item?.pnl > 0 ? (
                <Text style={styles.cellTextGreen}>
                  +₹{item?.pnl ? item?.pnl.toFixed(2) : '-'}
                </Text>
              ) : item?.pnl < 0 ? (
                <Text style={styles.cellTextRed}>-₹{Math.abs(item?.pnl)}</Text>
              ) : (
                <Text style={styles.cellText}>-</Text>
              )}
            </View>
          </View>

          <View style={styles.rightColumn}>
            {isActive ? (
              <ChevronUpIcon size={20} color={'black'} />
            ) : (
              <ChevronDownIcon size={20} color={'black'} />
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // Render the content of each accordion section (expanded view)
  const renderContent = item => (
    <View style={{}}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginVertical: 20,
          marginHorizontal: 15,
        }}>
        <Text style={styles.cellText}>
          Price: {item.exitPrice} (Exit) - {item.entryPrice} (Entry)
        </Text>
        <Text style={styles.cellText}>
          Qty: {item.sellQuantity} (Exit) - {item.buyQuantity} (Entry)
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ChevronLeft
            style={{
              marginRight: 10,
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginTop: 3,
            }}
            size={24}
            color="black"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade History</Text>
      </View>
      <View style={{backgroundColor: '#f8f8f8', paddingHorizontal: 0}}>
        {/* Date Range and Filter Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            onPress={() => setStartDateOpen(true)}
            style={styles.datePicker}>
            <Text style={styles.datepickerText}>
              {selectedStartDate
                ? dayjs(selectedStartDate).format('DD/MM/YYYY')
                : 'dd/mm/yy'}{' '}
              -
              {selectedEndDate
                ? dayjs(selectedEndDate).format('DD/MM/YYYY')
                : 'dd/mm/yy'}
            </Text>
            <Calendar
              size={15}
              color={'black'}
              style={{marginLeft: 8, alignSelf: 'center'}}
            />
          </TouchableOpacity>
          <Dropdown
            style={[styles.dropdown, isFocus && {borderColor: 'blue'}]}
            placeholderStyle={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: 'black',
            }}
            selectedTextStyle={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: 'black',
            }}
            inputSearchStyle={{color: 'black', fontSize: 11}}
            iconStyle={{color: 'white'}}
            data={menuOptions}
            labelField="label"
            valueField="value"
            itemTextStyle={{color: 'black', fontSize: 11}}
            placeholder={!isFocus ? 'All Trades' : '...'}
            value={value}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            onChange={item => {
              setValue(item.value);
              setIsFocus(false);
              //handleApplyFilter(item.value);
              console.log(item.value);
            }}
          />
          <TouchableOpacity onPress={handleClear} style={styles.filterButton}>
            <Text
              style={{
                color: 'white',
                fontFamily: 'Poppins-Regular',
                fontSize: 11,
              }}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        {filteredTradeHistory.length === 0 ? (
          //   <View style={{justifyContent:'center',alignContent:'center',alignItems:'center',marginTop:50,}}>

          //   <History size={25} color={'grey'} style={{marginBottom:20}} />
          //   <Text style={{color:'black',fontFamily:'Poppins-Regular',fontSize:16}}>No Trade History</Text>
          //   <Text style={{color:'black',fontFamily:'Poppins-Regular',fontSize:14,textAlign:'center',paddingHorizontal:20}}>
          //     No trades have been recorded yet. When you complete a trade, it will be
          //     listed here.
          //   </Text>
          // </View>
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              marginVertical: 20,
              marginHorizontal: 20,
              backgroundColor: '#FFF5F2',
              borderRadius: 16,
              overflow: 'hidden',
              width: '90%',
              alignSelf: 'center',
              marginTop: 100,
            }}>
            {/* Decorative background elements */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.7,
                backgroundColor: '#fff',
                borderRadius: 16,
              }}>
              <View
                style={{
                  position: 'absolute',
                  top: -80,
                  right: -80,
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: 'rgba(107, 20, 0, 0.08)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: -60,
                  left: -60,
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: 'rgba(173, 66, 38, 0.06)',
                }}
              />
            </View>

            {/* Icon container with nested circles for depth */}
            <View
              style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                shadowColor: '#6B1400',
                shadowOffset: {width: 0, height: 4},
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 4,
              }}>
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: 'rgba(107, 20, 0, 0.05)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}></View>
            </View>

            <Text
              style={{
                fontFamily: 'Satoshi-SemiBold',
                fontSize: 18,
                color: '#3A0B00',
                textAlign: 'center',
                marginBottom: 12,
              }}>
              No Trade History
            </Text>

            <Text
              style={{
                fontFamily: 'Satoshi-Medium',
                fontSize: 14,
                color: '#4D2418',
                textAlign: 'center',
                maxWidth: '85%',
                lineHeight: 20,
                marginBottom: 16,
              }}>
              No trades have been recorded yet. When you complete a trade, it
              will be
            </Text>
          </View>
        ) : (
          <View style={{marginBottom: 130}}>
            <Accordion
              sections={sections}
              activeSections={activeSections}
              renderHeader={renderHeader}
              renderAsFlatList
              renderContent={renderContent}
              onChange={updateSections}
              underlayColor="transparent" // To keep the background intact
            />
          </View>
        )}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={startDateOpen}
        onRequestClose={() => setStartDateOpen(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <CalendarPicker
              startFromMonday={true}
              allowRangeSelection={true}
              minDate={minDate}
              width={screenWidth * 0.8}
              maxDate={maxDate}
              monthTitleStyle={{color: 'black'}}
              previousTitleStyle={{color: 'black'}}
              nextTitleStyle={{color: 'black'}}
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
                handleApplyFilter(value); // Or any other function you want to execute
              }}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 20,
    color: 'black',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },

  headerSubtext: {
    minWidth: 110,
    fontSize: 15,
    paddingHorizontal: 25,
    fontFamily: 'Poppins-Regular',
    color: 'grey',
  },
  filterSection: {
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 0,
  },
  headerCell: {
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 10,
    minWidth: 110, // Keep the same width for both header and data cells
    justifyContent: 'center',
    borderWidth: 0.3,
    borderColor: 'grey',
    textAlign: 'center',
  },
  headerCell1: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 110, // Keep the same width for both header and data cells
    justifyContent: 'center',
    borderWidth: 0.3,
    borderColor: 'grey',
    textAlign: 'center',
  },
  headerCellfirst: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    minWidth: 110,
    justifyContent: 'center',
    borderWidth: 0.3,
    borderColor: 'grey',
    borderTopLeftRadius: 10,
    textAlign: 'center',
  },
  headerCelllast: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    minWidth: 110,
    justifyContent: 'center',
    borderWidth: 0.3,
    borderColor: 'grey',
    borderTopRightRadius: 10,
    textAlign: 'center',
  },
  headerText1: {
    fontSize: 12,
    minWidth: 110,
    justifyContent: 'center',
    color: '#727272',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  headerview: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  headerview1: {
    alignItems: 'center', // Centers content horizontally
    justifyContent: 'center',
  },
  datePicker: {
    borderColor: '#E4E4E4',
    backgroundColor: 'white',
    paddingVertical: 4,
    paddingHorizontal: 10,
    elevation: 3,
    fontSize: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'Poppins-Regular',
    borderRadius: 4,
    marginHorizontal: 10,
    color: 'black',
  },
  datepickerText: {
    fontSize: 11,
    color: 'black',
    fontFamily: 'Poppins-Regular',
  },
  arrow: {
    color: 'grey',
    marginHorizontal: 8,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  buyOrder: {
    minWidth: 110,
    color: 'green',
  },
  sellOrder: {
    minWidth: 110,
    color: 'red',
  },
  headerText: {
    fontSize: 12,
    minWidth: 110,
    textAlign: 'center',
    fontFamily: 'Poppins-Medium',
    color: 'grey',
  },

  cell: {
    borderWidth: 0.2,
    borderTopWidth: 0,
    justifyContent: 'center',
    borderColor: 'grey',
    minWidth: 110,
  },
  cellText: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  cellTextName: {
    fontSize: 12,
    color: 'black',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  cellTextGreen: {
    fontSize: 13,
    color: '#338D72',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: 'Poppins-SemiBold',
  },
  cellTextRed: {
    fontSize: 13,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    color: '#EF344A',
    fontFamily: 'Poppins-SemiBold',
  },
  horizontal: {
    height: 6,
    marginBottom: 20,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
  },
  dataTable: {
    width: '100%',
    minWidth: 110,
    marginBottom: 50,
  },
  tableHeader: {
    paddingHorizontal: 2,
    elevation: 1,
  },
  dropdownMenu: {
    padding: 5,
    color: 'black',
    backgroundColor: '#002a5c',
    borderRadius: 4,
    marginLeft: 8,
  },
  dropdownItem: {padding: 10, color: 'black'},
  dropdownItemText: {fontSize: 11, color: 'black'},
  dropdown: {
    width: screenWidth * 0.275,
    color: 'black',
    borderColor: '#E4E4E4',
    backgroundColor: 'white',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    elevation: 2,

    marginRight: 8,
  },

  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  modalView: {
    width: screenWidth * 0.85, // Adjust this to control modal width
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#002a5c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  //
  itemContainer: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderBottomColor: '#ddd',
    borderTopColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftColumn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRangeText: {
    color: '#555',
    fontSize: 11,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: 'Poppins-Regular',
  },
  stockName: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#000',
  },
  profitLossText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    marginRight: 10,
  },
});

export default HistoryScreen;
