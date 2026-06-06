/**
 * Pure helpers extracted from src/screens/Home/OrderScreen.js as part of
 * Phase E.1 (2026-05-01). Keeping these out of the screen file lets the
 * container/presentation split stay clean and avoids reinventing them in
 * the presentation layer.
 */

import {
    isOrderSuccess,
    isOrderPending,
    isOrderCancelled,
} from './orderStatusUtils';

export const isToday = (date) => {
    const today = new Date();
    const inputDate = new Date(date);
    return today.toDateString() === inputDate.toDateString();
};

/**
 * Format an option-symbol with strike + expiry parts visually separated.
 * Falls through unchanged for non-option symbols.
 */
export const formatSymbol = (symbol) => {
    if (!symbol) return symbol;
    const regex = /(.*?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/;
    const match = symbol.match(regex);
    if (match) {
        return `${match[1]}${match[2]} | ${match[3]} | ${match[4]}`;
    }
    return symbol;
};

/**
 * Render an ISO date as "DD MMM YYYY | hh:mm:ss AM/PM".
 */
export const formatOrderDate = (isoDate) => {
    const dt = new Date(isoDate);
    const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' };
    const optionsTime = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    };
    const datePart = dt.toLocaleDateString('en-US', optionsDate).replace(',', '');
    const timePart = dt.toLocaleTimeString('en-US', optionsTime);
    return `${datePart} | ${timePart}`;
};

/**
 * Map a trade_place_status string to legacy bg/fg colour pair used by the
 * order-row status pill. Returned hex values match the pre-Phase-E look;
 * a future PR may replace these with token-driven equivalents.
 */
export const getStatusColors = (status) => {
    if (isOrderSuccess(status)) {
        return { color1: '#F0FFE8', color2: '#16A085' };
    }
    if (isOrderPending(status)) {
        return { color1: '#F9F0E6', color2: '#D49244' };
    }
    if (isOrderCancelled(status)) {
        return { color1: '#F3F4F6', color2: '#6B7280' };
    }
    return { color1: '#FDEAEC', color2: '#EA2D3F' };
};
