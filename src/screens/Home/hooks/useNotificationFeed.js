/**
 * useNotificationFeed — live notification data for the design-system NotificationListScreen
 *
 * Reads from `TradeContext` (the same `allNotifications`, `getAllNotifcations`,
 * `isNotificationLoading`, `userEmail`, `configData` that the legacy
 * `src/screens/Home/PushNotificationScreen.js` consumes) and normalizes the
 * raw rows into the flat `{ id, section, kind, title, message, time, unread }`
 * shape that `designs/{default,alphanomy}/screens/NotificationListScreen.js`
 * expects through `viewModel.notifications`.
 *
 * Three legacy notification shapes (mirrors PushNotificationScreen's
 * `sortNotificationsByDate`):
 *   1. **inApp** — `notification.inAppNotifications: [{ title, body, date, ... }]`.
 *      Each sub-row becomes its own design-system row.
 *   2. **rebalance** — `notification.modelName` set; `insertedAt` / `date` is
 *      the timestamp. One design-system row, kind = 'advisory'.
 *   3. **stock** — `notification.symbolPrice: [{ ... }]` non-empty;
 *      `insertedAt` is the timestamp. One design-system row, kind = 'order'.
 *
 * Backend endpoints (for parity with PushNotificationScreen.js):
 *   - GET  /api/sendnotification/get-user-notifications/{userEmail}
 *     — handled by TradeContext.getAllNotifcations(), exposed as `allNotifications`.
 *   - PUT  /api/sendnotification/mark-notification-read-by-id
 *     body: { userEmail, notificationId }
 *     — used by `markRead(id)`.
 *
 * There is no "mark all read" endpoint exposed by the backend today, so
 * `markAllRead()` iterates the unread set and fires per-id PUTs in
 * parallel, then refreshes. If a real bulk endpoint lands later, swap
 * the body of `markAllRead` here only.
 *
 * Returns:
 *   {
 *     notifications: Array<{ id, section, kind, title, message, time, unread, _raw }>,
 *     isLoading: boolean,
 *     refresh: () => Promise<void>,
 *     markRead: (notificationId: string) => Promise<void>,
 *     markAllRead: () => Promise<void>,
 *   }
 */

import { useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import { useTrade } from '../../TradeContext';
import server from '../../../utils/serverConfig';
import { generateToken } from '../../../utils/SecurityTokenManager';

// ─────────────────────────────────────────────────────────────────────────────
// Time + section formatting
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

// Relative time string for the row's right-side label. Mirrors what users
// expect on a notifications feed: very recent → "Xm ago" / "Xh ago", today
// → "Xh ago", anything older → short date "Apr 27".
const formatRelativeTime = (date, now = new Date()) => {
    if (!date || Number.isNaN(date.getTime())) {return '';}
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) {return 'just now';}
    if (diffMin < 60) {return `${diffMin}m ago`;}
    const diffHr = Math.round(diffMin / 60);
    if (sameDay(date, now)) {return `${diffHr}h ago`;}
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(date, yesterday)) {return 'Yesterday';}
    const yearSuffix =
        date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
    return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}${yearSuffix}`;
};

// Section header — mirrors the HTML mockup (Today / Yesterday / Earlier).
const sectionLabelFor = (date, now = new Date()) => {
    if (!date || Number.isNaN(date.getTime())) {return 'Earlier';}
    if (sameDay(date, now)) {return 'Today';}
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(date, yesterday)) {return 'Yesterday';}
    return 'Earlier';
};

// ─────────────────────────────────────────────────────────────────────────────
// Kind classifier — picks the colored icon tile.
// Maps to the alphanomy variant's KIND_MAP in the presentation.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_KEYWORDS = {
    order: ['buy', 'sell', 'order', 'execut', 'trade', 'fill', 'open', 'closed'],
    advisory: ['advisory', 'advisor', 'recommend', 'target', 'rebalance', 'plan'],
    reminder: ['remind', 'reminder', 'closure', 'holiday', 'closed'],
    alert: ['stop loss', 'stop-loss', 'sl', 'alert', 'triggered', 'warning'],
    message: ['message', 'reply', 'query'],
};

const inferKind = (typeHint, ...textParts) => {
    if (typeHint === 'rebalance') {return 'advisory';}
    if (typeHint === 'stock') {return 'order';}
    const hay = textParts
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    for (const [kind, keywords] of Object.entries(KIND_KEYWORDS)) {
        if (keywords.some((kw) => hay.includes(kw))) {return kind;}
    }
    return 'message';
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-shape row builders
// ─────────────────────────────────────────────────────────────────────────────

// inApp sub-row → one design-system row.
const buildInAppRow = (parent, sub, index, now) => {
    const dateStr = sub?.date || sub?.insertedAt || parent?.insertedAt;
    const date = dateStr ? new Date(dateStr) : null;
    const title = sub?.title || parent?.title || 'Notification';
    const message = sub?.body || sub?.message || parent?.body || '';
    const id =
        parent?._id
            ? `inapp-${parent._id}-${index}`
            : `inapp-${index}-${date ? date.getTime() : Date.now()}`;
    return {
        id,
        section: sectionLabelFor(date, now),
        kind: inferKind('inApp', title, message),
        title,
        message,
        time: formatRelativeTime(date, now),
        unread: !parent?.isRead,
        _raw: { type: 'inApp', parent, sub, sortMs: date?.getTime?.() || 0 },
    };
};

const buildRebalanceRow = (n, now) => {
    const dateStr = n?.insertedAt || n?.date;
    const date = dateStr ? new Date(dateStr) : null;
    const title = n?.title || `Rebalance · ${n?.modelName || 'Plan'}`;
    const message =
        n?.body ||
        n?.description ||
        (n?.modelName
            ? `Your advisor has updated the ${n.modelName} portfolio.`
            : 'Your advisor has updated a model portfolio.');
    return {
        id: n?._id ? `rebalance-${n._id}` : `rebalance-${date?.getTime?.() || Date.now()}`,
        section: sectionLabelFor(date, now),
        kind: 'advisory',
        title,
        message,
        time: formatRelativeTime(date, now),
        unread: !n?.isRead,
        _raw: { type: 'rebalance', notification: n, sortMs: date?.getTime?.() || 0 },
    };
};

const buildStockRow = (n, now) => {
    const dateStr = n?.insertedAt;
    const date = dateStr ? new Date(dateStr) : null;
    const first = Array.isArray(n?.symbolPrice) ? n.symbolPrice[0] : null;
    const symbol = first?.symbol || n?.title || 'Stock';
    const title = n?.title || `${first?.action || 'Trade'} · ${symbol}`;
    const message =
        n?.body ||
        n?.description ||
        (first
            ? `${first.action || 'Order'} ${symbol}${first.price != null ? ` at ₹${first.price}` : ''}`
            : 'Stock notification');
    return {
        id: n?._id ? `stock-${n._id}` : `stock-${date?.getTime?.() || Date.now()}`,
        section: sectionLabelFor(date, now),
        kind: inferKind('stock', title, message),
        title,
        message,
        time: formatRelativeTime(date, now),
        unread: !n?.isRead,
        _raw: { type: 'stock', notification: n, sortMs: date?.getTime?.() || 0 },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main normalizer + section ordering
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_ORDER = { Today: 0, Yesterday: 1, Earlier: 2 };

const normalizeFeed = (rawList) => {
    const now = new Date();
    const out = [];
    if (!Array.isArray(rawList)) {return out;}

    for (const n of rawList) {
        if (!n) {continue;}
        if (
            Array.isArray(n.inAppNotifications) &&
            n.inAppNotifications.length > 0
        ) {
            n.inAppNotifications.forEach((sub, idx) => {
                out.push(buildInAppRow(n, sub, idx, now));
            });
        } else if (n.modelName) {
            out.push(buildRebalanceRow(n, now));
        } else if (
            Array.isArray(n.symbolPrice) &&
            n.symbolPrice.length > 0
        ) {
            out.push(buildStockRow(n, now));
        }
    }

    // Stable section + recency sort: Today first, then Yesterday, then
    // Earlier; within each section newest first.
    out.sort((a, b) => {
        const sa = SECTION_ORDER[a.section] ?? 99;
        const sb = SECTION_ORDER[b.section] ?? 99;
        if (sa !== sb) {return sa - sb;}
        const ma = a._raw?.sortMs || 0;
        const mb = b._raw?.sortMs || 0;
        return mb - ma;
    });

    return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// The hook
// ─────────────────────────────────────────────────────────────────────────────

const useNotificationFeed = () => {
    const {
        allNotifications,
        getAllNotifcations,
        isNotificationLoading,
        userEmail,
        configData,
    } = useTrade();

    // First-load fetch. Same trigger PushNotificationScreen uses (mount-time
    // without dep tracking). Re-firing on focus is the container's job.
    useEffect(() => {
        if (typeof getAllNotifcations === 'function') {
            getAllNotifcations();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const notifications = useMemo(
        () => normalizeFeed(allNotifications?.notifications),
        [allNotifications],
    );

    const refresh = useCallback(async () => {
        if (typeof getAllNotifcations === 'function') {
            await getAllNotifcations();
        }
    }, [getAllNotifcations]);

    // Per-id mark-as-read. Mirrors PushNotificationScreen's
    // `markNotificationAsReadById` body for parity. Accepts either the
    // raw mongo `_id` (preferred) or the design-system row id we built;
    // the row id still embeds the mongo id after the type prefix
    // ("inapp-<id>-N" / "rebalance-<id>" / "stock-<id>") so we can
    // recover it.
    const markRead = useCallback(
        async (rowOrId) => {
            const id =
                typeof rowOrId === 'string'
                    ? rowOrId
                    : rowOrId?._raw?.parent?._id ||
                      rowOrId?._raw?.notification?._id ||
                      rowOrId?.id;
            if (!id || !userEmail) {return;}
            // Recover the raw _id from a built row id.
            const rawId = id.replace(/^(inapp|rebalance|stock)-/, '').split('-')[0];
            try {
                await axios.put(
                    `${server.server.baseUrl}api/sendnotification/mark-notification-read-by-id`,
                    { userEmail, notificationId: rawId },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain':
                                configData?.config?.REACT_APP_HEADER_NAME,
                            'aq-encrypted-key': generateToken(
                                Config.REACT_APP_AQ_KEYS,
                                Config.REACT_APP_AQ_SECRET,
                            ),
                        },
                    },
                );
                await refresh();
            } catch (err) {
                console.warn('[useNotificationFeed] markRead failed', err?.message || err);
            }
        },
        [userEmail, configData, refresh],
    );

    // No bulk-mark endpoint today — fan out per-id PUTs in parallel and
    // refresh once at the end. Swap the body for a single endpoint call
    // when the backend exposes one.
    const markAllRead = useCallback(async () => {
        const unread = notifications.filter((n) => n.unread);
        if (unread.length === 0 || !userEmail) {return;}
        const seenRawIds = new Set();
        const headers = {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
            ),
        };
        try {
            await Promise.all(
                unread
                    .map((row) => {
                        const rawId =
                            row?._raw?.parent?._id ||
                            row?._raw?.notification?._id ||
                            (row?.id || '').replace(/^(inapp|rebalance|stock)-/, '').split('-')[0];
                        if (!rawId || seenRawIds.has(rawId)) {return null;}
                        seenRawIds.add(rawId);
                        return axios
                            .put(
                                `${server.server.baseUrl}api/sendnotification/mark-notification-read-by-id`,
                                { userEmail, notificationId: rawId },
                                { headers },
                            )
                            .catch((err) => {
                                console.warn(
                                    '[useNotificationFeed] markAllRead per-id failed',
                                    rawId,
                                    err?.message || err,
                                );
                            });
                    })
                    .filter(Boolean),
            );
            await refresh();
        } catch (err) {
            console.warn('[useNotificationFeed] markAllRead failed', err?.message || err);
        }
    }, [notifications, userEmail, configData, refresh]);

    return {
        notifications,
        isLoading: !!isNotificationLoading,
        refresh,
        markRead,
        markAllRead,
    };
};

export default useNotificationFeed;
