import { create } from 'zustand';
import eventEmitter from '../components/EventEmitter';

const useModalStore = create((set) => ({
  visibleModal: null,
  showBrokerModal: false,
  // Optional per-open payload — used by the smart re-auth flow to pass a
  // pre-signed OAuth URL + stored credentials to the per-broker modal so
  // it can skip the credential form and jump straight to the WebView
  // step. See src/utils/reauthHelpers.js.
  modalPayload: null,

  // Alert modal state
  alertVisible: false,
  alertType: 'error', // 'error', 'success', 'warning', 'info'
  alertTitle: '',
  alertMessage: '',

  openModal: (modalName, payload = null) => {
    // Emit event to close any other modals (like RebalancePreferenceModal)
    eventEmitter.emit('closeBrokerRelatedModals');
    set({ visibleModal: modalName, showBrokerModal: true, modalPayload: payload });
  },

  closeModal: () =>
    set({ visibleModal: null, showBrokerModal: false, modalPayload: null }),

  setShowBrokerModal: (value) => set({ showBrokerModal: value }),

  // Alert modal actions
  showAlert: (type, title, message) =>
    set({ alertVisible: true, alertType: type, alertTitle: title, alertMessage: message }),

  hideAlert: () =>
    set({ alertVisible: false, alertType: 'error', alertTitle: '', alertMessage: '' }),
}));

export default useModalStore;
