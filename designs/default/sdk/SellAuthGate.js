/**
 * designs/default/sdk/SellAuthGate.js
 *
 * Default: re-exports the SDK's built-in SellAuthGate.
 * Props: { brokerName, userDetails, onAuthorized, onDeclined, onDdpiHelpRequested? }
 * MUST call onAuthorized() or onDeclined() to proceed.
 */
export { SellAuthGate as default } from '@alphaquark/mobile-sdk';
