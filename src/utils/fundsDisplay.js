const hasConfirmedCash = funds => {
  if (!funds || typeof funds !== 'object' || Array.isArray(funds)) {
    return false;
  }
  if (funds.status === 1 || funds.status === 2) {
    return false;
  }
  const value = funds?.data?.availablecash;
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
};

export const confirmedFundsSnapshot = funds =>
  hasConfirmedCash(funds)
    ? {funds, availableCash: Number(funds.data.availablecash), verifiedAt: Date.now()}
    : null;

export const availableCashText = ({broker, snapshot, loading}) => {
  if (!broker) {
    return 'N/A';
  }
  if (snapshot) {
    return `₹ ${snapshot.availableCash.toFixed(2)}`;
  }
  return loading ? 'Fetching…' : 'Unavailable';
};

export const fundsVerificationText = ({snapshot, loading, error}) => {
  if (loading && snapshot) {
    return 'Refreshing…';
  }
  if (error && snapshot) {
    return `Last verified ${new Date(snapshot.verifiedAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}`;
  }
  if (error) {
    return 'Could not verify with broker';
  }
  return '';
};

export {hasConfirmedCash};
