export const FYERS_REDIRECT_MISMATCH = 'fyers_redirect_mismatch';

export const isFyersRedirectMismatch = value => {
  const compact = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return (
    compact.includes('redirecturlmismatch') ||
    compact.includes('redirecturimismatch')
  );
};
