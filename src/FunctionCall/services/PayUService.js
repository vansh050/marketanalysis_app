/**
 * PayUService.js
 *
 * Service for PayU payment gateway integration in React Native.
 * Provides functions for one-time and recurring (Standing Instructions) payments.
 *
 * PayU Flow (different from Cashfree/Razorpay):
 * 1. App calls backend to create order -> Backend returns form data with hash
 * 2. App opens WebView with PayU form -> User completes payment on PayU
 * 3. PayU redirects to success/failure URL -> App intercepts and processes
 * 4. App calls backend to verify and complete payment
 *
 * ============================================================================
 * API ENDPOINTS
 * ============================================================================
 *
 * POST /api/payu/create-order          - Create PayU order for one-time payment
 * POST /api/payu/verify-payment        - Verify PayU payment status
 * POST /api/payu/complete-one-time-payment - Complete payment and activate subscription
 * POST /api/payu/si/register           - Register Standing Instructions for recurring
 * GET  /api/payu/si/status/:id         - Get SI mandate status
 * POST /api/payu/si/revoke             - Revoke/cancel SI mandate
 *
 * ============================================================================
 */

import axios from 'axios';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import { logPayment } from '../../utils/Logging';

/**
 * Get the standard headers for API requests
 * @param {Object} configData - Config data containing subdomain info
 * @returns {Object} Headers object
 */
const getHeaders = (configData) => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || Config.REACT_APP_HEADER_NAME,
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

// Subscription durations in days
const SUBSCRIPTION_DURATIONS = {
  monthly: 30,
  quarterly: 90,
  'half-yearly': 180,
  yearly: 365,
};

// Map frontend frequency names to backend SI frequency values
const FREQUENCY_MAP = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  'half-yearly': 'half-yearly',
  yearly: 'yearly',
};

/**
 * Get PayU form URL based on environment
 * @returns {string} PayU payment URL
 */
export function getPayUFormUrl() {
  const env = Config.REACT_APP_PAYU_ENV || 'TEST';
  return env === 'PRODUCTION'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment';
}

/**
 * Create a PayU order for one-time payment
 * Returns form data to be submitted to PayU via WebView
 *
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Payment amount
 * @param {string} params.user_email - User email
 * @param {string} params.name - User name
 * @param {string} params.phone - User phone number
 * @param {string} params.plan_id - Plan ID
 * @param {number} params.duration - Duration in days
 * @param {string} params.couponId - Applied coupon ID
 * @param {string} params.productinfo - Product description
 * @param {string} params.countryCode - Country code
 * @param {string} params.panNumber - PAN number
 * @param {string} params.birthDate - Date of birth
 * @param {string} params.telegramId - Telegram ID
 * @param {string} params.capital - Investment capital
 * @param {Object} params.configData - App config data
 * @returns {Promise<Object>} PayU form data
 */
export async function createPayUOrder({
  amount,
  user_email,
  name,
  phone,
  plan_id,
  duration,
  couponId,
  productinfo,
  countryCode,
  panNumber,
  birthDate,
  telegramId,
  capital,
  digioStatus,
  digioFailureReason,
  configData,
}) {
  const headers = getHeaders(configData);

  // For React Native, we'll use deep link URLs for return
  const appScheme = Config.REACT_APP_DEEP_LINK_SCHEME || 'alphab2b';
  const redirectLocation = `${appScheme}://payu/return`;

  const response = await axios.post(
    `${server.server.baseUrl}api/payu/create-order`,
    {
      amount,
      user_email,
      name,
      phone,
      plan_id,
      duration: duration || 30,
      couponId,
      productinfo: productinfo || 'Subscription',
      redirectSpecificLocation: redirectLocation,
      countryCode,
      panNumber,
      birthDate,
      telegramId,
      capital,
      digioStatus,
      digioFailureReason,
    },
    { headers },
  );

  return response.data;
}

/**
 * Verify PayU payment status
 *
 * @param {string} txnid - Transaction ID from PayU
 * @param {Object} configData - App config data
 * @returns {Promise<Object>} Verification result
 */
export async function verifyPayUPayment(txnid, configData) {
  const headers = getHeaders(configData);

  const response = await axios.post(
    `${server.server.baseUrl}api/payu/verify-payment`,
    { txnid },
    { headers },
  );

  return response.data;
}

/**
 * Complete PayU one-time payment and activate subscription
 *
 * @param {Object} params - Completion parameters
 * @param {string} params.txnid - Transaction ID
 * @param {number} params.oneTimeDurationPlan - Duration in days
 * @param {number} params.part - Part number for multi-part payments
 * @param {Object} params.configData - App config data
 * @returns {Promise<Object>} Completion result
 */
export async function completePayUPayment({
  txnid,
  oneTimeDurationPlan,
  part,
  configData,
}) {
  const headers = getHeaders(configData);

  const requestPayload = { txnid };

  if (oneTimeDurationPlan) {
    requestPayload.oneTimeDurationPlan = oneTimeDurationPlan;
  }

  if (part !== undefined && part !== null) {
    requestPayload.part = Number(part);
  }

  const response = await axios.post(
    `${server.server.baseUrl}api/payu/complete-one-time-payment`,
    requestPayload,
    { headers },
  );

  return response.data;
}

/**
 * Get PayU transaction status
 *
 * @param {string} txnid - Transaction ID
 * @param {Object} configData - App config data
 * @returns {Promise<Object>} Transaction status
 */
export async function getPayUTransactionStatus(txnid, configData) {
  const headers = getHeaders(configData);

  const response = await axios.get(
    `${server.server.baseUrl}api/payu/transaction-status/${txnid}`,
    { headers },
  );

  return response.data;
}

/**
 * Register PayU Standing Instructions (SI) for recurring payments
 * Returns form data to be submitted to PayU via WebView
 *
 * @param {Object} params - SI registration parameters
 * @param {number} params.amount - Payment amount
 * @param {string} params.user_email - User email
 * @param {string} params.name - User name
 * @param {string} params.phone - User phone number
 * @param {string} params.plan_id - Plan ID
 * @param {string} params.frequency - Billing frequency (monthly, quarterly, etc.)
 * @param {number} params.duration - Number of billing cycles
 * @param {string} params.productinfo - Product description
 * @param {string} params.countryCode - Country code
 * @param {string} params.panNumber - PAN number
 * @param {string} params.birthDate - Date of birth
 * @param {string} params.telegramId - Telegram ID
 * @param {string} params.capital - Investment capital
 * @param {Object} params.configData - App config data
 * @returns {Promise<Object>} PayU SI form data
 */
export async function registerPayUSI({
  amount,
  user_email,
  name,
  phone,
  plan_id,
  frequency,
  duration,
  productinfo,
  countryCode,
  panNumber,
  birthDate,
  telegramId,
  capital,
  couponId,
  configData,
}) {
  const headers = getHeaders(configData);

  // For React Native, we'll use deep link URLs for return
  const appScheme = Config.REACT_APP_DEEP_LINK_SCHEME || 'alphab2b';
  const redirectLocation = `${appScheme}://payu/si/return`;

  // Calculate SI start and end dates
  const today = new Date();
  const siStartDate = new Date(today);
  siStartDate.setDate(siStartDate.getDate() + 1); // Start from tomorrow

  // Calculate end date based on frequency and duration
  const daysPerCycle = SUBSCRIPTION_DURATIONS[frequency] || 30;
  const totalDays = daysPerCycle * (duration || 12); // Default 12 cycles
  const siEndDate = new Date(today);
  siEndDate.setDate(siEndDate.getDate() + totalDays);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const response = await axios.post(
    `${server.server.baseUrl}api/payu/si/register`,
    {
      amount,
      user_email,
      name,
      phone,
      plan_id,
      frequency: FREQUENCY_MAP[frequency] || frequency,
      duration: duration || 12,
      productinfo: productinfo || 'Subscription',
      si_start_date: formatDate(siStartDate),
      si_end_date: formatDate(siEndDate),
      redirectSpecificLocation: redirectLocation,
      countryCode,
      panNumber,
      birthDate,
      telegramId,
      capital,
      couponId,
    },
    { headers },
  );

  return response.data;
}

/**
 * Get SI mandate status
 *
 * @param {string} subscriptionId - Subscription/SI ID
 * @param {Object} configData - App config data
 * @returns {Promise<Object>} SI status
 */
export async function getPayUSIStatus(subscriptionId, configData) {
  const headers = getHeaders(configData);

  const response = await axios.get(
    `${server.server.baseUrl}api/payu/si/status/${subscriptionId}`,
    { headers },
  );

  return response.data;
}

/**
 * Revoke/Cancel SI mandate
 *
 * @param {string} subscriptionId - Subscription/SI ID
 * @param {Object} configData - App config data
 * @returns {Promise<Object>} Revocation result
 */
export async function revokePayUSI(subscriptionId, configData) {
  const headers = getHeaders(configData);

  const response = await axios.post(
    `${server.server.baseUrl}api/payu/si/revoke`,
    { subscriptionId },
    { headers },
  );

  return response.data;
}

/**
 * Full PayU one-time payment flow handler
 * Similar to CashFreeOneTimePayment but for PayU
 *
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} Payment result
 */
export async function PayUOneTimePayment({
  paymentDetails, // txnid from PayU
  email,
  name,
  panNumber,
  mobileNumber,
  countryCode,
  specificPlan,
  telegramId,
  birthDate,
  invetAmount,
  singleStrategyDetails,
  oneTimeDurationPlan,
  onetimeamount,
  panCategory,
  couponId,
  setTaskId,
  part,
  configData,
  skipAddClientToGroup = false,
}) {
  const headers = getHeaders(configData);
  const user = email;

  // Fetch the latest subscription state before processing
  const existingSubscription = await axios.get(
    `${server.server.baseUrl}api/subscription-check/user/${user}/plan/${specificPlan?._id}`,
    { headers },
  );

  let expiryDate;
  if (existingSubscription.data.subscription) {
    const existingEndDate = new Date(existingSubscription.data.subscription.end_date);
    const today = new Date();
    const durationDays = oneTimeDurationPlan || 30;
    const baseDate = existingEndDate > today ? existingEndDate : today;
    expiryDate = new Date(baseDate);
    expiryDate.setDate(expiryDate.getDate() + durationDays);
  }

  // For part-based payments, log the current subscription state
  if (part !== undefined && part !== null) {
    const currentParts = existingSubscription.data.subscription?.payment_history?.map(p => p.part) || [];
    console.log(`[PayU] Current subscription state before processing part ${part}:`, {
      hasSubscription: !!existingSubscription.data.subscription,
      currentPaymentHistoryCount: existingSubscription.data.subscription?.payment_history?.length || 0,
      existingParts: currentParts,
      partAlreadyExists: currentParts.includes(Number(part)),
    });
  }

  // Complete the payment
  const completionResult = await completePayUPayment({
    txnid: paymentDetails,
    oneTimeDurationPlan,
    part,
    configData,
  });

  const data = completionResult;

  await logPayment('PAYMENT_SUCCESS', {
    amount: onetimeamount,
    clientName: name,
    email: user,
    plan: specificPlan?.name,
    phoneNumber: mobileNumber,
    panNumber,
    countryCode: countryCode || '+91',
    part: part !== undefined && part !== null ? Number(part) : undefined,
    gateway: 'payu',
  });

  return { data };
}

/**
 * Full PayU SI registration flow handler
 * Similar to CashFreeRecurringPayment but for PayU SI
 *
 * @param {Object} params - SI payment parameters
 * @returns {Promise<Object>} SI result
 */
export async function PayUSIPayment({
  paymentDetails, // subscription ID from PayU SI
  email,
  name,
  panNumber,
  mobileNumber,
  countryCode,
  specificPlan,
  telegramId,
  birthDate,
  invetAmount,
  singleStrategyDetails,
  selectedCard, // frequency (monthly, quarterly, etc.)
  panCategory,
  couponId,
  setTaskId,
  configData,
}) {
  const user = email;
  const selectedAmount = specificPlan?.pricing?.[selectedCard];

  // Verify SI status
  const siStatus = await getPayUSIStatus(paymentDetails, configData);

  if (siStatus.success && siStatus.subscription?.si_details?.status === 'active') {
    const data = siStatus;

    await logPayment('PAYMENT_SUCCESS', {
      amount: selectedAmount,
      clientName: name,
      email: user,
      plan: specificPlan?.name,
      phoneNumber: mobileNumber,
      panNumber,
      countryCode: countryCode || '+91',
      gateway: 'payu',
      paymentType: 'recurring',
    });

    return { data };
  }

  throw new Error('SI registration not active');
}

/**
 * Parse PayU callback URL parameters
 * Used when PayU redirects back to the app
 *
 * @param {string} url - Callback URL from PayU
 * @returns {Object} Parsed parameters
 */
export function parsePayUCallback(url) {
  try {
    const urlObj = new URL(url);
    const params = {};

    // Parse query parameters
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Common PayU callback parameters:
    // txnid, status, hash, mihpayid, mode, amount, error_Message, field9

    return {
      success: true,
      txnid: params.txnid,
      status: params.status,
      mihpayid: params.mihpayid,
      mode: params.mode,
      amount: params.amount,
      error: params.error_Message || params.field9,
      isSuccess: params.status?.toLowerCase() === 'success',
      isFailure: params.status?.toLowerCase() === 'failure',
      raw: params,
    };
  } catch (error) {
    console.error('[PayU] Error parsing callback URL:', error);
    return {
      success: false,
      error: 'Failed to parse callback URL',
    };
  }
}

/**
 * Build PayU form HTML for WebView
 * Used when backend returns structured form data instead of HTML string
 *
 * @param {Object} formData - Form data from backend
 * @param {boolean} isSI - Whether this is a Standing Instructions payment
 * @returns {string} HTML form string
 */
export function buildPayUFormHTML(formData, isSI = false) {
  const payuUrl = getPayUFormUrl();

  // Common fields
  const fields = [
    { name: 'key', value: formData.key },
    { name: 'txnid', value: formData.txnid },
    { name: 'amount', value: formData.amount },
    { name: 'productinfo', value: formData.productinfo },
    { name: 'firstname', value: formData.firstname },
    { name: 'email', value: formData.email },
    { name: 'phone', value: formData.phone },
    { name: 'surl', value: formData.surl },
    { name: 'furl', value: formData.furl },
    { name: 'hash', value: formData.hash },
    { name: 'udf1', value: formData.udf1 || '' },
    { name: 'udf2', value: formData.udf2 || '' },
    { name: 'udf3', value: formData.udf3 || '' },
    { name: 'udf4', value: formData.udf4 || '' },
    { name: 'udf5', value: formData.udf5 || '' },
  ];

  // SI-specific fields
  if (isSI && formData.si_details) {
    fields.push(
      { name: 'api_version', value: formData.api_version || '6' },
      { name: 'si', value: '1' },
      { name: 'si_details', value: JSON.stringify(formData.si_details) },
    );
  }

  // Split payment fields
  if (formData.split_payments) {
    fields.push({ name: 'split_payments', value: formData.split_payments });
  }

  // Build form HTML
  const inputsHTML = fields
    .map(
      field =>
        `<input type="hidden" name="${field.name}" value="${field.value || ''}" />`,
    )
    .join('\n');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loader {
          text-align: center;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        p {
          color: #666;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="loader">
        <div class="spinner"></div>
        <p>Redirecting to PayU...</p>
        <p style="font-size: 12px; color: #999;">Please do not close this window</p>
      </div>
      <form id="payuForm" action="${payuUrl}" method="POST" style="display: none;">
        ${inputsHTML}
      </form>
      <script>
        setTimeout(function() {
          document.getElementById('payuForm').submit();
        }, 500);
      </script>
    </body>
    </html>
  `;
}

export default {
  getPayUFormUrl,
  createPayUOrder,
  verifyPayUPayment,
  completePayUPayment,
  getPayUTransactionStatus,
  registerPayUSI,
  getPayUSIStatus,
  revokePayUSI,
  PayUOneTimePayment,
  PayUSIPayment,
  parsePayUCallback,
  buildPayUFormHTML,
};
