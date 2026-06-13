/**
 * OrderScreen — container (Phase E.1, 2026-05-01)
 *
 * Owns data fetching, sorting, and the EventEmitter listener for cart
 * updates. Computes the viewModel + actions and hands them to the
 * presentation resolved from the design registry
 * (`screens.OrderScreen` — implementation at
 * `designs/default/screens/OrderScreen.js` for the default variant).
 *
 * Pre-Phase-E.1 this file was 1195 lines and bundled the rendering inline,
 * plus a defunct PanResponder + tab system + `imageUrl` / `isModalOpen`
 * machinery whose code paths were unreachable. All of that was removed in
 * the same commit — see docs/DESIGN_MIGRATION_PROGRESS.md § 2026-05-01
 * Phase E.1 entry for the full delta.
 *
 * Data deps preserved from legacy:
 *   - useTrade() → configData (for X-Advisor-Subdomain header)
 *   - useConfig() → gradient1 / gradient2 for the empty-state hero
 *   - useModalStore() → openModal('DdpiHelp', { broker })
 *   - getAuth() → user.email
 *   - eventEmitter on 'cartUpdated' → re-fetch trades
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import eventEmitter from '../../components/EventEmitter';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../TradeContext';
import { isOrderRejected } from '../../utils/orderStatusUtils';
import useModalStore from '../../GlobalUIModals/modalStore';
import { useComponent } from '../../design/useDesign';
import useHomeMarketSummary from './hooks/useHomeMarketSummary';

export default function OrderScreen() {
    const { configData, userDetails: userDetailsTradeCtx } = useTrade();
    const config = useConfig();
    const openModal = useModalStore((state) => state.openModal);

    const auth = getAuth();
    const userEmail = auth.currentUser?.email;

    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchTrades = () => {
        if (!userEmail) return;
        setLoading(true);
        const reqConfig = {
            method: 'get',
            url: `${server.server.baseUrl}api/user/trade-reco-for-user?user_email=${userEmail}`,
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
            .request(reqConfig)
            .then((response) => {
                const trades = response.data?.trades || [];
                const executed = trades.filter(
                    (t) =>
                        t.trade_place_status !== 'recommend' &&
                        t.trade_place_status !== 'ignored',
                );
                const sorted = [...executed].sort((a, b) => {
                    const da = new Date(a.exitDate || a.purchaseDate || a.date);
                    const db = new Date(b.exitDate || b.purchaseDate || b.date);
                    if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
                    if (isNaN(da.getTime())) return 1;
                    if (isNaN(db.getTime())) return -1;
                    return db - da;
                });
                setAllOrders(sorted);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        if (userEmail) fetchTrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail]);

    useEffect(() => {
        const handlePortfolioUpdate = () => fetchTrades();
        eventEmitter.on('cartUpdated', handlePortfolioUpdate);
        return () => {
            eventEmitter.off('cartUpdated', handlePortfolioUpdate);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const Presentation = useComponent('screens.OrderScreen');

    // Memoized so the presentation's renderItem (also useCallback'd) keeps a
    // stable reference across keystrokes in the search box, letting the
    // memoized OrderRow skip re-renders when its item props are unchanged.
    const openDdpiHelp = useCallback(
        ({ broker }) => openModal('DdpiHelp', { broker }),
        [openModal]
    );

    // Variant-facing live tickers (alphanomy reads these for `_AppHeader`).
    // userEmail is already in scope above (line 44).
    const { tickers } = useHomeMarketSummary();
    // Variant-facing user name for the greeting (full name preferred over
    // email-derived first-name fallback). See AccountSettingsScreen
    // container for the same useTrade().userDetails source.
    const userName =
        userDetailsTradeCtx?.name || auth.currentUser?.displayName || '';

    const viewModel = useMemo(
        () => ({
            orders: allOrders,
            isLoading: loading,
            gradient: {
                start: config?.gradient1,
                end: config?.gradient2,
            },
            // Additive — default presentation ignores these.
            tickers,
            userEmail,
            userName,
            config,
        }),
        [allOrders, loading, config, tickers, userEmail, userName],
    );

    const actions = useMemo(() => ({ openDdpiHelp }), [openDdpiHelp]);

    // Reference kept so a future PR can surface a "rejected only" filter
    // in the UI without re-deriving — not currently displayed.
    // eslint-disable-next-line no-unused-vars
    const rejectedOrders = allOrders.filter((t) => isOrderRejected(t.trade_place_status));

    return <Presentation viewModel={viewModel} actions={actions} />;
}
