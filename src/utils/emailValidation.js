/**
 * emailValidation — shared email normalisation, validation, and domain-typo
 * nudge ("Did you mean foo@gmail.com?") for every form that writes to
 * `clientlistdatas`.
 *
 * Closes the two long-standing prevention gaps in CUSTOMER_MASTER_ARCHITECTURE
 * §8:
 *   - Class D (internal-whitespace ghost): validateEmail rejects any input
 *     containing whitespace anywhere. normalizeEmail strips it defensively.
 *   - Class F (typo-at-renewal): suggestDomain detects common gateway/SMTP
 *     typos (gmail.co, gmial.com, yhoo.com, hotnail.com, etc.) and returns a
 *     corrected suggestion the UI can render as a non-blocking nudge.
 *
 * No external deps — the typo list is small and local so we avoid pulling in
 * mailcheck.js (~9KB + maintenance).
 */

// Same shape regex used by AddClientForm, CorrectEmailModal, AssignCourseModal,
// LeadCaptureModal — kept identical so behaviour is consistent everywhere.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize an email key for storage / comparison:
 *   - lower-case
 *   - strip ALL whitespace (email addresses cannot legally contain spaces)
 *
 * Returns "" for null / undefined / non-string input so callers can compare
 * defensively.
 */
export const normalizeEmail = (raw) =>
  typeof raw === 'string' ? raw.toLowerCase().replace(/\s+/g, '') : '';

/**
 * validateEmail(raw) → { ok, error?, normalized }
 *   ok=true means the input looks like a real email AND has no internal
 *   whitespace. `normalized` is the lower-cased + space-stripped form, safe
 *   to send to the backend.
 *
 *   ok=false carries an `error` string suitable for inline form display.
 *   Distinguishes between "empty", "has internal whitespace", "wrong shape".
 */
export const validateEmail = (raw) => {
  if (raw == null || raw === '') {
    return { ok: false, error: 'Email is required', normalized: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Invalid email', normalized: '' };
  }
  // Detect whitespace separately so we can give a precise error — useful when
  // someone pastes "foo@gmail. com" and would otherwise just see a generic
  // "invalid format" message and not know why.
  if (/\s/.test(raw)) {
    return {
      ok: false,
      error: 'Email cannot contain spaces',
      normalized: normalizeEmail(raw),
    };
  }
  if (!EMAIL_REGEX.test(raw.trim())) {
    return { ok: false, error: 'Enter a valid email address', normalized: raw.trim().toLowerCase() };
  }
  return { ok: true, normalized: raw.trim().toLowerCase() };
};

// Common domain typos seen in production clientlistdatas ghost rows.
// Format: typo → correct. Add entries here as new patterns surface.
const DOMAIN_TYPOS = {
  // gmail
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.in': 'gmail.com',
  // yahoo
  'yhoo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  // hotmail / outlook
  'hotnail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  // rediffmail / rocketmail / icloud
  'redifmail.com': 'rediffmail.com',
  'redifff.com': 'rediffmail.com',
  'rocketmail.co': 'rocketmail.com',
  'icloud.co': 'icloud.com',
  'icoud.com': 'icloud.com',
  // common India TLDs
  'yahoo.co.n': 'yahoo.co.in',
  'gmail.co.in': 'gmail.com',
};

/**
 * suggestDomain(raw) → { suggestion: string | null }
 *   If the email's domain (substring after "@") matches a known-typo entry,
 *   returns the corrected full email. Otherwise null. Case-insensitive on
 *   the domain match; preserves the local-part (lower-cased) so the suggestion
 *   is paste-ready.
 *
 *   Returns null for inputs with no "@" or with multiple "@".
 */
export const suggestDomain = (raw) => {
  if (typeof raw !== 'string') return { suggestion: null };
  const trimmed = raw.trim();
  if (!trimmed.includes('@')) return { suggestion: null };
  const parts = trimmed.split('@');
  if (parts.length !== 2) return { suggestion: null };
  const local = parts[0].toLowerCase();
  const domain = parts[1].toLowerCase();
  if (!local || !domain) return { suggestion: null };
  const correct = DOMAIN_TYPOS[domain];
  if (correct && correct !== domain) {
    return { suggestion: `${local}@${correct}` };
  }
  return { suggestion: null };
};
