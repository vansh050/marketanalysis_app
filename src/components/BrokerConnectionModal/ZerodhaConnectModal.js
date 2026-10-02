import React from 'react';
import ZerodhaConnectUI from '../../UIComponents/BrokerConnectionUI/ZerodhaConnectUI';
import eventEmitter from '../EventEmitter';

const ZerodhaConnectModal = ({
  isVisible,
  setShowzerodhaModal,
  onClose,
  fetchBrokerStatusModal,
  setShowBrokerModal,
  // Set by DeviceTotpReconnectGate when the customer chose quick reconnect
  // (TOTP) and Zerodha first needs one normal login to create the session.
  onBackToQuickReconnect,
}) => {
  const handleConnectionSuccess = () => {
    // Refresh broker status after successful connection
    if (fetchBrokerStatusModal) {
      fetchBrokerStatusModal();
    }
    // Emit refresh event to update portfolio data
    eventEmitter.emit('refreshEvent', { source: 'Zerodha broker connection' });
    // Close the broker modal
    if (setShowBrokerModal) {
      setShowBrokerModal(false);
    }
  };

  return (
    <ZerodhaConnectUI
      isVisible={isVisible}
      onClose={onClose}
      onConnectionSuccess={handleConnectionSuccess}
      quickReconnectPending={typeof onBackToQuickReconnect === 'function'}
      onBackToQuickReconnect={onBackToQuickReconnect}
    />
  );
};

export default ZerodhaConnectModal;
