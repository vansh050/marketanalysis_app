/**
 * designs/default/sdk/TradeReviewSheet.js
 *
 * Default: re-exports the SDK's built-in TradeReviewSheet.
 * To customize: replace this file in designs/<variant>/sdk/ with
 * your own component that accepts the same props.
 *
 * Props: { trades[], brokerName?, totalEstimate?, isPlacing, onConfirm, onCancel }
 * MUST call onConfirm() or onCancel() to proceed.
 */
export { TradeReviewSheet as default } from '@alphaquark/mobile-sdk';
