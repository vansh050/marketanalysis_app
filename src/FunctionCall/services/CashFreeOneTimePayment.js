import axios from 'axios';
import server from '../../utils/serverConfig';
import {calculateNewExpiryDate} from '../../utils/calculateExpiryDate';
import {logPayment} from '../../utils/Logging';
import {sendNotifications} from './SendNotificationService';
import {addClientToGroupSubscription} from './AddClientToGroupService';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import AsyncStorage from '@react-native-async-storage/async-storage';


export async function CashFreeOneTimePayment({
  paymentDetails,
  email,
  name,
  panNumber,
  mobileNumber,
  countryCode,
  formattedName,
  specificPlan,
  whiteLabelText,
  telegramId,
  advisorTag,
  birthDate,
  invetAmount,
  panCategory,
  singleStrategyDetails,
  configData
}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  let expiryDate;
  const user = email;

  const existingSubscription = await axios.get(
    `${server.server.baseUrl}api/subscription-check/user/${user}/plan/${specificPlan?._id}`,
    {headers},
  );

  if (existingSubscription.data.subscription) {
    expiryDate = calculateNewExpiryDate(
      existingSubscription.data.subscription.end_date,
      specificPlan,
    );
  }

  const endDate =
    expiryDate ||
    new Date(
      new Date().setDate(new Date().getDate() + (specificPlan?.duration || 30)),
    );

  const response = await axios.post(
    `${server.server.baseUrl}api/cashfree/complete-one-time-payment`,
    {
      cashfree_order_id: paymentDetails,
      user_email: user,
      advisor_email: specificPlan?.advisor_email,
      plan_id: specificPlan?._id,
      amount: specificPlan?.amount,
      end_date: endDate,
      newExpiryDate: expiryDate,
    },
    {headers},
  );

  const data = response.data;

  await logPayment('PAYMENT_SUCCESS', {
    // orderId: data?.subscription?.razorpay_order_id,
    amount: specificPlan?.amount,
    clientName: name,
    email: user,
    plan: formattedName,
    phoneNumber: mobileNumber,
    panNumber,
    countryCode: countryCode || '+91',
  }, configData);

  
  await addClientToGroupSubscription({
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
    paymentType: 'onetime',
    telegramId,
    configData,
  });


  await logPayment('PROCESS_COMPLETION_STATUS', {
    paymentSuccess: true,
    notificationsSent: true,
    clientName: name,
    email: user,
  }, configData);

  return {data};
}

export async function CashFreeRecurringPayment({
  paymentDetails,
  email,
  name,
  panNumber,
  mobileNumber,
  countryCode,
  formattedName,
  specificPlan,
  whiteLabelText,
  telegramId,
  advisorTag,
  birthDate,
  invetAmount,
  singleStrategyDetails,
  configData,
  panCategory,
}) {
  console.log('name', name);
  console.log('email', email);
  console.log('specificPlan', specificPlan);
  const headers = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  let expiryDate;
  const user = email;

  const existingSubscription = await axios.get(
    `${server.server.baseUrl}api/subscription-check/user/${user}/plan/${specificPlan?._id}`,
    {headers},
  );

  if (existingSubscription.data.subscription) {
    expiryDate = calculateNewExpiryDate(
      existingSubscription.data.subscription.end_date,
      specificPlan,
    );
  }

  const endDate =
    expiryDate ||
    new Date(
      new Date().setDate(new Date().getDate() + (specificPlan?.duration || 30)),
    );

  const response = await axios.post(
    `${server.server.baseUrl}api/cashfree/subscription/check/payment/compelete/subscription-payment`,
    {
      cashfree_subscription_id: paymentDetails,
      user_email: user,
      advisor_email: specificPlan?.advisor_email,
      plan_id: specificPlan?._id,
      amount: specificPlan?.amount,
      end_date: endDate,
      newExpiryDate: expiryDate,
    },
    {headers},
  );

  const data = response.data;

  await logPayment('PAYMENT_SUCCESS', {
    // orderId: data?.subscription?.razorpay_order_id,
    amount: specificPlan?.amount,
    clientName: name,
    email: user,
    plan: formattedName,
    phoneNumber: mobileNumber,
    panNumber,
    countryCode: countryCode || '+91',
  },configData);

  await addClientToGroupSubscription({
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
    paymentType: 'recurring',
    telegramId,
    configData,
  });

  await logPayment('PROCESS_COMPLETION_STATUS', {
    paymentSuccess: true,
    notificationsSent: true,
    clientName: name,
    email: user,
  }, configData);

  await AsyncStorage.removeItem('specificPlan');
  await AsyncStorage.removeItem('cashFreeUserEmail');
  return {data};
}
