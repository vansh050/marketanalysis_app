/**
 * PortfolioSummaryService — mobile client for the customer-facing
 * "Client Performance Summary" (fund-wise) read surface.
 *
 * Direct port of prod-alphaquark-github/src/services/PortfolioSummaryService.js
 * (the customer /me reads), swapping web's `encryptApiKey` header helper for the
 * mobile `getOptionalAuthHeaders()` (X-Advisor-Subdomain + aq-encrypted-key,
 * plus a Firebase Bearer when the caller is signed in). Read-only, no new
 * backend. See prod-alphaquark-github/docs/CLIENT_PERFORMANCE_SUMMARY_ARCHITECTURE.md.
 *
 * HOST: these routes live on the NODE server (`server.server.baseUrl` =
 * server.alphaquark.in) under /api/model-portfolio/* — same host web hits. Do
 * NOT move them to the ccxt comms host.
 *
 * The three endpoints (all identified by the :email path param, same as web):
 *   1. GET /api/model-portfolio/portfolio-summary/:email   (Phase 1 — fund-wise)
 *   2. GET /api/model-portfolio/value-history/:email        (Phase 3 — chart + XIRR/TWRR)
 *   3. GET /api/model-portfolio/realised-pnl/:email         (Phase 2 — sold positions)
 *
 * getPortfolioSummary → data:
 *   { totalInvested, totalCurrent, totalReturns, returnsPercentage,
 *     estTotalCost, totalReturnsNet, returnsPercentageNet, portfolioCount,
 *     portfolios: [{ modelName, broker, invested, current, returns,
 *       returnsPercentage, estCost, returnsNet, returnsPercentageNet,
 *       subscriptionAmount, ltpSnapshotTimestamp, stockCount }] }
 *
 * getValueHistory → data:
 *   { series:[{date,total_aum,invested}], by_model:[{model_name,series[],summary}],
 *     summary:{as_of,total_aum,invested,abs_gain,actual_current,points}, xirr, twrr }
 *
 * getRealisedPnl → data:
 *   { funds:[{ modelName, modelRealised, customerRealised, closedCount,
 *       closedPositions:[{symbol,qty,avgCost,exitPrice,realised,exitDate}] }],
 *     totalModelRealised, totalCustomerRealised }
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { getOptionalAuthHeaders } from '../../utils/courseAuthHeaders';

const BASE = `${server.server.baseUrl}api/model-portfolio`;

class PortfolioSummaryService {
  /**
   * Fund-wise portfolio summary for a customer.
   * @param {string} email  customer email (self-view)
   * @param {string} [broker] preferred broker to value against (optional)
   * @returns {Promise<object|null>} the `data` object, or null
   */
  async getPortfolioSummary(email, broker) {
    if (!email) return null;
    const headers = await getOptionalAuthHeaders();
    const res = await axios.get(
      `${BASE}/portfolio-summary/${encodeURIComponent(email)}`,
      { headers, params: broker ? { broker } : {} },
    );
    return res?.data?.data || null;
  }

  /**
   * Since-inception value history + XIRR/TWRR for a customer.
   * @param {string} email
   * @param {string} [broker]
   * @returns {Promise<object|null>}
   */
  async getValueHistory(email, broker) {
    if (!email) return null;
    const headers = await getOptionalAuthHeaders();
    const res = await axios.get(
      `${BASE}/value-history/${encodeURIComponent(email)}`,
      { headers, params: broker ? { broker } : {} },
    );
    return res?.data?.data || null;
  }

  /**
   * Realised gain/loss on SOLD positions per fund.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async getRealisedPnl(email) {
    if (!email) return null;
    const headers = await getOptionalAuthHeaders();
    const res = await axios.get(
      `${BASE}/realised-pnl/${encodeURIComponent(email)}`,
      { headers },
    );
    return res?.data?.data || null;
  }
}

export default new PortfolioSummaryService();
