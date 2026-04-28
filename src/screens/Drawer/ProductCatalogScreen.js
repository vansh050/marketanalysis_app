import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions  } from 'react-native';

import Icon from 'react-native-vector-icons/AntDesign';
import CustomToolbar from '../../components/CustomToolbar';
import { ChevronLeft,Clock,Flame,Info,SquareArrowUpRight,SquareArrowOutUpRight,ChevronUp,ChevronDown } from "lucide-react-native";
import { useNavigation } from '@react-navigation/native';
import Accordion from 'react-native-collapsible/Accordion';
import { TabView, TabBar, SceneMap } from 'react-native-tab-view';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // Assuming the design is based on a 375px wide screen (iPhone X)
const responsiveFontSize = (fontSize) => Math.round(fontSize * scale);




const ProductCatalogScreen = ({ route }) => {
    const navigation = useNavigation();
    const { explore = null } = route.params || {}; // Default value if params is undefined

    console.log('Explore:', explore);
    const catalogData = [
        {
            id: '1',
            name: 'ARFS FNO LITE',
            price: 29000,
            gst: ' + GST',
            star:'Retention Rate: 4.5',
            retentionRate: '(1k Reviews)',
            capital: '25k',
            validity: '2M',
            volatility: 'High',
            details:'A Premium Services designed for traders who wants to trade in high volatility. This aim to capitalise intraday market volatility. Trade recommendation frequency is high in order to get best out of volatile market movements.',
            tradeRecoTypes: 'Naked Options Buying, Straddle Options',
            researchMethod: 'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
        },{
          id: '2',
          name: 'ARFS FNO ALPHA',
          price: 49000,
          gst: '+ GST',
          star:'Retention Rate: 4.3',
          retentionRate: '(1k Reviews)',
          capital: '50k-1L',
          validity: '3M',
          volatility: 'High',
          details:'A premium service designed for traders who wants to trade in high volatility in the Futures and Options to capture momentum.',
          tradeRecoTypes: 'Naked Options Buying, Straddle Options',
          researchMethod: 'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
      },
      {
        id: '3',
        name: 'ARFS FNO BETA',
        price: 79000,
        gst: '+ GST',
        star:'Retention Rate: 4.0',
        retentionRate: '(1k Reviews)',
        capital: '1L-2L',
        validity: '5M',
        volatility: 'High',
        details:'A Premium Services designed for traders who wants to trade in high volatility in the Future and Option to capture momentum.',
        tradeRecoTypes: 'Naked Options Buying, Straddle Options',
        researchMethod: 'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
      id: '4',
      name: 'ARJUNA PREMIUM',
      price: 140000,
      gst: '+ GST',
      star:'Retention Rate: 4.1',
      retentionRate: '(1k Reviews)',
      capital: '1.2L-5L',
      validity: '2M',
      volatility: 'High',
      details:'An exclusive product designed for High Net-worth Individual traders who wants to take advantage of all kinds of equity segments.',
      tradeRecoTypes: 'Naked Options Buying, Straddle Options',
      researchMethod: 'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
  },
{
    id: '5',
    name: 'ARJUNA HNI',
    price: 500000,
    gst: '+ GST',
    star:'Retention Rate: 4.0',
    retentionRate: '(1k Reviews)',
    capital: '5L-10L',
    validity: '6M',
    volatility: 'High',
    details:'An exclusive product designed for High Net-worth Individual traders who wants to take advantage of all kinds of equity segments.',
    tradeRecoTypes: 'Straddle options, Strangle options Bull spread, Bear spread Future buying, Future selling Options selling, Cash intraday Cash swing, Cash long term Covered calls, Protective puts Naked options buying Calendar Spreads',
    researchMethod: 'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
},
{
    id: '6',
    name: 'COMPOUND KING',
    price: 49000,
    gst: '+ GST',
    star:'Retention Rate: 4.0',
    retentionRate: '(1k Reviews)',
    capital: '---',
    validity: '12M',
    volatility: 'High',
    details:'A product designed for Investors who aim to create wealth by investing in technically and fundamentally strong companies.',
    tradeRecoTypes: 'Cash Segment',
    researchMethod: 'Fundamental analysis, Price action, Candlestick Patterns, Economic analysis.',
},
        // Add more catalog items here
    ];
      
    const [selectedTab, setSelectedTab] = useState('Model Portfolio');
    const [expandedItems, setExpandedItems] = useState([]);
    const [index, setIndex] = useState(0);
    setIndex(explore);
    const [routes] = useState([
        { key: 'bespoke', title: 'Bespoke Plan' },
        { key: 'modelportfolio', title: 'Model Portfolio Plan' },
    ]);

    const PlacedOrders = () => (
        <View>
      
        </View>
    );

    const RejectedOrders = () => (
        <View>
            <FlatList
                data={catalogData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                style={{  }}
            />
        </View>
    );

    const renderScene = SceneMap({
        bespoke: PlacedOrders,
        modelportfolio: RejectedOrders,
    });

    const [selectedItems, setSelectedItems] = useState([]);

    const handleSelection = (item) => {
        const newSelection = selectedItems.includes(item.id)
            ? selectedItems.filter((id) => id !== item.id)
            : [...selectedItems, item.id];
        setSelectedItems(newSelection);
    };

    const calculateTotalPrice = () => {
        return selectedItems.reduce((total, itemId) => {
            const item = catalogData.find((catalogItem) => catalogItem.id === itemId);
            return total + (item ? item.price : 0);
        }, 0);
    };

    const formatPrice = (price) => {
        return price >= 1000 ? `${(price / 1000).toFixed(0)}k` : price.toString();
    };

    const toggleExpanded = (id) => {
        setExpandedItems((prevExpanded) =>
            prevExpanded.includes(id) ? prevExpanded.filter((itemId) => itemId !== id) : [...prevExpanded, id]
        );
    };

    const [activeSections, setActiveSections] = useState([]);

    const renderHeader = (section, _, isActive) => (
        <TouchableOpacity
            style={{ padding: 10, backgroundColor: isActive ? '#DEBC89' : '#fff' }}
            onPress={() => updateSections(section)}
        >
            <Text>{isActive ? 'Hide Details' : 'Read More'}</Text>
        </TouchableOpacity>
    );

    const renderContent = (section) => (
        <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
                <Text>
                    <Text style={{ fontSize: 12, color: '#4c4c4d', fontFamily: 'Poppins-Bold' }}>Trade Reco Types: </Text>
                    <Text style={styles.tradeReco}>{section.tradeRecoTypes}</Text>
                </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
                <Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Poppins-Bold', color: '#4c4c4d' }}>Research Method: </Text>
                    <Text style={styles.researchMethod}>{section.researchMethod}</Text>
                </Text>
            </View>
        </View>
    );

    const updateSections = (section) => {
        const currentIndex = activeSections.indexOf(section);
        const newActiveSections = currentIndex === -1 
            ? [...activeSections, section] 
            : activeSections.filter((_, index) => index !== currentIndex);
        
        setActiveSections(newActiveSections);
    };

    const renderItem  = ({ item }) => (
 
        <View style={styles.cardContainer}>
            <View style={styles.card}>
                <View style={styles.cardContent}>     
                    <View style={{backgroundColor:'#BE8023',paddingVertical:15,borderTopRightRadius:8,borderTopLeftRadius:8}}>
                    <View style={{ flexDirection: 'row', marginBottom: 10,paddingLeft:30 }}>
                        <View style={{ flexDirection: 'column',marginRight:5 }}>
                            <Text style={styles.cardTitle}>{item.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <Text style={styles.retentionRate}>{item.star}</Text>
                                <Icon name='star' color='gold' size={12} />
                                <Text style={styles.retentionRate}>{item.retentionRate}</Text>
                                <SquareArrowOutUpRight size={16} color={'white'}/>
                            </View>
                        </View>
                    </View>
                    <View style={{flexDirection:'row',justifyContent:'space-between',marginHorizontal:20,marginVertical:10}}>
                        <View style={{flexDirection:'column'}}>
                        <View style={{flexDirection:'row'}}>
                            <Clock size={18} color={'white'}/>
                            <Text style={{color:'white',fontFamily:'Poppins-Regular',fontSize:12,marginLeft:5}}>Duration</Text>
                            </View>
                            <Text style={{color:'white',fontFamily:'Poppins-Medium'}}>2 Months</Text>
                        </View>
                        <View style={{flexDirection:'column'}}>
                            <View style={{flexDirection:'row'}}>
                            <Flame size={18} color={'white'}/>
                            <Text style={{color:'white',fontFamily:'Poppins-Regular',fontSize:12,marginLeft:5}}>Volatility</Text>
                            </View>
                            
                            <Text style={{color:'white',fontFamily:'Poppins-Medium'}}>Highly Risky</Text>
                        </View>
                        <View style={{flexDirection:'column'}}>
                        <View style={{flexDirection:'row'}}>
                            <Info size={18} color={'white'}/>
                            <Text style={{color:'white',fontFamily:'Poppins-Regular',fontSize:12,marginLeft:5}}>Min. Investment</Text>
                            </View>
                            <Text style={{color:'white',fontFamily:'Poppins-Medium'}}>{`${formatPrice(item.price)} ${item.gst}`}</Text>
                        </View>
                    </View>
                    <View style={{flexDirection:'row',justifyContent:'space-between',marginHorizontal:30}}>
                        <TouchableOpacity style={{padding:10,borderColor:'#DEBC89',borderWidth:1,borderRadius:8,flexDirection:'row',alignContent:'center',alignItems:'center'}}>
                                <Text style={{fontFamily:'Poppins-Regular',color:'white',marginRight:5}}>Read More</Text>
                                <ChevronDown size={16} color={'white'}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={{padding:10,borderColor:'#DEBC89',borderWidth:1,borderRadius:8,backgroundColor:'white'}}>
                                <Text style={{fontFamily:'Poppins-Medium',color:'black'}}>Invest Now</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                    {/* if read more is clicked show this */}
                    
                </View>
            </View>
        </View>
    );


    const filterData = () => {
        return catalogData.filter(item => selectedTab === 'Model Portfolio' || selectedTab === 'Bespoke Plan');
    };

    const renderTabBar = () => (
        <View style={styles.tabContainer}>
            {['Bespoke Plan', 'Model Portfolio'].map(tab => (
                <TouchableOpacity
                    key={tab}
                    style={[
                        styles.tabButton,
                        selectedTab === tab ? styles.activeTab : styles.inactiveTab
                    ]}
                    onPress={() => setSelectedTab(tab)}>
                    <Text style={selectedTab === tab ? styles.activeTabText : styles.inactiveTabText}>
                        {tab}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
    return (
        <View style={{ flex: 1,backgroundColor:'#fafafa' }}>
          <CustomToolbar/>
          <View style={{ flexDirection: 'row',alignContent:'center',alignItems:'flex-sTART', marginHorizontal: 10, marginTop:20 }}>
          <ChevronLeft style={{marginTop:3,}} color={'#000'} onPress={() => navigation.goBack()}/>
        <View style={{ flexDirection: 'column' }}>
          <Text style={{fontSize: 20,
                        fontFamily: 'Poppins-Bold',
                        color: 'black',
                        paddingHorizontal: 15,}}>Product catalog</Text>
          {/* <Text style={{ fontSize: 15, paddingHorizontal: 15,  fontFamily: 'Poppins-Regular',color:'grey' }}>You can subscribe to 1 or more Product</Text> */}
        </View>
      </View>
      <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: Dimensions.get('window').width }}
      renderTabBar={(props) => (
        <TabBar
          {...props}
          activeColor="black"
          inactiveColor="grey"
          indicatorStyle={styles.indicator}
          style={styles.tabBar}
        />
      )}
    />
          
 
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        position: 'relative',
        marginVertical:5, 
        marginHorizontal:5,// Adjust based on your design
    },
    checkboxContainer: {
        position:'absolute',
        backgroundColor:'transparent',
        width:25,
        height:25,
        top: '3%',
        
        bottom:10,
        borderRadius:5,
        left:1, // Adjust this value to move it outside the card
        transform: [{ translateY: -9 },{translateX:5}],
        zIndex: 10, // Ensures it is above the card
    },
    customCheckbox: {
      borderColor:'#d8d9d9',
      borderWidth:1.5,
      width: 25,
      height: 25,
      borderRadius: 3,
      justifyContent: 'center',
      alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,

    marginBottom: 5,
    color: 'black',
    paddingHorizontal: 15,
  },
    checkbox: {

      transform:[{translateX:-2}],
      padding: 0,
      margin: -2.5,
      right:9,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        borderWidth:1,
        borderColor:'#d8d9d9',
        marginHorizontal: 10,

    },
    cardContent: {
        flex: 1,
        
        paddingBottom:20,
    },
    cardTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color:'#fff',
        marginBottom:5,
    },
    retentionRate: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#fff',
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#002a5c',
      padding: 10,
      borderRadius: 5,

    },
    buttonText: {
      fontFamily: 'Poppins-Bold',
      color: '#fff',
      fontSize: 18,
      marginLeft: 10,
    },
    price: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 22,
        marginBottom: 5,
        color:'#000',
    },
    detailText: {
        fontFamily: 'Poppins-Regular',
        fontSize: responsiveFontSize(11),
        justifyContent:'center',
        color: '#565657',

    },
    tradeReco: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#858585',
    },
    researchMethod: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#858585',

    },
    totalContainer: {
        padding: 15,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderColor: '#eee',
    },
    totalText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
    
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal:30,
        marginTop:10,
    },
    filterButton: {
        backgroundColor: 'white',
        borderRadius: 13,
        marginLeft: 10,
        marginBottom:10,
        paddingVertical: 3,
        borderColor:'#E6E6E6',
        borderWidth: 0.5,
        paddingHorizontal: 15,
        marginLeft: 12,
    },
    filterButtonText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'black',
    },
    activeTabButton: {
        backgroundColor: '#fff',
    },
    inactiveTabButton: {
        backgroundColor: '#f5f5f4',
    },
    activeTabButtonText: {
        color: 'black',
    },
    inactiveTabButtonText: {
        color: '#afaeae',
    },
});

export default ProductCatalogScreen;
