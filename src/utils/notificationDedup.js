const DEFAULT_DUPLICATE_WINDOW_MS = 60 * 1000;

const normalizeNotificationText = value =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const notificationTimestamp = (parent, child) => {
  const value =
    child?.date ||
    child?.insertedAt ||
    parent?.insertedAt ||
    parent?.date ||
    null;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
};

const inAppSignature = (parent, child) => {
  const title = child?.title || parent?.title;
  const message =
    child?.message ||
    child?.body ||
    parent?.body ||
    parent?.description ||
    '';
  const type =
    child?.notificationType || parent?.notificationType || 'in-app';

  return [
    normalizeNotificationText(type),
    normalizeNotificationText(title),
    normalizeNotificationText(message),
  ].join('|');
};

/**
 * Removes accidental rapid-repeat in-app notifications while retaining
 * legitimate reminders sent again later. The API returns oldest-to-newest
 * rows, so iteration runs backwards and keeps the newest copy.
 */
export const dedupeNotificationFeed = (
  rawNotifications,
  duplicateWindowMs = DEFAULT_DUPLICATE_WINDOW_MS,
) => {
  if (!Array.isArray(rawNotifications)) {
    return [];
  }

  const newestTimestampBySignature = new Map();
  const dedupedReversed = [];

  for (let index = rawNotifications.length - 1; index >= 0; index -= 1) {
    const parent = rawNotifications[index];
    const inAppNotifications = parent?.inAppNotifications;

    if (!Array.isArray(inAppNotifications) || inAppNotifications.length === 0) {
      dedupedReversed.push(parent);
      continue;
    }

    const keptChildrenReversed = [];
    for (
      let childIndex = inAppNotifications.length - 1;
      childIndex >= 0;
      childIndex -= 1
    ) {
      const child = inAppNotifications[childIndex];
      const timestamp = notificationTimestamp(parent, child);
      const signature = inAppSignature(parent, child);
      const newestTimestamp = newestTimestampBySignature.get(signature);
      const isRapidDuplicate =
        timestamp != null &&
        newestTimestamp != null &&
        newestTimestamp - timestamp >= 0 &&
        newestTimestamp - timestamp <= duplicateWindowMs;

      if (!isRapidDuplicate) {
        keptChildrenReversed.push(child);
        if (timestamp != null) {
          newestTimestampBySignature.set(signature, timestamp);
        }
      }
    }

    if (keptChildrenReversed.length > 0) {
      dedupedReversed.push({
        ...parent,
        inAppNotifications: keptChildrenReversed.reverse(),
      });
    }
  }

  return dedupedReversed.reverse();
};

export const countUnreadNotifications = rawNotifications =>
  dedupeNotificationFeed(rawNotifications).filter(
    notification => !notification?.isRead,
  ).length;

export const dedupeNotificationSymbols = symbolPrices => {
  if (!Array.isArray(symbolPrices)) {
    return [];
  }
  const seen = new Set();
  return symbolPrices.filter(stock => {
    const signature = [
      stock?.symbol,
      stock?.searchSymbol,
      stock?.exchange,
      stock?.strike,
      stock?.optionType,
      stock?.price,
      stock?.orderType,
    ].map(normalizeNotificationText).join('|');
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
};

export const formatNotificationSymbol = stock => {
  if (!stock) {
    return '';
  }
  const symbol = stock.searchSymbol || stock.symbol || '';
  const optionType = String(stock.optionType || '').trim();
  const rawStrike = String(stock.strike || '').trim();
  const strike = rawStrike.toLowerCase() === 'order' ? '' : rawStrike;
  const isFuture = optionType.toUpperCase() === 'FUT';
  const isDerivative = ['NFO', 'BFO'].includes(
    String(stock.exchange || '').toUpperCase(),
  );
  if (!isDerivative || isFuture) {
    return symbol;
  }
  return [symbol, strike, optionType].filter(Boolean).join(' | ');
};

export default dedupeNotificationFeed;
