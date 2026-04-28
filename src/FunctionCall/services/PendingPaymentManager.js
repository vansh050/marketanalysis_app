/**
 * PendingPaymentManager - Manages pending payment tracking and recovery
 *
 * This service handles:
 * 1. Saving pending payment info to AsyncStorage when payment is initiated
 * 2. Clearing pending payment when payment completes (success or confirmed failure)
 * 3. Checking and recovering pending payments on app resume
 * 4. Providing hooks for payment recovery flow
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkFullPaymentStatus,
  PaymentStatus,
  DigioStatus,
} from './PaymentStatusService';
import {logPayment} from '../../utils/Logging';

// AsyncStorage keys
const PENDING_PAYMENT_KEY = '@pending_payment';
const PENDING_DIGIO_KEY = '@pending_digio';

// Payment types
export const PaymentType = {
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
};

/**
 * Pending payment data structure
 * @typedef {Object} PendingPayment
 * @property {string} orderId - Cashfree order ID
 * @property {string} userEmail - User's email
 * @property {string} planId - Plan ID
 * @property {string} paymentType - 'one_time' or 'recurring'
 * @property {number} amount - Payment amount
 * @property {object} planDetails - Full plan details
 * @property {object} userDetails - User details (name, pan, phone, etc.)
 * @property {number} initiatedAt - Timestamp when payment was initiated
 * @property {string} subscriptionId - Subscription ID if created
 * @property {boolean} digioRequired - Whether Digio is required
 * @property {string} digioDocumentId - Digio document ID if applicable
 */

/**
 * Save pending payment to AsyncStorage
 * @param {PendingPayment} paymentData - Payment data to save
 * @returns {Promise<boolean>}
 */
export const savePendingPayment = async (paymentData) => {
  try {
    const pendingPayment = {
      ...paymentData,
      initiatedAt: Date.now(),
    };

    await AsyncStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify(pendingPayment),
    );

    console.log('[PendingPaymentManager] Saved pending payment:', paymentData.orderId);
    return true;
  } catch (error) {
    console.error('[PendingPaymentManager] Error saving pending payment:', error);
    return false;
  }
};

/**
 * Get pending payment from AsyncStorage
 * @returns {Promise<PendingPayment|null>}
 */
export const getPendingPayment = async () => {
  try {
    const data = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
    if (data) {
      const pendingPayment = JSON.parse(data);

      // Check if payment is too old (more than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - pendingPayment.initiatedAt > maxAge) {
        console.log('[PendingPaymentManager] Pending payment expired, clearing...');
        await clearPendingPayment();
        return null;
      }

      return pendingPayment;
    }
    return null;
  } catch (error) {
    console.error('[PendingPaymentManager] Error getting pending payment:', error);
    return null;
  }
};

/**
 * Clear pending payment from AsyncStorage
 * @returns {Promise<boolean>}
 */
export const clearPendingPayment = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
    console.log('[PendingPaymentManager] Cleared pending payment');
    return true;
  } catch (error) {
    console.error('[PendingPaymentManager] Error clearing pending payment:', error);
    return false;
  }
};

/**
 * Save pending Digio signature to AsyncStorage
 * @param {object} digioData - Digio data to save
 * @returns {Promise<boolean>}
 */
export const savePendingDigio = async (digioData) => {
  try {
    const pendingDigio = {
      ...digioData,
      initiatedAt: Date.now(),
    };

    await AsyncStorage.setItem(
      PENDING_DIGIO_KEY,
      JSON.stringify(pendingDigio),
    );

    console.log('[PendingPaymentManager] Saved pending Digio:', digioData.documentId);
    return true;
  } catch (error) {
    console.error('[PendingPaymentManager] Error saving pending Digio:', error);
    return false;
  }
};

/**
 * Get pending Digio from AsyncStorage
 * @returns {Promise<object|null>}
 */
export const getPendingDigio = async () => {
  try {
    const data = await AsyncStorage.getItem(PENDING_DIGIO_KEY);
    if (data) {
      const pendingDigio = JSON.parse(data);

      // Check if Digio is too old (more than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - pendingDigio.initiatedAt > maxAge) {
        console.log('[PendingPaymentManager] Pending Digio expired, clearing...');
        await clearPendingDigio();
        return null;
      }

      return pendingDigio;
    }
    return null;
  } catch (error) {
    console.error('[PendingPaymentManager] Error getting pending Digio:', error);
    return null;
  }
};

/**
 * Clear pending Digio from AsyncStorage
 * @returns {Promise<boolean>}
 */
export const clearPendingDigio = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_DIGIO_KEY);
    console.log('[PendingPaymentManager] Cleared pending Digio');
    return true;
  } catch (error) {
    console.error('[PendingPaymentManager] Error clearing pending Digio:', error);
    return false;
  }
};

/**
 * Check and recover pending payment status
 * @param {object} configData - Configuration data
 * @returns {Promise<{hasPending: boolean, status: object, pendingPayment: object}>}
 */
export const checkAndRecoverPendingPayment = async (configData) => {
  try {
    const pendingPayment = await getPendingPayment();

    if (!pendingPayment) {
      return {hasPending: false};
    }

    console.log('[PendingPaymentManager] Found pending payment, checking status...');

    // Check the current status of the payment
    const status = await checkFullPaymentStatus({
      orderId: pendingPayment.orderId,
      userEmail: pendingPayment.userEmail,
      planId: pendingPayment.planId,
      configData,
    });

    await logPayment('PENDING_PAYMENT_RECOVERY_CHECK', {
      orderId: pendingPayment.orderId,
      userEmail: pendingPayment.userEmail,
      paymentStatus: status.payment?.status,
      digioStatus: status.subscription?.digioStatus,
      initiatedAt: new Date(pendingPayment.initiatedAt).toISOString(),
    }, configData);

    const needsAction = determineRecoveryAction(status, pendingPayment);

    // Clear pending payment if action says to
    if (needsAction.shouldClearPending) {
      await clearPendingPayment();
    }

    return {
      hasPending: true,
      pendingPayment,
      status,
      needsAction,
    };
  } catch (error) {
    console.error('[PendingPaymentManager] Error checking pending payment:', error);
    return {hasPending: false, error: error.message};
  }
};

/**
 * Determine what action is needed for recovery
 * @param {object} status - Current payment/subscription status
 * @param {object} pendingPayment - Pending payment data
 * @returns {object} Recovery action details
 */
const determineRecoveryAction = (status, pendingPayment) => {
  const {payment, subscription} = status;

  // Case 1: Payment succeeded but subscription not completed
  if (payment?.status === PaymentStatus.SUCCESS) {
    if (!subscription?.found || subscription?.status !== 'ACTIVE') {
      return {
        action: 'COMPLETE_SUBSCRIPTION',
        message: 'Payment was successful! Let us complete your subscription.',
        canAutoComplete: true,
      };
    }

    // Subscription is active - check Digio if required
    if (pendingPayment.digioRequired) {
      if (subscription?.digioStatus === DigioStatus.PENDING) {
        return {
          action: 'COMPLETE_DIGIO',
          message: 'Payment successful! Please complete the e-signature.',
          canAutoComplete: false,
        };
      } else if (subscription?.digioStatus === DigioStatus.FAILED) {
        return {
          action: 'RETRY_DIGIO',
          message: 'E-signature failed. Would you like to try again?',
          canAutoComplete: false,
          failureReason: subscription?.digioFailureReason,
        };
      }
    }

    // Everything is complete - clear will be called by caller
    return {
      action: 'NONE',
      message: 'Payment and subscription are complete!',
      isComplete: true,
      shouldClearPending: true,
    };
  }

  // Case 2: Payment is still pending
  if (payment?.status === PaymentStatus.PENDING || payment?.status === PaymentStatus.NOT_FOUND) {
    const timeSinceInitiation = Date.now() - pendingPayment.initiatedAt;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeSinceInitiation < fiveMinutes) {
      return {
        action: 'WAIT',
        message: 'Your payment is being processed...',
        canRetry: false,
      };
    }

    return {
      action: 'RETRY_PAYMENT',
      message: 'Payment status unclear. Would you like to retry?',
      canRetry: true,
    };
  }

  // Case 3: Payment failed
  if (payment?.status === PaymentStatus.FAILED) {
    return {
      action: 'PAYMENT_FAILED',
      message: 'Payment was not successful. Please try again.',
      canRetry: true,
      shouldClearPending: true,
    };
  }

  // Case 4: Error checking status
  return {
    action: 'CHECK_ERROR',
    message: 'Could not verify payment status. Please check your subscription.',
    canRetry: true,
  };
};

/**
 * Update pending payment with additional info (like subscription ID after creation)
 * @param {object} updates - Fields to update
 * @returns {Promise<boolean>}
 */
export const updatePendingPayment = async (updates) => {
  try {
    const pendingPayment = await getPendingPayment();
    if (pendingPayment) {
      const updated = {...pendingPayment, ...updates};
      await AsyncStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(updated));
      console.log('[PendingPaymentManager] Updated pending payment');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PendingPaymentManager] Error updating pending payment:', error);
    return false;
  }
};

/**
 * Create pending payment data structure from payment initiation
 * @param {object} params - Payment parameters
 * @returns {PendingPayment}
 */
export const createPendingPaymentData = ({
  orderId,
  subscriptionId,
  userEmail,
  planId,
  paymentType,
  amount,
  planDetails,
  userDetails,
  digioRequired = false,
  digioDocumentId = null,
}) => ({
  orderId,
  subscriptionId,
  userEmail,
  planId,
  paymentType,
  amount,
  planDetails: planDetails ? {
    _id: planDetails._id,
    name: planDetails.name,
    duration: planDetails.duration,
    advisor_email: planDetails.advisor_email,
  } : null,
  userDetails: userDetails ? {
    name: userDetails.name,
    email: userDetails.email,
    pan: userDetails.pan || userDetails.panNumber,
    phone: userDetails.phone || userDetails.mobileNumber,
    countryCode: userDetails.countryCode,
  } : null,
  digioRequired,
  digioDocumentId,
});

export default {
  PaymentType,
  savePendingPayment,
  getPendingPayment,
  clearPendingPayment,
  savePendingDigio,
  getPendingDigio,
  clearPendingDigio,
  checkAndRecoverPendingPayment,
  updatePendingPayment,
  createPendingPaymentData,
};
