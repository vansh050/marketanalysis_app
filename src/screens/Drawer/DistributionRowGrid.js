/**
 * DistributionRowGrid — container (Phase G batch 2, 2026-05-02)
 *
 * Owns: market price fetching via axios + SecurityTokenManager,
 * tab state, totalCurrent calculation.
 * Renders presentation resolved from `screens.DistributionRowGrid`.
 */

import React, { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useComponent } from '../../design/useDesign';

const { width: ScreenWidth } = Dimensions.get('window');

const DistributionGrid = ({
    adviceEntries = [],
    holdings = [],
    portfolioLoading,
    type = 'normal',
}) => {
    const [activeTab, setActiveTab] = useState('distribution');
    const [marketPrices, setMarketPrices] = useState({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);

    const fetchMarketPrices = async symbols => {
        try {
            setIsLoadingPrices(true);
            const data = JSON.stringify({
                Orders: symbols.map(sym => ({
                    exchange: 'NSE',
                    segment: '',
                    tradingSymbol: sym,
                })),
            });

            const config = {
                method: 'post',
                url: `${server.ccxtServer.baseUrl}angelone/market-data`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': Config.REACT_APP_ADVISOR_SUBDOMAIN || '',
                    'aq-encrypted-key': generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET,
                    ),
                },
                data,
            };

            const response = await axios.request(config);

            const pricesMap = {};
            response?.data?.data?.fetched?.forEach(item => {
                pricesMap[item.tradingSymbol] = item.ltp;
            });

            setMarketPrices(pricesMap);
        } catch (error) {
            console.error('Error fetching market prices:', error);
        } finally {
            setIsLoadingPrices(false);
        }
    };

    useEffect(() => {
        if (holdings && holdings.length > 0) {
            const symbols = holdings.map(stock => stock.symbol);
            fetchMarketPrices(symbols);
        }
    }, [holdings]);

    const totalCurrent =
        holdings?.reduce((total, stock) => {
            const ltp = marketPrices[stock.symbol] || 0;
            return total + ltp * stock.quantity;
        }, 0) || 0;

    const Presentation = useComponent('screens.DistributionRowGrid');

    return (
        <Presentation
            viewModel={{
                activeTab,
                adviceEntries,
                holdings,
                marketPrices,
                totalCurrent,
                isLoadingPrices,
                portfolioLoading,
                type,
                screenWidth: ScreenWidth,
            }}
            actions={{
                onTabChange: setActiveTab,
            }}
        />
    );
};

export default DistributionGrid;
