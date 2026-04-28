// components/BrokerModals.js
import React from 'react';
import IIFLModal from '../../components/iiflmodal';
import ICICIUPModal from '../../components/BrokerConnectionModal/icicimodal';
import UpstoxModal from '../../components/BrokerConnectionModal/upstoxModal';
import AngleOneBookingTrueSheet from '../../components/BrokerConnectionModal/AngleoneBookingModal';
import MotilalModal from '../../components/BrokerConnectionModal/MotilalModal';
import ZerodhaConnectModal from '../../components/BrokerConnectionModal/ZerodhaConnectModal';
import HDFCconnectModal from '../../components/BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from '../../components/BrokerConnectionModal/DhanConnectModal';
import AliceBlueConnect from '../../components/BrokerConnectionModal/AliceBlueConnect';
import FyersConnect from '../../components/BrokerConnectionModal/FyersConnect';
import KotakModal from '../../components/BrokerConnectionModal/KotakModal';

const GlobalBrokerModals = ({
  broker,
  visible,
  setVisible,
  setShowBrokerModal,
  fetchBrokerStatusModal
}) => {
  if (!visible) return null;
  console.log('broker i get')
  const commonProps = {
    isVisible: visible,
    onClose: () => setVisible(false),
    setShowBrokerModal,
    fetchBrokerStatusModal,
  };

  const modals = {
    IIFL: <IIFLModal {...commonProps} setShowBrokerModal={setShowBrokerModal} />,
    ICICI: <ICICIUPModal {...commonProps} setShowICICIUPModal={setVisible} />,
    Upstox: <UpstoxModal {...commonProps} setShowupstoxModal={setVisible} />,
    AngleOne: <AngleOneBookingTrueSheet {...commonProps} setShowangleoneModal={setVisible} />,
    Motilal: <MotilalModal {...commonProps} setMotilalModal={setVisible} setShowBrokerModal={setShowBrokerModal} />,
    Zerodha: <ZerodhaConnectModal {...commonProps} setShowzerodhaModal={setVisible} />,
    HDFC: <HDFCconnectModal {...commonProps} setShowhdfcModal={setVisible} />,
    Dhan: <DhanConnectModal {...commonProps} setShowDhanModal={setVisible} />,
    Aliceblue: <AliceBlueConnect {...commonProps} setShowAliceblueModal={setVisible} />,
    Fyers: <FyersConnect {...commonProps} setShowFyersModal={setVisible} />,
    Kotak: <KotakModal {...commonProps} setShowKotakModal={setVisible} />,
  };

  return modals[broker] || null;
};

export default GlobalBrokerModals;
