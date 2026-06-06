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
 */

import TradeReviewSheet from './TradeReviewSheet';
import TradeExecutionProgress from './TradeExecutionProgress';
import TradeResultModal from './TradeResultModal';
import SellAuthGate from './SellAuthGate';
import BrokerCredentialForm from './BrokerCredentialForm';
import BrokerWebViewHeader from './BrokerWebViewHeader';
import BrokerSelectionList from './BrokerSelectionList';
import ModifyInvestmentSheet from './ModifyInvestmentSheet';
import RebalancePnlChoice from './RebalancePnlChoice';
import KitePublisherHeader from './KitePublisherHeader';

export default {
  // Trade execution flow
  tradeReviewSheet: TradeReviewSheet,
  tradeExecutionProgress: TradeExecutionProgress,
  tradeResultModal: TradeResultModal,

  // Sell-auth flow
  sellAuthGate: SellAuthGate,

  // Broker connect flow
  brokerCredentialForm: BrokerCredentialForm,
  brokerWebViewHeader: BrokerWebViewHeader,
  brokerSelectionList: BrokerSelectionList,

  // Portfolio management
  modifyInvestmentSheet: ModifyInvestmentSheet,
  rebalancePnlChoice: RebalancePnlChoice,

  // Zerodha publisher
  kitePublisherHeader: KitePublisherHeader,
};
