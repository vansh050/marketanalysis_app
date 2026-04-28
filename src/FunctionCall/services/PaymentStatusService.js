/**
 * PaymentStatusService - Service to check and poll payment/subscription status
 *
 * This service handles:
 * 1. Checking Cashfree payment status via backend API
 * 2. Checking subscription status including Digio signature status
 * 3. Polling with configurable intervals and retry logic
 * 4. Supporting both one-time and recurring payments
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import {logPayment} from '../../utils/Logging';

// Payment status constants
export const PaymentStatus = {
  SUCCESS: 'SUCCESS',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  NOT_FOUND: 'NOT_FOUND',
  ERROR: 'ERROR',
};

// Digio status constants
export const DigioStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * Get common headers for API calls
 */
const getHeaders = (configData) => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

/**
 * Check Cashfree payment status for a given order ID
 * @param {string} orderId - The Cashfree order ID
 * @param {object} configData - Configuration data containing advisor subdomain
 * @returns {Promise<{status: string, data: object}>}
 */
export const checkCashfreePaymentStatus = async (orderId, configData) => {
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/cashfree?orderId=${orderId}`,
      {headers: getHeaders(configData)},
    );

    if (response.data?.success && response.data?.data) {
      const paymentData = response.data.data;

      // Handle array response (Cashfree returns array of payment attempts)
      const payments = Array.isArray(paymentData) ? paymentData : [paymentData];

      // Check if any payment was successful
      const successfulPayment = payments.find(
        p => p.payment_status === 'SUCCESS' || p.payment_status === 'PAID',
      );

      if (successfulPayment) {
        return {
          status: PaymentStatus.SUCCESS,
          data: successfulPayment,
          allPayments: payments,
        };
      }

      // Check for pending payments
      const pendingPayment = payments.find(
        p => p.payment_status === 'PENDING' || p.payment_status === 'INITIATED',
      );

      if (pendingPayment) {
        return {
          status: PaymentStatus.PENDING,
          data: pendingPayment,
          allPayments: payments,
        };
      }

      // All payments failed
      return {
        status: PaymentStatus.FAILED,
        data: payments[payments.length - 1] || {},
        allPayments: payments,
      };
    }

    return {
      status: PaymentStatus.NOT_FOUND,
      data: null,
      error: 'No payment data found',
    };
  } catch (error) {
    console.error('[PaymentStatusService] Error checking payment status:', error);
    return {
      status: PaymentStatus.ERROR,
      data: null,
      error: error.message,
    };
  }
};

/**
 * Check subscription status for a user and plan
 * This also includes Digio signature status
 * @param {string} userEmail - User's email
 * @param {string} planId - Plan ID
 * @param {object} configData - Configuration data
 * @returns {Promise<{subscription: object, digioStatus: string}>}
 */
export const checkSubscriptionStatus = async (userEmail, planId, configData) => {
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/subscription-check/user/${userEmail}/plan/${planId}`,
      {headers: getHeaders(configData)},
    );

    if (response.data?.subscription) {
      const subscription = response.data.subscription;
      return {
        found: true,
        subscription,
        status: subscription.status,
        digioStatus: subscription.digio_status || DigioStatus.PENDING,
        digioDocumentId: subscription.digio_document_id,
        digioFailureReason: subscription.digio_failure_reason,
        isActive: subscription.is_active && subscription.status === 'ACTIVE',
      };
    }

    return {
      found: false,
      subscription: null,
      status: null,
      digioStatus: null,
    };
  } catch (error) {
    console.error('[PaymentStatusService] Error checking subscription status:', error);
    return {
      found: false,
      subscription: null,
      error: error.message,
    };
  }
};

/**
 * Check subscription by Cashfree order ID
 * @param {string} orderId - Cashfree order ID
 * @param {object} configData - Configuration data
 * @returns {Promise<object>}
 */
export const checkSubscriptionByOrderId = async (orderId, configData) => {
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/subscription-check/order/${orderId}`,
      {headers: getHeaders(configData)},
    );

    if (response.data?.found) {
      return {
        found: true,
        subscription: response.data.subscription,
        digioStatus: response.data.digioStatus,
        status: response.data.status,
        isActive: response.data.isActive,
      };
    }

    return {found: false};
  } catch (error) {
    // Endpoint might not exist or subscription not found
    if (error.response?.status === 404) {
      return {found: false};
    }
    console.log('[PaymentStatusService] Order lookup error:', error.message);
    return {found: false, error: error.message};
  }
};

/**
 * Poll for payment status with retry logic
 * @param {string} orderId - Cashfree order ID
 * @param {object} configData - Configuration data
 * @param {object} options - Polling options
 * @returns {Promise<{status: string, data: object}>}
 */
export const pollPaymentStatus = async (
  orderId,
  configData,
  options = {},
) => {
  const {
    maxAttempts = 60,           // 5 minutes at 5-second intervals
    intervalMs = 5000,          // 5 seconds between polls
    onStatusUpdate = null,      // Callback for status updates
    shouldStop = () => false,   // Function to check if polling should stop
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    // Check if we should stop polling
    if (shouldStop()) {
      return {
        status: PaymentStatus.PENDING,
        stopped: true,
        message: 'Polling stopped by caller',
      };
    }

    attempts++;

    try {
      const result = await checkCashfreePaymentStatus(orderId, configData);

      // Notify caller of status update
      if (onStatusUpdate) {
        onStatusUpdate({
          attempt: attempts,
          maxAttempts,
          status: result.status,
          data: result.data,
        });
      }

      // If we have a definitive result (success or confirmed failure), return it
      if (result.status === PaymentStatus.SUCCESS) {
        await logPayment('PAYMENT_STATUS_POLL_SUCCESS', {
          orderId,
          attempts,
          status: result.status,
        }, configData);
        return result;
      }

      if (result.status === PaymentStatus.FAILED) {
        // Check if it's a confirmed failure or just no payment yet
        if (result.data?.payment_status === 'FAILED' ||
            result.data?.payment_status === 'CANCELLED' ||
            result.data?.payment_status === 'USER_DROPPED') {
          await logPayment('PAYMENT_STATUS_POLL_FAILED', {
            orderId,
            attempts,
            status: result.data?.payment_status,
          }, configData);
          return result;
        }
      }

      // For PENDING, NOT_FOUND, or ERROR - continue polling
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`[PaymentStatusService] Poll attempt ${attempts} failed:`, error);
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  // Max attempts reached
  await logPayment('PAYMENT_STATUS_POLL_TIMEOUT', {
    orderId,
    attempts,
  }, configData);

  return {
    status: PaymentStatus.PENDING,
    data: null,
    message: 'Payment status check timed out - payment may still be processing',
    attempts,
  };
};

/**
 * Poll for Digio status completion
 * @param {string} userEmail - User's email
 * @param {string} planId - Plan ID
 * @param {object} configData - Configuration data
 * @param {object} options - Polling options
 * @returns {Promise<{digioStatus: string, subscription: object}>}
 */
export const pollDigioStatus = async (
  userEmail,
  planId,
  configData,
  options = {},
) => {
  const {
    maxAttempts = 60,           // 5 minutes at 5-second intervals
    intervalMs = 5000,          // 5 seconds between polls
    onStatusUpdate = null,      // Callback for status updates
    shouldStop = () => false,   // Function to check if polling should stop
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    if (shouldStop()) {
      return {
        digioStatus: DigioStatus.PENDING,
        stopped: true,
        message: 'Polling stopped by caller',
      };
    }

    attempts++;

    try {
      const result = await checkSubscriptionStatus(userEmail, planId, configData);

      if (onStatusUpdate) {
        onStatusUpdate({
          attempt: attempts,
          maxAttempts,
          digioStatus: result.digioStatus,
          subscription: result.subscription,
        });
      }

      // If Digio signature is completed
      if (result.digioStatus === DigioStatus.COMPLETED) {
        await logPayment('DIGIO_STATUS_POLL_SUCCESS', {
          userEmail,
          planId,
          attempts,
          digioStatus: result.digioStatus,
        }, configData);
        return {
          digioStatus: DigioStatus.COMPLETED,
          subscription: result.subscription,
          success: true,
        };
      }

      // If Digio failed
      if (result.digioStatus === DigioStatus.FAILED) {
        await logPayment('DIGIO_STATUS_POLL_FAILED', {
          userEmail,
          planId,
          attempts,
          digioStatus: result.digioStatus,
          reason: result.digioFailureReason,
        }, configData);
        return {
          digioStatus: DigioStatus.FAILED,
          subscription: result.subscription,
          failureReason: result.digioFailureReason,
          success: false,
        };
      }

      // Still pending - continue polling
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`[PaymentStatusService] Digio poll attempt ${attempts} failed:`, error);
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  // Max attempts reached
  return {
    digioStatus: DigioStatus.PENDING,
    subscription: null,
    message: 'Digio status check timed out',
    attempts,
  };
};

/**
 * Combined status check - checks both payment and Digio status
 * @param {object} params - Parameters
 * @returns {Promise<object>}
 */
export const checkFullPaymentStatus = async ({
  orderId,
  userEmail,
  planId,
  configData,
}) => {
  const [paymentResult, subscriptionResult] = await Promise.all([
    orderId ? checkCashfreePaymentStatus(orderId, configData) : Promise.resolve(null),
    userEmail && planId ? checkSubscriptionStatus(userEmail, planId, configData) : Promise.resolve(null),
  ]);

  return {
    payment: paymentResult,
    subscription: subscriptionResult,
    isPaymentSuccess: paymentResult?.status === PaymentStatus.SUCCESS,
    isDigioComplete: subscriptionResult?.digioStatus === DigioStatus.COMPLETED,
    isDigioSkipped: subscriptionResult?.digioStatus === DigioStatus.SKIPPED,
    isFullyComplete:
      paymentResult?.status === PaymentStatus.SUCCESS &&
      (subscriptionResult?.digioStatus === DigioStatus.COMPLETED ||
       subscriptionResult?.digioStatus === DigioStatus.SKIPPED),
  };
};

export default {
  PaymentStatus,
  DigioStatus,
  checkCashfreePaymentStatus,
  checkSubscriptionStatus,
  checkSubscriptionByOrderId,
  pollPaymentStatus,
  pollDigioStatus,
  checkFullPaymentStatus,
};
