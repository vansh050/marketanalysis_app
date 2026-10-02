/** Publisher handoff contract; see docs/MODEL_PORTFOLIO_ARCHITECTURE.md. */
export const PUBLISHER_ACK_TIMEOUT_MS = 15000;

export const isPublisherActivationAcknowledged = response =>
  response?.status === 0 &&
  response?.recorded === true &&
  response?.reconciliationEnrolled === true &&
  response?.allowExecution !== false;
