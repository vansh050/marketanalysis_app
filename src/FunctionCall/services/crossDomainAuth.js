// src/services/crossDomainAuth.js
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase";
import server from "../../utils/serverConfig";
import { encryptApiKey } from "../utils/cryptoUtils";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";
import { useTrade } from "../../screens/TradeContext";

const AUTHENTICATION_TIMEOUT = 15000;
const {configData}=useTrade();
export class CrossDomainAuthService {
  
  static extractTokensFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      accessToken: urlParams.get("accessToken"),
      uid: urlParams.get("uid"),
    };
  }

  static isTokenExpired(idToken) {
    try {
      const payload = JSON.parse(atob(idToken.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch (error) {
      console.error("Error parsing token:", error);
      return true;
    }
  }

  static async exchangeTokens(
    idToken,
    uid,
    subdomain = `${configData?.config?.REACT_APP_HEADER_NAME}`
  ) {
    const response = await fetch(
      `${server.server.baseUrl}api/auth/user/createCustomToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
        body: JSON.stringify({ uid, subdomain }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `Token exchange failed: ${response.status}`
      );
    }

    const data = await response.json();
    return data.customToken;
  }

  static createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Authentication timeout - please try again")),
        AUTHENTICATION_TIMEOUT
      );
    });
  }

  static cleanupURL() {
    const url = new URL(window.location);
    url.searchParams.delete("accessToken");
    url.searchParams.delete("uid");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  static async performCrossDomainLogin(tokens, onProgress) {
    if (!tokens.accessToken || !tokens.uid) {
      throw new Error("Missing authentication tokens");
    }

    if (onProgress) onProgress("Verifying authentication...");

    if (this.isTokenExpired(tokens.accessToken)) {
      throw new Error("Authentication token has expired");
    }

    if (onProgress) onProgress("Exchanging tokens...");

    const customToken = await Promise.race([
      this.exchangeTokens(tokens.accessToken, tokens.uid),
      this.createTimeoutPromise(),
    ]);

    if (onProgress) onProgress("Signing in...");

    const userCredential = await signInWithCustomToken(auth, customToken);

    this.cleanupURL();

    return userCredential;
  }
}
