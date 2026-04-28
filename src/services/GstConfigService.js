import axios from 'axios';
import Config from '../utils/safeConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import server from '../utils/serverConfig';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': Config?.REACT_APP_X_ADVISOR_SUBDOMAIN || Config?.REACT_APP_HEADER_NAME || 'rgxresearch',
  'aq-encrypted-key': Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
    Config?.REACT_APP_AQ_KEYS,
    Config?.REACT_APP_AQ_SECRET
  ),
});

export async function fetchGstConfig() {
  try {
    const headers = getHeaders();
    const baseUrl = Config?.REACT_APP_NODE_SERVER_API_URL || server.server.baseUrl;

    const response = await axios.get(
      `${baseUrl}api/adminControl/get-gst-config`,
      { headers }
    );

    if (response.data.success && response.data.gstConfig) {
      return {
        gstConfigure: response.data.gstConfig.gst_configure || false,
        gstWithTextConfigure: response.data.gstConfig.gst_with_text_configure || false,
      };
    }

    console.warn('[GstConfigService] Unexpected response format, using env fallback');
    return getEnvFallbackConfig();
  } catch (error) {
    console.error('[GstConfigService] Error fetching config:', error.message);
    return getEnvFallbackConfig();
  }
}

export function getEnvFallbackConfig() {
  return {
    gstConfigure: String(Config?.REACT_APP_ADVISOR_GST_CONFIGURE || 'false').trim().toLowerCase() === 'true',
    gstWithTextConfigure: String(Config?.REACT_APP_ADVISOR_WITH_TEXT_GST_CONFIGURE || 'false').trim().toLowerCase() === 'true',
  };
}
