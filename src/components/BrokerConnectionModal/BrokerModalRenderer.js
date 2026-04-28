// components/BrokerModalRenderer.js

import React from 'react';

import IIFLModal from '../iiflmodal';
import ICICIUPModal from './icicimodal';
import UpstoxModal from './upstoxModal';
import AngleOneBookingTrueSheet from './AngleoneBookingModal';
import MotilalModal from './MotilalModal';
import ZerodhaConnectModal from './ZerodhaConnectModal';
import HDFCconnectModal from './HDFCconnectModal';
import DhanConnectModal from './DhanConnectModal';
import AliceBlueConnect from './AliceBlueConnect';
import FyersConnect from './FyersConnect';
import KotakModal from './KotakModal';

const brokerModals = {
  iifl: IIFLModal,
  icici: ICICIUPModal,
  upstox: UpstoxModal,
  angelone: AngleOneBookingTrueSheet,
  motilal: MotilalModal,
  zerodha: ZerodhaConnectModal,
  Hdfc: HDFCconnectModal,
  dhan: DhanConnectModal,
  aliceblue: AliceBlueConnect,
  fyers: FyersConnect,
  Kotak: KotakModal,
};

const BrokerModalRenderer = ({ type, visible, onClose, commonProps = {} }) => {
  console.log('type here i get to open---',type);
  if (!type || !visible) return null;

  const ModalComponent = brokerModals[type];
  if (!ModalComponent) return null;

  return (
    <ModalComponent
      isVisible={visible}
      onClose={onClose}
      {...commonProps}
    />
  );
};

export default BrokerModalRenderer;
