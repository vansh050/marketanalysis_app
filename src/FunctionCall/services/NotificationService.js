import axios from "axios";
import server from "../../utils/serverConfig";

import { addISTOffset } from "../../utils/dateUtils";
import { generateToken } from "../../utils/SecurityTokenManager";
import Config from "react-native-config";
import { useTrade } from "../../screens/TradeContext";


export async function sendWhatsAppNotification({
  phoneNumber,
  countryCode,
  planDetails,
  userName,
  email,
  advisorName,
  data,
}) {
  const {configData}=useTrade();
  const latestPayment = data?.subscription?.payment_history?.sort(
    (a, b) => new Date(b?.payment_date) - new Date(a?.payment_date)
  )[0];

  try {
    const formattedPhone = phoneNumber.toString().replace(/\D/g, "");
    let formattedCountryCode = countryCode.startsWith("+")
      ? countryCode
      : `+${countryCode}`;

    if (latestPayment?.payment_type === "extension") {
      await axios.post(
        `${server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
        {
          phone_number: formattedPhone,
          template_name: "new_plan2",
          template_body_values: [
            userName ? userName : email,
            latestPayment?.payment_type === "extension"
              ? "renewed"
              : "subscribed",
            addISTOffset(
              latestPayment?.payment_type === "extension" &&
                latestPayment?.previous_end_date
                ? latestPayment?.previous_end_date
                : latestPayment?.payment_date
            ),
            addISTOffset(latestPayment?.new_end_date),
            advisorName,
          ],
          template_button_values: [`${configData?.config?.REACT_APP_HEADER_NAME}`],
          template_header_values: [
            latestPayment?.payment_type === "extension"
              ? "Renewed"
              : "Subscribed",
          ],
          country_code: countryCode,
          callback_data: "Standard Callback",
          language_code: "en",
        },
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
    } else {
      const trackUserResponse = await axios.post(
        `${server.ccxtServer.baseUrl}comms/whatsapp/track-user`,
        {
          phone_number: formattedPhone,
          country_code: formattedCountryCode,
          user_traits: {
            name: userName ? userName : email,
            email: email,
            advisor: advisorName,
            advisor_codomain: `${configData?.config?.REACT_APP_HEADER_NAME}`,
            whatsapp_opted_in: true,
          },
          tags: [advisorName, "All tags"],
        },
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

      if (trackUserResponse.data.result.result === true) {
        // console.log("Sending WhatsApp template message...");
        await axios.post(
          `${server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
          {
            phone_number: formattedPhone,
            template_name: "new_plan2",
            template_body_values: [
              userName ? userName : email,
              latestPayment.payment_type === "extension"
                ? "renewed"
                : "subscribed",
              addISTOffset(
                latestPayment?.payment_type === "extension" &&
                  latestPayment?.previous_end_date
                  ? latestPayment?.previous_end_date
                  : latestPayment?.payment_date
              ),
              addISTOffset(latestPayment?.new_end_date),
              advisorName,
            ],
            template_button_values: [`${configData?.config?.REACT_APP_HEADER_NAME}`],
            template_header_values: [
              latestPayment.payment_type === "extension"
                ? "Renewed"
                : "Subscribed",
            ],
            country_code: countryCode,
            callback_data: "Standard Callback",
            language_code: "en",
          },
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
      }
    }
  } catch (error) {
    console.error("WhatsApp notification error:", {
      message: error.message,
      response: error.response?.data,
      statusCode: error.response?.status,
      phoneNumber,
      countryCode,
    });
  }
}

export async function sendEmailNotification({
  email,
  planDetails,
  userName,
  panNumber,
  advisorName,
  tradingPlatform,
  data,
}) {
  const {configData}=useTrade();
  try {
    const latestPayment = data?.subscription?.payment_history.sort(
      (a, b) => new Date(b?.payment_date) - new Date(a?.payment_date)
    )[0];
    const emailData = [
      {
        template_name: "new_plan2",
        template_body_values: [
          userName ? userName : email,
          addISTOffset(
            latestPayment?.payment_type === "extension" &&
              latestPayment?.previous_end_date
              ? latestPayment?.previous_end_date
              : latestPayment?.payment_date
          ),
          addISTOffset(latestPayment?.new_end_date),
        ],
        trade_given_by: advisorName,
        recipient_email: email,
        plan_name: planDetails?.name,
        pan: panNumber,
        amount: data?.subscription?.amount,
        payment_frequency: data?.subscription?.payment_frequency || "oneTime",
        duration: planDetails?.duration,
      },
    ];

    const emailResponse = await axios.post(
      `${server.ccxtServer.baseUrl}comms/email/send-template-messages/supported-broker`,
      emailData,
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
  }
}

export async function sendTelegramNotification({ userName, telegramId, data }) {
  try {
    const {configData}=useTrade();
    const latestPayment = data?.subscription?.payment_history?.sort(
      (a, b) => new Date(b?.payment_date) - new Date(a?.payment_date)
    )[0];

    const emailData = {
      recipient: telegramId,
      template_name: "new_plan2",
      template_body_values: [
        userName,
        latestPayment?.payment_type === "extension" ? "renewed" : "subscribed",
        addISTOffset(
          latestPayment?.payment_type === "extension" &&
            latestPayment?.previous_end_date
            ? latestPayment?.previous_end_date
            : latestPayment?.payment_date
        ),
        addISTOffset(latestPayment?.new_end_date),
        configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
      ],
      template_button_values: [
        `${configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
          "https://",
          ""
        )}`,
      ],
      template_header_values: [
        `${
          latestPayment?.payment_type === "extension" ? "renewed" : "subscribed"
        }`,
      ],
      trade_given_by: configData?.config?.REACT_APP_EMAIL,
    };

    const response = await axios.post(
      `${server.ccxtServer.baseUrl}comms/telegram/send-template`,
      emailData,
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

    return response.data;
  } catch (error) {
    console.error(
      "Failed to send Telegram notification:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: "Failed to send Telegram notification",
      error: error.response?.data || error.message,
    };
  }
}
