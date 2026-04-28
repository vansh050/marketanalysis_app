import axios from "axios";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import Config from "react-native-config";
import server from "../../utils/serverConfig";
import { generateToken } from "../../utils/SecurityTokenManager";
import { getAdvisorSubdomain } from "../../utils/variantHelper";

/**
 * Get device information for logging
 */
const getDeviceInfo = async () => {
  try {
    const [deviceId, model, brand, systemName, systemVersion, version, buildNumber] =
      await Promise.all([
        DeviceInfo.getUniqueId(),
        DeviceInfo.getModel(),
        DeviceInfo.getBrand(),
        DeviceInfo.getSystemName(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
      ]);

    return {
      device_id: deviceId,
      device_model: model,
      device_brand: brand,
      os_name: systemName,
      os_version: systemVersion,
      build_number: buildNumber,
      app_version: version,
      platform: Platform.OS,
    };
  } catch (error) {
    console.error("Error getting device info:", error);
    return {
      platform: Platform.OS,
    };
  }
};

/**
 * Get common headers for API requests
 * @param {string} subdomain - Optional subdomain override (from config data)
 */
const getHeaders = (subdomain = null) => ({
  "Content-Type": "application/json",
  "X-Advisor-Subdomain": subdomain || getAdvisorSubdomain(),
  "aq-encrypted-key": generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET
  ),
});

/**
 * Log a login attempt (success or failure)
 * This is fire-and-forget - errors are silently caught
 *
 * @param {Object} data - Login attempt data
 * @param {string} data.email - User email
 * @param {string} data.firebase_id - Firebase user ID (optional)
 * @param {string} data.status - 'success' or 'failed'
 * @param {string} data.login_method - 'email' or 'google'
 * @param {string} data.failure_reason - Reason for failure (if failed)
 * @param {string} data.error_message - Error message (if failed)
 * @param {string} data.error_code - Error code (if failed)
 * @param {string} data.advisor_subdomain - Advisor subdomain to log to (from config)
 */
export const logLoginAttempt = async (data) => {
  try {
    const deviceInfo = await getDeviceInfo();

    const payload = {
      email: data.email,
      firebase_id: data.firebase_id,
      status: data.status,
      login_method: data.login_method,
      failure_reason: data.failure_reason,
      error_message: data.error_message,
      error_code: data.error_code,
      platform: deviceInfo.platform,
      app_version: deviceInfo.app_version,
      device_info: {
        device_id: deviceInfo.device_id,
        device_model: deviceInfo.device_model,
        device_brand: deviceInfo.device_brand,
        os_name: deviceInfo.os_name,
        os_version: deviceInfo.os_version,
        build_number: deviceInfo.build_number,
      },
    };

    // Log to the advisor-specific database
    await axios.post(
      `${server.server.baseUrl}api/app-login/log`,
      payload,
      {
        headers: getHeaders(data.advisor_subdomain),
        timeout: 10000,
      }
    );

    console.log("Login attempt logged successfully:", data.status, "to subdomain:", data.advisor_subdomain || getAdvisorSubdomain());
  } catch (error) {
    // Silent failure - don't block login flow
    console.error("Failed to log login attempt:", error.message);
  }
};

/**
 * Track app user on successful login
 * Creates new user record or updates existing one
 * This is fire-and-forget - errors are silently caught
 *
 * @param {Object} data - User tracking data
 * @param {string} data.email - User email
 * @param {string} data.firebase_id - Firebase user ID
 * @param {string} data.name - User name (optional)
 * @param {string} data.login_method - 'email' or 'google'
 * @param {string} data.advisor_subdomain - Advisor subdomain to log to (from config)
 */
export const trackAppUser = async (data) => {
  try {
    const deviceInfo = await getDeviceInfo();

    const payload = {
      email: data.email,
      firebase_id: data.firebase_id,
      name: data.name,
      login_method: data.login_method,
      platform: deviceInfo.platform,
      app_version: deviceInfo.app_version,
      device_info: {
        device_model: deviceInfo.device_model,
        device_brand: deviceInfo.device_brand,
        os_name: deviceInfo.os_name,
        os_version: deviceInfo.os_version,
        build_number: deviceInfo.build_number,
      },
    };

    // Track user in the advisor-specific database
    await axios.post(
      `${server.server.baseUrl}api/app-login/track-user`,
      payload,
      {
        headers: getHeaders(data.advisor_subdomain),
        timeout: 10000,
      }
    );

    console.log("App user tracked successfully:", data.email, "to subdomain:", data.advisor_subdomain || getAdvisorSubdomain());
  } catch (error) {
    // Silent failure - don't block login flow
    console.error("Failed to track app user:", error.message);
  }
};

export default {
  logLoginAttempt,
  trackAppUser,
};
