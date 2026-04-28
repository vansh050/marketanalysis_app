/**
 * Authentication helpers for broker QA tests.
 * - JWT generation (HMAC-SHA256, IST timezone, 60s expiry)
 * - TOTP 6-digit code generation from base32 seed
 * - Standard request header construction
 *
 * JWT format matches prod aq-api.sh aq_generate_jwt() exactly.
 */
const crypto = require('crypto');
const {authenticator} = require('otplib');

/**
 * Generate aq-encrypted-key JWT token.
 * Matches prod-alphaquark cryptoUtils.js encryptApiKey().
 */
function generateJWT(apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    throw new Error('AQ_API_KEY and AQ_API_SECRET required');
  }

  // IST = UTC + 5:30 (19800 seconds)
  const now = Math.floor(Date.now() / 1000) + 19800;
  const exp = now + 60;

  const header = JSON.stringify({alg: 'HS256', typ: 'JWT'});
  const payload = JSON.stringify({apiKey, exp, iat: now});

  const b64url = (str) =>
    Buffer.from(str).toString('base64url');

  const h = b64url(header);
  const p = b64url(payload);
  const signingInput = `${h}.${p}`;

  const sig = crypto
    .createHmac('sha256', apiSecret)
    .update(signingInput)
    .digest('base64url');

  return `${h}.${p}.${sig}`;
}

/**
 * Generate 6-digit TOTP code from base32 seed.
 * Equivalent to: python3 -c "import pyotp; print(pyotp.TOTP('$secret').now())"
 */
function generateTOTP(secret) {
  if (!secret) throw new Error('TOTP secret required');
  return authenticator.generate(secret);
}

/**
 * Build standard request headers for AQ API calls.
 */
function getHeaders(subdomain, jwt) {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': subdomain,
    'aq-encrypted-key': jwt,
  };
}

module.exports = {generateJWT, generateTOTP, getHeaders};
