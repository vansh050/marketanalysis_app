import React from 'react';
import ZerodhaConnectUI from '../../UIComponents/BrokerConnectionUI/ZerodhaConnectUI';
import eventEmitter from '../EventEmitter';

const ZerodhaConnectModal = ({
  isVisible,
  setShowzerodhaModal,
  onClose,
  fetchBrokerStatusModal,
  setShowBrokerModal,
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
    />
  );
};

export default ZerodhaConnectModal;
