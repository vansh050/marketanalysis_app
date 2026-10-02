// Match documented domain responses precisely; do not hide arbitrary 4xx/5xx failures.
export const isEmptyInvoiceResponse = error =>
  error?.response?.status === 404 &&
  error.response.data?.status === 1 &&
  error.response.data?.message === 'No invoices found';

export const isPortfolioAccessRestricted = error => {
  const {status, data} = error?.response || {};
  return (status === 402 && ['payment_required', 'payment_pending_review'].includes(data?.code)) ||
    (status === 403 && data?.code === 'not_entitled');
};
