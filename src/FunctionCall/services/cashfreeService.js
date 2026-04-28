import axios from "axios";
import server from "../../utils/serverConfig";
import { encryptApiKey } from "../utils/cryptoUtils";
import { generateToken } from "../../utils/SecurityTokenManager";
import Config from "react-native-config";
import { useTrade } from "../../screens/TradeContext";


const getHeaders = ({configData}) => ({
  "Content-Type": "application/json",
  "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
  "aq-encrypted-key": generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET
  ),
});

export const createPlan = async (planData) => {
  const {configData}=useTrade();
  const formattedData = {
    adminId: planData.adminId,
    name: planData.name,
    description: planData.description,
    advisor_email: planData.email,
    advisor: planData.advisor,
    frequency: planData.frequency,
    duration: planData?.duration,
    minInvestment: planData?.minInvestment,
    maxNetWorth: planData?.maxNetWorth,
    type: planData.type,
    planType: planData.planType,
    pricing: planData.pricing,
    onetimeOptions: planData.onetimeOptions,
    pricingWithoutGst: planData.pricingWithoutGst,
    amount: planData.amount || null,
    amountWithoutGst: planData.amountWithoutGst || null,
    charges: planData.charges || null,
    isSIPEnabled: planData.isSIPEnabled,
    start_date: planData.start_date,
    paymentGateway: planData.paymentGateway,
    is_single_payment: planData.isOneTime,
  };

  try {
    const response = await axios.post(
      `${server.server.baseUrl}api/cashfree/subscription/create`,
      formattedData,
      {
        headers: getHeaders(configData),
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const createCashfreeSubscription = async (planId, subscriptionData) => {
    const {configData}=useTrade();
  try {
    const response = await axios.post(
      `${server.server.baseUrl}/plans/${planId}/cashfree/subscription`,
      subscriptionData,
      {
        headers: getHeaders(configData),
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getAllPlans = async () => {
    const {configData}=useTrade();
  try {
    const response = await axios.get(`${server.server.baseUrl}/plans`, {
      headers: getHeaders(configData),
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getPlanById = async (planId) => {
    const {configData}=useTrade();
  try {
    const response = await axios.get(
      `${server.server.baseUrl}/plans/${planId}`,
      {
        headers: getHeaders(configData),
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const checkPaymentStatus = async (subscriptionId) => {
    const {configData}=useTrade();
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/cashfree/subscription/check/payment/status`,
      {
        params: { subscription_id: subscriptionId },
        headers: getHeaders(configData),
      }
    );

    if (response.data.success) {
      return response.data.data;
    } else {
      console.error("Failed to fetch subscription status.");
      return null;
    }
  } catch (err) {
    console.error("Error checking payment status:", err);
    return null;
  }
};
