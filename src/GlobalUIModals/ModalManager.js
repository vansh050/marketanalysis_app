import React from 'react';
import useModalStore from './modalStore';
import { useTrade } from '../screens/TradeContext';

// Lazy import modals
import IIFLModal from '../components/iiflmodal';
import ICICIUPModal from '../components/BrokerConnectionModal/icicimodal';
import UpstoxModal from '../components/BrokerConnectionModal/upstoxModal';
import AngleOneBookingTrueSheet from '../components/BrokerConnectionModal/AngleoneBookingModal';
import MotilalModal from '../components/BrokerConnectionModal/MotilalModal';
import ZerodhaConnectModal from '../components/BrokerConnectionModal/ZerodhaConnectModal';
import HDFCconnectModal from '../components/BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from '../components/BrokerConnectionModal/DhanConnectModal';
import AliceBlueConnect from '../components/BrokerConnectionModal/AliceBlueConnect';
import FyersConnect from '../components/BrokerConnectionModal/FyersConnect';
import KotakModal from '../components/BrokerConnectionModal/KotakModal';
import GrowwConnectModal from '../components/BrokerConnectionModal/GrowwConnectModal';
import AxisConnectModal from '../components/BrokerConnectionModal/AxisConnectModal';
import BrokerDdpiHelpModal from '../components/BrokerDdpiHelpModal';


const ModalManager = () => {
  const visibleModal = useModalStore((state) => state.visibleModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const setShowBrokerModal = useModalStore((state) => state.setShowBrokerModal);
  const modalPayload = useModalStore((state) => state.modalPayload);
  const { fetchBrokerStatusModal } = useTrade();

  const commonProps = {
    isVisible: true,
    onClose: closeModal,
    setShowBrokerModal,
    fetchBrokerStatusModal,
    // reauthConfig is set by ManageConnectionsModal's smart-reauth flow
    // for credential brokers (Upstox/ICICI/HDFC/Motilal/Fyers). When
    // present, the modal hydrates its WebView directly and skips the
    // credential form.
    reauthConfig: modalPayload?.reauthConfig || null,
  };

  const renderModal = () => {
    switch (visibleModal) {
      case 'ICICI':
        return <ICICIUPModal {...commonProps} />;
      case 'Upstox':
        return <UpstoxModal {...commonProps} />;
      case 'Angel One':
        return <AngleOneBookingTrueSheet {...commonProps} />;
      case 'Motilal':
        return <MotilalModal {...commonProps} />;
      case 'Zerodha':
        return <ZerodhaConnectModal {...commonProps} />;
      case 'HDFC':
        return <HDFCconnectModal {...commonProps} />;
      case 'Dhan':
        return <DhanConnectModal {...commonProps} />;
      case 'AliceBlue':
        return <AliceBlueConnect {...commonProps} />;
      case 'Fyers':
        return <FyersConnect {...commonProps} />;
      case 'Kotak':
        return <KotakModal {...commonProps} />;
      case 'Groww':
        return <GrowwConnectModal {...commonProps} />;
      case 'Axis Securities':
        return <AxisConnectModal {...commonProps} />;
      case 'IIFL':
      case 'IIFL Securities':
        return <IIFLModal {...commonProps} />;
      case 'DdpiHelp':
        // Per-broker DDPI activation help. Payload must carry {broker}.
        // Config lives in src/config/brokerDdpiHelp.js. Works across all
        // 14 brokers (falls back to render nothing if broker is unknown).
        return (
          <BrokerDdpiHelpModal
            broker={modalPayload?.broker}
            visible={true}
            onClose={closeModal}
          />
        );
      default:
        return null;
    }
  };

  return renderModal();
};

export default ModalManager;
