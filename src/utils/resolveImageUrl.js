/**
 * Resolves a plan/course/strategy image path against the backend base URL.
 *
 * Historically `image` fields (plan.image, strategyDetails.image, etc.)
 * were relative paths that needed the backend base URL prepended. They
 * can now be FULL absolute URLs (e.g. `https://s3.alphaquark.in/...`) —
 * blindly prepending baseUrl onto an already-absolute URL produces a
 * broken, non-resolvable string (`https://<backend>https://s3...`).
 * This helper passes absolute URLs through unchanged and only prepends
 * baseUrl for legacy relative paths.
 *
 * @param {string|null|undefined} image - the raw image field value.
 * @param {string} baseUrl - backend base URL to prepend for relative paths.
 * @returns {string} resolved URL, or '' if image is falsy.
 */
export const resolveImageUrl = (image, baseUrl) => {
  if (!image) return '';
  return String(image).startsWith('http') ? image : `${baseUrl}${image}`;
};

export default resolveImageUrl;
