/**
 * ReviewScreen — container (Phase G, 2026-05-02)
 *
 * Owns dummy review data, sort state, and navigation. Renders presentation
 * resolved as `screens.ReviewScreen`.
 */

import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useComponent } from '../../design/useDesign';

const dummyReviews = [
    {
        id: '1',
        name: 'Akshata Kenjale',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '3 hours ago',
    },
    {
        id: '2',
        name: 'Aman Singh',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '6 hours ago',
    },
    {
        id: '3',
        name: 'Om Rai',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '10 hours ago',
    },
    {
        id: '4',
        name: 'Krunalee Rane',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '1 day ago',
    },
    {
        id: '5',
        name: 'Bhushan Jagdale',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '1 day ago',
    },
    {
        id: '6',
        name: 'Krunalee Rane',
        avatar: require('../../assets/default.png'),
        rating: 4,
        review:
            'Lorem ipsum dolor sit amet consectetur. Elementum gravida vitae pharetra et tincidunt arcu vestibulum eget.',
        timeAgo: '1 day ago',
    },
];

const sortOptions = [
    { label: 'Newest to Oldest', value: 'newest' },
    { label: 'Oldest to Newest', value: 'oldest' },
];

const ReviewScreen = () => {
    const navigation = useNavigation();
    const [sortValue, setSortValue] = useState(null);

    const Presentation = useComponent('screens.ReviewScreen');

    return (
        <Presentation
            viewModel={{
                reviews: dummyReviews,
                sortValue,
                sortOptions,
            }}
            actions={{
                onGoBack: () => navigation.goBack(),
                onSortChange: setSortValue,
            }}
        />
    );
};

export default ReviewScreen;
