import Config from "react-native-config";
import {
  sendWhatsAppNotification,
  sendEmailNotification,
  sendTelegramNotification,
} from "./NotificationService";

export const sendNotifications = async ({
  email,
  phoneNumber,
  countryCode,
  planDetails,
  panNumber,
  userName,
  advisorName,
  tradingPlatform,
  data,
  telegramId,
}) => {
  const results = {
    emailSent: false,
    whatsappSent: false,
    telegramSent: false,
  };

  try {
    if (true) {
      await sendEmailNotification({
        email,
        planDetails,
        userName,
        panNumber,
        advisorName,
        tradingPlatform,
        data,
      });
      results.emailSent = true;
    }

    if (true) {
      await sendWhatsAppNotification({
        phoneNumber,
        countryCode,
        planDetails,
        userName,
        email,
        advisorName,
        data,
      });
      results.whatsappSent = true;
    }

    if (Config.REACT_APP_TELEGRAM_NOTIFICATION === "true" && telegramId) {
      await sendTelegramNotification({ userName, telegramId, data });
      results.telegramSent = true;
    }

    return results;
  } catch (error) {
    console.error("Notification error:", error);
    throw error;
  }
};
