import React, { useState, useEffect, createContext } from 'react';
import axios from 'axios';
import { Alert } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Toast from 'react-native-toast-message'
import formatCurrency from './formateCurrency';
import Config from 'react-native-config';
import { generateToken } from '../utils/SecurityTokenManager';
import { useTrade } from '../screens/TradeContext';
export const PaymentContext = createContext(); 

// Payment handling function
const handlePayment = async (props) => {
  const { 
    planDetails,
    userEmail,
    mobileNumber,
    countryCode,
    name,
    clientId,
    advisorName,
    userId,
    specificPlan,
    specificPlanDetails,
    formattedName,
    invetAmount,
    broker,
    strategyDetails,
    latestRebalance,
    panNumber,
    userDetails,
    razorPayKey,
    server,
    FormatDateTime,
    getStrategyDetails,
    getAllStrategy,
    updateStrategySubscription,
    setLoading,
    setPaymentModal,
    setPaymentSuccess,
    setIsPostPaymentProcessing,
    setRefresh,
    showToast,
    inputValue, // Add inputValue prop
    selectedCard, // Add selectedCard prop
  } = props;
  const {configData}=useTrade();
  try {
    // Format the data before making API call
    const formatUserData = () => {
      // Safely format countryCode
      let formattedCountryCode = null;
      if (countryCode) {
        // Check if countryCode is already a number
        formattedCountryCode =
          typeof countryCode === "number"
            ? countryCode
            : parseInt(countryCode.toString().replace("+", ""));
      }

      return {
        email: userEmail,
        phoneNumber: mobileNumber ? parseInt(mobileNumber) : null,
        countryCode: formattedCountryCode,
        telegramId: "",
        userName: name || "",
        profileCompletion: 75,
        clientId: clientId || "",
        advisorName: advisorName,
      };
    };

    // Update user details
    if (planDetails?.frequency?.length !== 0) {
      await subscribeToPlan(props); // Pass props to subscribeToPlan

      let config = {
        method: "put",
        url: `${server.server.baseUrl}api/user/update/user-details`,
        
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
        data: JSON.stringify(formatUserData()),
      };

      await axios.request(config);
    } else {
      await handleSinglePayment(props); // Pass props to handleSinglePayment

      let config = {
        method: "put",
        url: `${server.server.baseUrl}api/user/update/user-details`,
        
        headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
        data: JSON.stringify(formatUserData()),
      };

      await axios.request(config);
    }

    // Check if the plan is recurring
    if (planDetails?.frequency?.length !== 0) {
      // If recurring, call subscribeToPlan function to handle subscription
      await subscribeToPlan(props); 
    } else {
      // If not recurring, call handleSinglePayment to handle one-time payment
      await handleSinglePayment(props); 
    }
  } catch (error) {
    console.error("Error during payment process:", error);
    // Handle errors appropriately (e.g., display an error message)
  }
};


// Function to add days to a date and return ISO string
const addDaysToDate = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
};

// Send email notification function
const sendEmailNotification = async (props) => { 
  const { 
    email,
    planDetails,
    userName,
    advisorName,
  } = props;
  const {configData}=useTrade();
  try {
    console.log("Sending email notification to:", email);

    const getAdvisorCodomain = (advisor) => {
      if (advisor === "AlphaQuark") return "prod";
      if (advisor === "AlphaQuarkTest") return "test";
      return advisor.toLowerCase();
    };

    // Send email using template
    const emailResponse = await axios.post(
      `${props.server.ccxtServer.baseUrl}comms/email/send-template`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      {
        template_name: "subscription_confirmation",
        to_email: email,
        template_body_values: [
          userName || email,
          planDetails.isRenewal ? "renewed" : "subscribed",
          planDetails.name,
          planDetails.duration || "30",
          formatCurrency(planDetails.amount),
          advisorName,
          getAdvisorCodomain(advisorName),
        ],
        template_header_values: [
          planDetails.isRenewal ? "Subscription Renewed" : "New Subscription",
        ],
        callback_data: "Standard Callback",
        language_code: "en",
      }
    );

    if (emailResponse.data.status !== 0) {
      console.error("Email sending failed:", emailResponse.data);
    }

    return emailResponse;
  } catch (error) {
    console.error("Email notification error:", {
      message: error.message,
      response: error.response?.data,
      statusCode: error.response?.status,
      email: email,
    });
    // Don't throw error to prevent disrupting the main flow
  }
};

// Send WhatsApp notification function
const sendWhatsAppNotification = async (props) => {
  const { 
    phoneNumber,
    countryCode,
    planDetails,
    userName,
    email,
    advisorName,
  } = props;
  const {configData}=useTrade();
  try {
    const formattedPhone = phoneNumber.toString().replace(/\D/g, "");
    let formattedCountryCode = countryCode.startsWith("+")
      ? countryCode
      : `+${countryCode}`;

    const getAdvisorCodomain = (advisor) => {
      if (advisor === "AlphaQuark") return "prod";
      if (advisor === "AlphaQuarkTest") return "test";
      return advisor.toLowerCase();
    };

    const startDate = new Date().toISOString();
    const duration = parseInt(planDetails.duration) || 30;
    const endDate = addDaysToDate(startDate, duration);

    // First track the user
    const trackUserResponse = await axios.post(
      `${props.server.ccxtServer.baseUrl}comms/whatsapp/track-user`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      {
        phone_number: formattedPhone,
        country_code: formattedCountryCode,
        user_traits: {
          name: userName || email,
          email: email,
          advisor: advisorName,
          advisor_codomain: getAdvisorCodomain(advisorName),
          whatsapp_opted_in: true,
        },
        tags: [advisorName, "internal_team"],
      }
    );

    if (trackUserResponse.data.result.result === true) {
      // Then send template message
      await axios.post(
        `${props.server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
        {
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      },
        {
          phone_number: formattedPhone,
          template_name: "new_plan",
          template_body_values: [
            userName || email,
            planDetails.isRenewal ? "renewed" : "subscribed",
            startDate,
            endDate, // This will be the ISO string with 30 days added
            advisorName,
          ],
          template_button_values: [getAdvisorCodomain(advisorName)],
          template_header_values: [
            planDetails.isRenewal ? "Renewed" : "Subscribed",
          ],
          country_code: countryCode,
          callback_data: "Standard Callback",
          language_code: "en",
        }
      );
    }
  } catch (error) {
    console.error("WhatsApp notification error:", error);
    // Don't throw error to prevent disrupting the main flow
  }
};

// Send notifications function
const sendNotifications = async (props) => { 
  const { 
    email,
    phoneNumber,
    countryCode,
    planDetails,
    userName,
    advisorName,
  } = props;
  const {configData}=useTrade();
  try {
    // Send email first
    await sendEmailNotification(props);

    // Then send WhatsApp notification
    await sendWhatsAppNotification(props);
  } catch (error) {
    console.error("Notification error:", error);
    // Don't throw error to prevent disrupting the main flow
  }
};

// Calculate new expiry date
function calculateNewExpiryDate(props, plan) {
  const { planDetails } = props;
  const newExpiry = new Date(props.planDetails.expiry);

  if (plan.frequency) {
    // For recurring subscriptions
    switch (plan.frequency) {
      case "monthly":
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        break;
      case "quarterly":
        newExpiry.setMonth(newExpiry.getMonth() + 3);
        break;
      case "yearly":
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        break;
      default:
        newExpiry.setMonth(newExpiry.getMonth() + 1); // Default to monthly
    }
  } else {
    // For one-time payments
    // Add the plan duration (assuming it's in days)
    newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30)); // Default to 30 days if not specified
  }

  return newExpiry;
}

// Subscribe to plan function
async function subscribeToPlan(props) {
  const {
    planDetails,
    userEmail,
    inputValue,
    selectedCard,
    setLoading,
    setPaymentModal,
  } = props; 
  const {configData}=useTrade();
  try {
    setLoading(true);
    // Fetch subscription details from the backend
    const response = await axios.post(
      `${props.server.server.baseUrl}api/admin/subscription`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      {
        plan_id: planDetails._id,
        frequency: selectedCard, // Use selectedCard for frequency
        user_email: userEmail,
        sip_amount: inputValue, 
      }
    );
    setLoading(false);
    setPaymentModal(false);
    const subscriptionData = response.data.data;

    console.log(subscriptionData, "subscriptionData");

    if (subscriptionData.razorpay_subscription_id) {
      // Initialize Razorpay with the subscription details
      const options = {
        key: props.razorPayKey, // Your Razorpay Key ID
        subscription_id: subscriptionData.razorpay_subscription_id, // The subscription ID from Razorpay
        name: subscriptionData.plan_id.name, // Plan or product name
        description: subscriptionData.plan_id.description, // Description of the plan
        amount: subscriptionData.amount, // Amount in smallest unit (paise for INR)
        currency: "INR", // Currency (e.g., INR)
    
        prefill: {
          name: "", // User's name
          email: userEmail, // User's email
        },
        theme: {
          color: "#F37254",
        },
      };
      
         try {
        const razorpayResponse = await RazorpayCheckout.open(options);
        console.log("Payment Success:", razorpayResponse);
        
        // Create payment response object similar to web
        const paymentResponse = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_subscription_id: razorpayResponse.razorpay_subscription_id,
          razorpay_signature: razorpayResponse.razorpay_signature
        };

        if (props.userId) { // Use props.userId
          props.setIsPostPaymentProcessing(true); // Use props.setIsPostPaymentProcessing
          await completeSubscription(props, paymentResponse); // Pass props to completeSubscription
        }

      } catch (paymentError) {
        console.log("Payment Error:", paymentError);
        if (paymentError.code === 0) {
          // User cancelled the payment
          Alert.alert('Payment Cancelled', 'The payment was cancelled. Please try again.');
        } else {
          // Payment failed
          Alert.alert('Payment Failed', 'The payment could not be processed. Please try again.');
        }
      }
    } else {
      console.error("Error fetching one-time payment data");
      Alert.alert('Error', 'Could not initialize payment. Please try again.');
    }
  } catch (error) {
    console.error("Error subscribing to plan:", error);
    props.setLoading(true);
  }
}

// Log payment function
const logPayment = async (type, data) => {
  const {configData}=useTrade();
  try {
    await axios.post(`${props.server.server.baseUrl}api/log-payment`
      ,{
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    }, {
      type,
      data,
    });
  } catch (error) {
    console.error("Failed to log payment:", error);
  }
};

// Complete subscription function
async function completeSubscription(props, paymentDetails) {
  const {
    specificPlan,
    userEmail,
    name,
    formattedName,
    setIsPostPaymentProcessing,
    setPaymentSuccess,
    setRefresh,
    sendNotifications, 
    specificPlanDetails,
    userDetails,
    FormatDateTime,
    getStrategyDetails,
    getAllStrategy,
    updateStrategySubscription,
    broker,
    strategyDetails,
    latestRebalance,
    invetAmount,
  } = props;
  const {configData}=useTrade();
  try {
    // Send payment details to the backend to finalize the subscription
    const response = await axios.post(
      `${props.server.server.baseUrl}api/admin/subscription/complete-payment`,{
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      paymentDetails
    );

    const data = response.data;
    setIsPostPaymentProcessing(false);
    await logPayment("SUBSCRIPTION_PAYMENT_SUCCESS", {
      subscriptionId: data.subscription.razorpay_subscription_id,
      amount: specificPlan?.amount,
      clientName: name,
      email: userEmail,
      plan: formattedName,
      planType: specificPlan?.frequency,
      duration:
        specificPlan?.frequency === "monthly"
          ? "30"
          : specificPlan?.frequency === "quarterly"
          ? "90"
          : "365",
    });
    setPaymentSuccess(true);
    setRefresh((prev) => !prev);

    // Send notifications (email and WhatsApp)
    try {
      await sendNotifications(props);
    } catch (notificationError) {
      console.error("Notifications failed:", notificationError);
      // Continue execution - notification failure shouldn't stop the process
    }

    const newSubscription = {
      subId: uuid.v4().slice(0, 10),
      startDate: FormatDateTime(new Date()),
      plan: formattedName || "", // Assuming the response contains a plan
      capital: data.subscription.capital || 0, // Assuming the response contains capital
      charges: data.subscription.amount || 0, // Assuming the response contains charges
      invoice: data.subscription.razorpay_subscription_id || "", // Assuming the response contains invoice
      expiry: FormatDateTime(new Date(data.expiry)), // Assuming the response contains expiry date
    };
    const clientId = userDetails?.clientId || uuid.v4().slice(0, 7);
    const newClientData = {
      clientId: clientId,
      clientName: name || "", // Assuming the response contains a client name
      email: data.subscription.user_email || "", // Assuming the response contains an email
      phone: mobileNumber || "", // Assuming the response contains a phone number
      groups: [`All Client`, formattedName], // Add formatted name dynamically
      location: data.location || "", // Assuming the response contains a location
      telegram: data.telegram || "", // Assuming the response contains a Telegram ID
      pan: data.pan || "", // Assuming the response contains a PAN number
      creationDate: FormatDateTime(new Date()), // Current date
      comments: data.comments || "", // Assuming the response contains comments
      subscriptions: [
        {
          ...newSubscription, // Attach the new subscription here
        },
      ],
    };

    try {
      // Send a POST request to add the new client
      const response = await fetch(
        `${props.server.server.baseUrl}api/add-new-client-to-groups`,
        {
          method: "POST",
          
            headers: {
                        "Content-Type": "application/json",
                        "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                        "aq-encrypted-key": generateToken(
                          Config.REACT_APP_AQ_KEYS,
                          Config.REACT_APP_AQ_SECRET
                        ),
                      },
        
          body: JSON.stringify({
            userId: specificPlanDetails?.adminId,
            clientData: newClientData,
          }),
        }
      );

      const result = await response.json();

      await logPayment("SUBSCRIPTION_CLIENT_ADDED", {
        clientId: newClientData.clientId,
        clientName: newClientData.clientName,
        plan: formattedName,
        subscriptionId: newSubscription.subId,
        subscriptionDetails: {
          startDate: newSubscription.startDate,
          expiry: newSubscription.expiry,
          amount: newSubscription.charges,
        },
      });
    } catch (error) {
      console.error("Error adding client:", error);
      await logPayment("SUBSCRIPTION_CLIENT_ADD_ERROR", {
        error: error.message,
        clientName: data.subscription.name,
        email: data.subscription.user_email,
      });
    }

    let payloadData = JSON.stringify({
      email: userEmail,
      action: "subscribe",
    });

    let config = {
      method: "put",
      url: `${props.server.server.baseUrl}api/model-portfolio/subscribe-strategy/${strategyDetails?._id}`,
      
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    
      data: payloadData,
    };

    axios
      .request(config)
      .then((response) => {
        getStrategyDetails();
      })
      .catch((error) => {
        console.log(error);
      });

    let data2 = JSON.stringify({
      userEmail: userEmail,
      model: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: latestRebalance.model_Id,
      userBroker: broker ? broker : "",
      subscriptionAmountRaw: [
        {
          amount: invetAmount,
          dateTime: new Date(),
        },
      ],
    });

    let config2 = {
      method: "post",
      url: `${props.server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
      
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    
      data: data2,
    };

    axios
      .request(config2)
      .then((response) => {
        getStrategyDetails();
      
      })
      .catch((error) => {
        console.log(error);
      });
    getAllStrategy();
  } catch (error) {
    console.error("Error completing subscription:", error);
    await logPayment("SUBSCRIPTION_PAYMENT_FAILURE", {
      error: error.message,
      clientName: name,
      email: userEmail,
      amount: specificPlan?.amount,
      plan: formattedName,
      planType: specificPlan?.frequency,
    });
  }
}

// Handle single payment function
async function handleSinglePayment(props) {
  const {
    planDetails,
    userEmail,
    setLoading,
    setPaymentModal,
    razorPayKey,
    userId,
    setIsPostPaymentProcessing,
    completeSinglePayment, 
  } = props;
  const {configData}=useTrade();
  try {
    setLoading(true);
    // Fetch one-time payment details from the backend
    const response = await axios.post(
      `${props.server.server.baseUrl}api/admin/subscription/one-time-payment/subscription`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      {
        plan_id: planDetails._id,
        user_email: userEmail,
        amount: planDetails.amount,
      }
    );
    setLoading(false);
    setPaymentModal(false);
    const paymentData = response.data.data;

    console.log(response.data, "paymentData");

    if (paymentData.razorpay_order_id) {
      const options = {
        key: razorPayKey,
        order_id: paymentData.razorpay_order_id,
        name: paymentData.plan_id.name,
        description: paymentData.plan_id.description,
        amount: paymentData.amount,
        currency: "INR",
        prefill: {
          email: userEmail,
          contact: '', // Add phone number if available
          name: '', // Add name if available
        },
        theme: { color: "#F37254" }
      };

      try {
        const razorpayResponse = await RazorpayCheckout.open(options);
        console.log("Payment Success:", razorpayResponse);
        
        // Create payment response object similar to web
        const paymentResponse = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_signature: razorpayResponse.razorpay_signature
        };

        if (userId) {
          setIsPostPaymentProcessing(true);
          await completeSinglePayment(props, paymentResponse); // Pass props to completeSinglePayment
        }

      } catch (paymentError) {
        console.log("Payment Error:", paymentError);
        if (paymentError.code === 0) {
          // User cancelled the payment
          Alert.alert('Payment Cancelled', 'The payment was cancelled. Please try again.');
        } else {
          // Payment failed
          Alert.alert('Payment Failed', 'The payment could not be processed. Please try again.');
        }
      }
    } else {
      console.error("Error fetching one-time payment data");
      Alert.alert('Error', 'Could not initialize payment. Please try again.');
    }
    
  } catch (error) {
    console.error("Error initiating one-time payment:", error);
    Alert.alert('Error', 'Could not start payment process. Please try again.');
  } finally {
    setLoading(false);
  }
}

// Complete single payment function
async function completeSinglePayment(props, paymentDetails) {
  const {
    specificPlan,
    userEmail,
    name,
    formattedName,
    setIsPostPaymentProcessing,
    setPaymentSuccess,
    setRefresh,
    sendNotifications, 
    specificPlanDetails,
    userDetails,
    FormatDateTime,
    getStrategyDetails,
    getAllStrategy,
    updateStrategySubscription,
    broker,
    strategyDetails,
    latestRebalance,
    invetAmount,
  } = props;
  const {configData}=useTrade();
  console.log('Complete Single Payment Called')
  try {
    // First, check for existing payment and plan
    const existingPayment = await axios.post(
      `${props.server.server.baseUrl}api/subscription-check/check-payment-status`,
      
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    }
    ,{
        razorpay_order_id: paymentDetails.razorpay_order_id,
        plan_id: specificPlan?._id,
        user_email: userEmail,
      }
    );

    if (existingPayment.data.orderExists) {
      throw new Error("This payment has already been processed");
    }

    let expiryDate;
    let isSubscriptionExtension = false;

    // Check for existing subscription with same plan
    const existingSubscription = await axios.get(
      `${props.server.server.baseUrl}api/subscription-check/user/${userEmail}/plan/${specificPlan?._id}`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    }
    );

    if (existingSubscription.data.subscription) {
      isSubscriptionExtension = true;
      // Calculate new expiry based on existing subscription
      expiryDate = calculateNewExpiryDate(props, specificPlan);
    }

    // Complete payment with backend
    const response = await axios.post(
      `${props.server.server.baseUrl}api/admin/subscription/one-time-payment/subscription/complete-one-time-payment`,
      {
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    },
      {
        ...paymentDetails,
        user_email: userEmail,
        advisor_email: specificPlan?.advisor_email,
        plan_id: specificPlan?._id,
        amount: specificPlan?.amount,
        end_date:
          expiryDate ||
          new Date(
            new Date().setDate(
              new Date().getDate() + (specificPlan?.duration || 30)
            )
          ),
        newExpiryDate: expiryDate,
      }
    );

    const data = response.data;
    setIsPostPaymentProcessing(false);
    await logPayment("PAYMENT_SUCCESS", {
      orderId: data.subscription.razorpay_order_id,
      amount: specificPlan?.amount,
      clientName: name,
      email: userEmail,
      plan: formattedName,
    });
    setPaymentSuccess(true);

    // Send notifications
    try {
      await sendNotifications(props);
    } catch (notificationError) {
      console.error("Notifications failed:", notificationError);
      // Continue execution - notification failure shouldn't stop the process
    }

    if (strategyDetails) {
      let data2 = JSON.stringify({
        userEmail: userEmail,
        model: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance.model_Id,
        userBroker: broker ? broker : "",
        subscriptionAmountRaw: [
          {
            amount: invetAmount,
            dateTime: new Date(),
          },
        ],
      });

      let config2 = {
        method: "post",
        url: `${props.server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
        
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
        data: data2,
      };

      axios
        .request(config2)
        .then((response) => {
          getStrategyDetails();
        })
        .catch((error) => {
          console.log(error);
        });
      updateStrategySubscription();
    }

    const newSubscription = {
      subId: uuid.v4().slice(0, 10),
      startDate: FormatDateTime(new Date()),
      plan: formattedName || "",
      capital: invetAmount || 0,
      charges: specificPlan?.amount || 0,
      invoice: paymentDetails.razorpay_order_id || "",
      expiry: FormatDateTime(expiryDate || data.subscription.end_date),
    };

    // Update client data in same way as before
    const clientResponse = await handleClientUpdate(
      props,
      isSubscriptionExtension,
      newSubscription,
      data.subscription
    );

    let data2 = JSON.stringify({
      userEmail: userEmail,
      model: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: latestRebalance.model_Id,
      userBroker: broker ? broker : "",
      subscriptionAmountRaw: [
        {
          amount: invetAmount,
          dateTime: new Date(),
        },
      ],
    });

    let config2 = {
      method: "post",
      url: `${props.server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
      
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    
      data: data2,
    };

    axios
      .request(config2)
      .then((response) => {
        getStrategyDetails();
      })
      .catch((error) => {
        console.log(error);
      });
    props.showToast("isSubscriptionExtension", "success", ""); // Use props.showToast
    
  } catch (error) {
    console.error("Error completing payment:", error);
    await logPayment("PAYMENT_FAILURE", {
      error: error.message,
      clientName: name,
      email: userEmail,
      amount: specificPlan?.amount,
    });
   
    throw error;
  }
}

// Handle client update function
async function handleClientUpdate(props, isExtension, newSubscription, subscriptionData) {
  const {
    specificPlanDetails,
    userDetails,
    FormatDateTime,
    name,
    mobileNumber,
    panNumber,
    formattedName,
  } = props;
  const {configData}=useTrade();
  const clientId = userDetails?.clientId || uuid.v4().slice(0, 7);

  const clientData = {
    clientId: clientId, // Add clientId here
    clientName: name || "",
    email: subscriptionData.user_email || "",
    phone: mobileNumber || "",
    groups: [`All Client`, formattedName],
    location: "",
    telegram: "",
    pan: panNumber || "",
    creationDate: FormatDateTime(new Date()),
    subscriptions: [newSubscription],
  };

  try {
    const checkClientResponse = await fetch(
      `${props.server.server.baseUrl}api/add-subscriptions/check-client`,
      {
        method: "POST",
        
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
        body: JSON.stringify({
          userId: specificPlanDetails?.adminId,
          email: clientData.email,
          clientId: clientId, // Include clientId in check
        }),
      }
    );

    const checkClientResult = await checkClientResponse.json();
    await logPayment("CLIENT_ADDED", {
      clientId: clientData.clientId,
      clientName: name,
      plan: formattedName,
      subscriptionDetails: newSubscription,
    });
    if (checkClientResult.clientExists) {
      return fetch(
        `${props.server.server.baseUrl}api/add-subscriptions/update/update-client-subscription`,
        {
          method: "POST",
          
            headers: {
                        "Content-Type": "application/json",
                        "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                        "aq-encrypted-key": generateToken(
                          Config.REACT_APP_AQ_KEYS,
                          Config.REACT_APP_AQ_SECRET
                        ),
                      },
        
          body: JSON.stringify({
            userId: specificPlanDetails?.adminId,
            clientId: checkClientResult.clientId,
            newSubscription: newSubscription,
            updatedClientData: clientData,
            isExtension: isExtension,
          }),
        }
      );
    } else {
      return fetch(`${props.server.server.baseUrl}api/add-subscriptions`, {
        method: "POST",
        
          headers: {
                      "Content-Type": "application/json",
                      "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                      "aq-encrypted-key": generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET
                      ),
                    },
      
        body: JSON.stringify({
          userId: specificPlanDetails?.adminId,
          clientData: clientData,
        }),
      });
    }
  } catch (error) {
    console.error("Error updating client data:", error);
    await logPayment("CLIENT_ADD_FAILURE", {
      error: error.message,
      clientName: name,
      email: userEmail,
    });
    throw error;
  }
}

// Update strategy subscription function
async function updateStrategySubscription(props) {
  const {
    userEmail,
    getStrategyDetails,
    getAllStrategy,
    strategyDetails,
    latestRebalance,
    broker,
    invetAmount,
  } = props;
  const {configData}=useTrade();
  try {
    let payloadData = JSON.stringify({
      email: userEmail,
      action: "subscribe",
    });

    let config = {
      method: "put",
      url: `${props.server.server.baseUrl}api/model-portfolio/subscribe-strategy/${strategyDetails?._id}`,
      
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    
      data: payloadData,
    };

    await axios.request(config);
    getStrategyDetails();
    getAllStrategy();
    let data2 = JSON.stringify({
      userEmail: userEmail,
      model: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: strategyDetails?.model_Id,
      userBroker: broker ? broker : "",
      subscriptionAmountRaw: [
        {
          amount: invetAmount,
          dateTime: new Date(),
        },
      ],
    });

    let config2 = {
      method: "post",
      url: `${props.server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
      
        headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET
                    ),
                  },
    
      data: data2,
    };

    await axios.request(config2);

    getStrategyDetails();
  } catch (error) {
    console.error("Error updating strategy subscription:", error);
  }
}

// Export the handlePayment function
export { handlePayment }; 