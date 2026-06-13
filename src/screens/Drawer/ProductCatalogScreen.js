/**
 * ProductCatalogScreen — container (Phase G, 2026-05-02)
 *
 * Owns static catalog data, tab/selection/accordion state, and navigation.
 * Renders presentation resolved as `screens.ProductCatalogScreen`.
 */

import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useComponent } from '../../design/useDesign';

const catalogData = [
    {
        id: '1',
        name: 'ARFS FNO LITE',
        price: 29000,
        gst: ' + GST',
        star: 'Retention Rate: 4.5',
        retentionRate: '(1k Reviews)',
        capital: '25k',
        validity: '2M',
        volatility: 'High',
        details:
            'A Premium Services designed for traders who wants to trade in high volatility. This aim to capitalise intraday market volatility. Trade recommendation frequency is high in order to get best out of volatile market movements.',
        tradeRecoTypes: 'Naked Options Buying, Straddle Options',
        researchMethod:
            'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
        id: '2',
        name: 'ARFS FNO ALPHA',
        price: 49000,
        gst: '+ GST',
        star: 'Retention Rate: 4.3',
        retentionRate: '(1k Reviews)',
        capital: '50k-1L',
        validity: '3M',
        volatility: 'High',
        details:
            'A premium service designed for traders who wants to trade in high volatility in the Futures and Options to capture momentum.',
        tradeRecoTypes: 'Naked Options Buying, Straddle Options',
        researchMethod:
            'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
        id: '3',
        name: 'ARFS FNO BETA',
        price: 79000,
        gst: '+ GST',
        star: 'Retention Rate: 4.0',
        retentionRate: '(1k Reviews)',
        capital: '1L-2L',
        validity: '5M',
        volatility: 'High',
        details:
            'A Premium Services designed for traders who wants to trade in high volatility in the Future and Option to capture momentum.',
        tradeRecoTypes: 'Naked Options Buying, Straddle Options',
        researchMethod:
            'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
        id: '4',
        name: 'ARJUNA PREMIUM',
        price: 140000,
        gst: '+ GST',
        star: 'Retention Rate: 4.1',
        retentionRate: '(1k Reviews)',
        capital: '1.2L-5L',
        validity: '2M',
        volatility: 'High',
        details:
            'An exclusive product designed for High Net-worth Individual traders who wants to take advantage of all kinds of equity segments.',
        tradeRecoTypes: 'Naked Options Buying, Straddle Options',
        researchMethod:
            'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
        id: '5',
        name: 'ARJUNA HNI',
        price: 500000,
        gst: '+ GST',
        star: 'Retention Rate: 4.0',
        retentionRate: '(1k Reviews)',
        capital: '5L-10L',
        validity: '6M',
        volatility: 'High',
        details:
            'An exclusive product designed for High Net-worth Individual traders who wants to take advantage of all kinds of equity segments.',
        tradeRecoTypes:
            'Straddle options, Strangle options Bull spread, Bear spread Future buying, Future selling Options selling, Cash intraday Cash swing, Cash long term Covered calls, Protective puts Naked options buying Calendar Spreads',
        researchMethod:
            'Price Action, PCR Analysis, Option chain analysis, Candlestick Patterns, Dow Theory and Other Technical Analysis',
    },
    {
        id: '6',
        name: 'COMPOUND KING',
        price: 49000,
        gst: '+ GST',
        star: 'Retention Rate: 4.0',
        retentionRate: '(1k Reviews)',
        capital: '---',
        validity: '12M',
        volatility: 'High',
        details:
            'A product designed for Investors who aim to create wealth by investing in technically and fundamentally strong companies.',
        tradeRecoTypes: 'Cash Segment',
        researchMethod:
            'Fundamental analysis, Price action, Candlestick Patterns, Economic analysis.',
    },
];

const formatPrice = (price) => {
    return price >= 1000 ? `${(price / 1000).toFixed(0)}k` : price.toString();
};

const ProductCatalogScreen = ({ route }) => {
    const navigation = useNavigation();
    const { explore = null } = route.params || {};

    const [index, setIndex] = useState(explore);
    const [routes] = useState([
        { key: 'bespoke', title: 'Bespoke Plan' },
        { key: 'modelportfolio', title: 'Model Portfolio Plan' },
    ]);

    const [selectedItems, setSelectedItems] = useState([]);
    const [activeSections, setActiveSections] = useState([]);

    const handleSelection = (item) => {
        const newSelection = selectedItems.includes(item.id)
            ? selectedItems.filter((id) => id !== item.id)
            : [...selectedItems, item.id];
        setSelectedItems(newSelection);
    };

    const updateSections = (section) => {
        const currentIndex = activeSections.indexOf(section);
        const newActiveSections =
            currentIndex === -1
                ? [...activeSections, section]
                : activeSections.filter((_, i) => i !== currentIndex);
        setActiveSections(newActiveSections);
    };

    const Presentation = useComponent('screens.ProductCatalogScreen');

    return (
        <Presentation
            viewModel={{
                index,
                routes,
                catalogData,
                selectedItems,
                activeSections,
                formatPrice,
            }}
            actions={{
                onGoBack: () => navigation.goBack(),
                onIndexChange: setIndex,
                onSelection: handleSelection,
                onToggleSection: updateSections,
            }}
        />
    );
};

export default ProductCatalogScreen;
