 
import sign from 'jwt-encode';
import Config from 'react-native-config';
import { decode } from 'react-native-pure-jwt';
 
// Get environment variables
const AQ_KEY = Config.REACT_APP_AQ_KEYS;
const AQ_SECRET = Config.REACT_APP_AQ_SECRET;

// Singleton instance
let instance = null;

class SecurityTokenManager {
  constructor() {
    if (!AQ_KEY) {
      console.warn("AQ_API_KEY environment variable is not set — API auth will fail");
    }
    if (!AQ_SECRET) {
      console.warn("AQ_API_SECRET environment variable is not set — API auth will fail");
    }

    this.apiKey = AQ_KEY || '';
    this.secretKey = AQ_SECRET || '';
    this.tokenExpirySeconds = 60;  // default value

  }
  static getInstance() {
    if (!instance) {
      instance = new SecurityTokenManager();
    }
    return instance;
  }
  // Get current time in IST
  nowTimeIST() {
    const now = new Date();
    // IST offset is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset);
  }

  // Generate service token


  
  generateServiceToken(apiKey, secretKey) {
    function nowTimeIST() {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      return new Date(now.getTime() + istOffset);
    }
   // console.log('aapiii:',apiKey,secretKey);
    try {
        if (!apiKey || !secretKey) {
            throw new Error("API Key and Secret Key are required");
        }
        // Create the payload
        // 300 sec expiry tolerates typical device clock drift (emulators, phones with
        // stale time) — 15 sec was too tight and caused 401 "Token has expired" on
        // any device with >15 sec skew against server time.
        const payload = {
          apiKey: apiKey,
          exp: Math.floor(
            (nowTimeIST().getTime() + 1000 * 300) / 1000
          ),
          iat: Math.floor(nowTimeIST().getTime() / 1000),
        };
        return sign(payload, secretKey);
    } catch (error) {
        console.error("Error generating token:", error.message);
        return null;
    }
}

  

  // Verify token
  verifyToken(token,secretKey) {
    const alg='HS256';
  //  console.log('tokeeencnvcvc:',token,secretKey);
    try {
      const decoded = decode(token, secretKey, false);
      console.log('decodedd:',decoded);
      // Check expiration manually since some JWT libraries don't do it automatically
      const currentTime = Math.floor(this.nowTimeIST().getTime() / 1000);
    // console.log('time ::::::',currentTime,'other--->',decoded.exp);
      if (decoded.exp && decoded.exp <= currentTime) {
        return [false, {
          error: 'Token has expired',
          status: 1
        }];
      }

      return [true, decoded];
    } catch (error) {
      return [false, {
        error: 'Invalid token',
        status: 1
      }];
    }
  }

  // Set custom token expiry time
  setTokenExpiry(seconds) {
    this.tokenExpirySeconds = seconds;
  }
}

// Export utility functions that can be used directly
export const generateToken = (apiKey,secretKey) => {
  const manager = SecurityTokenManager.getInstance();
  return manager.generateServiceToken(apiKey,secretKey);
};

export const verifyToken = (token,secretKey) => {
  const manager = SecurityTokenManager.getInstance();
  return manager.verifyToken(token,secretKey);
};

export const setTokenExpiry = (seconds) => {
  const manager = SecurityTokenManager.getInstance();
  manager.setTokenExpiry(seconds);
};

export const getISTTime = () => {
  const manager = SecurityTokenManager.getInstance();
  return manager.nowTimeIST();
};

// Export lazy getter — avoids crash at module load time when env vars are missing
export const getTokenManager = () => SecurityTokenManager.getInstance();