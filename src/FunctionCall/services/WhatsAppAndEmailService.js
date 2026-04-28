import axios from "axios";
import server from "../utils/serverConfig";
import { encryptApiKey } from "../utils/cryptoUtils";

function formatTimeTo12Hour(time24) {
  const [hours, minutes] = time24.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12; // Convert 0 or 12 to 12
  return `${formattedHour}:${minutes} ${period}`;
}

export function normalWhatsAppNotification(
  mobileNumber,
  name,
  startdate,
  endDate,
  countryCode
) {
  return axios.post(
    `${server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
    {
      phone_number: mobileNumber,
      template_name: "new_plan2",
      template_body_values: [
        name,
        "subscribed",
        startdate,
        endDate,
        `${process.env.REACT_APP_ADVISOR_SPECIFIC_TAG}`,
      ],
      template_button_values: [`${process.env.REACT_APP_ADVISOR_SPECIFIC_TAG}`],
      template_header_values: ["Subscribed"],
      country_code: countryCode,
      callback_data: "Standard Callback",
      language_code: "en",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

// research report whatsapp msg
export function getWhatsAppNotification(mobileNumber, name, countryCode) {
  return axios.post(
    `${server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
    {
      phone_number: mobileNumber,
      template_name: "new_plan_research",
      template_body_values: [
        `${name}`,
        "Congratulation, you have been subscribed to stock research plan",
        "Click on the link below to request an appointment",
      ],
      template_button_values: [
        `booking.${process.env.REACT_APP_CALENDLY_LINK}`,
      ],
      country_code: countryCode,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

// rebalance push whatsapp notification
export function getWhatsAppRebalanceNotification(
  strategyDetails,
  userEmail,
  mobileNumber,
  countryCode,
  userName
) {
  let whatsappData = JSON.stringify({
    advisor: process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
    modelName: strategyDetails?.model_name,
    userEmail: userEmail,
    phoneNumber: mobileNumber,
    countryCode: countryCode,
    clientName: userName,
  });

  return axios.post(
    `${server.ccxtServer.baseUrl}comms/new-rebalance-push/single-user`,
    whatsappData,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}
// webinar whatsapp notification
export function getWhatsWebinarNotification(
  mobileNumber,
  countryCode,
  specificPlan
) {
  let whatsappData = JSON.stringify({
    phone_number: mobileNumber,
    template_name: "webinar_template",
    template_body_values: [
      specificPlan?.name,
      new Date(specificPlan?.start_date),
      formatTimeTo12Hour(specificPlan?.timeSlot?.startTime),
      "Earing",
      "learning",
      "grwoing",
      "listening",
      "This is the description of webinar",
    ],
    template_button_values: ["masterthemarket.co.in"],
    country_code: countryCode,
    advisor: process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
  });

  return axios.post(
    `${server.ccxtServer.baseUrl}comms/whatsapp/send-template`,
    whatsappData,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

export function normalEmailNotification(
  name,
  startDate,
  endDate,
  email,
  planName,
  panNumber
) {
  const emailData = [
    {
      template_name: "new_plan2",
      template_body_values: [name, startDate, endDate],
      trade_given_by: process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
      recipient_email: email,
      plan_name: planName,
      pan: panNumber,
    },
  ];
  return axios.post(
    `${server.ccxtServer.baseUrl}comms/email/send-template-messages/supported-broker`,
    emailData,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}
//reserach report email
export function getEmailNotification(name, email, pan, planName) {
  const emailData = [
    {
      template_name: "new_plan_research",
      template_body_values: [`${name}`],
      booking_link: `booking.${process.env.REACT_APP_CALENDLY_LINK}`,
      trade_given_by: process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
      recipient_email: email,
      pan: pan,
      plan_name: planName,
    },
  ];
  return axios.post(
    `${server.ccxtServer.baseUrl}comms/email/send-template-messages/supported-broker`,
    emailData,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

export function getEmailWebinarNotification(specificPlan, name, email, data) {
  let whatsappData = [
    {
      template_name: "webinar_template",
      template_body_values: [
        specificPlan?.name,
        new Date(specificPlan?.start_date),
        formatTimeTo12Hour(specificPlan?.timeSlot?.startTime),
        "Earing",
        "learning",
        "grwoing",
        "listening",
        "This is the description of webinar",
      ],
      trade_given_by: process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
      recipient_name: name,
      recipient_email: email,
      amount: specificPlan?.amount,
      payment_frequency: data?.payment_frequency || "oneTime",
      duration: specificPlan?.duration,
    },
  ];

  return axios.post(
    `${server.ccxtServer.baseUrl}comms/email/send-template-messages/supported-broker`,
    whatsappData,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": process.env.REACT_APP_URL,
        "aq-encrypted-key": encryptApiKey(
          process.env.REACT_APP_AQ_KEYS,
          process.env.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

export async function getTelegramNotification(userName, telegramId, data) {
  try {
    const latestPayment = data?.subscription?.payment_history?.sort(
      (a, b) => new Date(b?.payment_date) - new Date(a?.payment_date)
    )[0];

    const emailData = {
      recipient: telegramId,
      template_name: "new_plan2",
      template_body_values: [
        userName,
        latestPayment?.payment_type === "extension" ? "renewed" : "subscribed",
        `${
          latestPayment?.payment_type === "extension" &&
          latestPayment?.previous_end_date
            ? latestPayment?.previous_end_date
            : latestPayment?.payment_date
        }`,
        `${latestPayment?.new_end_date}`,
        process.env.REACT_APP_ADVISOR_SPECIFIC_TAG,
      ],
      template_button_values: [
        `${process.env.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
          "https://",
          ""
        )}`,
      ],
      template_header_values: [
        `${
          latestPayment?.payment_type === "extension" ? "renewed" : "subscribed"
        }`,
      ],
      trade_given_by: process.env.REACT_APP_EMAIL,
    };

    const response = await axios.post(
      `${server.ccxtServer.baseUrl}comms/telegram/send-template`,
      emailData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": process.env.REACT_APP_URL,
          "aq-encrypted-key": encryptApiKey(
            process.env.REACT_APP_AQ_KEYS,
            process.env.REACT_APP_AQ_SECRET
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

export async function normalTelegramNotification(
  name,
  telegramId,
  startDate,
  endDate
) {
  try {
    const emailData = {
      recipient: telegramId,
      template_name: "new_plan2",
      template_body_values: [
        name,
        "subscribed",
        startDate,
        endDate,
        `${process.env.REACT_APP_ADVISOR_SPECIFIC_TAG}`,
      ],
      template_button_values: [
        `${process.env.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
          "https://",
          ""
        )}`,
      ],
      template_header_values: ["subscribed"],
      trade_given_by: process.env.REACT_APP_EMAIL,
    };

    const response = await axios.post(
      `${server.ccxtServer.baseUrl}comms/telegram/send-template`,
      emailData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": process.env.REACT_APP_URL,
          "aq-encrypted-key": encryptApiKey(
            process.env.REACT_APP_AQ_KEYS,
            process.env.REACT_APP_AQ_SECRET
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
