const normalizeBroker = value => String(value || '').trim().toLowerCase();

export const getBasketBrokerOwnership = (basketLifecycle, currentBroker) => {
  const positionBrokers = Array.isArray(basketLifecycle?.positionBrokers)
    ? basketLifecycle.positionBrokers.filter(Boolean)
    : basketLifecycle?.positionBroker
      ? [basketLifecycle.positionBroker]
      : [];
  const current = normalizeBroker(currentBroker);
  const matchesCurrent = positionBrokers.some(
    item => normalizeBroker(item) === current,
  );
  const hasKnownOwner = positionBrokers.length > 0;
  return {
    positionBrokers,
    positionBroker:
      basketLifecycle?.positionBroker ||
      (positionBrokers.length === 1 ? positionBrokers[0] : null),
    hasKnownOwner,
    mismatch: hasKnownOwner && Boolean(current) && !matchesCurrent,
    ambiguous:
      basketLifecycle?.brokerOwnershipAmbiguous === true ||
      positionBrokers.length > 1,
  };
};
