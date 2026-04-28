import axios from "axios";
import server from "../../utils/serverConfig";
import { sendNotifications } from "./SendNotificationService";
import { logPayment } from "../utils/logger";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";
import { useTrade } from "../../screens/TradeContext";

const getDurationInDays = (frequency) => {
  switch (frequency) {
    case "monthly":
      return "30";
    case "quarterly":
      return "90";
    case "half-yearly":
      return "180";
    case "yearly":
      return "365";
    default:
      return "30"; // default fallback
  }
};

export async function completeSubscriptionService({
  paymentDetails,
  specificPlan,
  name,
  email,
  mobileNumber,
  countryCode,
  panNumber,
  formattedName,
  whiteLabelText,
  telegramId,
  advisorTag,
  birthDate,
  invetAmount,
  singleStrategyDetails,
}) {
  const {configData}=useTrade();
  const user = email;
  const headers = {
    "Content-Type": "application/json",
    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
    "aq-encrypted-key": generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET
    ),
  };

  try {
    const response = await axios.post(
      `${server.server.baseUrl}api/admin/subscription/complete-payment`,
      paymentDetails,
      { headers }
    );

    const data = response.data;

    await logPayment("SUBSCRIPTION_PAYMENT_SUCCESS", {
      subscriptionId: data.subscription.razorpay_subscription_id,
      amount: specificPlan?.amount,
      clientName: name,
      email: user,
      plan: formattedName,
      planType: specificPlan?.frequency,
      duration:
        specificPlan?.frequency === "monthly"
          ? "30"
          : specificPlan?.frequency === "quarterly"
          ? "90"
          : "365",
    });

    await sendNotifications({
      email: user,
      phoneNumber: mobileNumber,
      countryCode: countryCode || "+91",
      panNumber,
      planDetails: {
        isRenewal: false,
        duration:
          specificPlan?.duration === null
            ? getDurationInDays(data?.subscription?.payment_frequency)
            : specificPlan?.duration || "30",
        name: specificPlan?.name,
        amount: specificPlan?.amount,
      },
      userName: name,
      advisorName: whiteLabelText,
      tradingPlatform: "supported-broker",
      data,
      telegramId,
    });

    const newSubscription = {
      startDate: new Date(),
      plan: formattedName || "",
      capital: data.subscription.capital || 0,
      charges: data.subscription.amount || 0,
      invoice: data.subscription.razorpay_subscription_id || "",
      expiry: data.expiry
        ? new Date(data.expiry)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      userDetails: {
        name,
        phoneNumber: mobileNumber,
        panNumber,
        countryCode: countryCode || "+91",
      },
    };

    const newClientData = {
      clientName: name || "",
      country_code: countryCode || "+91",
      email: user.toLowerCase(),
      phone: mobileNumber || "",
      groups: [`All Client`, formattedName],
      location: data.location || "",
      telegram: telegramId || "",
      pan: panNumber || "",
      comments: data.comments || "",
      advisorName: advisorTag,
      subscriptions: [newSubscription],
    };

    let clientAdded = false;
    try {
      const clientResponse = await fetch(
        `${server.ccxtServer.baseUrl}comms/add-new-client-to-groups`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: specificPlan?.adminId,
            DateofBirth: birthDate || "",
            advisorName: advisorTag,
            clientData: newClientData,
          }),
          headers,
        }
      );

      await clientResponse.json();
      await logPayment("SUBSCRIPTION_CLIENT_ADDED", {
        clientId: newClientData.clientId,
        clientName: newClientData.clientName,
        plan: formattedName,
        subscriptionId: newSubscription.invoice,
        subscriptionDetails: {
          startDate: newSubscription.startDate,
          expiry: newSubscription.expiry,
          amount: newSubscription.charges,
        },
      });

      clientAdded = true;
    } catch (clientError) {
      console.error("Error adding client:", clientError);
      await logPayment("SUBSCRIPTION_CLIENT_ADD_ERROR", {
        error: clientError.message,
        clientName: data?.subscription?.name,
        email: data?.subscription?.user_email,
      });
    }

    return {
      success: true,
      data,
      clientAdded,
      plan: formattedName,
      subscriptionId: data.subscription.razorpay_subscription_id,
    };
  } catch (error) {
    await logPayment("SUBSCRIPTION_PAYMENT_FAILURE", {
      error: error.message,
      clientName: name,
      email: user,
      amount: specificPlan?.amount,
      plan: formattedName,
      planType: specificPlan?.frequency,
    });
    throw error;
  }
}
