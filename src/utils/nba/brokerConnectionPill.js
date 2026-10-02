import {BROKER_STATUS} from './brokerStatus';

/** Stored credentials are "linked"; only a successful live probe is "live". */
export const brokerConnectionPill = ({
  brokerState,
  liveVerified = false,
  fundsError,
  accountRecovery,
}) => {
  if (brokerState === BROKER_STATUS.TOKEN_EXPIRED) {
    return {tone: 'amber', label: 'Broker Expired'};
  }
  if (brokerState === BROKER_STATUS.NOT_CONNECTED) {
    return {tone: 'grey', label: 'Broker —'};
  }
  if (brokerState === BROKER_STATUS.MANUAL) {
    return {tone: 'grey', label: 'Broker Manual'};
  }
  if (brokerState === BROKER_STATUS.OK && accountRecovery?.blocked === true) {
    return {tone: 'amber', label: 'Broker Linked · Check'};
  }
  if (brokerState === BROKER_STATUS.OK && liveVerified && !fundsError) {
    return {tone: 'green', label: 'Broker Live'};
  }
  if (brokerState === BROKER_STATUS.OK) {
    return {tone: fundsError ? 'amber' : 'grey', label: 'Broker Linked'};
  }
  return {tone: 'grey', label: 'Broker —'};
};
