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
 *   - eventEmitter on 'cartUpdated' / 'OrderPlacedReferesh' / 'refreshEvent'
 *     → re-fetch trades; plus a focus refetch, because this screen lives
 *     in the bottom-tab navigator and its mount effect runs only once
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import eventEmitter from '../../components/EventEmitter';
import { useConfig } from '../../context/ConfigContext';
import { useTrade } from '../TradeContext';
import { isOrderPending, isOrderRejected } from '../../utils/orderStatusUtils';
import useModalStore from '../../GlobalUIModals/modalStore';
import { useComponent } from '../../design/useDesign';
import { useAccountEmail, getAccountDisplayName } from '../../utils/accountEmail';
import {
    shouldShowInOrderHistory,
} from '../../utils/basketOrderState';

// A basket container's top-level date is the advice date; the actual
// activity (entry fill / exit fill) lives on its legs. Sorting must use the
// LATEST leg datetime so a basket whose exit happened after its advice sorts
// by the exit — otherwise Order History is not descending by datetime.
const getOrderTimestamp = (order) => {
    if (Array.isArray(order?.basket_advice) && order.basket_advice.length > 0) {
        let latest = null;
        order.basket_advice.forEach((leg) => {
            const t = new Date(
                leg?.exitDate || leg?.purchaseDate || leg?.date || leg?.created_at
            );
            if (!Number.isNaN(t.getTime()) && (!latest || t > latest)) latest = t;
        });
        if (latest) return latest;
    }
    return new Date(order?.exitDate || order?.purchaseDate || order?.date || order?.created_at);
};

const isToday = (date, today = new Date()) =>
    !Number.isNaN(date?.getTime?.()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

// A GTT is deliberately long-lived; a normal pending/AMO order is not useful
// after its trading day. The API has legacy field spellings, so recognise each
// persisted shape rather than relying on one broker-specific property.
const isGttOrder = (order) => {
    const orderType = String(
        order?.order_type || order?.orderType || order?.productType || '',
    ).toLowerCase();
    return Boolean(
        order?.gttCheck ||
        order?.gtt_check ||
        order?.isGTT ||
        order?.gttId ||
        order?.gtt_id ||
        order?.gtt?.id ||
        orderType === 'gtt' ||
        orderType === 'gtt_oco' ||
        orderType === 'gtt oco',
    );
};

const isActionablePendingOrder = (order) => {
    const status = String(order?.trade_place_status || order?.orderStatus || '')
        .toLowerCase()
        .trim();
    // "manually_placed" means the customer completed the order at their broker;
    // it is presented as completed elsewhere and must stay in history.
    return !['manually_placed', 'manually placed'].includes(status) && isOrderPending(status);
};

export default function OrderScreen() {
    const { configData, userDetails: userDetailsTradeCtx } = useTrade();
    const config = useConfig();
    const openModal = useModalStore((state) => state.openModal);

    const auth = getAuth();
    // Reactive: this screen gates its fetch on `userEmail`, and on a cold
    // start / fresh Apple sign-in the identity resolves AFTER mount — a
    // one-shot read would capture null and never refetch (and the bare
    // getAccountEmail symbol was never imported here, which crashed the
    // screen outright on open).
    const userEmail = useAccountEmail();

    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const inFlightRef = useRef(null);

    const fetchTrades = useCallback((options) => {
        if (!userEmail) {
            inFlightRef.current = null;
            setAllOrders([]);
            setLoading(false);
            setRefreshing(false);
            return Promise.resolve();
        }
        // Focus, cart and placement events can arrive together. One request is
        // enough; parallel full-history responses repeatedly parse and sort a
        // large payload on the Android JS thread, delaying taps.
        const requestKey = `${userEmail}|${configData?.config?.REACT_APP_HEADER_NAME || ''}`;
        if (inFlightRef.current?.key === requestKey) return inFlightRef.current.promise;
        const currentRequest = {key: requestKey, promise: null};
        inFlightRef.current = currentRequest;
        setLoading(true);
        setRefreshing(options?.pullToRefresh === true);
        setLoadError(false);
        const reqConfig = {
            method: 'get',
            url: `${server.server.baseUrl}api/user/trade-reco-for-user?user_email=${userEmail}`,
            timeout: 12000,
            headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET,
                ),
            },
        };
        const request = axios
            .request(reqConfig)
            .then((response) => {
                if (inFlightRef.current !== currentRequest) return;
                const trades = response.data?.trades || [];
                const executed = trades.filter((t) => {
                    if (!shouldShowInOrderHistory(t)) return false;
                    // Do not keep stale failed-to-place orders in the customer
                    // order book forever. Regular pending/AMO status is relevant
                    // only on its trading day; GTT is the intentional exception.
                    return !isActionablePendingOrder(t) || isGttOrder(t) || isToday(getOrderTimestamp(t));
                });
                const sorted = [...executed].sort((a, b) => {
                    const da = getOrderTimestamp(a);
                    const db = getOrderTimestamp(b);
                    if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
                    if (isNaN(da.getTime())) return 1;
                    if (isNaN(db.getTime())) return -1;
                    return db - da;
                });
                setAllOrders(sorted);
            })
            .catch(() => {
                if (inFlightRef.current === currentRequest) setLoadError(true);
            })
            .finally(() => {
                if (inFlightRef.current === currentRequest) {
                    inFlightRef.current = null;
                    setLoading(false);
                    setRefreshing(false);
                }
            });
        currentRequest.promise = request;
        return request;
    }, [configData?.config?.REACT_APP_HEADER_NAME, userEmail]);

    // Orders lives in the bottom-tab navigator, so a mount effect runs once and
    // never again — placing an order from another tab left this screen showing
    // the pre-order list with no way back to fresh data except pull-to-refresh
    // (user-reported 2026-09-02: "Orders screen did not get auto refreshed and
    // it was not showing the orders placed"). Refetch on focus instead, which
    // also covers the first open and a late-resolving `userEmail` (the callback
    // re-runs while focused when its deps change), so no separate mount effect
    // is needed — having both just double-fetched on every open.
    useFocusEffect(
        useCallback(() => {
            if (userEmail) fetchTrades();
        }, [userEmail, fetchTrades]),
    );

    // The listeners below are registered once, so a closure over `fetchTrades`
    // would pin the FIRST render's copy — the one built before `userEmail`
    // resolved, which early-returns. Go through a ref so they always call the
    // current fetcher.
    const fetchTradesRef = useRef(fetchTrades);
    useEffect(() => {
        fetchTradesRef.current = fetchTrades;
    }, [fetchTrades]);

    useEffect(() => {
        const handlePortfolioUpdate = () => fetchTradesRef.current();
        eventEmitter.on('cartUpdated', handlePortfolioUpdate);
        // Covers the case where the order is placed while Orders is already
        // the focused tab (deep-link execution, a modal over this screen), so
        // no focus transition follows the placement.
        eventEmitter.on('OrderPlacedReferesh', handlePortfolioUpdate);
        eventEmitter.on('refreshEvent', handlePortfolioUpdate);
        return () => {
            eventEmitter.off('cartUpdated', handlePortfolioUpdate);
            eventEmitter.off('OrderPlacedReferesh', handlePortfolioUpdate);
            eventEmitter.off('refreshEvent', handlePortfolioUpdate);
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

    // The shared CustomToolbar already owns live index subscriptions. Orders
    // does not render tickers; subscribing here caused another socket callback
    // and 30-second market-data poll on every Orders mount.
    // Variant-facing user name for the greeting (full name preferred over
    // email-derived first-name fallback). See AccountSettingsScreen
    // container for the same useTrade().userDetails source.
    const userName =
        getAccountDisplayName(
            userDetailsTradeCtx?.name,
            auth.currentUser?.displayName,
        );

    const viewModel = useMemo(
        () => ({
            orders: allOrders,
            isLoading: loading,
            isRefreshing: refreshing,
            loadError,
            gradient: {
                start: config?.gradient1,
                end: config?.gradient2,
            },
            // Additive — default presentation ignores these.
            userEmail,
            userName,
            config,
        }),
        [allOrders, loading, refreshing, loadError, config, userEmail, userName],
    );

    const actions = useMemo(
        () => ({ openDdpiHelp, refreshOrders: () => fetchTrades({pullToRefresh: true}) }),
        [openDdpiHelp, fetchTrades],
    );

    // Reference kept so a future PR can surface a "rejected only" filter
    // in the UI without re-deriving — not currently displayed.
    // eslint-disable-next-line no-unused-vars
    const rejectedOrders = allOrders.filter((t) => isOrderRejected(t.trade_place_status));

    return <Presentation viewModel={viewModel} actions={actions} />;
}
