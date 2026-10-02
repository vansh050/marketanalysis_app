// Both entry modes become a confirmed absolute investment target.
// The base excludes a previously included P&L adjustment.
export function investmentTarget({ mode, entered, preview, includePnl = false, now = Date.now() }) {
  if (entered === '' || entered == null) return null;
  const amount = Number(entered);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const priorBase = Number(preview?.baseInvestmentAmount);
  if (mode === 'topup' && (preview?.status !== 0 || !Number.isFinite(priorBase))) return null;
  const base = amount + (mode === 'topup' ? priorBase : 0);
  if (includePnl && (preview?.pnlAvailable !== true || !preview?.pnlQuoteId ||
      !Number.isFinite(Number(preview.netPnl)) ||
      !Number.isFinite(Date.parse(preview.asOf)) ||
      now - Date.parse(preview.asOf) > 5 * 60 * 1000)) return null;
  const pnl = includePnl ? Number(preview.netPnl) : 0;
  const total = Math.round((base + pnl) * 100) / 100;
  if (total <= 0) return null;
  return { base: Math.round(base * 100) / 100, pnl, total };
}

export function investmentEntry({ mode, entered, preview, includePnl, dateTime }) {
  const target = investmentTarget({ mode, entered, preview, includePnl });
  if (!target) throw new Error('Review the amount or refresh the P&L preview.');
  return {
    investmentIntentVersion: 2, inputMode: mode, enteredAmount: Number(entered),
    includePnl, pnlQuoteId: includePnl ? preview.pnlQuoteId : null,
    amount: target.total, baseInvestmentAmount: target.base, pnlAdjustment: target.pnl,
    changeMode: 'full', changeAmount: null, dateTime,
  };
}
