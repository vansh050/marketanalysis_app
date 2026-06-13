import React from 'react';
import useModalStore from './modalStore';
import { useTrade } from '../screens/TradeContext';

import BrokerConnectModalDispatch from '../components/BrokerConnectionModal/BrokerConnectModalDispatch';
import BrokerDdpiHelpModal from '../components/BrokerDdpiHelpModal';

/**
 * ModalManager — handles modals opened via the Zustand `visibleModal`
 * store. For broker-connect modals, delegates to
 * BrokerConnectModalDispatch which centralizes Phase 3 SDK vs legacy
 * routing across both Zustand-driven and inline-render call sites.
 *
 * See:
 *   src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js
 *   docs/PHASE3_ARCHITECTURE.md § Routing rules
 */
const ModalManager = () => {
  const visibleModal = useModalStore((state) => state.visibleModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const setShowBrokerModal = useModalStore((state) => state.setShowBrokerModal);
  const modalPayload = useModalStore((state) => state.modalPayload);
  const { fetchBrokerStatusModal } = useTrade();

  if (!visibleModal) return null;

  if (visibleModal === 'DdpiHelp') {
    return (
      <BrokerDdpiHelpModal
        broker={modalPayload?.broker}
        visible={true}
        onClose={closeModal}
      />
    );
  }

  return (
    <BrokerConnectModalDispatch
      brokerName={visibleModal}
      isVisible={true}
      onClose={closeModal}
      setShowBrokerModal={setShowBrokerModal}
      fetchBrokerStatusModal={fetchBrokerStatusModal}
      reauthConfig={modalPayload?.reauthConfig || null}
    />
  );
};

export default ModalManager;
