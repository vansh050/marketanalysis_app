const DAY_MS = 24 * 60 * 60 * 1000;

export const baseSymbol = symbol =>
  String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BL|BZ|SM|ST)$/, '');

const parseAction = row => {
  const actionId = String(row?.corp_action_action_id || '');
  const match = actionId.match(/_(BONUS|SPLIT)_(\d{4})(\d{2})(\d{2})$/i);
  if (!match) return null;
  const date = new Date(Date.UTC(+match[2], +match[3] - 1, +match[4]));
  const originalQuantity = Number(row?.corp_action_orig_qty);
  const adjustedQuantity = Number(row?.quantity);
  const symbol = baseSymbol(row?.symbol || row?.tradingsymbol);
  if (
    Number.isNaN(date.getTime()) ||
    !symbol ||
    !(originalQuantity > 0) ||
    !(adjustedQuantity > originalQuantity)
  ) return null;
  return {actionId, type: match[1].toUpperCase(), date, symbol, originalQuantity, adjustedQuantity};
};

export const getRecentCorporateActionNotices = (
  rows = [],
  {now = new Date(), maxAgeDays = 14} = {},
) => {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return [];
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const parsed = parseAction(row);
    if (!parsed) return;
    const ageMs = nowMs - parsed.date.getTime();
    if (ageMs < -DAY_MS || ageMs > maxAgeDays * DAY_MS) return;
    const key = `${parsed.actionId}:${parsed.symbol}`;
    const current = grouped.get(key) || {...parsed, originalQuantity: 0, adjustedQuantity: 0};
    current.originalQuantity += parsed.originalQuantity;
    current.adjustedQuantity += parsed.adjustedQuantity;
    grouped.set(key, current);
  });
  return [...grouped.values()].map(notice => ({
    ...notice,
    addedQuantity: notice.adjustedQuantity - notice.originalQuantity,
    dateLabel: notice.date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }),
  }));
};

export const corporateActionMessage = (notice, brokerQuantity = null) => {
  if (!notice) return '';
  const added = `${notice.addedQuantity} additional model share${notice.addedQuantity === 1 ? '' : 's'}`;
  const brokerLine = Number.isFinite(Number(brokerQuantity))
    ? ` Your broker currently reports ${Number(brokerQuantity)} share${Number(brokerQuantity) === 1 ? '' : 's'}.`
    : '';
  if (notice.type === 'BONUS') {
    return `${notice.symbol} bonus dated ${notice.dateLabel}: ${added} are being credited.${brokerLine} Model values already include the entitlement; broker quantity and day P&L may look temporarily wrong. This is not a market loss.`;
  }
  return `${notice.symbol} split dated ${notice.dateLabel}: quantity and cost basis are being adjusted.${brokerLine} Broker quantity and day P&L may look temporarily wrong while the credit settles.`;
};
