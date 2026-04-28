/**
 * portfolioEvents.js
 *
 * Structured event emitter for portfolio-related cross-component communication.
 * Ported from prod-alphaquark-github web app for consistency.
 *
 * Usage:
 *   import portfolioEvents, { PORTFOLIO_EVENTS } from './portfolioEvents';
 *
 *   // Subscribe
 *   const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, (data) => {
 *     refetchHoldings();
 *   });
 *
 *   // Emit
 *   portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, { userEmail, modelName });
 *
 *   // Cleanup
 *   unsub();
 */

export const PORTFOLIO_EVENTS = {
  HOLDINGS_REFRESH: 'HOLDINGS_REFRESH',
  REBALANCE_EXECUTED: 'REBALANCE_EXECUTED',
  DISTRIBUTION_REFRESH: 'DISTRIBUTION_REFRESH',
  BROKER_CONNECTED: 'BROKER_CONNECTED',
  BROKER_DISCONNECTED: 'BROKER_DISCONNECTED',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
};

class PortfolioEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(
        cb => cb !== callback,
      );
    };
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.warn(`[PortfolioEvents] Error in ${event} listener:`, err);
      }
    });
  }

  off(event) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

const portfolioEvents = new PortfolioEventEmitter();
export default portfolioEvents;
