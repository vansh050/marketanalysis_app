import {encryptApiKey} from '../utils/cryptoUtils';
import server from '../../utils/serverConfig';
import {logPayment} from '../../utils/Logging';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';

const advisorTag = Config.REACT_APP_ADVISOR_SPECIFIC_TAG;

export const addClientToGroupSubscription = async ({
  email,
  name,
  panNumber,
  mobileNumber,
  countryCode,
  specificPlan,
  birthDate,
  invetAmount,
  singleStrategyDetails,
  data,
  panCategory,
  paymentType,
  telegramId,
  configData,
}) => {


  const formattedName = specificPlan?.name
    ? specificPlan.name.includes(' ') // Check if there are spaces
      ? specificPlan.name.toLowerCase().replace(/\s+/g, '_') // If spaces, replace them
      : specificPlan.name.toLowerCase() // If no spaces, just lowercase
    : '';
  // Validate data is not undefined before using it
  if (!data || !data.subscription) {
    console.error(
      'Invalid data provided to addClientToGroupSubscription:',
      data,
    );
    await logPayment('SUBSCRIPTION_CLIENT_ADD_ERROR', {
      error: 'Invalid subscription data',
      clientName: name,
      email: email,
    });
    throw new Error('Invalid subscription data provided');
  }

  const getLatestPayment = (paymentHistory, subscription) => {
    // If no payment history, use subscription data
    if (!paymentHistory || paymentHistory.length === 0) {
      return {
        invoice: subscription.cashfree_order_id || '',
        amount: subscription.amount || 0,
      };
    }

    // Get latest payment by date
    const latest = paymentHistory.reduce((a, b) =>
      new Date(a.payment_date) > new Date(b.payment_date) ? a : b,
    );

    return {
      invoice: latest.cashfree_order_id || '',
      amount: latest.amount || 0,
    };
  };

  // Usage:
  const latestPayment = getLatestPayment(
    data?.subscription?.payment_history,
    data?.subscription,
  );

  const newSubscription = {
    startDate: new Date(),
    plan: formattedName || '',
    capital: invetAmount || 0,
    charges: latestPayment.amount || 0,
    invoice: latestPayment.invoice,
    expiry: data?.subscription?.end_date
      ? new Date(data?.subscription?.end_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userDetails: {
      name,
      phoneNumber: mobileNumber,
      panNumber,
      countryCode: countryCode || '+91',
    },
  };

  const newClientData = {
    clientName: name || '',
    country_code: countryCode || '+91',
    email: email.toLowerCase(),
    phone: mobileNumber || '',
    groups: ['All Client', formattedName],
    location: data.location || '',
    telegram: telegramId || '',
    pan: panNumber || '', // Changed from data.panNumber to use the parameter directly
    comments: data.comments || '',
    advisorName: advisorTag,
    subscriptions: [newSubscription],
    panCategory: panCategory,
    paymentFrequency: paymentType,
  };

  try {
    const response = await fetch(
      `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`,
      {
        method: 'POST',
        body: JSON.stringify({
          userId: specificPlan?.adminId,
          DateofBirth: birthDate || '',
          advisorName: advisorTag,
          clientData: newClientData,
          modelPfId: singleStrategyDetails?._id,
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      },
    );

    const result = await response.json();

    await logPayment('SUBSCRIPTION_CLIENT_ADDED', {
      clientId: result?.clientId || 'unknown',
      clientName: newClientData.clientName,
      plan: data.subscription.plan,
      subscriptionId: newSubscription.invoice,
      subscriptionDetails: {
        startDate: newSubscription.startDate,
        expiry: newSubscription.expiry,
        amount: newSubscription.charges,
      },
    });

    return result;
  } catch (error) {
    console.error('Error adding client:', error);
    await logPayment('SUBSCRIPTION_CLIENT_ADD_ERROR', {
      error: error.message,
      clientName: name,
      email: email,
    });
    throw error;
  }
};
