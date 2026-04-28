import CryptoJS from "react-native-crypto-js";
import { sha256 } from 'react-native-sha256'; // Correct import



// Function to derive key using SHA-256
const deriveKey = async (apiSecret) => {

  sha256("Test").then((hash) => {
    console.log(hash);  // Expected to log the SHA-256 hash of "Test"
  }).catch((error) => {
    console.error("SHA-256 errvcvor:", error);
  });

  try {
    console.log('apiSecret:', apiSecret);
    
    // Hash the apiSecret using SHA-256 and wait for the result
    const hash = await sha256(apiSecret);
    console.log("Derived Key (SHA-256):", hash);

    return hash; // Return the derived key
  } catch (error) {
    console.error("Error while deriving key:", error);
    return null;
  }
};

// Encrypt function
const encryptApiKey = async (apiKey, apiSecret) => {
  try {
    // Derive key asynchronously
    const key = await deriveKey(apiSecret);
    console.log('Derived Key:::::', key);

    if (!key) {
      throw new Error("Encryption failed: No key derived");
    }

    // Encrypt the API key
    const encrypted = CryptoJS.AES.encrypt(apiKey, key).toString();

    // Convert to Base64
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encrypted));
  } catch (error) {
    console.error("Encryption failedvuxvhxvxb:", error);
    return null;
  }
};

// Decrypt function
const decryptApiKey = async (encryptedKey, apiSecret) => {
  try {
    // Derive key asynchronously
    const key = await deriveKey(apiSecret);

    if (!key) {
      throw new Error("Decryption failed: No key derived");
    }

    // Decode Base64 and decrypt
    const encryptedUtf8 = CryptoJS.enc.Base64.parse(encryptedKey).toString(CryptoJS.enc.Utf8);
    const bytes = CryptoJS.AES.decrypt(encryptedUtf8, key);

    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};

export { encryptApiKey, decryptApiKey };
