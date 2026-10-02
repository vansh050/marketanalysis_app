/**
 * The equity-delivery SELLs a customer must approve on CDSL, for the shared
 * SellAuthGuideCard "Approve these" list. Prefers the broker's actual
 * rejected/unfilled SELL rows (post-placement), else the planned SELLs.
 * Display only — never used to decide whether to block.
 */
const FAILED = new Set(['REJECTED', 'FAILED', 'FAILURE', 'CANCELLED', 'CANCELED']);

const isEquityDeliverySell = row => {
  if (!row || typeof row !== 'object') return false;
  const side = String(row.transactionType || row.TransactionType || '').toUpperCase();
  if (side !== 'SELL') return false;
  const exchange = String(row.exchange || row.Exchange || '').toUpperCase();
  const product = String(row.productType || row.ProductType || 'CNC').toUpperCase();
  if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
  if (['MIS', 'NRML', 'CARRYFORWARD'].includes(product)) return false;
  return true;
};

export function sellOrdersForAuth(...sources) {
  for (const source of sources) {
    const rows = Array.isArray(source) ? source.filter(isEquityDeliverySell) : [];
    if (!rows.length) continue;
    const failed = rows.filter(r => FAILED.has(String(r.orderStatus || '').toUpperCase()));
    return failed.length ? failed : rows;
  }
  return [];
}

export default sellOrdersForAuth;
