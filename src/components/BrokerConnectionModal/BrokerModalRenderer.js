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

// SDK pilot rolled back here on 2026-04-27 — broker CONNECT UX has too
// many per-broker quirks (Zerodha apiKey-from-config, AliceBlue OTP
// intercept, Kotak +91 normalisation, Angel One booking flow) that
// the legacy modals already handle correctly. Reinventing them in a
// schema-driven SDK form lost the inline instructions / WebView /
// help-content panels users rely on.
//
// The SDK pilot is now scoped to the data plane: session token mint
// + /sdk/v1/user/status, /sdk/v1/portfolios/*, /sdk/v1/rebalance/*,
// /sdk/v1/connections/:broker/sell-auth — the parts where there is
// no UI gap to bridge. Broker connect stays on the legacy modals; we
// can incrementally swap their internal API calls (axios →
// /api/user/connect-broker) to /sdk/v1/connections/:broker/connect
// without changing UI in a follow-up PR.
//
// SdkBrokerTestScreen (reachable via REACT_APP_SDK_BROKER_TEST_FIRST)
// still exists for SDK form / WebView component verification.

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
