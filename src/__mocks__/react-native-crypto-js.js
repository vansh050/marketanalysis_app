/**
 * Mock for react-native-crypto-js
 * Provides a simple AES encrypt/decrypt for testing.
 */
const CryptoJS = {
  AES: {
    encrypt: jest.fn((text, key) => ({
      toString: () => `encrypted_${text}`,
    })),
    decrypt: jest.fn((encrypted, key) => ({
      toString: (encoding) => {
        if (typeof encrypted === 'string' && encrypted.startsWith('encrypted_')) {
          return encrypted.replace('encrypted_', '');
        }
        return encrypted || '';
      },
    })),
  },
  enc: {
    Utf8: 'utf8',
    Base64: 'base64',
  },
};

module.exports = CryptoJS;
module.exports.default = CryptoJS;
