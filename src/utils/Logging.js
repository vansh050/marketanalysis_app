import axios from "axios";
import server from "./serverConfig";
import { encryptApiKey } from "./cryptoUtils";
import Config from "react-native-config";
import { generateToken } from "./SecurityTokenManager";
import { sanitizeKiteDiagnosticUrl } from "./publisherOutcome";

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

/**
 * Diagnostic beacon for the Zerodha basket publisher flow. Fire-and-forget —
 * posts to the shared Node `/api/log-frontend-anomaly` endpoint (same
 * `frontend_anomaly_audit` collection + Telegram bridge the web app uses).
 * Lets a production repro produce a server-side trace of the WebView
 * navigation sequence so "pending but no order at broker" can be pinned
 * without a debug build.
 *
 * @param {string} kind   - "zerodha_mobile_basket_nav" | "zerodha_mobile_basket_error" | "zerodha_mobile_basket_settled"
 * @param {object} data   - { step, url, baseUrl, reason, ... } (no PII / tokens)
 */
export const logZerodhaDiagnostic = async (kind, data, configData) => {
  try {
    // Redact credentials (session IDs, request tokens, API keys) from any
    // Kite URL before it enters frontend anomaly telemetry.
    const safeData = {
      ...(data || {}),
      ...(data?.url ? { url: sanitizeKiteDiagnosticUrl(data.url) } : {}),
    };
    await axios.post(
      `${server.server.baseUrl}api/log-frontend-anomaly`,
      {
        kind,
        severity: "info",
        data: safeData,
        ts: new Date().toISOString(),
        advisor_subdomain:
          configData?.config?.REACT_APP_HEADER_NAME ||
          Config.REACT_APP_HEADER_NAME,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain":
            configData?.config?.REACT_APP_HEADER_NAME ||
            Config.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
        timeout: 5000,
      }
    );
  } catch (error) {
    console.warn("[zerodha-diagnostic] failed to log:", kind, error?.message);
  }
};

/**
 * Generic fire-and-forget frontend anomaly beacon (same Node
 * `/api/log-frontend-anomaly` endpoint → `frontend_anomaly_audit` + the
 * critical-severity Telegram bridge). Tenant header is REACT_APP_HEADER_NAME —
 * never the build variant (root CLAUDE.md, mobile tenant header rule).
 *
 * @param {string} kind     - e.g. "nav_manifest_warning"
 * @param {"info"|"warning"|"critical"} severity
 * @param {object} data     - no PII / tokens
 */
export const logFrontendAnomaly = async (kind, severity, data, configData) => {
  const tenant =
    configData?.config?.REACT_APP_HEADER_NAME || Config.REACT_APP_HEADER_NAME;
  try {
    await axios.post(
      `${server.server.baseUrl}api/log-frontend-anomaly`,
      {
        kind,
        severity: severity || "info",
        data: data || {},
        ts: new Date().toISOString(),
        advisor_subdomain: tenant,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": tenant,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
        timeout: 5000,
      }
    );
  } catch (error) {
    console.warn("[frontend-anomaly] failed to log:", kind, error?.message);
  }
};
