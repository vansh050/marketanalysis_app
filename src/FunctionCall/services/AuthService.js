import axios from "axios";
import server from "../../utils/serverConfig";
import { CrossDomainAuthService } from "./crossDomainAuth";
import { loginConfirmedAction } from "../store/actions/AuthActions";

import { encryptApiKey } from "../utils/cryptoUtils";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";
import { useTrade } from "../../screens/TradeContext";

// Function to handle login
export async function login(email) {
  const {configData}=useTrade();
  try {
    const postData = { email };
    const response = await axios.post(
      `${server.server.baseUrl}api/admin/allowed/login`,
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
      postData
    );

    if (response.status === 200 && response.data) {
      // Assuming the response contains user details and a token
      return response.data;
    } else {
      throw new Error("Login failed");
    }
  } catch (error) {
    console.error("Login error:", error);
    throw error; // Rethrow error for handling in the calling function
  }
}

// Function to save token and user details in local storage
export function saveTokenInLocalStorage(userDetails, token) {
  localStorage.setItem("userDetails", JSON.stringify(userDetails));
  localStorage.setItem("authToken", token);
}

export function loadUserFromLocalStorage() {
  const userDetails = localStorage.getItem("userDetails");
  const token = localStorage.getItem("authToken");
  return {
    userDetails: userDetails ? JSON.parse(userDetails) : null,
    token: token || null,
  };
}

export const checkAutoLogin = async (dispatch) => {
  try {
    // First check for cross-domain tokens
    const tokens = CrossDomainAuthService.extractTokensFromURL();

    if (tokens.accessToken && tokens.uid) {
      console.log("Cross-domain tokens found, attempting authentication...");

      try {
        const userCredential =
          await CrossDomainAuthService.performCrossDomainLogin(tokens);

        if (userCredential && userCredential.user) {
          // Get fresh token from Firebase user
          const firebaseToken = await userCredential.user.getIdToken();

          // Create user details object for Redux store
          const userDetails = {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            displayName:
              userCredential.user.displayName || userCredential.user.email,
            emailVerified: userCredential.user.emailVerified,
            photoURL: userCredential.user.photoURL,
            // Add any other user properties you need
          };

          // Save to localStorage for persistence
          saveTokenInLocalStorage(userDetails, firebaseToken);

          // Dispatch login action to Redux store
          dispatch(
            loginConfirmedAction({ ...userDetails, token: firebaseToken })
          );

          // console.log(
          //   "Cross-domain authentication successful:",
          //   userCredential.user.email
          // );
          return; // Exit early since cross-domain auth succeeded
        }
      } catch (error) {
        console.error("Cross-domain authentication failed:", error);
        // Continue to normal auto-login check below
      }
    }

    // Normal auto-login check from localStorage
    const { userDetails, token } = loadUserFromLocalStorage();
    if (userDetails && token) {
      dispatch(loginConfirmedAction({ ...userDetails, token }));
    }
  } catch (error) {
    console.error("Error in checkAutoLogin:", error);
    // Fallback to normal auto-login
    const { userDetails, token } = loadUserFromLocalStorage();
    if (userDetails && token) {
      dispatch(loginConfirmedAction({ ...userDetails, token }));
    }
  }
};
