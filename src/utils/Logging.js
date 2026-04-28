import axios from "axios";
import server from "./serverConfig";
import { encryptApiKey } from "./cryptoUtils";
import Config from "react-native-config";
import { generateToken } from "./SecurityTokenManager";

export const logPayment = async (type, data, configData) => {
  console.log("config Data---",configData);
  try {
    await axios.post(
      `${server.server.baseUrl}api/log-payment`,
      {
        type,
        data,
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
  } catch (error) {
    console.error("Failed to log payment:", error,error.message,error.response);
  }
};
