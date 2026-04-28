import axios from "axios";
import server from "../../utils/serverConfig";
import { encryptApiKey } from "../utils/cryptoUtils";
import { calculateNewExpiryDate } from "../utils/calculateExpiryDate";
import { logPayment } from "../utils/logger";
import { sendNotifications } from "./SendNotificationService";
import { addClientToGroupSubscription } from "./AddClientToGroupService";

export async function completeOneTimePayment({
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
}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Advisor-Subdomain": process.envREACT_APP_URL,
    "aq-encrypted-key": encryptApiKey(
      process.envREACT_APP_AQ_KEYS,
      process.envREACT_APP_AQ_SECRET
    ),
  };

  let expiryDate;
  const user = email;

  console.log("this also hit false-------------------");
  const existingSubscription = await axios.get(
    `${server.server.baseUrl}api/subscription-check/user/${user}/plan/${specificPlan?._id}`,
    { headers }
  );

  if (existingSubscription.data.subscription) {
    expiryDate = calculateNewExpiryDate(
      existingSubscription.data.subscription.end_date,
      specificPlan
    );
  }

  const endDate =
    expiryDate ||
    new Date(
      new Date().setDate(new Date().getDate() + (specificPlan?.duration || 30))
    );

  const response = await axios.post(
    `${server.server.baseUrl}api/admin/subscription/one-time-payment/subscription/complete-one-time-payment`,
    {
      ...paymentDetails,
      user_email: user,
      advisor_email: specificPlan?.advisor_email,
      plan_id: specificPlan?._id,
      amount: specificPlan?.amount,
      end_date: endDate,
      newExpiryDate: expiryDate,
    },
    { headers }
  );

  const data = response.data;

  await logPayment("PAYMENT_SUCCESS", {
    orderId: data?.subscription?.razorpay_order_id,
    amount: specificPlan?.amount,
    clientName: name,
    email: user,
    plan: formattedName,
    phoneNumber: mobileNumber,
    panNumber,
    countryCode: countryCode || "+91",
  });

  await sendNotifications({
    email: user,
    phoneNumber: mobileNumber,
    countryCode: countryCode || "+91",
    panNumber,
    planDetails: {
      isRenewal: false,
      duration: specificPlan?.duration || "30",
      name: specificPlan?.name,
      amount: specificPlan?.amount,
    },
    userName: name,
    advisorName: whiteLabelText,
    tradingPlatform: "supported-broker",
    data,
    telegramId,
  });

  await addClientToGroupSubscription({
    specificPlan,
    name,
    email,
    mobileNumber,
    countryCode,
    birthDate,
    panNumber,
    data,
  });

  await logPayment("PROCESS_COMPLETION_STATUS", {
    paymentSuccess: true,
    clientAdded,
    notificationsSent: true,
    clientName: name,
    email: user,
  });

  return { data };
}
