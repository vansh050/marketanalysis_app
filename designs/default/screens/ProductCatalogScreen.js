/**
 * ProductCatalogScreen — design-system screen presentation (Phase G, 2026-05-02)
 *
 * Pure presentation. Container owns state (tab index, selection, accordion),
 * static catalog data, and navigation. This renders the header, TabView, and
 * product cards.
 *
 * Contract:
 *   viewModel = {
 *     index, routes, catalogData, selectedItems, activeSections,
 *     formatPrice,
 *   }
 *   actions = {
 *     onGoBack, onIndexChange, onSelection, onToggleSection,
 *   }
 */

import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import {
    ChevronLeft,
    Clock,
    Flame,
    Info,
    SquareArrowOutUpRight,
    ChevronDown,
} from 'lucide-react-native';
import Icon from 'react-native-vector-icons/AntDesign';
import { TabView, TabBar } from 'react-native-tab-view';
import Text from '../primitives/Text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const responsiveFontSize = (fontSize) => Math.round(fontSize * scale);

const ProductCatalogScreen = ({ viewModel, actions }) => {
    const {
        index = 0,
        routes = [],
        catalogData = [],
        formatPrice = (p) => p.toString(),
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onIndexChange = () => {},
    } = actions || {};

    const renderItem = ({ item }) => (
        <View style={styles.cardContainer}>
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                            <View style={{ flexDirection: 'column', marginRight: 5 }}>
                                <Text variant="bodyEmphasis" style={styles.cardTitle}>
                                    {item.name}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <Text variant="caption" style={styles.retentionRate}>
                                        {item.star}
                                    </Text>
                                    <Icon name="star" color="gold" size={12} />
                                    <Text variant="caption" style={styles.retentionRate}>
                                        {item.retentionRate}
                                    </Text>
                                    <SquareArrowOutUpRight size={16} color={'white'} />
                                </View>
                            </View>
                        </View>
                        <View style={styles.cardMetaRow}>
                            <View style={{ flexDirection: 'column' }}>
                                <View style={{ flexDirection: 'row' }}>
                                    <Clock size={18} color={'white'} />
                                    <Text variant="caption" style={styles.metaLabel}>
                                        Duration
                                    </Text>
                                </View>
                                <Text variant="body" style={styles.metaValue}>
                                    2 Months
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'column' }}>
                                <View style={{ flexDirection: 'row' }}>
                                    <Flame size={18} color={'white'} />
                                    <Text variant="caption" style={styles.metaLabel}>
                                        Volatility
                                    </Text>
                                </View>
                                <Text variant="body" style={styles.metaValue}>
                                    Highly Risky
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'column' }}>
                                <View style={{ flexDirection: 'row' }}>
                                    <Info size={18} color={'white'} />
                                    <Text variant="caption" style={styles.metaLabel}>
                                        Min. Investment
                                    </Text>
                                </View>
                                <Text variant="body" style={styles.metaValue}>
                                    {`${formatPrice(item.price)} ${item.gst}`}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.cardActionsRow}>
                            <TouchableOpacity style={styles.readMoreButton}>
                                <Text variant="body" style={styles.readMoreText}>
                                    Read More
                                </Text>
                                <ChevronDown size={16} color={'white'} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.investButton}>
                                <Text variant="bodyEmphasis" style={styles.investText}>
                                    Invest Now
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );

    const PlacedOrders = () => <View />;

    const RejectedOrders = () => (
        <View>
            <FlatList
                data={catalogData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
            />
        </View>
    );

    const renderScene = ({ route }) => {
        switch (route.key) {
            case 'bespoke':
                return <PlacedOrders />;
            case 'modelportfolio':
                return <RejectedOrders />;
            default:
                return null;
        }
    };

    return (
        <View style={styles.root}>
            <View style={styles.headerRow}>
                <ChevronLeft
                    style={{ marginTop: 3 }}
                    color={'#000'}
                    onPress={onGoBack}
                />
                <View style={{ flexDirection: 'column' }}>
                    <Text variant="title" style={styles.headerTitle}>
                        Product catalog
                    </Text>
                </View>
            </View>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={onIndexChange}
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
    root: {
        flex: 1,
        backgroundColor: '#fafafa',
    },
    headerRow: {
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'flex-start',
        marginHorizontal: 10,
        marginTop: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: 'black',
        paddingHorizontal: 15,
    },
    indicator: {},
    tabBar: {},
    cardContainer: {
        position: 'relative',
        marginVertical: 5,
        marginHorizontal: 5,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: '#d8d9d9',
        marginHorizontal: 10,
    },
    cardContent: {
        flex: 1,
        paddingBottom: 20,
    },
    cardHeader: {
        backgroundColor: '#BE8023',
        paddingVertical: 15,
        borderTopRightRadius: 8,
        borderTopLeftRadius: 8,
    },
    cardTitleRow: {
        flexDirection: 'row',
        marginBottom: 10,
        paddingLeft: 30,
    },
    cardTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#fff',
        marginBottom: 5,
    },
    retentionRate: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#fff',
    },
    cardMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        marginVertical: 10,
    },
    metaLabel: {
        color: 'white',
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        marginLeft: 5,
    },
    metaValue: {
        color: 'white',
        fontFamily: 'Poppins-Medium',
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 30,
    },
    readMoreButton: {
        padding: 10,
        borderColor: '#DEBC89',
        borderWidth: 1,
        borderRadius: 8,
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
    },
    readMoreText: {
        fontFamily: 'Poppins-Regular',
        color: 'white',
        marginRight: 5,
    },
    investButton: {
        padding: 10,
        borderColor: '#DEBC89',
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: 'white',
    },
    investText: {
        fontFamily: 'Poppins-Medium',
        color: 'black',
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
});

export default ProductCatalogScreen;
