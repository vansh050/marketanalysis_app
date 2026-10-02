/**
 * designs/default/sdk/ — SDK widget defaults for the default variant.
 *
 * Each file re-exports the SDK's built-in widget OR provides a
 * standalone default implementation. A custom variant at
 * designs/<variant>/sdk/ overrides any of these by exporting its
 * own component with the same key.
 *
 * To customize for your variant:
 *   1. Copy the file you want to change to designs/<variant>/sdk/
 *   2. Replace the component implementation
 *   3. Export it from designs/<variant>/sdk/index.js
 *   4. The SdkProviderRoot picks it up automatically via useDesign().sdk
 *
 * See docs/SDK_DESIGN_PASSTHROUGH.md § 9 for props contracts.
 *
 * 2026-10-01 — the SDK now CONSUMES every slot (presentation-only overrides;
 * the SDK keeps the logic). A value here therefore changes what AlphaPro
 * renders. `null` = "use the SDK built-in", which is what AlphaPro has always
 * shown. The standalone BrokerWebViewHeader / KitePublisherHeader /
 * RebalancePnlChoice / BrokerSelectionList files stay as starting points for
 * a custom variant to copy; registering them here would switch AlphaPro to
 * untested chrome. Entries that re-export an SDK widget are ignored by the
 * SDK's resolveSlot guard (no recursion). Pinned by
 * src/__tests__/sdkSlotPassthrough.render.test.js.
 */

import TradeReviewSheet from './TradeReviewSheet';
import TradeExecutionProgress from './TradeExecutionProgress';
import TradeResultModal from './TradeResultModal';
import SellAuthGate from './SellAuthGate';
import BrokerCredentialForm from './BrokerCredentialForm';
// Reference implementations for custom variants (not registered by default):
// ./BrokerWebViewHeader, ./BrokerSelectionList, ./RebalancePnlChoice,
// ./KitePublisherHeader.
import ModifyInvestmentSheet from './ModifyInvestmentSheet';

export default {
  // Trade execution flow
  tradeReviewSheet: TradeReviewSheet,
  tradeExecutionProgress: TradeExecutionProgress,
  tradeResultModal: TradeResultModal,

  // Sell-auth flow
  sellAuthGate: SellAuthGate,

  // Broker connect flow
  brokerCredentialForm: BrokerCredentialForm,
  brokerWebViewHeader: null, // SDK built-in (see header note)
  brokerSelectionList: null, // reserved: the SDK has no broker-picker widget

  // Portfolio management
  modifyInvestmentSheet: ModifyInvestmentSheet,
  rebalancePnlChoice: null, // SDK built-in

  // Zerodha publisher
  kitePublisherHeader: null, // SDK built-in
};
