/**
 * NotificationListScreen — container (Phase J follow-up, 2026-05-06)
 *
 * Resolves the design-system presentation for the Notification list. Live
 * data is sourced via `useNotificationFeed` (which reads
 * TradeContext.allNotifications + getAllNotifcations + isNotificationLoading
 * — same backend feed `src/screens/Home/PushNotificationScreen.js` consumes)
 * and reshaped into the flat `{ id, section, kind, title, message, time,
 * unread }` rows the design-system presentations expect.
 *
 * Default presentation (`designs/default/screens/NotificationListScreen.js`)
 * keeps the legacy chrome — back-chevron + simple FlatList + empty state.
 * Alphanomy presentation (`designs/alphanomy/screens/NotificationListScreen.js`)
 * ports `alphanomy-improved.html § "08 · Notifications"` and falls back to
 * its built-in `FALLBACK_ITEMS` ONLY when this container hands it an empty
 * `notifications` array (e.g. boot, no auth, empty feed).
 *
 * The legacy 1800-line `PushNotificationScreen.js` is unchanged — its route
 * stays registered for deep-link / push-tap reachability, but no in-app bell
 * on the alphanomy fork points at it any more.
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useComponent } from '../design/useDesign';
import useNotificationFeed from '../screens/Home/hooks/useNotificationFeed';

const NotificationListScreen = () => {
    const navigation = useNavigation();
    const Presentation = useComponent('screens.NotificationListScreen');
    const { notifications, isLoading, refresh, markRead, markAllRead } =
        useNotificationFeed();

    const viewModel = {
        notifications,
        isLoading,
    };
    const actions = {
        onBack: () => navigation.goBack(),
        onRefresh: refresh,
        onMarkAllRead: markAllRead,
        onNotificationPress: (item) => {
            // Mark the row read; the alphanomy presentation just toggles
            // the unread style (no detail view yet — keep parity with the
            // sample data preview).
            if (item?.unread) {
                markRead(item);
            }
        },
    };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default NotificationListScreen;
