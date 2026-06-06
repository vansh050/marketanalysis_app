/**
 * ReviewScreen — design-system screen presentation (Phase G, 2026-05-02)
 *
 * Pure presentation. Container owns the dummy review data, sort state,
 * and navigation. This renders the header, sort dropdown, and review list.
 *
 * Contract:
 *   viewModel = {
 *     reviews, sortValue, sortOptions,
 *   }
 *   actions = {
 *     onGoBack, onSortChange,
 *   }
 */

import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    Dimensions,
} from 'react-native';
import { ChevronLeft, AlignLeft } from 'lucide-react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { Dropdown } from 'react-native-element-dropdown';
import Text from '../primitives/Text';

const { width: screenWidth } = Dimensions.get('window');

const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
        stars.push(
            <AntDesign
                key={i}
                name="star"
                size={16}
                color={i < rating ? '#FFCE31' : '#E0E0E0'}
                style={{ marginRight: 2 }}
            />,
        );
    }
    return <View style={styles.starRating}>{stars}</View>;
};

const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
            <Image source={item.avatar} style={styles.avatar} />
            <View style={styles.reviewInfo}>
                <Text variant="bodyEmphasis" style={styles.name}>
                    {item.name}
                </Text>
                {renderStarRating(item.rating)}
            </View>
            <Text variant="caption" style={styles.timeAgo}>
                {item.timeAgo}
            </Text>
        </View>
        <Text variant="body" style={styles.reviewText}>
            "{item.review}"
        </Text>
    </View>
);

const ReviewScreen = ({ viewModel, actions }) => {
    const {
        reviews = [],
        sortValue = null,
        sortOptions = [],
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onSortChange = () => {},
    } = actions || {};

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={onGoBack}
                    style={styles.backButton}
                >
                    <ChevronLeft size={24} color="black" />
                </TouchableOpacity>
                <Text variant="title" style={styles.headerTitle}>
                    ARFS FNO LITE Reviews
                </Text>
            </View>

            <View style={styles.sortDropdownContainer}>
                <Dropdown
                    style={styles.dropdown}
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
                    inputSearchStyle={{ color: 'black', fontSize: 11 }}
                    iconStyle={styles.iconStyle}
                    data={sortOptions}
                    search={false}
                    itemTextStyle={{ color: 'black', fontSize: 11 }}
                    labelField="label"
                    valueField="value"
                    placeholder="Sort by : Newest to Oldest"
                    searchPlaceholder="Search..."
                    value={sortValue}
                    onChange={(item) => onSortChange(item.value)}
                    renderLeftIcon={() => (
                        <AlignLeft
                            style={{ marginRight: 10 }}
                            size={20}
                            color={'black'}
                        />
                    )}
                />
            </View>

            <FlatList
                data={reviews}
                renderItem={renderReviewItem}
                keyExtractor={(item) => item.id}
                style={styles.reviewList}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 20,
        paddingHorizontal: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 15,
        alignContent: 'center',
        paddingHorizontal: 10,
    },
    backButton: {
        alignContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Satoshi-Bold',
        color: 'black',
    },
    sortDropdownContainer: {},
    dropdown: {
        width: screenWidth - 80,
        marginLeft: 10,
        marginBottom: 10,
        color: 'black',
        paddingHorizontal: 5,
        borderColor: '#0000001A',
        borderWidth: 1,
        backgroundColor: '#FFF',
        borderRadius: 4,
        paddingVertical: 7,
    },
    iconStyle: {},
    reviewList: {
        flex: 1,
        paddingHorizontal: 10,
    },
    reviewItem: {
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 15,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    reviewInfo: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'black',
    },
    starRating: {
        flexDirection: 'row',
        marginTop: 2,
    },
    timeAgo: {
        fontSize: 12,
        color: '#757575',
    },
    reviewText: {
        fontSize: 14,
        color: 'black',
        lineHeight: 20,
        marginLeft: 50,
    },
});

export default ReviewScreen;
